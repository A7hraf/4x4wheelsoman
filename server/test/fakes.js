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
    if (body.query.includes('pageSize:1)')) return json({ data: { products: { total_count: 3 } } });
    const p = body.variables.p;
    const items = p === 1 ? [
      { sku: 'rs 100', name: 'Rock Slider (other shop)', url_key: 'rock-slider-x', url_suffix: '', stock_status: 'IN_STOCK', small_image: { url: 'https://mag.example/i.jpg' }, price_range: { minimum_price: { final_price: { value: 900, currency: 'AED' }, regular_price: { value: 950 } } } },
      { sku: 'W-9', name: 'Winch', url_key: 'winch', url_suffix: '', stock_status: 'OUT_OF_STOCK', small_image: null, price_range: { minimum_price: { final_price: { value: 2500, currency: 'AED' }, regular_price: { value: 2500 } } } }
    ] : [{ sku: 'B-1', name: 'Bumper', url_key: 'bumper', url_suffix: '', stock_status: 'IN_STOCK', small_image: null, price_range: { minimum_price: { final_price: { value: 1800, currency: 'AED' }, regular_price: { value: 1800 } } } }];
    return json({ data: { products: { total_count: 3, page_info: { total_pages: 2 }, items } } });
  }
  if (['manual.example', 'titanperformanceuae.com', 'www.ramyautomotive.com'].includes(u.host)) return new Response('<html>blocked</html>', { status: 403 });
  if (u.host === 'redir.example') return new Response('', { status: 302, headers: { location: 'https://10.0.0.5/products.json' } });
  if (u.host === '10.0.0.5') throw new Error('internal address was contacted');
  if (u.host === 'api.anthropic.com') return json({ id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'hi' }], model: 'x' }, 200, { 'request-id': 'req_1' });
  return new Response('nope', { status: 404 });
}

