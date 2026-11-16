// Dashboard business workflows: sales, orders, returns, quotes, WhatsApp, Qpay, purchasing,
// inventory, finance, customers, campaigns, backups, publishing and reports.
const { test } = require('@playwright/test');
const { offline, watchErrors, captureOpen, opened, setupAdmin, go, expect } = require('./helpers');

test.beforeEach(async ({ context, page }) => { await offline(context); await captureOpen(page); });

const round3 = (n) => Math.round(n * 1000) / 1000;
const confirmYes = async (page) => { const y = page.locator('.overlay #yes'); if (await y.count()) await y.click(); };

test('every dashboard screen renders without errors, in English and Arabic', async ({ page }) => {
  const errors = watchErrors(page);
  await setupAdmin(page);
  const routes = ['dashboard', 'pos', 'quotes', 'orders', 'inventory', 'purchases', 'whatsapp', 'advisor', 'qpay', 'finance', 'reports', 'customers', 'settings'];
  for (const lang of ['en', 'ar']) {
    if (lang === 'ar') await page.locator('#langBtn').click();
    for (const r of routes) {
      await go(page, r);
      await expect(page.locator('#view')).not.toBeEmpty();
      expect((await page.locator('#view').innerText()).length).toBeGreaterThan(80);
    }
  }
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await go(page, 'dashboard');
  expect(await page.locator('#view canvas').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Point of Sale: discount, VAT, payment, stock and receipt are correct', async ({ page }) => {
  await setupAdmin(page, '#/pos');
  const picks = await page.evaluate(() => DB.data.products.filter(p => p.stock >= 3 && p.price > 0).slice(0, 2).map(p => ({ id: p.id, pn: p.partNumber || p.sku, price: p.price, stock: p.stock })));
  await page.locator('#pq').fill(picks[0].pn);
  await page.locator('#pq').press('Enter');
  await page.locator(`#pgrid [data-pid="${picks[1].id}"]`).click();
  await page.locator('#cart [data-inc="1"]').click();                   // 2 of the second product
  await page.locator('#pdisc').fill('10'); await page.locator('#pdisc').dispatchEvent('change');
  await page.locator('#cart [data-pay="card"]').click();
  await page.locator('#pcharge').click();
  await expect(page.locator('.overlay')).toContainText('INV-');
  const sale = await page.evaluate(() => DB.data.sales[DB.data.sales.length - 1]);
  const sub = picks[0].price + 2 * picks[1].price;
  expect(sale.channel).toBe('shop');
  expect(sale.payment).toBe('card');
  expect(sale.subtotal).toBeCloseTo(sub, 3);
  expect(sale.discount).toBe(10);
  expect(sale.vat).toBeCloseTo(round3((sub - 10) * 0.05), 3);
  expect(sale.total).toBeCloseTo(round3(sub - 10 + (sub - 10) * 0.05), 3);
  const stock = await page.evaluate((ids) => ids.map(id => DB.product(id).stock), picks.map(p => p.id));
  expect(stock).toEqual([picks[0].stock - 1, picks[1].stock - 2]);
});

test('POS cash sale records change; selling beyond stock asks first', async ({ page }) => {
  await setupAdmin(page, '#/pos');
  const p = await page.evaluate(() => { const p = DB.data.products.find(x => x.price > 0); p.stock = 0; DB.save(); return { id: p.id, price: p.price }; });
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await go(page, 'pos');
  await page.locator(`#pgrid [data-pid="${p.id}"]`).click();
  await expect(page.locator('.overlay')).toContainText('Not in stock');
  await page.locator('.overlay #yes').click();
  await page.locator('#cart [data-pay="cash"]').click();
  const total = round3(p.price * 1.05);
  const given = Math.ceil(total / 100) * 100 + 100;
  await page.locator('#pcash').fill(String(given));
  await page.waitForTimeout(700);
  await page.locator('#pcharge').click();
  await expect(page.locator('.overlay')).toContainText('INV-');
  const sale = await page.evaluate(() => DB.data.sales[DB.data.sales.length - 1]);
  expect(sale.cashReceived).toBe(given);
  expect(sale.change).toBeCloseTo(given - total, 3);
});

test('online order: status flow notifies the customer; cancelling puts stock back', async ({ page }) => {
  await setupAdmin(page);
  const o = await page.evaluate(() => { const p = DB.data.products.find(x => x.price > 0 && x.stock > 2); const c = DB.data.customers[0]; const s = DB.createSale({ channel: 'online', source: 'website', customerId: c.id, payment: 'transfer', items: [{ pid: p.id, qty: 2 }] }); return { id: s.id, no: s.no, pid: p.id, stock: DB.product(p.id).stock }; });
  await go(page, 'orders');
  await page.locator(`[data-oid="${o.id}"]`).first().click();
  await page.locator('.overlay [data-set="processing"]').click();
  // the "notify customer" window opens with the confirmed template
  await expect(page.locator('.overlay #n_t')).toHaveValue(/is confirmed/);
  await page.locator('.overlay #n_go').click();
  let links = await opened(page);
  expect(links[0]).toContain('api.whatsapp.com/send?phone=968');
  expect(await page.evaluate((id) => DB.data.sales.find(s => s.id === id).status, o.id)).toBe('processing');
  await page.locator(`[data-oid="${o.id}"]`).first().click();
  await page.locator('.overlay [data-set="cancelled"]').click();
  const after = await page.evaluate((x) => ({ st: DB.data.sales.find(s => s.id === x.id).status, stock: DB.product(x.pid).stock }), o);
  expect(after).toEqual({ st: 'cancelled', stock: o.stock + 2 });
  // cancelled orders don't count as revenue
  expect(await page.evaluate((id) => DB.countsAsRevenue(DB.data.sales.find(s => s.id === id)), o.id)).toBe(false);
});

test('partial return: stock back, totals and VAT recalculated, return logged', async ({ page }) => {
  await setupAdmin(page);
  const o = await page.evaluate(() => { const ps = DB.data.products.filter(x => x.price > 0).slice(0, 2); const s = DB.createSale({ channel: 'shop', payment: 'cash', discount: 20, items: [{ pid: ps[0].id, qty: 2 }, { pid: ps[1].id, qty: 1 }] }); return { id: s.id, p0: ps[0].id, price0: ps[0].price, price1: ps[1].price, stock0: DB.product(ps[0].id).stock, sub: s.subtotal }; });
  await go(page, 'orders');
  await page.evaluate((id) => BH.orderModal(id), o.id);
  await page.locator('.overlay #orefund').click();
  await page.locator('.overlay [data-rq="0"]').fill('1');
  await page.locator('.overlay [data-rq="1"]').fill('0');
  await page.locator('.overlay [data-rq="1"]').dispatchEvent('input');
  await page.locator('.overlay #rf_r').fill('Wrong fitment');
  await page.locator('.overlay #rf_go').click();
  const s = await page.evaluate((id) => DB.data.sales.find(x => x.id === id), o.id);
  const newSub = o.price0 + o.price1;
  expect(s.subtotal).toBeCloseTo(newSub, 3);
  expect(s.discount).toBeCloseTo(round3(newSub * 20 / o.sub), 3);
  expect(s.vat).toBeCloseTo(round3((s.subtotal - s.discount) * 0.05), 3);
  expect(s.returns[0].reason).toBe('Wrong fitment');
  expect(await page.evaluate((id) => DB.product(id).stock, o.p0)).toBe(o.stock0 + 1);
});

test('quote from the website message → priced quote → order (end to end with the store)', async ({ page }) => {
  // 1) customer builds the list on the website
  await page.goto('index.html#/p/afe-momentum-gt-y62');
  await page.locator('#addQ').click();
  await page.goto('index.html#/quote');
  await page.locator('#q_make').selectOption('Nissan'); await page.locator('#q_model').selectOption('patrol-y62');
  await page.locator('#q_year').fill('2020'); await page.locator('#q_name').fill('Hamad Test');
  await page.locator('#qform button[type=submit]').click();
  const msg = new URL((await opened(page))[0]).searchParams.get('text');
  // 2) owner pastes it into the dashboard
  await setupAdmin(page, '#/quotes');
  await page.locator('#qimp').click();
  await page.locator('#im_t').fill(msg);
  await page.locator('#im_p').fill('+968 9000 1111');
  await page.locator('#im_go').click();
  await expect(page.locator('.overlay #q_v')).toHaveValue('Nissan Patrol Y62 2020');
  await expect(page.locator('.overlay #q_n')).toHaveValue('Hamad Test');
  await expect(page.locator('.overlay')).toContainText('Original customer message');
  // 3) send the quote on WhatsApp, then convert it to an order
  await page.locator('.overlay #q_send').click();
  const quoteMsg = new URL((await opened(page)).slice(-1)[0]).searchParams.get('text');
  expect(quoteMsg).toContain('aFe Momentum GT Cold Air Intake (Patrol Y62)');
  expect(quoteMsg).toMatch(/Total: OMR [\d,.]+ \(incl\. VAT\)/);
  const q = await page.evaluate(() => DB.data.quotes.find(x => x.vehicle === 'Nissan Patrol Y62 2020'));
  expect(q.status).toBe('sent');
  await page.evaluate((id) => document.querySelector(`[data-qid="${id}"]`).click(), q.id);
  await page.locator('.overlay #q_conv').click();
  const r = await page.evaluate((id) => { const q = DB.data.quotes.find(x => x.id === id); const s = DB.data.sales.find(x => x.id === q.saleId); return { qs: q.status, ch: s.channel, src: s.source, cust: s.customerName, items: s.items.map(i => i.name) }; }, q.id);
  expect(r).toEqual({ qs: 'converted', ch: 'online', src: 'whatsapp', cust: 'Hamad Test', items: ['aFe Momentum GT Cold Air Intake (Patrol Y62)'] });
});

test('quote from a normal customer message (English + Arabic) without AI', async ({ page }) => {
  await setupAdmin(page, '#/quotes');
  await page.locator('#qimp').click();
  await page.locator('#im_t').fill('salam, I need a lift kit and 4 tyres for my patrol 2021, also a light bar. can I pay with qpay?');
  await page.locator('#im_go').click();
  await expect(page.locator('.overlay #q_v')).toHaveValue('Nissan Patrol Y62 2021');
  await expect(page.locator('.overlay #q_q')).toBeChecked();
  const lines = await page.evaluate(() => [...document.querySelectorAll('.overlay [data-f="pid"]')].map(s => s.selectedOptions[0].textContent + ' x' + s.closest('.line, tr, div').querySelector('[data-f="qty"]').value));
  expect(lines.join(' | ')).toMatch(/Patrol Y62/);
  expect(lines.some(l => /KMC|Dakar|BRAID/.test(l) && /x4$/.test(l))).toBe(true);
  expect(lines.some(l => /Light Bar/.test(l))).toBe(true);
  await page.locator('.overlay [data-close], .overlay .x').first().click();
  await page.locator('#qimp').click();
  await page.locator('#im_t').fill('السلام عليكم ابي طقم رفع للاندكروزر 300 موديل 2024');
  await page.locator('#im_go').click();
  await expect(page.locator('.overlay #q_v')).toHaveValue('Toyota Land Cruiser 300 2024');
});

test('WhatsApp bill link opens a correct online invoice', async ({ page }) => {
  await setupAdmin(page);
  const o = await page.evaluate(() => { const c = DB.data.customers[0]; const p = DB.data.products.find(x => x.price > 0); const s = DB.createSale({ channel: 'shop', customerId: c.id, payment: 'card', items: [{ pid: p.id, qty: 3 }] }); return { id: s.id, no: s.no, total: s.total, name: p.name }; });
  await go(page, 'orders');
  await page.evaluate((id) => BH.orderModal(id), o.id);
  await page.locator('.overlay #obill').click();
  const wa = new URL((await opened(page)).slice(-1)[0]);
  const text = wa.searchParams.get('text');
  expect(text).toContain(o.no);
  const link = text.match(/https?:\/\/\S+bill\.html#\S+/)[0];
  // the link points at the live site; open the same invoice locally
  await page.goto('bill.html' + link.slice(link.indexOf('#')));
  await expect(page.locator('h1')).toHaveText('INVOICE');
  await expect(page.locator('#root')).toContainText(o.no);
  await expect(page.locator('#root')).toContainText(o.name);
  await expect(page.locator('.tot .g')).toContainText(o.total.toLocaleString('en-US', { minimumFractionDigits: 3 }));
  await expect(page.locator('.badge')).toHaveText('PAID');
});

test('Qpay pipeline: request → approved → settled marks the order paid', async ({ page }) => {
  await setupAdmin(page);
  const id = await page.evaluate(() => { const p = DB.data.products.find(x => x.price > 0 && x.price < 300); const s = DB.createSale({ channel: 'online', customerId: DB.data.customers[0].id, payment: 'qpay', items: [{ pid: p.id, qty: 1 }] }); return s.id; });
  await go(page, 'qpay');
  await page.locator(`[data-req="${id}"]`).click();
  await page.locator('.overlay #qp_ref').fill('QP123456');
  await page.locator('.overlay #qp_go').click();
  expect((await opened(page)).slice(-1)[0]).toContain('api.whatsapp.com');
  let s = await page.evaluate((i) => DB.data.sales.find(x => x.id === i), id);
  expect(s.qpay).toMatchObject({ status: 'requested', ref: 'QP123456' });
  expect(s.paid).toBe(false);
  await page.locator('.seg#qptab button[data-k="requested"]').click().catch(() => {});
  await page.evaluate((i) => document.querySelector(`[data-qa="approved"][data-id="${i}"]`).click(), id);
  await page.locator('.seg#qptab button[data-k="approved"]').click().catch(() => {});
  await page.evaluate((i) => { const b = document.querySelector(`[data-qa="settled"][data-id="${i}"]`); if (b) b.click(); else DB.setQpay(i, 'settled'); }, id);
  s = await page.evaluate((i) => DB.data.sales.find(x => x.id === i), id);
  expect(s.qpay.status).toBe('settled');
  expect(s.paid).toBe(true);
  expect(s.qpay.settledAt).toBeGreaterThan(0);
});

test('purchasing: forecast reorder → purchase order → receive updates stock, cost and expenses', async ({ page }) => {
  await setupAdmin(page, '#/purchases');
  const plan = await page.evaluate(() => AI.reorderPlan());
  expect(plan.length).toBeGreaterThan(0);
  for (const r of plan) { expect(r.suggest).toBeGreaterThan(0); expect(r.cost).toBeGreaterThanOrEqual(0); }
  await expect(page.locator('#roList li')).toHaveCount(plan.length);
  const first = plan[0];
  const before = await page.evaluate((pid) => ({ stock: DB.product(pid).stock, exp: DB.data.expenses.length }), first.pid);
  await page.locator('#poauto').click();
  await page.locator('.overlay #po_r').click();
  const after = await page.evaluate((pid) => ({ stock: DB.product(pid).stock, exp: DB.data.expenses.slice(-1)[0], po: DB.data.purchases.slice(-1)[0] }), first.pid);
  expect(after.stock).toBe(before.stock + first.suggest);
  expect(after.po.status).toBe('received');
  expect(after.exp.category).toBe('inventory');
  expect(after.exp.amount).toBeCloseTo(after.po.total, 3);
  // the item is no longer suggested
  expect(await page.evaluate((pid) => AI.reorderPlan().some(r => r.pid === pid), first.pid)).toBe(false);
});

test('reorder forecast does not order twice what is already on an open purchase order', async ({ page }) => {
  await setupAdmin(page);
  const r = await page.evaluate(() => {
    const x = AI.reorderPlan().find(y => y.suggest >= 2);
    const half = Math.floor(x.suggest / 2);
    const po = { id: 'po_t', no: 'PO-999', date: Date.now(), supplierId: 's1', status: 'ordered', items: [{ pid: x.pid, qty: half, cost: 1 }], total: half };
    DB.data.purchases.push(po);
    const partly = AI.reorderPlan().find(y => y.pid === x.pid);
    po.items[0].qty = x.suggest;
    const fully = AI.reorderPlan().find(y => y.pid === x.pid);
    return { first: x, half, partly: partly || null, fully: fully || null };
  });
  // half already ordered → only the rest is suggested; all of it ordered → not suggested again
  if (r.partly) { expect(r.partly.on_order).toBe(r.half); expect(r.partly.suggest).toBe(r.first.suggest - r.half); }
  expect(r.fully).toBeNull();
});

test('inventory: add a product, adjust stock, it shows in the POS', async ({ page }) => {
  await setupAdmin(page, '#/inventory');
  await page.locator('#iadd').click();
  await page.locator('.overlay #p_name').fill('Test Snorkel Kit');
  await page.locator('.overlay #p_partNumber').fill('SNK-001');
  await page.locator('.overlay #p_brand').fill('Safari');
  await page.locator('.overlay #p_cost').fill('60');
  await page.locator('.overlay #p_price').fill('95');
  await page.locator('.overlay #p_stock').fill('4');
  await page.locator('.overlay #p_save').click();
  const p = await page.evaluate(() => DB.data.products.find(x => x.partNumber === 'SNK-001'));
  expect(p).toMatchObject({ name: 'Test Snorkel Kit', cost: 60, price: 95, stock: 4 });
  await page.evaluate((id) => document.querySelector(`[data-adj="${id}"]`) ? document.querySelector(`[data-adj="${id}"]`).click() : null, p.id);
  if (await page.locator('.overlay #a_q').count()) { await page.locator('.overlay #a_q').fill('-1'); await page.locator('.overlay #a_s').click(); expect(await page.evaluate((id) => DB.product(id).stock, p.id)).toBe(3); }
  await go(page, 'pos');
  await page.locator('#pq').fill('SNK-001');
  await expect(page.locator(`#pgrid [data-pid="${p.id}"]`)).toBeVisible();
});

test('finance: add an expense and see it in the totals', async ({ page }) => {
  await setupAdmin(page, '#/finance');
  const before = await page.evaluate(() => DB.data.expenses.length);
  await page.locator('#eadd').click();
  await page.locator('.overlay #x_c').selectOption('marketing');
  await page.locator('.overlay #x_d').fill('Instagram boost – test');
  await page.locator('.overlay #x_a').fill('42.5');
  await page.locator('.overlay #x_s').click();
  const e = await page.evaluate(() => DB.data.expenses.slice(-1)[0]);
  expect(await page.evaluate(() => DB.data.expenses.length)).toBe(before + 1);
  expect(e).toMatchObject({ category: 'marketing', desc: 'Instagram boost – test', amount: 42.5 });
  await expect(page.locator('#view')).toContainText('Instagram boost – test');
});

test('customers: add a customer, find them in the POS', async ({ page }) => {
  await setupAdmin(page, '#/customers');
  await page.locator('#cadd').click();
  await page.locator('.overlay #cf_n').fill('Zahir Al Test');
  await page.locator('.overlay #cf_p').fill('+968 9876 5432');
  await page.locator('.overlay #cf_s').click();
  await expect(page.locator('#view')).toContainText('Zahir Al Test');
  await go(page, 'pos');
  await page.locator('#pcq').fill('9876');
  await expect(page.locator('#pcRes')).toContainText('Zahir Al Test');
});

test('WhatsApp campaign: audience, product links, one message at a time, logged', async ({ page }) => {
  await setupAdmin(page, '#/whatsapp');
  await page.locator('#wa_new').click();
  await page.locator('.overlay #cp_a').selectOption('workshop');
  const n = Number(await page.locator('.overlay #cp_cnt').textContent());
  expect(n).toBeGreaterThan(0);
  await page.locator('.overlay #cp_p').selectOption({ index: 0 });
  await expect(page.locator('.overlay #cp_prev')).toContainText('#/p/');
  await page.locator('.overlay #cp_go').click();
  await page.locator('.overlay #rc_next').click();
  const links = await opened(page);
  expect(links).toHaveLength(1);
  const c = await page.evaluate(() => DB.data.campaigns.slice(-1)[0]);
  expect(c.recipients.filter(r => r.sent)).toHaveLength(1);
  // only customers who opted in and are workshops
  for (const r of c.recipients) expect(await page.evaluate((id) => { const x = DB.customer(id); return x.type === 'workshop' && x.optIn !== false; }, r.cid)).toBe(true);
  expect(await page.evaluate(() => DB.data.waLog[0].type)).toBe('campaign');
});

test('backup download has no secrets; restore brings data back and keeps the keys', async ({ page }) => {
  await setupAdmin(page, '#/settings');
  await page.locator('#st_key').fill('sk-ant-keep-me'); await page.locator('#st_keysave').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#st_bk').click()]);
  const fs = require('fs');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  expect(text).not.toContain('sk-ant-keep-me');
  const backup = JSON.parse(text);
  expect(backup.secrets).toBeUndefined();
  expect(backup.sales.length).toBeGreaterThan(10);
  // wipe transactions, then restore
  await page.evaluate(() => { DB.startFresh(); });
  expect(await page.evaluate(() => DB.data.sales.length)).toBe(0);
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await go(page, 'settings');
  await page.locator('#st_rs').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect.poll(() => page.evaluate(() => DB.data.sales.length)).toBe(backup.sales.length);
  expect(await page.evaluate(() => DB.data.secrets.aiKey)).toBe('sk-ant-keep-me');
  // a broken file is refused
  page.once('dialog', d => d.accept());
  await page.locator('#st_rs').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  expect(await page.evaluate(() => DB.data.sales.length)).toBe(backup.sales.length);
});

test('publish to website: sends only public data to GitHub with the token', async ({ page, context }) => {
  const puts = [];
  await context.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, PUT' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (req.method() === 'GET') return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: JSON.stringify({ sha: 'abc123' }) });
    puts.push({ url: req.url(), auth: req.headers().authorization, body: JSON.parse(req.postData()) });
    return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, cors), body: '{}' });
  });
  await setupAdmin(page, '#/settings');
  // one product with a public price, everything else "price on request"
  const pid = await page.evaluate(() => { const p = DB.data.products[0]; p.showPrice = true; DB.save(); return p.id; });
  await page.locator('#gh_tok').fill('github_pat_TEST');
  await page.locator('#gh_pub').click();
  await expect(page.locator('#gh_st')).toContainText('Published', { timeout: 15000 });
  expect(puts).toHaveLength(1);
  expect(puts[0].url).toBe('https://api.github.com/repos/A7hraf/4x4wheelsoman/contents/assets/js/catalog.js');
  expect(puts[0].auth).toBe('Bearer github_pat_TEST');
  expect(puts[0].body.sha).toBe('abc123');
  const js = Buffer.from(puts[0].body.content, 'base64').toString('utf8');
  const cat = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
  const p0 = cat.products.find(p => p.id === pid);
  expect(p0.price).toBeGreaterThan(0);
  expect(cat.products.filter(p => p.id !== pid).every(p => p.price === 0)).toBe(true);
  for (const banned of ['"cost"', 'Ahmed Al Balushi', 'github_pat_TEST', '"secrets"', '"sales"']) expect(js).not.toContain(banned);
  expect(cat.products.every(p => p.stock === 0)).toBe(true); // "show stock" is off
  // the token is stored encrypted, not in plain localStorage
  expect(await page.evaluate(() => localStorage.getItem('x4w_gh_token'))).toBeNull();
});

test('preview website shows unpublished changes without exposing costs', async ({ page, context }) => {
  await setupAdmin(page, '#/settings');
  await page.evaluate(() => { const p = DB.data.products.find(x => x.slug === 'ome-bp51-lc300'); p.name = 'PREVIEW NAME BP-51'; DB.save(); });
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await go(page, 'settings');
  await page.locator('#st_prev').click();
  const pv = await page.evaluate(() => localStorage.getItem('x4w_preview'));
  expect(pv).toContain('PREVIEW NAME BP-51');
  expect(pv).not.toContain('"cost"');
  const store = await context.newPage();
  await store.goto('index.html?preview#/p/ome-bp51-lc300');
  await expect(store.locator('h1')).toContainText('PREVIEW NAME BP-51');
});

test('reports and the printable business report render', async ({ page }) => {
  const errors = watchErrors(page);
  await setupAdmin(page, '#/reports');
  expect(await page.locator('#view canvas').count()).toBeGreaterThan(3);
  await go(page, 'advisor');
  await expect(page.locator('.ring b')).toHaveText(/\d+/);
  await page.locator('#genRep').click();
  const frame = page.frameLocator('#repFrame');
  await expect(frame.locator('h1')).toHaveText('Business performance report');
  await expect(frame.locator('body')).toContainText('Monthly P&L');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#repDl').click()]);
  expect(dl.suggestedFilename()).toMatch(/business-report-\d{4}-\d{2}-\d{2}\.html/);
  expect(errors).toEqual([]);
});

test('dashboard works on a phone (no sideways scrolling)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await setupAdmin(page);
  for (const r of ['dashboard', 'pos', 'orders', 'quotes', 'purchases', 'settings', 'advisor']) {
    await go(page, r);
    await expect(page.locator('#view')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});
