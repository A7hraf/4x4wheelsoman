// End-to-end API tests on a real (embedded) Postgres. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { createPool, migrate } from '../src/store.js';
import { createApp } from '../src/index.js';

process.env.SYNC_PAUSE_MS = '0';
let pg, pool, server, base;
import { fakeFetch, fakeUpstream } from './fakes.js';

before(async () => {
  const dir = path.join(os.tmpdir(), 'x4wpg-' + process.pid + '-' + Date.now()); // must not exist yet (initdb may run as another user)
  const port = 55000 + Math.floor(Math.random() * 3000);
  pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false, onLog: () => {} });
  await pg.initialise(); await pg.start();
  pool = createPool(`postgres://postgres:pw@localhost:${port}/postgres`);
  await migrate(pool);
  const app = createApp({ pool, env: { SETUP_CODE: 'SETUP-123456', APP_SECRET: 'x'.repeat(32), ALLOWED_ORIGINS: 'https://a7hraf.github.io' }, fetchImpl: fakeFetch });
  server = http.createServer(app); await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server && server.close(); pool && await pool.end(); pg && await pg.stop(); });

async function call(method, p, body, token, headers = {}) {
  const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, headers: r.headers };
}
const T = {};
const seed = {
  settings: { vat: 5, currency: 'OMR', github: { repo: 'a/b' } }, makes: ['Jeep'],
  products: [{ id: 'p1', name: 'ARB Bumper', price: 100, cost: 60, stock: 10 }, { id: 'p2', name: 'Lift Kit', price: 50, cost: 20, stock: 3 }],
  customers: [{ id: 'c1', name: 'Ali', phone: '9999' }],
  sales: [], quotes: [], purchases: [], expenses: [{ id: 'e1', desc: 'Rent', amount: 300, category: 'rent' }], moves: [],
  suppliers: [{ id: 'sA', name: 'AM Wrangler', platform: 'shopify', website: 'https://shop.example' }, { id: 'sB', name: 'Offroad Zone', platform: 'magento', website: 'https://mag.example/en' }, { id: 'sC', name: 'Ramy', platform: 'manual', website: 'https://manual.example' }]
};
const sale = (over) => Object.assign({ id: 'o' + Math.random().toString(36).slice(2, 8), no: 'INV-1000', date: Date.now(), channel: 'shop', source: 'pos', items: [{ pid: 'p1', qty: 1, price: 100, cost: 1 }], subtotal: 100, discount: 0, total: 105, status: 'completed', paid: true }, over);

test('first owner needs the setup code, only once', async () => {
  assert.equal((await call('GET', '/api/status')).body.setup, true);
  assert.equal((await call('POST', '/api/setup', { code: 'nope', name: 'Ashraf', username: 'owner', password: 'Desert-Fox-2026!' })).status, 403);
  const r = await call('POST', '/api/setup', { code: 'SETUP-123456', name: 'Ashraf', username: 'Owner', password: 'Desert-Fox-2026!' });
  assert.equal(r.status, 200); assert.equal(r.body.me.role, 'owner'); T.owner = r.body.token;
  assert.equal((await call('POST', '/api/setup', { code: 'SETUP-123456', name: 'X', username: 'x2', password: 'Desert-Fox-2026!' })).status, 409);
  assert.equal((await call('GET', '/api/status')).body.setup, false);
});

test('owner moves the device data online once', async () => {
  const r = await call('POST', '/api/import', { data: Object.assign({ secrets: { aiKey: 'sk-should-not-store' } }, seed) }, T.owner);
  assert.equal(r.status, 200); assert.ok(r.body.count > 5);
  assert.equal((await call('POST', '/api/import', { data: seed }, T.owner)).status, 409);
  const s = await call('GET', '/api/state', null, T.owner);
  assert.equal(s.body.data.products.length, 2); assert.equal(s.body.data.settings.vat, 5); assert.deepEqual(s.body.data.makes, ['Jeep']);
  assert.equal(s.body.data.secrets, undefined);
  T.seq = s.body.seq;
});

test('login: wrong password, lock-out and no access without a session', async () => {
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('GET', '/api/state', null, 'garbage')).status, 401);
  assert.equal((await call('POST', '/api/login', { username: 'owner', password: 'wrong-pass-1' })).status, 401);
  assert.equal((await call('POST', '/api/login', { username: 'nobody', password: 'wrong-pass-1' })).status, 401);
});

test('owner creates employees with detailed permissions; staff cannot', async () => {
  const st = (await call('GET', '/api/status')).body;
  const cashier = await call('POST', '/api/users', { name: 'Salim', username: 'salim', password: 'Cashier-2026!', perms: Object.assign({}, st.presets.cashier) }, T.owner);
  assert.equal(cashier.status, 200, JSON.stringify(cashier.body)); T.cashierId = cashier.body.user.id;
  const keeper = await call('POST', '/api/users', { name: 'Khalid', username: 'khalid', password: 'Keeper-2026!', perms: { inventory: 'request', pricing: 'request', suppliers: 'view', purchases: 'edit' } }, T.owner);
  assert.equal(keeper.status, 200); T.keeperId = keeper.body.user.id;
  assert.equal((await call('POST', '/api/users', { name: 'X', username: 'salim', password: 'Cashier-2026!' }, T.owner)).status, 409);
  assert.equal((await call('POST', '/api/users', { name: 'X', username: 'weak', password: 'short' }, T.owner)).status, 400);
  T.cashier = (await call('POST', '/api/login', { username: 'salim', password: 'Cashier-2026!' })).body.token;
  T.keeper = (await call('POST', '/api/login', { username: 'KHALID', password: 'Keeper-2026!' })).body.token;
  assert.ok(T.cashier && T.keeper);
  assert.equal((await call('POST', '/api/users', { name: 'Y', username: 'yy1', password: 'Cashier-2026!' }, T.cashier)).status, 403);
  assert.equal((await call('PUT', '/api/users/' + T.cashierId, { perms: { finance: 'full' } }, T.cashier)).status, 403);
  assert.equal((await call('GET', '/api/secrets', null, T.cashier)).status, 403);
});

test('a cashier sees no costs, no finance and no GitHub settings', async () => {
  const s = (await call('GET', '/api/state', null, T.cashier)).body;
  assert.equal(s.data.products[0].cost, undefined);
  assert.equal(s.data.expenses, undefined);
  assert.equal(s.data.suppliers, undefined);
  assert.equal(s.data.settings.github, undefined);
  assert.equal(s.me.perms.pos, 'edit'); assert.equal(s.me.perms.finance, 'none');
});

test('cashier sells at the till: stock is merged as a difference, cost comes from the server', async () => {
  const s = (await call('GET', '/api/state', null, T.cashier)).body;
  const p1 = s.data.products.find(p => p.id === 'p1');
  const o = sale({ no: 'INV-1000', items: [{ pid: 'p1', qty: 2, price: 100, cost: 999 }], subtotal: 200, total: 210 });
  const r = await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o.id, prev: null, data: o }, { col: 'products', id: 'p1', prev: p1, data: Object.assign({}, p1, { stock: p1.stock - 2 }) }] }, T.cashier);
  assert.equal(r.body.status, 'ok', JSON.stringify(r.body));
  // owner on another device sells 1 of the same item from an older copy (stock 10 → 9)
  const o2 = sale({ no: 'INV-1000' });
  const r2 = await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o2.id, prev: null, data: o2 }, { col: 'products', id: 'p1', prev: { id: 'p1', name: 'ARB Bumper', price: 100, cost: 60, stock: 10 }, data: { id: 'p1', name: 'ARB Bumper', price: 100, cost: 60, stock: 9 } }] }, T.owner);
  assert.equal(r2.body.status, 'ok');
  const own = (await call('GET', '/api/state', null, T.owner)).body.data;
  assert.equal(own.products.find(p => p.id === 'p1').stock, 7, 'both sales are counted');
  const saved = own.sales.find(x => x.id === o.id);
  assert.equal(saved.items[0].cost, 60, 'cost from server, not from the device');
  assert.equal(saved.createdByName, 'Salim');
  const nos = own.sales.map(x => x.no).sort();
  assert.deepEqual(nos, ['INV-1000', 'INV-1001'], 'duplicate invoice numbers are fixed');
});

test('cashier discount above the limit is refused; lowered prices count too', async () => {
  const o = sale({ no: 'INV-2000', discount: 20, total: 84 });
  const r = await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o.id, prev: null, data: o }] }, T.cashier);
  assert.equal(r.body.status, 'denied'); assert.match(r.body.message, /limit of 5%/);
  const o2 = sale({ no: 'INV-2001', items: [{ pid: 'p1', qty: 1, price: 80 }], subtotal: 80, total: 84 });
  assert.equal((await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o2.id, prev: null, data: o2 }] }, T.cashier)).body.status, 'denied');
  const ok = sale({ no: 'INV-2002', discount: 5, total: 99.75 });
  assert.equal((await call('POST', '/api/sync', { batch: [{ col: 'sales', id: ok.id, prev: null, data: ok }] }, T.cashier)).body.status, 'ok');
});

test('view-only and no-access changes are refused as a whole batch', async () => {
  const st = (await call('GET', '/api/state', null, T.cashier)).body.data;
  const p2 = st.products.find(p => p.id === 'p2');
  const r = await call('POST', '/api/sync', { batch: [{ col: 'products', id: 'p2', prev: p2, data: Object.assign({}, p2, { name: 'Renamed' }) }] }, T.cashier);
  assert.equal(r.body.status, 'denied');
  assert.equal(r.body.rows[0].data.name, 'Lift Kit', 'server sends the real row back so the screen can undo');
  const r2 = await call('POST', '/api/sync', { batch: [{ col: 'expenses', id: 'e9', prev: null, data: { id: 'e9', desc: 'Fake', amount: 1 } }] }, T.cashier);
  assert.equal(r2.body.status, 'denied');
  const r3 = await call('POST', '/api/sync', { batch: [{ col: 'meta', id: 'settings', prev: st.settings, data: Object.assign({}, st.settings, { vat: 0 }) }] }, T.cashier);
  assert.equal(r3.body.status, 'denied');
});

test('request-level changes wait for the owner; approve applies them, reject does not', async () => {
  const s = (await call('GET', '/api/state', null, T.keeper)).body.data;
  const p2 = s.products.find(p => p.id === 'p2');
  assert.equal(p2.cost, undefined, 'keeper has no cost permission');
  const r = await call('POST', '/api/sync', { batch: [{ col: 'products', id: 'p2', prev: p2, data: Object.assign({}, p2, { price: 55 }) }] }, T.keeper);
  assert.equal(r.body.status, 'pending'); assert.ok(r.body.approvalId);
  assert.equal(r.body.rows[0].data.price, 50, 'not applied yet');
  const r2 = await call('POST', '/api/sync', { batch: [{ col: 'products', id: 'pN', prev: null, data: { id: 'pN', name: 'New Snorkel', price: 70, stock: 0, cost: 999 } }] }, T.keeper);
  assert.equal(r2.body.status, 'pending');
  const me = await call('GET', '/api/me', null, T.owner); assert.equal(me.body.pending, 2);
  const list = (await call('GET', '/api/approvals', null, T.owner)).body.items;
  const priceReq = list.find(x => x.id === r.body.approvalId);
  assert.match(priceReq.summary, /Price of Lift Kit: OMR 50.000 → OMR 55.000/);
  assert.deepEqual(priceReq.changes[0].diff, [{ field: 'price', from: 50, to: 55 }]);
  assert.equal((await call('POST', `/api/approvals/${r.body.approvalId}/approve`, {}, T.keeper)).status, 403, 'staff cannot approve');
  // meanwhile the cashier sells one (stock 3 → 2); approval must keep that
  const c = (await call('GET', '/api/state', null, T.cashier)).body.data.products.find(p => p.id === 'p2');
  await call('POST', '/api/sync', { batch: [{ col: 'products', id: 'p2', prev: c, data: Object.assign({}, c, { stock: 2 }) }] }, T.cashier);
  assert.equal((await call('POST', `/api/approvals/${r.body.approvalId}/approve`, { note: 'ok' }, T.owner)).status, 200);
  assert.equal((await call('POST', `/api/approvals/${r.body.approvalId}/approve`, {}, T.owner)).status, 409);
  assert.equal((await call('POST', `/api/approvals/${r2.body.approvalId}/reject`, { note: 'not now' }, T.owner)).status, 200);
  const own = (await call('GET', '/api/state', null, T.owner)).body.data;
  const p = own.products.find(x => x.id === 'p2');
  assert.equal(p.price, 55); assert.equal(p.stock, 2); assert.equal(p.cost, 20, 'cost untouched by someone who cannot see it');
  assert.equal(own.products.find(x => x.id === 'pN'), undefined);
  const mine = (await call('GET', '/api/approvals?status=all', null, T.keeper)).body.items;
  assert.equal(mine.length, 2); assert.ok(mine.find(x => x.status === 'rejected' && x.note === 'not now'));
});

test('edit-level can change directly, but cancelling an order needs approval', async () => {
  await call('PUT', '/api/users/' + T.cashierId, { perms: { pos: 'edit', orders: 'edit', customers: 'edit', inventory: 'view', maxDiscount: 5 } }, T.owner);
  const s = (await call('GET', '/api/state', null, T.cashier)).body.data;
  const o = s.sales[0];
  const r = await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o.id, prev: o, data: Object.assign({}, o, { note: 'gift wrap' }) }] }, T.cashier);
  assert.equal(r.body.status, 'ok');
  const r2 = await call('POST', '/api/sync', { batch: [{ col: 'sales', id: o.id, prev: r.body.rows[0].data, data: Object.assign({}, r.body.rows[0].data, { status: 'cancelled' }) }] }, T.cashier);
  assert.equal(r2.body.status, 'pending');
  const w = await call('POST', `/api/approvals/${r2.body.approvalId}/withdraw`, {}, T.cashier);
  assert.equal(w.status, 200);
});

test('changes feed only shows what the user may read', async () => {
  const c = await call('GET', '/api/changes?since=' + T.seq, null, T.cashier);
  assert.ok(c.body.changes.length > 0);
  assert.ok(c.body.changes.every(x => x.col !== 'expenses' && x.col !== 'suppliers'));
  assert.ok(c.body.changes.filter(x => x.col === 'products').every(x => x.data == null || x.data.cost === undefined));
});

test('switching an employee off ends their session at once', async () => {
  const t = (await call('POST', '/api/login', { username: 'khalid', password: 'Keeper-2026!' })).body.token;
  await call('PUT', '/api/users/' + T.keeperId, { active: false }, T.owner);
  assert.equal((await call('GET', '/api/me', null, t)).status, 401);
  assert.equal((await call('POST', '/api/login', { username: 'khalid', password: 'Keeper-2026!' })).status, 403);
  await call('PUT', '/api/users/' + T.keeperId, { active: true }, T.owner);
  T.keeper = (await call('POST', '/api/login', { username: 'khalid', password: 'Keeper-2026!' })).body.token;
  assert.equal((await call('PUT', '/api/users/' + (await call('GET', '/api/me', null, T.owner)).body.me.id, { active: false }, T.owner)).status, 400, 'owner cannot lock themselves out');
});

test('performance and activity per employee', async () => {
  const st = (await call('GET', '/api/team/stats?days=30', null, T.owner)).body;
  const salim = st.users.find(u => u.username === 'salim');
  assert.ok(salim.sales >= 2); assert.ok(salim.revenue > 0); assert.ok(salim.requests >= 1);
  const act = (await call('GET', '/api/activity?user=' + T.cashierId, null, T.owner)).body.items;
  assert.ok(act.some(a => /New sale INV-/.test(a.summary)));
  const own = (await call('GET', '/api/activity', null, T.cashier)).body.items;
  assert.ok(own.every(a => a.userId === T.cashierId), 'staff only see their own activity');
  assert.equal((await call('GET', '/api/team/stats', null, T.cashier)).status, 403);
});

test('supplier detection and catalogue sync (Shopify + Magento), price-change tracking', async () => {
  assert.equal((await call('POST', '/api/suppliers/detect', { url: 'https://shop.example/' }, T.owner)).body.platform, 'shopify');
  assert.equal((await call('POST', '/api/suppliers/detect', { url: 'https://mag.example/en' }, T.owner)).body.platform, 'magento');
  assert.equal((await call('POST', '/api/suppliers/detect', { url: 'https://manual.example' }, T.owner)).body.platform, 'manual');
  assert.equal((await call('POST', '/api/suppliers/detect', { url: 'https://localhost/x' }, T.owner)).body.platform, 'manual');
  fakeUpstream.calls = [];
  assert.equal((await call('POST', '/api/suppliers/detect', { url: 'https://redir.example/' }, T.owner)).body.platform, 'manual');
  assert.ok(!fakeUpstream.calls.some(c => c.url.includes('10.0.0.5')), 'redirect to an internal address is not followed');
  // after the data was moved online, the owner's four suppliers were added and catalogs copied by themselves
  let st;
  for (let i = 0; i < 100; i++) { st = (await call('GET', '/api/suppliers/stats', null, T.owner)).body.stats; if (['sA', 'sB', 'sup_amwrangler', 'sup_offroadzone'].every(id => st[id] && st[id].items && !st[id].running)) break; await new Promise(r => setTimeout(r, 100)); }
  assert.equal(st.sA.items, 3); assert.equal(st.sup_offroadzone.items, 3, 'null entries in the Magento feed are skipped');
  const sups = (await call('GET', '/api/state', null, T.owner)).body.data.suppliers.map(x => x.name);
  for (const n of ['AM Wrangler', 'Offroad Zone', 'Titan Performance', 'Ramy Automotive']) assert.ok(sups.includes(n), n);
  const a = await call('POST', '/api/suppliers/sA/sync', {}, T.owner);
  assert.equal(a.status, 200, JSON.stringify(a.body)); assert.equal(a.body.total, 3);
  const b = await call('POST', '/api/suppliers/sB/sync', {}, T.owner);
  assert.equal(b.body.total, 3);
  assert.equal((await call('POST', '/api/suppliers/sC/sync', {}, T.owner)).status, 400);
  const q = (await call('GET', '/api/catalog?q=rock slider', null, T.owner)).body;
  const rs = q.items.find(i => i.sku === 'RS-100' && i.supplierId === 'sA');
  assert.equal(rs.price, 1000); assert.equal(rs.url, 'https://shop.example/products/rock-slider?variant=1');
  const sb = rs.also.find(x => x.supplierId === 'sB'); assert.ok(sb, 'same part found at the other supplier'); assert.equal(sb.price, 900);
  const led = (await call('GET', '/api/catalog?q=LED&avail=1&supplier=sA', null, T.owner)).body.items;
  assert.deepEqual(led.map(i => i.sku), ['LB-2']);
  globalThis.__rsPrice = '1100.00';
  await call('POST', '/api/suppliers/sA/sync', {}, T.owner);
  const ch = (await call('GET', '/api/catalog?changed=1', null, T.owner)).body.items;
  assert.equal(ch[0].sku, 'RS-100'); assert.equal(ch[0].prevPrice, 1000); assert.equal(ch[0].price, 1100);
  const stats = (await call('GET', '/api/suppliers/stats', null, T.owner)).body.stats;
  assert.equal(stats.sA.items, 3); assert.equal(stats.sA.lastRun.ok, true);
  // cashier: no access to catalogues; employees without cost permission see no supplier prices
  assert.equal((await call('GET', '/api/catalog', null, T.cashier)).status, 403);
  const kq = (await call('GET', '/api/catalog?q=winch', null, T.keeper)).body.items;
  assert.equal(kq[0].price, null);
  assert.equal((await call('POST', '/api/suppliers/sA/sync', {}, T.keeper)).status, 403);
});

test('Claude proxy: key stays on the server, needs a session and AI permission', async () => {
  const msg = { model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] };
  assert.equal((await call('POST', '/api/ai/v1/messages', msg, null, { 'x-api-key': T.owner })).status, 412, 'no key yet');
  const put = await call('PUT', '/api/secrets', { aiKey: 'sk-ant-real', ghToken: 'ghp_x' }, T.owner);
  assert.equal(put.body.hasAiKey, true);
  const sec = (await call('GET', '/api/secrets', null, T.owner)).body;
  assert.equal(sec.aiKey, undefined); assert.equal(sec.ghToken, 'ghp_x');
  const stored = (await pool.query("SELECT value FROM kv WHERE key='aiKey'")).rows[0].value;
  assert.ok(!JSON.stringify(stored).includes('sk-ant-real'), 'encrypted at rest');
  fakeUpstream.calls = [];
  const r = await call('POST', '/api/ai/v1/messages', msg, null, { 'x-api-key': T.owner, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' });
  assert.equal(r.status, 200); assert.equal(r.body.content[0].text, 'hi');
  const up = fakeUpstream.calls.find(c => c.url.includes('anthropic'));
  assert.equal(up.opts.headers['x-api-key'], 'sk-ant-real'); assert.equal(up.opts.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal((await call('POST', '/api/ai/v1/messages', msg, null, { 'x-api-key': 'stolen' })).status, 401);
  assert.equal((await call('POST', '/api/ai/v1/messages', msg, null, { 'x-api-key': T.cashier })).status, 403);
});

test('CORS only for the shop website; security headers on every answer', async () => {
  const ok = await fetch(base + '/api/status', { headers: { Origin: 'https://a7hraf.github.io' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://a7hraf.github.io');
  const bad = await fetch(base + '/api/status', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff'); assert.equal(ok.headers.get('cache-control'), 'no-store');
  const pre = await fetch(base + '/api/ai/v1/messages', { method: 'OPTIONS', headers: { Origin: 'https://a7hraf.github.io', 'Access-Control-Request-Headers': 'x-api-key,anthropic-version' } });
  assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /x-api-key/);
});

test('changing your password signs out other devices', async () => {
  const other = (await call('POST', '/api/login', { username: 'salim', password: 'Cashier-2026!' })).body.token;
  assert.equal((await call('POST', '/api/me/password', { current: 'bad', password: 'Cashier-2027!' }, T.cashier)).status, 403);
  assert.equal((await call('POST', '/api/me/password', { current: 'Cashier-2026!', password: 'Cashier-2027!' }, T.cashier)).status, 200);
  assert.equal((await call('GET', '/api/me', null, other)).status, 401);
  assert.equal((await call('GET', '/api/me', null, T.cashier)).status, 200);
});

test('lock-out after repeated wrong passwords', async () => {
  for (let i = 0; i < 5; i++) await call('POST', '/api/login', { username: 'khalid', password: 'Wrong-pass-' + i });
  const r = await call('POST', '/api/login', { username: 'khalid', password: 'Keeper-2026!' });
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0);
});
