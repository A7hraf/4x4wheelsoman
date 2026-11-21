// Fake internet for tests: two supplier shops (Shopify, Magento), a blocked one, and the Claude API.
export const fakeUpstream = { calls: [] };
// fake internet: supplier shops + Claude API
export async function fakeFetch(url, opts = {}) {
  const u = new URL(url);
  fakeUpstream.calls.push({ url: String(url), opts });
  const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json' }, headers) });
  if (['shop.example', 'am-wrangler.com'].includes(u.host) && u.pathname === '/products.json') {
    const page = Number(u.searchParams.get('page') || 1), limit = Number(u.searchParams.get('limit'));
    if (limit === 1) return json({ products: [] });
    if (page > 1) return json({ products: [] });
    return json({ products: [
      { title: 'Rock Slider', handle: 'rock-slider', vendor: 'Rugged', product_type: 'Armor', tags: ['jl'], body_html: '<p>Strong</p>', images: [{ src: 'https://cdn.shopify.com/a.jpg' }], variants: [{ id: 1, sku: 'RS-100', price: globalThis.__rsPrice || '1000.00', available: true, title: 'Default Title' }] },
      { title: 'LED Bar', handle: 'led-bar', vendor: 'Lux', product_type: 'Lights', tags: '', images: [], variants: [{ id: 2, sku: 'LB-1', price: '200.00', available: false, title: '20in' }, { id: 3, sku: 'LB-2', price: '300.00', available: true, title: '30in' }] }
    ] });
  }
  if (['mag.example', 'www.offroad-zone.com'].includes(u.host) && u.pathname === '/en/graphql') {
    const body = JSON.parse(opts.body);
    // the real shop sometimes refuses a request once: every 2nd-page request fails the first time
    if (body.variables && body.variables.p === 2) { fakeUpstream.refused = (fakeUpstream.refused || 0) + 1; if (fakeUpstream.refused % 2 === 1) return new Response('Forbidden', { status: 403 }); }
    if (body.query.includes('pageSize:1)')) return json({ data: { products: { total_count: 3 } } });
    const p = body.variables.p;
    const items = p === 1 ? [
      { sku: 'rs 100', name: 'Rock Slider (other shop)', url_key: 'rock-slider-x', url_suffix: '', stock_status: 'IN_STOCK', small_image: { url: 'https://mag.example/i.jpg' }, price_range: { minimum_price: { final_price: { value: 900, currency: 'AED' }, regular_price: { value: 950 } } } },
      { sku: 'W-9', name: 'Winch', url_key: 'winch', url_suffix: '', stock_status: 'OUT_OF_STOCK', small_image: null, price_range: { minimum_price: { final_price: { value: 2500, currency: 'AED' }, regular_price: { value: 2500 } } } }
    ] : [null, { sku: 'B-1', name: 'Bumper', url_key: 'bumper', url_suffix: '', stock_status: 'IN_STOCK', small_image: null, price_range: { minimum_price: { final_price: { value: 1800, currency: 'AED' }, regular_price: { value: 1800 } } } }];
    return json({ data: { products: { total_count: 3, page_info: { total_pages: 2 }, items } } });
  }
  // Titan-like shop: product list only in the sitemap (prices load in the browser)
  if (u.host === 'titanperformanceuae.com' && u.pathname === '/sitemap.xml') return new Response(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://titanperformanceuae.com/shop</loc></url>
    <url><loc>https://titanperformanceuae.com/product/297814-lp4-pro-led-auxiliary-light-pod-pair</loc></url>
    <url><loc>https://titanperformanceuae.com/product/49-7813-2-squadron-2-0-pro-black-led-auxiliary-light-pod-pair</loc></url>
    <url><loc>https://titanperformanceuae.com/product/wolfbox-g900-dash-cam-d9932a</loc></url>
    ${globalThis.__titanExtra ? '<url><loc>https://titanperformanceuae.com/product/447068-jeep-jl</loc></url>' : ''}</urlset>`, { status: 200, headers: { 'content-type': 'application/xml' } });
  if (u.host === 'titanperformanceuae.com') return new Response('<html><div id="root"></div></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  // Ramy-like shop: no open list, but each product page has its details
  if (u.host === 'www.ramyautomotive.com' && u.pathname === '/aor-extreme-4-in-1-inflate-deflate-system') return new Response(`<html><head><meta property="og:title" content="AOR Extreme 4 in 1 Inflate/Deflate System | Ramy"><meta property="product:price:amount" content="${globalThis.__ramyPrice || '945.00'}"><meta property="product:price:currency" content="AED"></head>
    <body><h1>AOR Extreme 4 in 1 Inflate/Deflate System</h1><div class="product attribute sku"><div class="value" itemprop="sku">EQ-AIR-01</div></div><span data-price-amount="945">AED 945.00</span>
    <div class="stock ${globalThis.__ramyOut ? 'unavailable' : 'available'}"><span>${globalThis.__ramyOut ? 'Coming Soon' : 'In stock'}</span></div></body></html>`, { status: 200, headers: { 'content-type': 'text/html' } });
  if (u.host === 'www.ramyautomotive.com' && u.pathname === '/json-ld-product') return new Response(`<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Winch 12k","sku":"WN-12","brand":{"name":"Warn"},"image":"https://www.ramyautomotive.com/w.jpg","offers":{"@type":"Offer","price":"3200.50","priceCurrency":"AED","availability":"https://schema.org/OutOfStock"}}</script></html>`, { status: 200 });
  if (['manual.example', 'www.ramyautomotive.com'].includes(u.host)) return new Response('<html>blocked</html>', { status: 403 });
  // Google Gemini (OpenAI-compatible)
  if (u.host === 'generativelanguage.googleapis.com') {
    const body = JSON.parse(opts.body);
    fakeUpstream.gemini = (fakeUpstream.gemini || []).concat([body]);
    const last = body.messages[body.messages.length - 1];
    if (body.tools && last.role === 'user') return json({ id: 'g1', choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: body.tools[0].function.name, arguments: '{"query":"bumper"}' } }] } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    if (body.response_format) return json({ id: 'g3', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '```json\n{"ok":true}\n```' } }] });
    return json({ id: 'g2', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: last.role === 'tool' ? 'Found it: ' + last.content.slice(0, 20) : 'Hello from Gemini' } }], usage: { prompt_tokens: 12, completion_tokens: 4 } });
  }
  // WhatsApp Cloud API
  if (u.host === 'graph.facebook.com') {
    fakeUpstream.wa = (fakeUpstream.wa || []).concat([{ path: u.pathname, body: opts.body ? JSON.parse(opts.body) : null }]);
    if (/\/messages$/.test(u.pathname)) { const b = JSON.parse(opts.body); if (b.to === '96899999999') return json({ error: { code: 131047, message: 'Re-engagement message' } }, 400); return json({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.' + Math.random().toString(36).slice(2) }] }); }
    if (/message_templates/.test(u.pathname)) return json({ data: [{ name: 'offer_jl', status: 'APPROVED', language: 'en', category: 'MARKETING', components: [{ type: 'BODY', text: 'Hi {{1}}, {{2}}' }] }] });
    return json({ display_phone_number: '+968 9000 0000', verified_name: '4x4 Wheels Oman', quality_rating: 'GREEN' });
  }
  if (u.host === 'redir.example') return new Response('', { status: 302, headers: { location: 'https://10.0.0.5/products.json' } });
  if (u.host === '10.0.0.5') throw new Error('internal address was contacted');
  if (u.host === 'api.anthropic.com') return json({ id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'hi' }], model: 'x' }, 200, { 'request-id': 'req_1' });
  return new Response('nope', { status: 404 });
}

