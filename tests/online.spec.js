// Online mode: owner + employees sharing data through the Business Hub server.
// Starts the real API with an embedded Postgres and fake supplier websites (server/test/serve.js).
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const { offline, watchErrors, unlocked, go } = require('./helpers');

const API_PORT = 8790 + Math.floor(Math.random() * 100);
const API = `http://localhost:${API_PORT}`;
const OWNER_PW = 'Desert-Fox-2026!';
let srv;

test.describe.configure({ mode: 'serial' });
// The test rewrites admin.html's CSP through Playwright, and Chrome then treats the page as "public";
// its calls to the local test server would be blocked by Local Network Access, which a real deployment
// (https site → https API) never meets.
test.use({ launchOptions: Object.assign({}, process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}, { args: ['--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'] }) });
test.setTimeout(90000);

test.beforeAll(async ({ baseURL }) => {
  const origin = new URL(baseURL).origin;
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'test', 'serve.js'), String(API_PORT), origin], { cwd: path.join(__dirname, '..', 'server'), stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 60000);
    srv.stdout.on('data', d => { if (String(d).includes('READY')) { clearTimeout(t); resolve(); } });
    srv.on('exit', c => reject(new Error('server exited ' + c)));
  });
});
test.afterAll(async () => { if (srv) srv.kill('SIGTERM'); });

// Point the dashboard at the test server, as a real deployment does in config.js + the CSP.
async function onlineContext(browser) {
  const context = await browser.newContext();
  await offline(context);
  // supplier product photos (no internet in tests)
  await context.route(/^https:\/\/(cdn\.shopify\.com|mag\.example|www\.offroad-zone\.com)\//, r => r.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await context.route('**/assets/js/config.js', r => r.fulfill({ contentType: 'application/javascript', body: `window.X4W_API = '${API}';` }));
  await context.route(/\/admin\.html/, async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace("connect-src 'self'", `connect-src 'self' ${API}`);
    r.fulfill({ response: res, body });
  });
  return context;
}
async function signIn(page, user, pw) {
  await page.goto('admin.html');
  await page.locator('#authUser').fill(user);
  await page.locator('#authPw').fill(pw);
  await page.locator('#authGo').click();
  await unlocked(page);
}
const refresh = (page) => page.evaluate(() => Auth.refresh());

let owner, ownerErrors, cashier, keeper, amw, productId;

test('owner: first sign-in with the setup code, then start with demo data', async ({ browser }) => {
  const ctx = await onlineContext(browser);
  owner = await ctx.newPage(); ownerErrors = watchErrors(owner);
  owner.on('dialog', d => { ownerErrors.push('dialog: ' + d.message()); d.dismiss(); });
  owner.on('response', r => { if (r.status() >= 400) ownerErrors.push('http ' + r.status() + ' ' + r.url()); });
  await owner.goto('admin.html');
  await expect(owner.locator('.auth h1')).toHaveText('Create the owner account');
  await owner.locator('#sCode').fill('wrong-code');
  await owner.locator('#sName').fill('Ashraf');
  await owner.locator('#authUser').fill('ashraf');
  await owner.locator('#authPw').fill(OWNER_PW);
  await owner.locator('#authPw2').fill(OWNER_PW);
  await owner.locator('#authGo').click();
  await expect(owner.locator('#authErr')).toHaveText('Wrong setup code.');
  ownerErrors.length = 0; // the 403 above was expected
  await owner.locator('#sCode').fill('SETUP-TEST-1');
  await owner.locator('#authGo').click();
  await expect(owner.locator('.auth h1')).toHaveText('Move your data online');
  await owner.locator('#useDemo').click();
  await unlocked(owner);
  await expect(owner.locator('html')).toHaveClass(/online-mode/);
  await expect(owner.locator('#side a[href="#/team"]')).toBeVisible();
  await expect(owner.locator('#side a[href="#/approvals"]')).toBeVisible();
  await expect(owner.locator('#side a[href="#/suppliers"]')).toBeVisible();
  // data really is on the server
  const n = await owner.evaluate(async () => (await Auth.api('GET', '/api/state')).data.products.length);
  expect(n).toBeGreaterThan(10);
});

test('owner: adds the real suppliers, syncs AM Wrangler, picks a product with a margin', async () => {
  // the server adds the owner's four suppliers by itself and copies their catalogs
  await expect.poll(async () => { await refresh(owner); return owner.evaluate(() => DB.data.suppliers.filter(s => ['AM Wrangler', 'Offroad Zone', 'Titan Performance', 'Ramy Automotive'].includes(s.name)).length); }, { timeout: 20000 }).toBe(4);
  await expect.poll(() => owner.evaluate(async () => { const st = (await Auth.api('GET', '/api/suppliers/stats')).stats; return Object.values(st).filter(x => x.items && !x.running).length; }), { timeout: 30000 }).toBe(3); // AM Wrangler, Offroad Zone and Titan's list
  await go(owner, 'suppliers');
  await expect(owner.locator('#supKnown')).toHaveCount(0);
  await expect(owner.locator('.sup-card', { hasText: 'AM Wrangler' })).toContainText('In catalog');
  await expect(owner.locator('.sup-card', { hasText: 'Ramy Automotive' })).toContainText('Product links · checked daily'); // Ramy blocks product lists: products are added by link
  await expect(owner.locator('.sup-card', { hasText: 'Titan Performance' })).toContainText('In catalog'); // Titan's list comes from its sitemap
  await owner.locator('.sup-card', { hasText: 'AM Wrangler' }).click();
  amw = await owner.evaluate(() => DB.data.suppliers.find(s => s.name === 'AM Wrangler').id);
  await owner.locator('#supSync').click();
  await expect(owner.locator('.toast').filter({ hasText: '3 products' })).toBeVisible({ timeout: 20000 });
  await go(owner, 'sourcing');
  await expect(owner.locator('.sync-strip')).toContainText('AM Wrangler');
  await expect(owner.locator('.sync-strip')).toContainText('3 products');
  await owner.locator('#srcQ').fill('rock slider');
  await owner.locator('#srcForm button[type=submit]').click();
  const card = owner.locator('.src-card', { hasText: 'RS-100' });
  await expect(card).toContainText('AED 1,000.00');
  await expect(card).toContainText('Cheaper at Offroad Zone'); // 900 AED + 5% VAT < 1,000 AED
  await card.locator('[data-add]').click();
  // 1,000 AED × 0.1047 × 1.10 shipping = OMR 115.170 landed; 35% margin → 155.48 → rounded up to 156
  await expect(owner.locator('#sm_lc')).toHaveText('OMR 115.170');
  await expect(owner.locator('#sm_pr')).toHaveValue('156');
  await owner.locator('#sm_mk').fill('40');
  await expect(owner.locator('#sm_pr')).toHaveValue('162');
  await owner.locator('#sm_save').click();
  const p = await owner.evaluate(() => { const p = DB.data.products.find(x => (x.sources || []).some(s => s.sku === 'RS-100')); return p && { id: p.id, price: p.price, cost: p.cost, stock: p.stock, src: p.sources[0] }; });
  expect(p.price).toBe(162); expect(p.cost).toBeCloseTo(115.17, 3); expect(p.stock).toBe(0);
  expect(p.src.url).toContain('variant=1');
  productId = p.id;
  await go(owner, 'sourcing'); await owner.locator('[data-tab="mine"]').click();
  await expect(owner.locator('#srcBody')).toContainText('Rock Slider');

  // pick several products at once and add them with one margin
  await owner.locator('[data-tab="search"]').click();
  await owner.locator('#srcQ').fill('');
  await owner.locator('#srcSup').selectOption({ label: 'Offroad Zone' });
  await expect(owner.locator('.src-card')).toHaveCount(3);
  await owner.locator('#pickAll').check();
  await expect(owner.locator('#bulkBar')).toBeVisible();
  await owner.locator('#bulkMk').fill('30');
  await owner.locator('#bulkAdd').click();
  await expect(owner.locator('.overlay')).toContainText('Add 3 products');
  await owner.locator('#bk_ok').click();
  const added = await owner.evaluate(() => DB.data.products.filter(p => (p.sources || []).some(s => s.supplierId === 'sup_offroadzone')).map(p => ({ sku: p.sources[0].sku, price: p.price, cost: p.cost })));
  expect(added.length).toBe(3);
  // Winch 2,500 AED +5% VAT ×0.1047 ×1.10 = 302.333 → +30% = 393.03 → 394
  expect(added.find(a => a.sku === 'W-9').price).toBe(394);
});

test('owner: creates employees with detailed permissions', async () => {
  await go(owner, 'team');
  await owner.locator('#tmAdd').click();
  await owner.locator('#um_name').fill('Salim');
  await owner.locator('#um_user').fill('salim');
  await owner.locator('[data-preset="cashier"]').click();
  await expect(owner.locator('input[name="pm_pos"][value="edit"]')).toBeChecked();
  await expect(owner.locator('input[name="pm_finance"][value="none"]')).toBeChecked();
  await owner.locator('#um_pw').fill('Cashier-2026!');
  await owner.locator('#um_save').click();
  await expect(owner.locator('.overlay')).toContainText('Give these to the employee');
  await expect(owner.locator('.overlay')).toContainText('salim');
  await owner.locator('.overlay [data-close]').first().click();

  await owner.locator('#tmAdd').click();
  await owner.locator('#um_name').fill('Khalid');
  await owner.locator('#um_user').fill('khalid');
  await owner.locator('[data-preset="storekeeper"]').click();
  await owner.locator('input[name="pm_pricing"][value="request"]').check();
  await owner.locator('#um_pw').fill('Keeper-2026!');
  await owner.locator('#um_save').click();
  await expect(owner.locator('.overlay')).toContainText('khalid');
  await owner.locator('.overlay [data-close]').first().click();
  await expect(owner.locator('#tmBody')).toContainText('Cashier');
  await expect(owner.locator('#tmBody')).toContainText('@khalid');
});

test('cashier: sees only their sections, no costs; sells an item that must be bought', async ({ browser }) => {
  const ctx = await onlineContext(browser);
  cashier = await ctx.newPage(); const errors = watchErrors(cashier);
  await signIn(cashier, 'salim', 'Cashier-2026!');
  await expect(cashier.locator('#side a[href="#/pos"]')).toBeVisible();
  for (const r of ['finance', 'team', 'suppliers', 'reports', 'sourcing']) await expect(cashier.locator(`#side a[href="#/${r}"]`)).toHaveCount(0);
  expect(await cashier.evaluate(() => DB.data.products.every(p => p.cost === undefined))).toBe(true);
  expect(await cashier.evaluate(() => DB.data.expenses.length)).toBe(0);
  // the gross-profit tile is not shown
  await go(cashier, 'dashboard');
  await expect(cashier.locator('.kpi', { hasText: 'Gross profit' })).toHaveCount(0);

  await go(cashier, 'pos');
  await cashier.locator('#pq').fill('Rock Slider');
  await cashier.locator(`#pgrid [data-pid="${productId}"]`).click();
  await expect(cashier.locator('.overlay')).toContainText('Not in stock');
  await cashier.locator('.overlay #yes').click();
  await cashier.locator('#cart [data-pay="card"]').click();
  await cashier.locator('#pcharge').click();
  await expect(cashier.locator('.overlay')).toContainText('INV-');
  await expect.poll(() => cashier.evaluate(() => DB.data.sales[DB.data.sales.length - 1].createdByName)).toBe('Salim'); // stamped by the server
  const sale = await cashier.evaluate(() => DB.data.sales[DB.data.sales.length - 1]);
  expect(sale.createdByName).toBe('Salim');
  expect(sale.items[0].toBuy).toBe(1);
  expect(sale.items[0].supplierId).toBe(amw);
  expect(sale.items[0].cost).toBeUndefined();

  // a discount above the 5% cashier limit is stopped at the till…
  await go(cashier, 'dashboard'); await go(cashier, 'pos');
  const before = await cashier.evaluate(() => DB.data.sales.length);
  const msg = await cashier.evaluate((pid) => { try { DB.createSale({ channel: 'shop', source: 'pos', payment: 'cash', discount: 50, items: [{ pid, qty: 1 }] }); return 'created'; } catch (e) { return e.message; } }, productId);
  expect(msg).toContain('above your limit of 5%');
  await expect(cashier.locator('.toast.bad')).toContainText('above your limit of 5%');
  expect(await cashier.evaluate(() => DB.data.sales.length)).toBe(before);
  // …and refused by the server even if the dashboard check is bypassed
  const res = await cashier.evaluate(async (pid) => (await Auth.api('POST', '/api/sync', { batch: [{ col: 'sales', id: 'o_hack', prev: null, data: { id: 'o_hack', no: 'INV-9999', date: Date.now(), channel: 'shop', source: 'pos', items: [{ pid, qty: 1, price: 162 }], subtotal: 162, discount: 50, total: 117.6, status: 'completed' } }] })), productId);
  expect(res.status).toBe('denied');
  expect(errors).toEqual([]);
});

test('owner: the order shows on the supplier page; creates, sends and receives the supplier order', async () => {
  await expect.poll(async () => { await refresh(owner); return owner.evaluate(() => DB.data.sales.some(s => s.createdByName === 'Salim')); }, { timeout: 20000 }).toBe(true);
  await go(owner, 'dashboard');
  await expect(owner.locator('.cc-todo')).toContainText('order lines to buy from suppliers');
  await owner.evaluate(id => { location.hash = '#/suppliers/' + id; }, amw);
  await expect(owner.locator('#supBody')).toContainText('Rock Slider');
  await expect(owner.locator('#supBody')).toContainText('Walk-in');
  await owner.locator('#mkPO').click();
  const send = owner.locator('.overlay');
  await expect(send).toContainText('Send order');
  await expect(send.locator('a', { hasText: 'Open cart on website' })).toHaveAttribute('href', 'https://am-wrangler.com/cart/1:1');
  await expect(send.locator('#po_txt')).toHaveValue(/1 × .*Rock Slider/);
  await send.locator('[data-close]').last().click();
  await expect(owner.locator('[data-tab="orders"]')).toHaveClass(/on/);
  await owner.locator('#supBody [data-recv]').click();
  await owner.locator('.overlay #yes').click();
  await expect(owner.locator('.toast').first()).toBeVisible();
  const st = await owner.evaluate((pid) => ({ stock: DB.product(pid).stock, arrived: DB.data.sales.find(s => s.items.some(i => i.pid === pid)).items[0].arrived }), productId);
  expect(st.stock).toBe(0);           // the received item went to the waiting customer
  expect(st.arrived).toBeTruthy();
  await owner.evaluate(() => Auth.flush());
});

test('store keeper: a price change waits for the owner; approval applies it everywhere', async ({ browser }) => {
  const ctx = await onlineContext(browser);
  keeper = await ctx.newPage(); const errors = watchErrors(keeper);
  await signIn(keeper, 'khalid', 'Keeper-2026!');
  await go(keeper, 'inventory');
  await expect(keeper.locator('.perm-banner')).toHaveCount(0); // inventory: edit
  const pid = await keeper.evaluate(() => { const p = DB.data.products.find(x => x.price > 10 && !(x.sources || []).length); p.price = DB.r3(p.price + 7); DB.save(); return p.id; });
  await expect(keeper.locator('.toast.info')).toContainText('Sent to the owner for approval');
  const orig = await owner.evaluate((id) => DB.product(id).price, pid);
  await expect.poll(() => keeper.evaluate((id) => DB.product(id).price, pid)).toBe(orig); // shown as before until approved

  await refresh(owner);
  await go(owner, 'approvals');
  const card = owner.locator('.ap-card').first();
  await expect(card).toContainText('Khalid');
  await expect(card).toContainText('Price of');
  await card.locator('[data-ok]').click();
  await expect(owner.locator('#apBody')).toContainText('Nothing waiting');
  await expect.poll(async () => { await refresh(keeper); return keeper.evaluate((id) => DB.product(id).price, pid); }, { timeout: 20000 }).toBeCloseTo(orig + 7, 3);
  expect(errors).toEqual([]);
});

test('owner: is told when a supplier changes the price of a product he sells, and fixes it in one click', async () => {
  await fetch(API + '/__test/price?v=1200'); // the supplier raises the price
  await owner.evaluate(() => Auth.api('POST', '/api/suppliers/sup_amwrangler/sync'));
  await go(owner, 'dashboard');
  await owner.evaluate(() => location.reload()); await unlocked(owner);
  await expect(owner.locator('.cc-todo')).toContainText('changed price at the supplier', { timeout: 15000 });
  await expect(owner.locator('.cc-todo')).toContainText('out of stock at the supplier'); // the Winch added earlier
  await expect(owner.locator('#side a[href="#/sourcing"] .badge')).toHaveText('2');
  await owner.locator('.cc-todo a[href="#/sourcing/mine"]').first().click();
  const row = owner.locator('#srcBody tr', { hasText: 'RS-100' });
  await expect(row).toContainText('AED 1,200.00');
  // keep 40% margin: 1,200 × 0.1047 × 1.10 = 138.204 → ×1.4 = 193.49 → 194
  await row.locator('[data-fix="margin"]').click();
  await expect.poll(() => owner.evaluate((id) => DB.product(id).price, productId)).toBe(194);
  expect(await owner.evaluate((id) => DB.product(id).cost, productId)).toBeCloseTo(138.204, 3);
  await expect(owner.locator('#side a[href="#/sourcing"] .badge')).toHaveText('1');
});

test('owner: supplier updates are listed; out-of-stock products are hidden or sold "on order" on the website', async ({ browser }) => {
  await go(owner, 'dashboard');
  await owner.evaluate(() => { location.hash = '#/sourcing/updates'; });
  await expect(owner.locator('.upd-chips')).toContainText('Price up: 1');
  await owner.locator('#updMine').uncheck();
  await expect(owner.locator('tr', { hasText: 'RS-100' }).first()).toContainText('I sell this');
  await expect(owner.locator('#updMode')).toHaveValue('backorder');
  // a product of the website whose supplier ran out, none in the shop
  const slug = await owner.evaluate(() => { const p = DB.data.products.find(x => x.slug && CATALOG.products.some(c => c.slug === x.slug) && x.online !== false); p.stock = 0; p.supplierOut = true; p.outMode = 'default'; p.backorderDays = 12; DB.save(); return p.slug; });
  await owner.evaluate(() => Auth.flush());
  const av = async () => (await (await fetch(API + '/api/public/availability')).json()).items[slug];
  await expect.poll(av).toEqual({ m: 'backorder', d: 12 });
  const ctx = await onlineContext(browser);
  await ctx.route(/\/index\.html|\/$/, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("connect-src 'self' https:", `connect-src 'self' https: ${API}`) }); });
  const shop = await ctx.newPage(); const shopErrors = watchErrors(shop);
  await shop.goto('index.html#/p/' + slug);
  await expect(shop.locator('.avail.bo')).toContainText('on order, about 12 days');
  await expect(shop.locator('.bo-note')).toContainText('delivery in about 12 days');
  // the owner decides to hide it while the supplier has none
  await owner.locator('#updMode').selectOption('hide');
  await owner.evaluate(() => Auth.flush());
  await expect.poll(av).toEqual({ m: 'hide' });
  await shop.goto('index.html#/'); await shop.reload();
  await expect(shop.locator(`a[href="#/p/${slug}"]`)).toHaveCount(0);
  await owner.locator('#updMode').selectOption('backorder');
  await owner.evaluate(() => Auth.flush());
  expect(shopErrors).toEqual([]);
  await ctx.close();
});

test('employee: "My work" shows their tasks and orders (never shop totals); they are notified and can finish tasks', async () => {
  const errors = watchErrors(cashier);
  const ids = await owner.evaluate(async () => {
    const us = (await Auth.api('GET', '/api/users/brief')).users; const salim = us.find(u => u.name === 'Salim'), khalid = us.find(u => u.name === 'Khalid');
    const sale = DB.data.sales.find(s => s.channel !== 'shop' && !['completed', 'delivered', 'cancelled', 'refunded'].includes(s.status));
    sale.assignedTo = salim.id;
    DB.data.tasks.push({ id: 'tk_e2e1', title: 'Call Hamad about the winch', assignedTo: salim.id, assignedName: 'Salim', due: Date.now() + 3600e3, done: false });
    DB.data.tasks.push({ id: 'tk_e2e2', title: 'Count the lift kits', assignedTo: khalid.id, assignedName: 'Khalid', done: false });
    DB.save(); await Auth.flush(); return { sale: sale.no };
  });
  await expect.poll(async () => { await refresh(cashier); return cashier.evaluate(() => DB.data.tasks.map(t => t.id)); }, { timeout: 20000 }).toEqual(['tk_e2e1']); // only their own task
  await go(cashier, 'dashboard');
  await expect(cashier.locator('.page-head h2')).toContainText('Hello, Salim');
  await expect(cashier.locator('#view')).toContainText('Call Hamad about the winch');
  await expect(cashier.locator('#view')).toContainText(ids.sale);
  for (const k of ['Net sales', 'Gross profit', 'Stock value']) await expect(cashier.locator('.kpi', { hasText: k })).toHaveCount(0);
  await expect(cashier.locator('#bellBtn .badge')).toBeVisible();
  await cashier.locator('#bellBtn').click();
  await expect(cashier.locator('#notePanel')).toContainText('Call Hamad about the winch');
  await expect(cashier.locator('#notePanel')).toContainText(ids.sale);
  await cashier.locator('#bellBtn').click();
  // finishing their own task needs no approval, and the owner is told
  await cashier.locator('[data-done="tk_e2e1"]').click();
  await expect(cashier.locator('.toast').last()).toContainText('Done');
  await expect.poll(async () => { await refresh(owner); return owner.evaluate(() => DB.data.tasks.find(t => t.id === 'tk_e2e1').done); }, { timeout: 20000 }).toBe(true);
  const notes = await owner.evaluate(async () => (await Auth.api('GET', '/api/notifications')).items.map(n => n.title).join(' | '));
  expect(notes).toContain('Call Hamad about the winch');
  expect(errors).toEqual([]);
  // but they cannot change someone else's task, or see shop-wide numbers
  const r = await cashier.evaluate(async () => (await Auth.api('POST', '/api/sync', { batch: [{ col: 'tasks', id: 'tk_e2e2', prev: null, data: { id: 'tk_e2e2', title: 'x', done: true } }] })).status);
  expect(r).toBe('denied');
  expect(await cashier.evaluate(async () => { try { await Auth.api('GET', '/api/team/stats'); return 'ok'; } catch (e) { return e.status; } })).toBe(403);
});

test('AI: the owner connects free Gemini; an employee\'s AI only gets what the employee may see', async () => {
  await go(owner, 'settings');
  await owner.locator('#aiProv button[data-k="gemini"]').click();
  await owner.locator('#ai_key').fill('AIza-test-key');
  await owner.locator('#ai_save').click();
  await expect(owner.locator('.toast').last()).toContainText('AI connected');
  await expect(owner.locator('#set-ai .card-h .pill')).toContainText('ON · Google Gemini');
  await expect(owner.locator('#set-ai')).toContainText('may use what is sent on the free plan');

  const errors = watchErrors(cashier);
  await refresh(cashier);
  await go(cashier, 'advisor');
  await expect(cashier.locator('.page-head h2')).toContainText('AI assistant');
  await expect(cashier.locator('.ring')).toHaveCount(0); // no health score / shop totals
  await expect(cashier.locator('#genRep')).toHaveCount(0);
  const req = cashier.waitForRequest(r => r.url().endsWith('/api/ai/v1/messages'));
  await cashier.locator('#chatQ').fill('find a bumper');
  await cashier.locator('#chatSend').click();
  const body = JSON.parse((await req).postData());
  const tools = body.tools.map(t => t.name);
  expect(tools).toContain('search_products');
  expect(tools).toContain('my_performance');
  for (const n of ['sales_breakdown', 'team_performance', 'supplier_updates', 'add_expense', 'create_employee', 'create_purchase_order', 'prepare_campaign']) expect(tools).not.toContain(n);
  const snap = body.messages[0].content;
  expect(snap).toContain('"employee":"Salim"');
  expect(snap).not.toContain('net_sales');
  expect(body.system).toContain('Never give shop-wide totals');
  await expect(cashier.locator('.msg.assistant').last()).toContainText('Found it:', { timeout: 20000 });
  // the product search the AI ran for the cashier has no costs in it
  const res = await cashier.evaluate(() => AI.runTool('search_products', { query: 'bumper' }));
  expect(res.length).toBeGreaterThan(0);
  expect(res.every(p => p.cost === undefined && p.margin_pct === undefined)).toBe(true);
  expect(errors).toEqual([]);
});

test('WhatsApp Business: owner connects it; customer messages arrive in the Inbox; bills and offers go from the shop number', async () => {
  await go(owner, 'settings');
  await expect(owner.locator('#wa_pill')).toHaveText('Not connected');
  await expect(owner.locator('#wa_hook')).toHaveValue(API + '/api/whatsapp/webhook');
  await owner.locator('#wa_pid').fill('123456789012');
  await owner.locator('#wa_waba').fill('987654321098');
  await owner.locator('#wa_tok').fill('EAA-test-token');
  await owner.locator('#wa_sec').fill('app-secret-e2e');
  await owner.locator('#wa_bt').fill('order_update');
  await owner.locator('#wa_save').click();
  await expect(owner.locator('#wa_pill')).toContainText('Connected · +968 9000 0000');
  // a customer writes to the shop (Meta calls the webhook, signed with the app secret)
  const payload = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '96877712345', profile: { name: 'Hamad' } }], messages: [{ id: 'wamid.e2e1', from: '96877712345', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Do you have BP-51 for LC300?' } }] } }] }] });
  const sig = 'sha256=' + require('crypto').createHmac('sha256', 'app-secret-e2e').update(payload).digest('hex');
  const bad = await fetch(API + '/api/whatsapp/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' }, body: payload });
  expect(bad.status).toBe(403);
  const ok = await fetch(API + '/api/whatsapp/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, body: payload });
  expect(ok.status).toBe(200);
  await refresh(owner);
  await go(owner, 'whatsapp');
  await expect(owner.locator('#side a[href="#/whatsapp"] .badge')).toHaveText('1');
  await owner.locator('#wa_inboxTab').click();
  await owner.locator('.wa-conv', { hasText: 'Hamad' }).click();
  await expect(owner.locator('.wa-m.in')).toContainText('BP-51 for LC300');
  await expect(owner.locator('.wa-th-h .pill')).toHaveText('Can reply');
  await owner.locator('#wa_txt').fill('Yes, in stock. Come today!');
  await owner.locator('#wa_txt').press('Enter');
  await expect(owner.locator('.wa-m.out')).toContainText('Yes, in stock');
  // the new number became a customer, not signed up for offers
  await expect.poll(async () => { await refresh(owner); return owner.evaluate(() => { const c = DB.data.customers.find(x => x.phone === '+96877712345'); return c && [c.name, c.optIn]; }); }, { timeout: 15000 }).toEqual(['Hamad', false]);
  // a bill goes from the shop's number (approved template outside the 24-hour window)
  const sale = await owner.evaluate(() => { const s = DB.data.sales.find(x => x.phone && x.items.length && !/99999999/.test(x.phone)); BH.sendBill(s); return { no: s.no, wa: (s.phone.replace(/\D/g, '').length === 8 ? '968' : '') + s.phone.replace(/\D/g, '') }; });
  await expect(owner.locator('.toast').last()).toContainText('Sent on WhatsApp');
  const sent = await owner.evaluate(async (wa) => (await Auth.api('GET', '/api/whatsapp/messages?wa=' + wa)).items, sale.wa);
  expect(sent.some(m => m.direction === 'out' && m.kind === 'bill' && m.status === 'sent')).toBe(true);
  // an offer to chosen customers with an approved Marketing template
  await go(owner, 'whatsapp');
  await owner.locator('#wa_api').click();
  await expect(owner.locator('#ac_t')).toContainText('offer_jl');
  await owner.locator('#ac_a').selectOption('workshop');
  await owner.locator('[data-ap="1"]').fill('15% off Warn winches this week');
  await expect(owner.locator('#ac_go')).toBeEnabled();
  await owner.locator('#ac_go').click();
  await expect(owner.locator('#ac_prog')).toContainText('finished ✓', { timeout: 30000 });
  await owner.locator('.overlay [data-close]').first().click();
});

test('owner: performance and activity per employee; sign out works', async () => {
  await go(owner, 'team');
  await owner.locator('[data-tab="perf"]').click();
  const row = owner.locator('#tmPerf tr', { hasText: 'Salim' });
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(1)).toHaveText('1');
  await owner.locator('[data-tab="activity"]').click();
  await expect(owner.locator('.feed')).toContainText('Approved Khalid');
  await expect(owner.locator('.feed')).toContainText('Synced AM Wrangler');
  expect(ownerErrors).toEqual([]);

  await owner.locator('#lockBtn').click();
  await expect(owner.locator('#authUser')).toBeVisible();
  await expect(owner.locator('#authUser')).toHaveValue('ashraf');
  // the old session no longer works on the server
  const status = await owner.evaluate(async (api) => { const s = JSON.parse(sessionStorage.getItem('x4w_rsess') || 'null'); return s; }, API);
  expect(status).toBeNull();
});

test('switching an employee off signs them out', async () => {
  await signIn(owner, 'ashraf', OWNER_PW);
  const id = await owner.evaluate(async () => (await Auth.api('GET', '/api/users')).users.find(u => u.username === 'salim').id);
  await owner.evaluate((uid) => Auth.api('PUT', '/api/users/' + uid, { active: false }), id);
  await cashier.evaluate(() => Auth.refresh().catch(() => {}));
  await expect(cashier.locator('#authUser')).toBeVisible({ timeout: 15000 });
  await expect(cashier.locator('.auth-note')).toContainText('session ended');
});
