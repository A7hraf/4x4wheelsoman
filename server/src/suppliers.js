// Supplier catalogues. Two kinds of online shop publish their full product lists in a machine-readable way:
//   Shopify  (e.g. am-wrangler.com)   GET  /products.json?limit=250&page=N
//   Magento  (e.g. offroad-zone.com)  POST /graphql  products(search:"")
// Their lists are copied here once a day (and on demand) so the owner can search, compare and pick
// products, and see price changes. Other shops (Titan, Ramy) are kept as manual suppliers: the owner
// pastes a link and price. Nothing here gets around a site's protections; requests are slow and identified.
import { logActivity } from './store.js';

export const UA = '4x4WheelsOman-Supplier-Sync/1.0 (+https://a7hraf.github.io/4x4wheelsoman/)';
const PAUSE_MS = Number(process.env.SYNC_PAUSE_MS || 1200);
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

async function getJSON(fetchImpl, url, opts) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
  try {
    // follow at most 3 redirects, and only to public https addresses
    let r, target = url;
    for (let hop = 0; ; hop++) {
      if (!safeUrl(target)) throw new Error('Refused address ' + new URL(target).host);
      r = await fetchImpl(target, Object.assign({ signal: ctl.signal }, opts || {}, { redirect: 'manual', headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, (opts && opts.headers) || {}) }));
      const loc = r.status >= 300 && r.status < 400 && r.headers && r.headers.get('location');
      if (!loc) break;
      if (hop >= 3) throw new Error('Too many redirects');
      target = new URL(loc, target).href;
    }
    if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
    const text = await r.text();
    if (text.length > 25e6) throw new Error('Response too large');
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
    await sleep(PAUSE_MS);
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
    if (page < pages) await sleep(PAUSE_MS);
  }
  return items;
}

// Find out what kind of shop a supplier website is.
export async function detect(url, fetchImpl) {
  if (!safeUrl(url)) return { platform: 'manual', note: 'Use a full https:// address.' };
  const o = origin(url), b = base(url);
  try { const d = await getJSON(fetchImpl, `${o}/products.json?limit=1`); if (d && Array.isArray(d.products)) return { platform: 'shopify', feedUrl: o, note: 'Shopify shop: the full product list can be synced automatically.' }; } catch {}
  for (const cand of [b, o]) {
    try {
      const d = await getJSON(fetchImpl, cand + '/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{products(search:"",pageSize:1){total_count}}' }) });
      if (d && d.data && d.data.products) return { platform: 'magento', feedUrl: cand, note: `Magento shop with ${d.data.products.total_count} products: can be synced automatically.` };
    } catch {}
  }
  return { platform: 'manual', note: 'This site does not offer an open product list (or blocks automatic access). Add its products by pasting the link and price.' };
}

// ---- store synced items ----
export async function saveItems(pool, supplierId, currency, items) {
  const t = now(); let changed = 0, added = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = new Map((await client.query('SELECT sku, price FROM supplier_items WHERE supplier_id=$1', [supplierId])).rows.map(r => [r.sku, Number(r.price)]));
    const seen = new Set();
    for (const it of items) {
      if (!it.sku || seen.has(it.sku)) continue; seen.add(it.sku);
      const prev = old.get(it.sku);
      const priceChanged = prev != null && Math.abs(prev - it.price) > 0.0001;
      if (prev == null) added++; else if (priceChanged) changed++;
      await client.query(`INSERT INTO supplier_items (supplier_id,sku,skey,title,vendor,ptype,tags,price,compare_at,currency,available,url,image,first_seen,last_seen)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
        ON CONFLICT (supplier_id,sku) DO UPDATE SET skey=EXCLUDED.skey,title=EXCLUDED.title,vendor=EXCLUDED.vendor,ptype=EXCLUDED.ptype,tags=EXCLUDED.tags,
          compare_at=EXCLUDED.compare_at,currency=EXCLUDED.currency,available=EXCLUDED.available,url=EXCLUDED.url,image=EXCLUDED.image,last_seen=EXCLUDED.last_seen,
          prev_price=CASE WHEN supplier_items.price IS DISTINCT FROM EXCLUDED.price THEN supplier_items.price ELSE supplier_items.prev_price END,
          price_changed_at=CASE WHEN supplier_items.price IS DISTINCT FROM EXCLUDED.price THEN EXCLUDED.last_seen ELSE supplier_items.price_changed_at END,
          price=EXCLUDED.price`,
      [supplierId, it.sku.slice(0, 120), skey(it.sku), String(it.title || '').slice(0, 300), String(it.vendor || '').slice(0, 100), String(it.ptype || '').slice(0, 100), String(it.tags || '').slice(0, 500), it.price, it.compare_at, it.currency || currency || 'AED', it.available, String(it.url || '').slice(0, 500), String(it.image || '').slice(0, 500), t]);
    }
    // items no longer listed are marked unavailable (kept for history)
    const gone = [...old.keys()].filter(k => !seen.has(k));
    if (gone.length && items.length) await client.query('UPDATE supplier_items SET available=false WHERE supplier_id=$1 AND sku = ANY($2)', [supplierId, gone]);
    await client.query('COMMIT');
    return { total: seen.size, added, changed, gone: items.length ? gone.length : 0 };
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}

const running = new Set();
export async function syncSupplier(pool, sup, fetchImpl, user) {
  if (!sup || !['shopify', 'magento'].includes(sup.platform)) throw Object.assign(new Error('This supplier is manual: add its products by link and price.'), { status: 400 });
  const site = sup.feedUrl || sup.website;
  if (!safeUrl(site)) throw Object.assign(new Error('Supplier website must be a public https:// address.'), { status: 400 });
  if (running.has(sup.id)) throw Object.assign(new Error('A sync for this supplier is already running.'), { status: 409 });
  running.add(sup.id);
  const run = (await pool.query('INSERT INTO sync_runs (supplier_id, started_at) VALUES ($1,$2) RETURNING id', [sup.id, now()])).rows[0].id;
  try {
    const items = sup.platform === 'shopify' ? await fetchShopify(site, fetchImpl) : await fetchMagento(site, fetchImpl);
    if (!items.length) throw new Error('No products were returned.');
    const res = await saveItems(pool, sup.id, sup.currency || 'AED', items);
    await pool.query('UPDATE sync_runs SET finished_at=$2, ok=true, items=$3, changed=$4 WHERE id=$1', [run, now(), res.total, res.changed]);
    await logActivity(pool, user || null, 'sync', 'suppliers', `Synced ${sup.name}: ${res.total} products, ${res.added} new, ${res.changed} price changes`, { supplierId: sup.id });
    console.log(`sync ${sup.name}: ${res.total} products, ${res.added} new, ${res.changed} price changes`);
    return Object.assign({ ok: true }, res);
  } catch (e) {
    await pool.query('UPDATE sync_runs SET finished_at=$2, ok=false, error=$3 WHERE id=$1', [run, now(), String(e.message).slice(0, 300)]);
    throw Object.assign(new Error(`Sync of ${sup.name} failed: ${e.message}`), { status: e.status || 502 });
  } finally { running.delete(sup.id); }
}
export const isRunning = (id) => running.has(id);

// The suppliers the owner buys from. They are added to the shop's data automatically (once),
// and their catalogs are copied straight away, so products are there without any setup.
export const KNOWN = [
  { id: 'sup_amwrangler', name: 'AM Wrangler', website: 'https://am-wrangler.com', platform: 'shopify', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'Shopify online shop. Use "Open cart on website" to get a ready cart with the items, or send the list on WhatsApp. Prices on the site are in AED.' },
  { id: 'sup_offroadzone', name: 'Offroad Zone', website: 'https://www.offroad-zone.com/en', platform: 'magento', currency: 'AED', addVatPct: 5, country: 'UAE', howToOrder: 'Online shop (prices shown without 5% UAE VAT). Order on the website or send the list on WhatsApp.' },
  { id: 'sup_titan', name: 'Titan Performance', website: 'https://titanperformanceuae.com', platform: 'manual', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'The website shows prices that may not be accurate. Confirm price and stock by WhatsApp/phone before ordering. Add products by pasting the product link and the confirmed price.' },
  { id: 'sup_ramy', name: 'Ramy Automotive', website: 'https://www.ramyautomotive.com', platform: 'manual', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'Add products by pasting the product link and price. Confirm stock before ordering.' }
].map(k => Object.assign({ fxRate: 0, shippingPct: 10, fixedFee: 0, leadDays: 7, defaultMarkup: 35, roundTo: 1, active: true, contact: '', phone: '', whatsapp: '', email: '', paymentTerms: '', minOrder: 0, notes: '' }, k));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export async function ensureKnown(pool) {
  const n = (await pool.query('SELECT COUNT(*)::int AS n FROM rows')).rows[0].n;
  if (!n) return [];
  const done = await pool.query("SELECT value FROM kv WHERE key='knownSuppliers'");
  if (done.rows.length) return [];
  const have = await supplierRows(pool); const added = [];
  for (const k of KNOWN) {
    if (have.some(s => s && hostOf(s.website) === hostOf(k.website))) continue;
    await pool.query("INSERT INTO rows (col,id,data,updated_at,updated_by) VALUES ('suppliers',$1,$2,$3,'system') ON CONFLICT (col,id) DO NOTHING", [k.id, JSON.stringify(k), now()]);
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
      if (!s || s.active === false || !['shopify', 'magento'].includes(s.platform) || counts.get(s.id) || running.has(s.id)) continue;
      try { await syncSupplier(pool, s, fetchImpl); } catch (e) { console.error(e.message); }
    }
  } finally { autoRunning = false; }
}

export async function supplierRows(pool) {
  const r = await pool.query("SELECT data FROM rows WHERE col='suppliers' AND NOT deleted");
  return r.rows.map(x => x.data);
}
export async function syncAll(pool, fetchImpl) {
  const out = [];
  for (const s of await supplierRows(pool)) {
    if (s.active === false || !['shopify', 'magento'].includes(s.platform)) continue;
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

// ---- catalogue search ----
export async function searchCatalog(pool, { q, supplier, avail, page, size, changed }) {
  const where = [], args = [];
  if (supplier) { args.push(supplier); where.push(`supplier_id=$${args.length}`); }
  if (avail === '1') where.push('available');
  if (changed === '1') where.push('price_changed_at IS NOT NULL');
  const words = String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const w of words) {
    args.push('%' + w.replace(/[%_\\]/g, m => '\\' + m) + '%'); const i = args.length;
    args.push(skey(w) || '\u0000'); const j = args.length;
    where.push(`(title ILIKE $${i} OR sku ILIKE $${i} OR vendor ILIKE $${i} OR ptype ILIKE $${i} OR tags ILIKE $${i} OR (length($${j})>=4 AND skey LIKE '%' || $${j} || '%'))`);
  }
  size = Math.min(100, Math.max(1, Number(size) || 40)); page = Math.max(1, Number(page) || 1);
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM supplier_items ${w}`, args)).rows[0].n;
  const order = changed === '1' ? 'price_changed_at DESC' : 'available DESC, title';
  const rows = (await pool.query(`SELECT * FROM supplier_items ${w} ORDER BY ${order} LIMIT ${size} OFFSET ${(page - 1) * size}`, args)).rows;
  // the same part at other suppliers (by part number), so the owner can buy from the cheapest
  const keys = [...new Set(rows.map(r => r.skey).filter(k => k.length >= 4))];
  const others = keys.length ? (await pool.query('SELECT supplier_id, sku, skey, price, currency, available, url FROM supplier_items WHERE skey = ANY($1)', [keys])).rows : [];
  return { total, page, size, items: rows.map(r => shape(r, others.filter(o => o.skey === r.skey && o.supplier_id !== r.supplier_id))) };
}
const shape = (r, also) => ({ supplierId: r.supplier_id, sku: r.sku, title: r.title, vendor: r.vendor, type: r.ptype, tags: r.tags, price: Number(r.price), compareAt: r.compare_at == null ? null : Number(r.compare_at), currency: r.currency, available: r.available, url: r.url, image: r.image, prevPrice: r.prev_price == null ? null : Number(r.prev_price), priceChangedAt: r.price_changed_at == null ? null : Number(r.price_changed_at), lastSeen: Number(r.last_seen), also: (also || []).map(o => ({ supplierId: o.supplier_id, sku: o.sku, price: Number(o.price), currency: o.currency, available: o.available, url: o.url })) });
export async function lookup(pool, refs) {
  const out = [];
  for (const r of (refs || []).slice(0, 500)) {
    const x = (await pool.query('SELECT * FROM supplier_items WHERE supplier_id=$1 AND sku=$2', [r.supplierId, r.sku])).rows[0];
    if (x) out.push(shape(x));
  }
  return out;
}
export async function supplierStats(pool) {
  const items = (await pool.query('SELECT supplier_id, COUNT(*)::int AS n, SUM(CASE WHEN available THEN 1 ELSE 0 END)::int AS avail, MAX(last_seen)::bigint AS last FROM supplier_items GROUP BY supplier_id')).rows;
  const runs = (await pool.query('SELECT DISTINCT ON (supplier_id) supplier_id, started_at, finished_at, ok, items, changed, error FROM sync_runs ORDER BY supplier_id, id DESC')).rows;
  const out = {};
  for (const i of items) out[i.supplier_id] = { items: i.n, available: i.avail, lastSeen: Number(i.last) };
  for (const r of runs) out[r.supplier_id] = Object.assign(out[r.supplier_id] || {}, { lastRun: { at: Number(r.started_at), done: r.finished_at ? Number(r.finished_at) : null, ok: r.ok, items: r.items, changed: r.changed, error: r.error }, running: isRunning(r.supplier_id) });
  return out;
}
