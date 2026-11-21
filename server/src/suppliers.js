// Supplier catalogues. Two kinds of online shop publish their full product lists in a machine-readable way:
//   Shopify  (e.g. am-wrangler.com)   GET  /products.json?limit=250&page=N
//   Magento  (e.g. offroad-zone.com)  POST /graphql  products(search:"")
// Their lists are copied here once a day (and on demand) so the owner can search, compare and pick
// products, and see price changes. Other shops (Titan, Ramy) are kept as manual suppliers: the owner
// pastes a link and price. Nothing here gets around a site's protections; requests are slow and identified.
import { logActivity, writeRow } from './store.js';

export const UA = '4x4WheelsOman-Supplier-Sync/1.0 (+https://a7hraf.github.io/4x4wheelsoman/)';
const pauseMs = () => Number(process.env.SYNC_PAUSE_MS || 1200);
const MAX_PAGES = 80;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const skey = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const now = () => Date.now();

function origin(u) { try { const x = new URL(u); if (x.protocol !== 'https:' && x.protocol !== 'http:') return ''; return x.origin; } catch { return ''; } }
function base(u) { try { const x = new URL(u); return x.origin + x.pathname.replace(/\/+$/, ''); } catch { return ''; } }
// Supplier addresses come from the owner; still refuse anything that points inside our own network.
export function safeUrl(u) {
  let x; try { x = new URL(u); } catch { return false; }
  if (x.protocol !== 'https:') return false;
  const h = x.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.railway.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h.startsWith('[')) return false;
  return true;
}

// A busy shop sometimes refuses a request (403/429/5xx) and accepts it a few seconds later: try up to 3 times.
const retryMs = () => (process.env.SYNC_RETRY_MS || '4000,12000').split(',').map(Number);
async function getJSON(fetchImpl, url, opts) {
  for (let i = 0; ; i++) {
    try { return await getJSONOnce(fetchImpl, url, opts); }
    catch (e) { const w = retryMs(); if (!e.retry || i >= w.length) throw e; await sleep(w[i]); }
  }
}
async function getJSONOnce(fetchImpl, url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    // follow at most 3 redirects, and only to public https addresses
    let r, target = url;
    for (let hop = 0; ; hop++) {
      if (!safeUrl(target)) throw new Error('Refused address ' + new URL(target).host);
      const o = Object.assign({}, opts || {}); delete o.asText;
      r = await fetchImpl(target, Object.assign({ signal: ctl.signal }, o, { redirect: 'manual', headers: Object.assign({ 'User-Agent': UA, Accept: opts && opts.asText ? 'text/html,application/xml;q=0.9,*/*;q=0.8' : 'application/json' }, (opts && opts.headers) || {}) }));
      const loc = r.status >= 300 && r.status < 400 && r.headers && r.headers.get('location');
      if (!loc) break;
      if (hop >= 3) throw new Error('Too many redirects');
      target = new URL(loc, target).href;
    }
    if (!r.ok) throw Object.assign(new Error(`${new URL(url).host} answered ${r.status}`), { retry: [403, 408, 425, 429, 500, 502, 503, 504].includes(r.status) });
    const text = await r.text();
    if (text.length > 25e6) throw new Error('Response too large');
    if (opts && opts.asText) return text;
    try { return JSON.parse(text); } catch { throw new Error(`${new URL(url).host} did not return data (it may block automatic access)`); }
  } finally { clearTimeout(t); }
}

// ---- Shopify ----
const strip = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export async function fetchShopify(site, fetchImpl, onPage) {
  const b = origin(site); const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const d = await getJSON(fetchImpl, `${b}/products.json?limit=250&page=${page}`);
    const prods = (d && d.products) || [];
    if (!prods.length) break;
    for (const p of prods.filter(x => x && typeof x === 'object')) {
      const img = (p.images && p.images[0] && p.images[0].src) || '';
      const multi = (p.variants || []).length > 1;
      for (const v of (p.variants || []).filter(Boolean)) {
        const sku = String(v.sku || '').trim() || `${p.handle}${multi ? '#' + v.id : ''}`;
        const vImg = v.featured_image && v.featured_image.src;
        items.push({
          sku, title: p.title + (multi && v.title && v.title !== 'Default Title' ? ' – ' + v.title : ''), vendor: p.vendor || '', ptype: p.product_type || '',
          tags: (Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',')).map(s => String(s).trim()).filter(Boolean).slice(0, 15).join(', '),
          price: Number(v.price) || 0, compare_at: v.compare_at_price ? Number(v.compare_at_price) : null, available: !!v.available,
          url: `${b}/products/${p.handle}?variant=${v.id}`, image: vImg || img, desc: strip(p.body_html).slice(0, 400)
        });
      }
    }
    if (onPage) onPage(page, items.length);
    if (prods.length < 250) break;
    await sleep(pauseMs());
  }
  return items;
}

// ---- Magento 2 (GraphQL) ----
const MAGENTO_Q = `query($p:Int!){products(search:"",pageSize:100,currentPage:$p){total_count page_info{total_pages} items{sku name url_key stock_status small_image{url} price_range{minimum_price{final_price{value currency} regular_price{value}}}}}}`;
export function magentoEndpoint(site) {
  const b = base(site);
  // offroad-zone.com/en → offroad-zone.com/en/graphql (store view in the path)
  return b + '/graphql';
}
export async function fetchMagento(site, fetchImpl, onPage) {
  const ep = magentoEndpoint(site); const b = base(site); const items = [];
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
    const d = await getJSON(fetchImpl, ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: MAGENTO_Q, variables: { p: page } }) });
    if (d && d.errors && !d.data) throw new Error('Magento: ' + (d.errors[0] && d.errors[0].message));
    const res = d && d.data && d.data.products;
    if (!res) break;
    pages = (res.page_info && res.page_info.total_pages) || 1;
    // Magento sends null for products it can't show (disabled, hidden or broken entries): skip them
    for (const it of (res.items || []).filter(x => x && typeof x === 'object')) {
      const mp = it.price_range && it.price_range.minimum_price;
      const fp = mp && mp.final_price, rp = mp && mp.regular_price;
      const suffix = '/'; // offroad-zone.com: /en/<url_key>/
      items.push({
        sku: String(it.sku || '').trim() || it.url_key, title: it.name || it.sku, vendor: '', ptype: '', tags: '',
        price: fp ? Number(fp.value) || 0 : 0, compare_at: rp && fp && rp.value > fp.value ? Number(rp.value) : null, currency: fp && fp.currency,
        available: it.stock_status === 'IN_STOCK', url: it.url_key ? `${b}/${it.url_key}${suffix}` : b,
        image: (it.small_image && it.small_image.url && !/placeholder/i.test(it.small_image.url)) ? it.small_image.url : ''
      });
    }
    if (onPage) onPage(page, items.length, pages);
    if (page < pages) await sleep(pauseMs());
  }
  return items;
}

// ---- Sitemap (e.g. titanperformanceuae.com): the full product list without prices ----
// The site publishes every product URL for search engines; names and part numbers come from the address.
const titleFromSlug = (slug) => slug.replace(/-[0-9a-f]{6}$/i, '').split('-').map(w => /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export async function fetchSitemap(site, fetchImpl) {
  const o = origin(site); const seen = new Set(); const items = [];
  const queue = [o + '/sitemap.xml'];
  for (let n = 0; queue.length && n < 20; n++) {
    const xml = await getJSON(fetchImpl, queue.shift(), { asText: true });
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
    if (/<sitemapindex/i.test(xml)) { locs.filter(u => /product/i.test(u) || locs.length < 6).forEach(u => queue.push(u)); continue; }
    for (const u of locs) {
      const m = /\/products?\/([^/?#]+)\/?$/.exec(u);
      if (!m || seen.has(m[1])) continue; seen.add(m[1]);
      const slug = decodeURIComponent(m[1]);
      const pn = /^(\d[\d-]*\d|\d+)-/.exec(slug);
      items.push({ sku: slug, partNo: pn ? pn[1] : '', title: titleFromSlug(pn ? slug.slice(pn[0].length) : slug) + (pn ? ' (' + pn[1] + ')' : ''), vendor: '', ptype: '', tags: '', price: null, compare_at: null, available: null, url: u, image: '' });
    }
    if (queue.length) await sleep(pauseMs());
  }
  return items;
}

// ---- One product page (e.g. ramyautomotive.com): name, code, price and stock from the page itself ----
const decode = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
const num = (v) => { if (v == null) return null; const n = parseFloat(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; };
export function parseProductPage(html, url) {
  const out = { url, title: '', sku: '', price: null, currency: '', available: null, image: '', vendor: '' };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const all = [].concat(j['@graph'] || j);
    const prod = all.find(x => x && /Product/i.test([].concat(x['@type']).join(',')));
    if (!prod) continue;
    const offer = [].concat(prod.offers || [])[0] || {};
    const o2 = offer.offers ? [].concat(offer.offers)[0] : offer;
    out.title = out.title || decode(prod.name);
    out.sku = out.sku || decode(prod.sku || prod.mpn || '');
    out.price = out.price != null ? out.price : num(o2.price != null ? o2.price : offer.lowPrice);
    out.currency = out.currency || o2.priceCurrency || offer.priceCurrency || '';
    if (o2.availability) out.available = /InStock|LimitedAvailability|OnlineOnly/i.test(o2.availability);
    out.image = out.image || (typeof prod.image === 'string' ? prod.image : [].concat(prod.image || [])[0] && ([].concat(prod.image)[0].url || [].concat(prod.image)[0])) || '';
    out.vendor = out.vendor || decode(prod.brand && (prod.brand.name || prod.brand)) || '';
  }
  const meta = (prop) => { const m = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, 'i').exec(html); return m ? decode(m[1] || m[2]) : ''; };
  out.title = out.title || meta('og:title') || decode((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || '').replace(/<[^>]+>/g, '');
  if (out.price == null) out.price = num(meta('product:price:amount') || meta('price') || (/data-price-amount=["']([\d.]+)["']/i.exec(html) || [])[1]);
  out.currency = out.currency || meta('product:price:currency') || meta('priceCurrency') || ((/\b(AED|OMR|SAR|USD)\b\s*[\d,]+\.\d{2}/.exec(html) || [])[1]) || '';
  out.image = out.image || meta('og:image');
  if (!out.sku) { const m = /itemprop=["']sku["'][^>]*>([^<]+)</i.exec(html) || /itemprop=["']sku["'][^>]*content=["']([^"']+)/i.exec(html) || /\bSKU\s*:?\s*<\/?[^>]*>\s*([A-Za-z0-9][\w.\-/]{1,40})/i.exec(html) || /\bSKU:\s*([A-Za-z0-9][\w.\-/]{1,40})/i.exec(html); if (m) out.sku = decode(m[1]); }
  if (out.available == null) {
    const av = meta('product:availability') || meta('availability');
    if (av) out.available = /in ?stock|instock/i.test(av);
    else if (/class=["'][^"']*\bstock\b[^"']*\bunavailable\b|out of stock|coming soon/i.test(html)) out.available = false;
    else if (/class=["'][^"']*\bstock\b[^"']*\bavailable\b|in stock|add to cart/i.test(html)) out.available = true;
  }
  out.title = out.title.replace(/\s*\|\s*[^|]+$/, '').slice(0, 300);
  return out;
}
export async function readProductPage(url, fetchImpl) {
  if (!safeUrl(url)) throw Object.assign(new Error('Use a full https:// product link.'), { status: 400 });
  const html = await getJSON(fetchImpl, url, { asText: true });
  if (/cf-chl|challenge-platform|Just a moment\.\.\./i.test(html) && !/application\/ld\+json/i.test(html)) throw Object.assign(new Error('The supplier site asked for a browser check, so the page could not be read. Enter the details by hand.'), { status: 422 });
  const p = parseProductPage(html, url);
  if (!p.title && p.price == null) throw Object.assign(new Error('No product details found on that page (it may load them in the browser). Enter the details by hand.'), { status: 422 });
  return p;
}

// Find out what kind of shop a supplier website is.
export async function detect(url, fetchImpl) {
  if (!safeUrl(url)) return { platform: 'manual', note: 'Use a full https:// address.' };
  const o = origin(url), b = base(url);
  try { const d = await getJSON(fetchImpl, `${o}/products.json?limit=1`); if (d && Array.isArray(d.products)) return { platform: 'shopify', feedUrl: o, note: 'Shopify shop: the full product list with prices and stock is copied automatically.' }; } catch {}
  for (const cand of [b, o]) {
    try {
      const d = await getJSON(fetchImpl, cand + '/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{products(search:"",pageSize:1){total_count}}' }) });
      if (d && d.data && d.data.products) return { platform: 'magento', feedUrl: cand, note: `Magento shop with ${d.data.products.total_count} products: copied automatically with prices and stock.` };
    } catch {}
  }
  try { const items = await fetchSitemap(o, fetchImpl); if (items.length >= 5) return { platform: 'sitemap', note: `The site lists ${items.length} products for search engines (names and links, no prices). Prices are entered when you add a product.` }; } catch {}
  return { platform: 'links', note: 'No open product list. Add products by pasting their link (details are read from the page when the site allows it), or import the supplier\'s price list.' };
}

// ---- store synced items, and log what changed ----
// partial: only some products were checked (product links, a partial price list) → don't treat the rest as removed.
export async function saveItems(pool, supplierId, currency, items, opts = {}) {
  const t = now(); let changed = 0, added = 0;
  const client = await pool.connect();
  const log = [];
  try {
    await client.query('BEGIN');
    const old = new Map((await client.query('SELECT sku, price, available, removed, title, url FROM supplier_items WHERE supplier_id=$1', [supplierId])).rows.map(r => [r.sku, r]));
    const first = old.size === 0;
    const seen = new Set();
    for (const it of items) {
      if (!it || !it.sku || seen.has(it.sku)) continue; seen.add(it.sku);
      const prev = old.get(it.sku);
      const price = it.price == null || !Number.isFinite(Number(it.price)) ? null : Number(it.price);
      const avail = it.available == null ? null : !!it.available;
      if (!prev) { added++; if (!first) log.push({ kind: 'new', it, price }); }
      else {
        const pp = prev.price == null ? null : Number(prev.price);
        if (pp != null && price != null && Math.abs(pp - price) > 0.0001) { changed++; log.push({ kind: price > pp ? 'price_up' : 'price_down', it, old: pp, price }); }
        if (prev.removed) log.push({ kind: 'back', it, price });
        else if (prev.available === true && avail === false) log.push({ kind: 'out', it, price });
        else if (prev.available === false && avail === true) log.push({ kind: 'back', it, price });
      }
      await client.query(`INSERT INTO supplier_items (supplier_id,sku,skey,title,vendor,ptype,tags,price,compare_at,currency,available,url,image,first_seen,last_seen,part_no,removed)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,false)
        ON CONFLICT (supplier_id,sku) DO UPDATE SET skey=EXCLUDED.skey,title=EXCLUDED.title,vendor=EXCLUDED.vendor,ptype=EXCLUDED.ptype,tags=EXCLUDED.tags,
          compare_at=EXCLUDED.compare_at,currency=EXCLUDED.currency,available=EXCLUDED.available,url=EXCLUDED.url,image=COALESCE(NULLIF(EXCLUDED.image,''),supplier_items.image),last_seen=EXCLUDED.last_seen,
          part_no=EXCLUDED.part_no, removed=false,
          prev_price=CASE WHEN EXCLUDED.price IS NOT NULL AND supplier_items.price IS NOT NULL AND supplier_items.price <> EXCLUDED.price THEN supplier_items.price ELSE supplier_items.prev_price END,
          price_changed_at=CASE WHEN EXCLUDED.price IS NOT NULL AND supplier_items.price IS NOT NULL AND supplier_items.price <> EXCLUDED.price THEN EXCLUDED.last_seen ELSE supplier_items.price_changed_at END,
          price=COALESCE(EXCLUDED.price, supplier_items.price)`,
      [supplierId, String(it.sku).slice(0, 200), skey(it.partNo || it.sku), String(it.title || it.sku).slice(0, 300), String(it.vendor || '').slice(0, 100), String(it.ptype || '').slice(0, 100), String(it.tags || '').slice(0, 500), price, it.compare_at == null ? null : Number(it.compare_at), it.currency || currency || 'AED', avail, String(it.url || '').slice(0, 500), String(it.image || '').slice(0, 500), t, String(it.partNo || '').slice(0, 60)]);
    }
    // products no longer listed by the supplier: kept for history, marked removed
    let gone = [];
    if (!opts.partial && items.length) {
      gone = [...old.values()].filter(r => !seen.has(r.sku) && !r.removed);
      if (gone.length) await client.query('UPDATE supplier_items SET available=false, removed=true WHERE supplier_id=$1 AND sku = ANY($2)', [supplierId, gone.map(r => r.sku)]);
      gone.forEach(r => log.push({ kind: 'removed', it: { sku: r.sku, title: r.title, url: r.url }, old: r.price == null ? null : Number(r.price), price: null }));
    }
    for (const l of log.slice(0, 5000)) {
      await client.query('INSERT INTO supplier_changes (supplier_id, sku, kind, title, url, old_price, new_price, currency, at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [supplierId, String(l.it.sku).slice(0, 200), l.kind, String(l.it.title || '').slice(0, 300), String(l.it.url || '').slice(0, 500), l.old == null ? null : l.old, l.price == null ? null : l.price, l.it.currency || currency || 'AED', t]);
    }
    await client.query('COMMIT');
    const count = (k) => log.filter(l => l.kind === k).length;
    return { total: seen.size, added, changed, gone: gone.length, first, log: { new: count('new'), removed: count('removed'), price_up: count('price_up'), price_down: count('price_down'), out: count('out'), back: count('back') } };
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}

// ---- after a sync: products I sell whose supplier ran out ----
// The product's preferred source decides. Products get supplierOut=true/false; the website then hides them or
// shows "on order" (owner's choice), unless there is stock in the shop.
export async function applyAvailability(pool, supplierId) {
  const prods = (await pool.query("SELECT id, data FROM rows WHERE col='products' AND NOT deleted AND data->'sources' @> $1::jsonb", [JSON.stringify([{ supplierId }])])).rows;
  let n = 0;
  for (const r of prods) {
    const p = r.data; const srcs = p.sources || [];
    const src = srcs.find(x => x.preferred) || srcs[0];
    if (!src || src.supplierId !== supplierId || !src.sku) continue;
    const it = (await pool.query('SELECT available, removed, price FROM supplier_items WHERE supplier_id=$1 AND sku=$2', [supplierId, src.sku])).rows[0];
    if (!it || it.available == null) continue;
    const out = it.available === false || it.removed;
    if (!!p.supplierOut === out) continue;
    const next = Object.assign({}, p, { supplierOut: out, supplierOutAt: out ? now() : null });
    await writeRow(pool, { id: 'system' }, 'products', r.id, next); n++;
  }
  if (n) clearAvailabilityCache();
  return n;
}

const running = new Set();
const AUTO = ['shopify', 'magento', 'sitemap'];
export async function syncSupplier(pool, sup, fetchImpl, user) {
  if (!sup || !AUTO.concat('links').includes(sup.platform)) throw Object.assign(new Error('This supplier has no automatic catalog. Add products by link, or import a price list.'), { status: 400 });
  const site = sup.feedUrl || sup.website;
  if (!safeUrl(site)) throw Object.assign(new Error('Supplier website must be a public https:// address.'), { status: 400 });
  if (running.has(sup.id)) throw Object.assign(new Error('A sync for this supplier is already running.'), { status: 409 });
  running.add(sup.id);
  const run = (await pool.query('INSERT INTO sync_runs (supplier_id, started_at) VALUES ($1,$2) RETURNING id', [sup.id, now()])).rows[0].id;
  try {
    let items, partial = false;
    if (sup.platform === 'shopify') items = await fetchShopify(site, fetchImpl);
    else if (sup.platform === 'magento') items = await fetchMagento(site, fetchImpl);
    else if (sup.platform === 'sitemap') items = await fetchSitemap(site, fetchImpl);
    else { items = await checkLinks(pool, sup, fetchImpl); partial = true; }
    if (!items.length && !partial) throw new Error('No products were returned.');
    const res = await saveItems(pool, sup.id, sup.currency || 'AED', items, { partial });
    if (sup.platform === 'sitemap') { // linked products of a sitemap shop: read their own pages when the site allows
      const extra = await checkLinks(pool, sup, fetchImpl);
      if (extra.length) await saveItems(pool, sup.id, sup.currency || 'AED', extra, { partial: true });
    }
    await applyAvailability(pool, sup.id);
    await pool.query('UPDATE sync_runs SET finished_at=$2, ok=true, items=$3, changed=$4 WHERE id=$1', [run, now(), res.total, res.changed]);
    await logActivity(pool, user || null, 'sync', 'suppliers', `Synced ${sup.name}: ${res.total} products, ${res.added} new, ${res.changed} price changes`, { supplierId: sup.id });
    console.log(`sync ${sup.name}: ${res.total} products, ${res.added} new, ${res.changed} price changes, ${res.gone} removed`);
    await notifyChanges(pool, sup, res);
    return Object.assign({ ok: true }, res);
  } catch (e) {
    await pool.query('UPDATE sync_runs SET finished_at=$2, ok=false, error=$3 WHERE id=$1', [run, now(), String(e.message).slice(0, 300)]);
    throw Object.assign(new Error(`Sync of ${sup.name} failed: ${e.message}`), { status: e.status || 502 });
  } finally { running.delete(sup.id); }
}
export const isRunning = (id) => running.has(id);

// Product pages of the products I buy from a supplier without an open catalog (checked daily).
async function checkLinks(pool, sup, fetchImpl) {
  const rows = (await pool.query("SELECT data FROM rows WHERE col='products' AND NOT deleted AND data->'sources' @> $1::jsonb", [JSON.stringify([{ supplierId: sup.id }])])).rows;
  const links = [];
  for (const r of rows) for (const s of r.data.sources || []) if (s.supplierId === sup.id && s.url && safeUrl(s.url) && !links.some(l => l.url === s.url)) links.push({ url: s.url, sku: s.sku || s.url, title: s.title || r.data.name });
  const out = [];
  for (const l of links.slice(0, 400)) {
    try { const p = await readProductPage(l.url, fetchImpl); out.push({ sku: l.sku, partNo: p.sku, title: p.title || l.title, vendor: p.vendor, price: p.price, currency: p.currency || sup.currency, available: p.available, url: l.url, image: p.image }); }
    catch (e) { /* page could not be read (blocked or loads in the browser): keep last known values */ }
    await sleep(Math.max(pauseMs(), process.env.SYNC_PAUSE_MS ? 0 : 2000));
  }
  return out;
}

// Tell the people who look after suppliers what changed (not on the very first copy).
async function notifyChanges(pool, sup, res) {
  if (res.first) return;
  const l = res.log; const total = l.new + l.removed + l.price_up + l.price_down + l.out + l.back;
  if (!total) return;
  const parts = [];
  if (l.price_up + l.price_down) parts.push(`${l.price_up + l.price_down} price changes`);
  if (l.new) parts.push(`${l.new} new`); if (l.removed) parts.push(`${l.removed} removed`);
  if (l.out) parts.push(`${l.out} out of stock`); if (l.back) parts.push(`${l.back} back in stock`);
  const { usersWith, notify } = await import('./notify.js');
  await notify(pool, await usersWith(pool, ['suppliers', 'pricing'], 'view'), { kind: 'supplier', title: `${sup.name}: ${parts.join(', ')}`, body: 'Review the changes and decide what to do with your products.', link: '#/sourcing/updates' });
}

// The suppliers the owner buys from. They are added to the shop's data automatically (once),
// and their catalogs are copied straight away, so products are there without any setup.
export const KNOWN = [
  { id: 'sup_amwrangler', name: 'AM Wrangler', website: 'https://am-wrangler.com', platform: 'shopify', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'Shopify online shop. Use "Open cart on website" to get a ready cart with the items, or send the list on WhatsApp. Prices on the site are in AED.' },
  { id: 'sup_offroadzone', name: 'Offroad Zone', website: 'https://www.offroad-zone.com/en', platform: 'magento', currency: 'AED', addVatPct: 5, country: 'UAE', howToOrder: 'Online shop (prices shown without 5% UAE VAT). Order on the website or send the list on WhatsApp.' },
  { id: 'sup_titan', name: 'Titan Performance', website: 'https://titanperformanceuae.com', platform: 'sitemap', currency: 'AED', addVatPct: 5, country: 'UAE', phone: '+97143368557', email: 'sales@titanperformanceuae.com', howToOrder: 'Full product list (names and part numbers) is copied from their website. Prices load only in the browser and the site says they may be inaccurate: confirm price and stock by WhatsApp/phone (+971 4 336 8557) before ordering. Prices on the site exclude 5% VAT.' },
  { id: 'sup_ramy', name: 'Ramy Automotive', website: 'https://www.ramyautomotive.com', platform: 'links', currency: 'AED', addVatPct: 0, country: 'UAE', phone: '+97142698138', howToOrder: 'No open product list. Add products by pasting the product link (name, code, price and stock are read from the page), or import their price list. Products you sell are re-checked every day. Phone +971 4 269 8138.' }
].map(k => Object.assign({ fxRate: 0, shippingPct: 10, fixedFee: 0, leadDays: 7, defaultMarkup: 35, roundTo: 1, active: true, contact: '', phone: '', whatsapp: '', email: '', paymentTerms: '', minOrder: 0, notes: '' }, k));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export async function ensureKnown(pool) {
  const n = (await pool.query('SELECT COUNT(*)::int AS n FROM rows')).rows[0].n;
  if (!n) return [];
  const have = await supplierRows(pool); const added = [];
  // suppliers added earlier as "manual" get their new catalog type (Titan: sitemap, Ramy: product links)
  for (const k of KNOWN) {
    const row = have.find(s => s && hostOf(s.website) === hostOf(k.website));
    if (row && row.platform === 'manual' && k.platform !== 'manual') {
      await writeRow(pool, { id: 'system' }, 'suppliers', row.id, Object.assign({}, row, { platform: k.platform, howToOrder: row.howToOrder || k.howToOrder, addVatPct: k.addVatPct }));
    }
  }
  const done = await pool.query("SELECT value FROM kv WHERE key='knownSuppliers'");
  if (done.rows.length) return [];
  for (const k of KNOWN) {
    if (have.some(s => s && hostOf(s.website) === hostOf(k.website))) continue;
    await writeRow(pool, { id: 'system' }, 'suppliers', k.id, k);
    added.push(k.name);
  }
  // only once: if the owner later deletes one, it is not added back
  await pool.query("INSERT INTO kv (key,value) VALUES ('knownSuppliers', $1) ON CONFLICT (key) DO NOTHING", [JSON.stringify({ at: now(), added })]);
  if (added.length) await logActivity(pool, null, 'team', 'suppliers', 'Added your suppliers: ' + added.join(', '));
  return added;
}
// Copy the catalog of every automatic supplier that has none yet (runs in the background).
let autoRunning = false;
export async function autoSync(pool, fetchImpl) {
  if (autoRunning) return; autoRunning = true;
  try {
    const counts = new Map((await pool.query('SELECT supplier_id, COUNT(*)::int AS n FROM supplier_items GROUP BY 1')).rows.map(r => [r.supplier_id, r.n]));
    for (const s of await supplierRows(pool)) {
      if (!s || s.active === false || !AUTO.includes(s.platform) || counts.get(s.id) || running.has(s.id)) continue;
      try { await syncSupplier(pool, s, fetchImpl); } catch (e) { console.error(e.message); }
    }
  } finally { autoRunning = false; }
}
export async function supplierRows(pool) {
  const r = await pool.query("SELECT data FROM rows WHERE col='suppliers' AND NOT deleted");
  return r.rows.map(x => x.data);
}
// Every day: all automatic catalogs, and the product pages of "links" suppliers.
export async function syncAll(pool, fetchImpl) {
  const out = [];
  for (const s of await supplierRows(pool)) {
    if (!s || s.active === false || !AUTO.concat('links').includes(s.platform)) continue;
    try { out.push(Object.assign({ id: s.id }, await syncSupplier(pool, s, fetchImpl))); } catch (e) { out.push({ id: s.id, ok: false, error: e.message }); }
  }
  return out;
}
// Once a day at about 03:00 Muscat time (UTC+4) = 23:00 UTC.
export function startScheduler(pool, fetchImpl) {
  let last = '';
  const tick = async () => {
    const d = new Date(); const day = d.toISOString().slice(0, 10);
    if (d.getUTCHours() === 23 && last !== day) { last = day; try { await syncAll(pool, fetchImpl); } catch (e) { console.error('daily sync', e.message); } }
  };
  return setInterval(tick, 5 * 60000);
}

// ---- price lists sent by a supplier (CSV / Excel rows prepared in the dashboard) ----
export async function importList(pool, sup, rows, replace) {
  const items = (rows || []).slice(0, 20000).map(r => ({ sku: String(r.sku || r.url || r.title || '').trim(), partNo: String(r.sku || '').trim(), title: String(r.title || r.sku || '').trim(), vendor: String(r.brand || '').trim(), price: r.price == null || r.price === '' ? null : Number(r.price), available: r.available == null || r.available === '' ? null : !!r.available, url: safeUrl(r.url) ? r.url : '', image: '' })).filter(i => i.sku);
  if (!items.length) throw Object.assign(new Error('No rows with a code or name.'), { status: 400 });
  const res = await saveItems(pool, sup.id, sup.currency || 'AED', items, { partial: !replace });
  await applyAvailability(pool, sup.id);
  await notifyChanges(pool, sup, res);
  return res;
}

// ---- what changed at the suppliers (for the owner's review) ----
export async function changes(pool, { days, supplier, kind, limit }) {
  const args = [now() - Math.min(90, Math.max(1, Number(days) || 14)) * 86400000]; let w = 'at >= $1';
  if (supplier) { args.push(supplier); w += ` AND supplier_id=$${args.length}`; }
  if (kind) { args.push(String(kind).split(',')); w += ` AND kind = ANY($${args.length})`; }
  const r = await pool.query(`SELECT * FROM supplier_changes WHERE ${w} ORDER BY at DESC, id DESC LIMIT ${Math.min(3000, Number(limit) || 1500)}`, args);
  return r.rows.map(x => ({ id: String(x.id), supplierId: x.supplier_id, sku: x.sku, kind: x.kind, title: x.title, url: x.url, oldPrice: x.old_price == null ? null : Number(x.old_price), price: x.new_price == null ? null : Number(x.new_price), currency: x.currency, at: Number(x.at) }));
}
export async function unseenChanges(pool, userId) {
  const seen = (await pool.query('SELECT value FROM kv WHERE key=$1', ['seen:sc:' + userId])).rows[0];
  const since = seen ? Number(seen.value) : 0;
  return (await pool.query('SELECT COUNT(*)::int AS n FROM supplier_changes WHERE at > $1', [since])).rows[0].n;
}
export async function markChangesSeen(pool, userId) {
  await pool.query('INSERT INTO kv (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', ['seen:sc:' + userId, JSON.stringify(now())]);
}

// ---- website: products the supplier ran out of (public, no prices) ----
let availCache = { at: 0, data: null };
export async function publicAvailability(pool) {
  if (availCache.data && now() - availCache.at < 120000) return availCache.data;
  const settingsRow = (await pool.query("SELECT data FROM rows WHERE col='meta' AND id='settings'")).rows[0];
  const defMode = (settingsRow && settingsRow.data && settingsRow.data.supplierOutMode) || 'backorder';
  const sups = new Map((await supplierRows(pool)).filter(Boolean).map(s => [s.id, s]));
  const rows = (await pool.query("SELECT data FROM rows WHERE col='products' AND NOT deleted AND (data->>'supplierOut')::boolean IS TRUE")).rows;
  const items = {};
  for (const { data: p } of rows) {
    if (!p.slug || (Number(p.stock) || 0) > 0) continue;
    const mode = p.outMode && p.outMode !== 'default' ? p.outMode : defMode;
    if (mode === 'show') continue;
    const src = (p.sources || []).find(x => x.preferred) || (p.sources || [])[0] || {};
    const s = sups.get(src.supplierId) || {};
    items[p.slug] = mode === 'hide' ? { m: 'hide' } : { m: 'backorder', d: Number(p.backorderDays) || (Number(s.leadDays) || 7) + 7 };
  }
  availCache = { at: now(), data: { updated: now(), items } };
  return availCache.data;
}
export const clearAvailabilityCache = () => { availCache = { at: 0, data: null }; };

// ---- catalogue search ----
export async function searchCatalog(pool, { q, supplier, avail, page, size, changed, removed }) {
  const where = [], args = [];
  if (supplier) { args.push(supplier); where.push(`supplier_id=$${args.length}`); }
  if (avail === '1') where.push('available IS TRUE');
  if (changed === '1') where.push('price_changed_at IS NOT NULL');
  if (removed !== '1' && changed !== '1') where.push('NOT removed');
  const words = String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const w of words) {
    args.push('%' + w.replace(/[%_\\]/g, m => '\\' + m) + '%'); const i = args.length;
    args.push(skey(w) || '\u0000'); const j = args.length;
    where.push(`(title ILIKE $${i} OR sku ILIKE $${i} OR vendor ILIKE $${i} OR ptype ILIKE $${i} OR tags ILIKE $${i} OR (length($${j})>=4 AND skey LIKE '%' || $${j} || '%'))`);
  }
  size = Math.min(100, Math.max(1, Number(size) || 40)); page = Math.max(1, Number(page) || 1);
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM supplier_items ${w}`, args)).rows[0].n;
  const order = changed === '1' ? 'price_changed_at DESC' : 'available DESC NULLS LAST, title';
  const rows = (await pool.query(`SELECT * FROM supplier_items ${w} ORDER BY ${order} LIMIT ${size} OFFSET ${(page - 1) * size}`, args)).rows;
  // the same part at other suppliers (by part number), so the owner can buy from the cheapest
  const keys = [...new Set(rows.map(r => r.skey).filter(k => k.length >= 4))];
  const others = keys.length ? (await pool.query('SELECT supplier_id, sku, skey, price, currency, available, url FROM supplier_items WHERE skey = ANY($1) AND NOT removed', [keys])).rows : [];
  return { total, page, size, items: rows.map(r => shape(r, others.filter(o => o.skey === r.skey && o.supplier_id !== r.supplier_id))) };
}
const n2 = (v) => (v == null ? null : Number(v));
const shape = (r, also) => ({ supplierId: r.supplier_id, sku: r.sku, partNo: r.part_no || '', title: r.title, vendor: r.vendor, type: r.ptype, tags: r.tags, price: n2(r.price), compareAt: n2(r.compare_at), currency: r.currency, available: r.available, removed: !!r.removed, url: r.url, image: r.image, prevPrice: n2(r.prev_price), priceChangedAt: n2(r.price_changed_at), lastSeen: Number(r.last_seen), also: (also || []).map(o => ({ supplierId: o.supplier_id, sku: o.sku, price: n2(o.price), currency: o.currency, available: o.available, url: o.url })) });
export async function lookup(pool, refs) {
  const out = [];
  for (const r of (refs || []).slice(0, 1000)) {
    const x = (await pool.query('SELECT * FROM supplier_items WHERE supplier_id=$1 AND sku=$2', [r.supplierId, r.sku])).rows[0];
    if (x) out.push(shape(x));
  }
  return out;
}
export async function supplierStats(pool) {
  const items = (await pool.query('SELECT supplier_id, COUNT(*)::int AS n, SUM(CASE WHEN available THEN 1 ELSE 0 END)::int AS avail, MAX(last_seen)::bigint AS last FROM supplier_items WHERE NOT removed GROUP BY supplier_id')).rows;
  const runs = (await pool.query('SELECT DISTINCT ON (supplier_id) supplier_id, started_at, finished_at, ok, items, changed, error FROM sync_runs ORDER BY supplier_id, id DESC')).rows;
  const out = {};
  for (const i of items) out[i.supplier_id] = { items: i.n, available: i.avail, lastSeen: Number(i.last) };
  for (const r of runs) out[r.supplier_id] = Object.assign(out[r.supplier_id] || {}, { lastRun: { at: Number(r.started_at), done: r.finished_at ? Number(r.finished_at) : null, ok: r.ok, items: r.items, changed: r.changed, error: r.error }, running: isRunning(r.supplier_id) });
  return out;
}
