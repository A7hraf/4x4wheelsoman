// Supplier changes, out-of-stock handling, notifications, tasks, AI providers and WhatsApp.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { createPool, migrate } from '../src/store.js';
import { createApp } from '../src/index.js';
import { fakeFetch, fakeUpstream } from './fakes.js';
import { remindTasks } from '../src/notify.js';
import { parseProductPage } from '../src/suppliers.js';

process.env.SYNC_PAUSE_MS = '0'; process.env.SYNC_RETRY_MS = '10,10'; process.env.WA_PAUSE_MS = '0';
let pg, pool, server, base;
before(async () => {
  const port = 52000 + Math.floor(Math.random() * 3000);
  pg = new EmbeddedPostgres({ databaseDir: path.join(os.tmpdir(), 'x4wpg-ops-' + process.pid + '-' + Date.now()), user: 'postgres', password: 'pw', port, persistent: false, onLog: () => {} });
  await pg.initialise(); await pg.start();
  pool = createPool(`postgres://postgres:pw@localhost:${port}/postgres`);
  await migrate(pool);
  server = http.createServer(createApp({ pool, env: { SETUP_CODE: 'SETUP-OPS', APP_SECRET: 'y'.repeat(32), ALLOWED_ORIGINS: 'https://a7hraf.github.io', PUBLIC_URL: 'https://api.example' }, fetchImpl: fakeFetch }));
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server && server.close(); pool && await pool.end(); pg && await pg.stop(); });

async function call(method, p, body, token, headers = {}) {
  const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers), body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, headers: r.headers };
}
const wait = async (fn, ms = 8000) => { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
const T = {};
const state = async (tok) => (await call('GET', '/api/state', null, tok)).body.data;
const sync = (tok, batch) => call('POST', '/api/sync', { batch }, tok);

test('setup, data, the owner\'s four suppliers and automatic catalogs (incl. Titan from its sitemap)', async () => {
  T.owner = (await call('POST', '/api/setup', { code: 'SETUP-OPS', name: 'Ashraf', username: 'owner', password: 'Desert-Fox-2026!' })).body.token;
  const r = await call('POST', '/api/import', { data: {
    settings: { name: '4x4 Wheels Oman', vat: 5, supplierOutMode: 'backorder' }, makes: [],
    products: [{ id: 'p1', name: 'Bumper', slug: 'bumper', price: 100, cost: 60, stock: 3 }],
    customers: [{ id: 'c1', name: 'Ali', phone: '+968 9111 1111' }, { id: 'c2', name: 'Said', phone: '92222222', optIn: false }],
    sales: [], suppliers: []
  } }, T.owner);
  assert.equal(r.status, 200);
  const sups = await wait(async () => { const d = await state(T.owner); return d.suppliers && d.suppliers.length === 4 && d.suppliers; });
  assert.deepEqual(sups.map(s => s.platform).sort(), ['links', 'magento', 'shopify', 'sitemap']);
  const st = await wait(async () => { const s = (await call('GET', '/api/suppliers/stats', null, T.owner)).body.stats; return s.sup_titan && s.sup_titan.items && s.sup_amwrangler && s.sup_amwrangler.items && !s.sup_titan.running && s; });
  assert.equal(st.sup_titan.items, 3);
  const t = (await call('GET', '/api/catalog?supplier=sup_titan&q=lp4', null, T.owner)).body.items[0];
  assert.equal(t.partNo, '297814'); assert.equal(t.price, null); assert.match(t.title, /Lp4 Pro Led Auxiliary Light Pod Pair \(297814\)/);
  assert.equal(t.url, 'https://titanperformanceuae.com/product/297814-lp4-pro-led-auxiliary-light-pod-pair');
});

test('reading one product page: Ramy (meta tags) and JSON-LD', async () => {
  const r = await call('POST', '/api/suppliers/read-link', { url: 'https://www.ramyautomotive.com/aor-extreme-4-in-1-inflate-deflate-system' }, T.owner);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.title, 'AOR Extreme 4 in 1 Inflate/Deflate System');
  assert.equal(r.body.sku, 'EQ-AIR-01'); assert.equal(r.body.price, 945); assert.equal(r.body.available, true); assert.equal(r.body.supplierId, 'sup_ramy');
  const j = await call('POST', '/api/suppliers/read-link', { url: 'https://www.ramyautomotive.com/json-ld-product' }, T.owner);
  assert.deepEqual([j.body.title, j.body.sku, j.body.price, j.body.currency, j.body.available, j.body.vendor], ['Winch 12k', 'WN-12', 3200.5, 'AED', false, 'Warn']);
  assert.equal((await call('POST', '/api/suppliers/read-link', { url: 'https://titanperformanceuae.com/product/x' }, T.owner)).status, 422, 'pages that load in the browser give a clear error');
  assert.equal((await call('POST', '/api/suppliers/read-link', { url: 'http://localhost/x' }, T.owner)).status, 400);
  const blocked = parseProductPage('<html><title>Just a moment...</title><div class="cf-chl"></div></html>', 'https://x');
  assert.equal(blocked.price, null);
});

test('daily check of linked products: price and stock changes are logged, the website shows "on order" or hides it', async () => {
  const d = await state(T.owner);
  const prod = { id: 'p2', name: 'AOR Inflate/Deflate', slug: 'aor-inflate', price: 140, cost: 110, stock: 0, sources: [{ supplierId: 'sup_ramy', sku: 'EQ-AIR-01', url: 'https://www.ramyautomotive.com/aor-extreme-4-in-1-inflate-deflate-system', price: 945, currency: 'AED', preferred: true }] };
  assert.equal((await sync(T.owner, [{ col: 'products', id: 'p2', prev: null, data: prod }])).body.status, 'ok');
  let s = await call('POST', '/api/suppliers/sup_ramy/sync', {}, T.owner);
  assert.equal(s.status, 200, JSON.stringify(s.body)); assert.equal(s.body.total, 1);
  globalThis.__ramyPrice = '990.00'; globalThis.__ramyOut = true;
  s = await call('POST', '/api/suppliers/sup_ramy/sync', {}, T.owner);
  const ch = (await call('GET', '/api/supplier-changes?supplier=sup_ramy', null, T.owner)).body.items;
  assert.deepEqual(ch.map(c => c.kind).sort(), ['out', 'price_up']);
  assert.equal(ch.find(c => c.kind === 'price_up').oldPrice, 945); assert.equal(ch.find(c => c.kind === 'price_up').price, 990);
  const p2 = (await state(T.owner)).products.find(p => p.id === 'p2');
  assert.equal(p2.supplierOut, true, 'product marked: supplier is out of stock');
  let av = (await call('GET', '/api/public/availability')).body;
  assert.deepEqual(av.items['aor-inflate'], { m: 'backorder', d: 14 });
  assert.equal(av.items.bumper, undefined);
  // the owner prefers to hide it from the website
  await sync(T.owner, [{ col: 'products', id: 'p2', prev: p2, data: Object.assign({}, p2, { outMode: 'hide' }) }]);
  av = (await call('GET', '/api/public/availability')).body;
  assert.deepEqual(av.items['aor-inflate'], { m: 'hide' });
  // back in stock at the supplier → normal again
  globalThis.__ramyOut = false;
  await call('POST', '/api/suppliers/sup_ramy/sync', {}, T.owner);
  assert.equal((await state(T.owner)).products.find(p => p.id === 'p2').supplierOut, false);
  assert.equal((await call('GET', '/api/public/availability')).body.items['aor-inflate'], undefined);
  const n = (await call('GET', '/api/notifications', null, T.owner)).body.items;
  assert.ok(n.some(x => x.kind === 'supplier' && /Ramy Automotive: 1 price changes/.test(x.title)));
});

test('new and removed products at a supplier are logged; unseen count for the owner', async () => {
  globalThis.__titanExtra = true;
  await call('POST', '/api/suppliers/sup_titan/sync', {}, T.owner);
  globalThis.__titanExtra = false;
  await call('POST', '/api/suppliers/sup_titan/sync', {}, T.owner);
  const ch = (await call('GET', '/api/supplier-changes?supplier=sup_titan', null, T.owner)).body.items.map(c => c.kind);
  assert.deepEqual(ch.sort(), ['new', 'removed']);
  const me = (await call('GET', '/api/me', null, T.owner)).body;
  assert.ok(me.supplierChanges >= 4);
  await call('POST', '/api/supplier-changes/seen', {}, T.owner);
  assert.equal((await call('GET', '/api/me', null, T.owner)).body.supplierChanges, 0);
  const cat = (await call('GET', '/api/catalog?supplier=sup_titan', null, T.owner)).body;
  assert.equal(cat.total, 3, 'removed products are not listed');
});

test('price list import (partial update) logs changes', async () => {
  const r = await call('POST', '/api/suppliers/sup_ramy/import', { items: [{ sku: 'EQ-AIR-01', title: 'AOR Extreme', price: 1000, available: true }, { sku: 'NEW-1', title: 'New jack', price: 300 }] }, T.owner);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.total, 2);
  const ch = (await call('GET', '/api/supplier-changes?supplier=sup_ramy&kind=price_up,new', null, T.owner)).body.items;
  assert.ok(ch.some(c => c.kind === 'new' && c.sku === 'NEW-1')); assert.ok(ch.some(c => c.kind === 'price_up' && c.price === 1000));
});

test('employees: notified of new online orders and orders given to them; their own numbers', async () => {
  const salim = await call('POST', '/api/users', { name: 'Salim', username: 'salim', password: 'Sales-2026!', perms: { pos: 'edit', orders: 'edit', customers: 'edit', maxDiscount: 10 } }, T.owner);
  T.salimId = salim.body.user.id;
  T.salim = (await call('POST', '/api/login', { username: 'salim', password: 'Sales-2026!' })).body.token;
  const keeper = await call('POST', '/api/users', { name: 'Khalid', username: 'khalid', password: 'Keeper-2026!', perms: { inventory: 'edit' } }, T.owner);
  T.khalidId = keeper.body.user.id;
  T.khalid = (await call('POST', '/api/login', { username: 'khalid', password: 'Keeper-2026!' })).body.token;
  const o = { id: 'o1', no: 'WEB-5000', date: Date.now(), channel: 'online', source: 'website', customerName: 'Ali', items: [{ pid: 'p1', qty: 1, price: 100 }], subtotal: 100, discount: 0, total: 105, status: 'new' };
  assert.equal((await sync(T.owner, [{ col: 'sales', id: 'o1', prev: null, data: o }])).body.status, 'ok');
  let n = (await call('GET', '/api/notifications', null, T.salim)).body;
  assert.equal(n.unread, 1); assert.match(n.items[0].title, /New online order WEB-5000/);
  assert.equal((await call('GET', '/api/notifications', null, T.khalid)).body.unread, 0, 'only people who handle orders');
  // the owner gives the order to Salim
  const cur = (await state(T.owner)).sales[0];
  await sync(T.owner, [{ col: 'sales', id: 'o1', prev: cur, data: Object.assign({}, cur, { assignedTo: T.salimId }) }]);
  const s1 = (await state(T.salim)).sales[0];
  assert.equal(s1.assignedName, 'Salim');
  n = (await call('GET', '/api/notifications', null, T.salim)).body;
  assert.match(n.items[0].title, /Order WEB-5000 is yours/);
  assert.equal((await call('GET', '/api/me', null, T.salim)).body.notes, 2);
  await call('POST', '/api/notifications/read', { all: true }, T.salim);
  assert.equal((await call('GET', '/api/me', null, T.salim)).body.notes, 0);
  // Salim's own numbers; the overall dashboard figures are not given to him
  const ms = (await call('GET', '/api/me/stats?days=30', null, T.salim)).body;
  assert.equal(ms.me.name, 'Salim');
  assert.equal((await call('GET', '/api/team/stats', null, T.salim)).status, 403);
  assert.equal((await call('GET', '/api/users/brief', null, T.salim)).body.users.length, 3);
  assert.equal((await call('GET', '/api/users/brief', null, T.khalid)).status, 403);
});

test('tasks: given by the owner, seen and finished by the employee, reminders before the due time', async () => {
  const task = { id: 't1', title: 'Call Ali about the bumper', assignedTo: T.salimId, due: Date.now() + 30 * 60000, done: false };
  assert.equal((await sync(T.owner, [{ col: 'tasks', id: 't1', prev: null, data: task }])).body.status, 'ok');
  const other = { id: 't2', title: 'Count the winches', assignedTo: T.khalidId, done: false };
  await sync(T.owner, [{ col: 'tasks', id: 't2', prev: null, data: other }]);
  const mine = (await state(T.salim)).tasks;
  assert.deepEqual(mine.map(t => t.id), ['t1'], 'employees only see their own tasks');
  assert.match((await call('GET', '/api/notifications', null, T.salim)).body.items[0].title, /New task: Call Ali/);
  // reminder
  await remindTasks(pool);
  assert.match((await call('GET', '/api/notifications', null, T.salim)).body.items[0].title, /Due soon: Call Ali/);
  await remindTasks(pool);
  assert.equal((await call('GET', '/api/notifications', null, T.salim)).body.items.filter(x => x.kind === 'reminder').length, 1, 'only once');
  // he can finish his task, not give it to someone else
  const t1 = (await state(T.salim)).tasks[0];
  assert.equal((await sync(T.salim, [{ col: 'tasks', id: 't1', prev: t1, data: Object.assign({}, t1, { assignedTo: T.khalidId }) }])).body.status, 'denied');
  const done = await sync(T.salim, [{ col: 'tasks', id: 't1', prev: t1, data: Object.assign({}, t1, { done: true }) }]);
  assert.equal(done.body.status, 'ok'); assert.ok(done.body.rows[0].data.doneAt);
  assert.match((await call('GET', '/api/notifications', null, T.owner)).body.items[0].title, /Done: Call Ali/);
  // his own to-do
  assert.equal((await sync(T.salim, [{ col: 'tasks', id: 't3', prev: null, data: { id: 't3', title: 'Clean the display', assignedTo: T.salimId, createdBy: T.salimId } }])).body.status, 'ok');
  assert.equal((await sync(T.salim, [{ col: 'tasks', id: 't4', prev: null, data: { id: 't4', title: 'For Khalid', assignedTo: T.khalidId, createdBy: T.salimId } }])).body.status, 'denied');
});

test('free AI provider (Gemini): tools, streaming and JSON answers are translated', async () => {
  let r = await call('PUT', '/api/secrets', { aiProvider: 'gemini', aiModel: 'gemini-flash-latest', aiKey: 'AIza-test', aiKeyFor: 'gemini' }, T.owner);
  assert.equal(r.body.ai.provider, 'gemini'); assert.equal(r.body.ai.hasKey.gemini, true); assert.equal(r.body.hasAiKey, true);
  const tools = [{ name: 'search_products', description: 'Search', input_schema: { type: 'object', properties: { query: { type: 'string' } } } }];
  r = await call('POST', '/api/ai/v1/messages', { model: 'claude-opus-5-5', max_tokens: 100, system: 'Be brief', tools, messages: [{ role: 'user', content: 'find bumpers' }] }, null, { 'x-api-key': T.owner });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.stop_reason, 'tool_use'); assert.deepEqual(r.body.content[0], { type: 'tool_use', id: 'call_1', name: 'search_products', input: { query: 'bumper' } });
  const g = fakeUpstream.gemini[fakeUpstream.gemini.length - 1];
  assert.equal(g.model, 'gemini-flash-latest'); assert.equal(g.messages[0].role, 'system'); assert.equal(g.tools[0].function.name, 'search_products');
  // the tool result goes back; streamed answer in Claude's event format
  const raw = await fetch(base + '/api/ai/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': T.owner }, body: JSON.stringify({ model: 'x', max_tokens: 100, stream: true, tools, messages: [{ role: 'user', content: 'find bumpers' }, { role: 'assistant', content: r.body.content }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '[{"name":"Bumper"}]' }] }] }) });
  const sse = await raw.text();
  assert.match(raw.headers.get('content-type'), /event-stream/);
  assert.match(sse, /event: message_start/); assert.match(sse, /"text":"Found it: \[\{\\"name\\":\\"Bumper/); assert.match(sse, /event: message_stop/);
  const tmsg = fakeUpstream.gemini[fakeUpstream.gemini.length - 1].messages;
  assert.deepEqual(tmsg.slice(-2).map(m => m.role), ['assistant', 'tool']);
  // JSON answers (structured output)
  r = await call('POST', '/api/ai/v1/messages', { model: 'x', max_tokens: 100, output_config: { format: { type: 'json_schema', schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } }, messages: [{ role: 'user', content: 'json please' }] }, null, { 'x-api-key': T.owner });
  assert.deepEqual(JSON.parse(r.body.content[0].text), { ok: true });
  const test2 = await call('POST', '/api/ai/test', {}, T.owner);
  assert.equal(test2.body.text, 'Hello from Gemini');
  // the website's parts assistant uses the same provider
  r = await call('GET', '/api/secrets', null, T.owner);
  assert.equal(r.body.ai.hasKey.claude, false);
});

test('WhatsApp: settings, sending inside / outside the 24-hour window, webhook, campaigns only to opted-in customers', async () => {
  let c = await call('PUT', '/api/whatsapp/config', { phoneId: '1065403522', wabaId: '1022901293', token: 'EAAtest', appSecret: 'app-secret', billTemplate: 'order_update', billLang: 'en' }, T.owner);
  assert.equal(c.status, 200, JSON.stringify(c.body)); assert.equal(c.body.configured, true); assert.ok(c.body.verifyToken);
  assert.equal((await call('PUT', '/api/whatsapp/config', { phoneId: 'abc' }, T.owner)).status, 400);
  assert.equal((await call('PUT', '/api/whatsapp/config', { phoneId: '1' }, T.salim)).status, 403);
  assert.equal((await call('POST', '/api/whatsapp/test', {}, T.owner)).body.number, '+968 9000 0000');
  const cfg = (await call('GET', '/api/whatsapp/config', null, T.owner)).body;
  assert.equal(cfg.webhook, 'https://api.example/api/whatsapp/webhook');
  // Meta checks the webhook
  const v = await fetch(base + `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${cfg.verifyToken}&hub.challenge=12345`);
  assert.equal(await v.text(), '12345');
  assert.equal((await fetch(base + '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1')).status, 403);
  // no message from the customer yet → bill goes as the approved template; plain text falls back to opening WhatsApp
  let s = await call('POST', '/api/whatsapp/send', { to: '+968 9111 1111', text: 'Your bill', kind: 'bill', ref: 'INV-1', template: { params: ['Ali', 'INV-1', 'OMR 105'] } }, T.salim);
  assert.equal(s.body.sent, true, JSON.stringify(s.body));
  assert.equal(fakeUpstream.wa[fakeUpstream.wa.length - 1].body.template.name, 'order_update');
  s = await call('POST', '/api/whatsapp/send', { to: '91111111', text: 'Hello', kind: 'chat' }, T.salim);
  assert.deepEqual(s.body, { fallback: true, reason: 'outside_window' });
  // incoming message (signed by Meta)
  const payload = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '96893333333', profile: { name: 'Hamad' } }], messages: [{ from: '96893333333', id: 'wamid.in1', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Do you have JL rock sliders?' } }] } }] }] });
  const sig = 'sha256=' + crypto.createHmac('sha256', 'app-secret').update(payload).digest('hex');
  assert.equal((await fetch(base + '/api/whatsapp/webhook', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=bad' }, body: payload })).status, 403);
  assert.equal((await fetch(base + '/api/whatsapp/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sig }, body: payload })).status, 200);
  const conv = (await call('GET', '/api/whatsapp/conversations', null, T.owner)).body.items;
  const h = conv.find(x => x.wa === '96893333333');
  assert.equal(h.name, 'Hamad'); assert.equal(h.unread, 1); assert.equal(h.open, true);
  const cust = (await state(T.owner)).customers.find(x => x.phone === '+96893333333');
  assert.equal(cust.name, 'Hamad'); assert.equal(cust.optIn, false, 'not signed up for offers automatically');
  assert.ok((await call('GET', '/api/notifications', null, T.owner)).body.items.some(x => x.kind === 'whatsapp'));
  // inside the window → free text reply
  s = await call('POST', '/api/whatsapp/send', { to: '96893333333', text: 'Yes, in stock', kind: 'chat' }, T.owner);
  assert.equal(s.body.sent, true);
  assert.equal(fakeUpstream.wa[fakeUpstream.wa.length - 1].body.text.body, 'Yes, in stock');
  const msgs = (await call('GET', '/api/whatsapp/messages?wa=96893333333', null, T.owner)).body.items;
  assert.deepEqual(msgs.map(m => m.direction), ['in', 'out']);
  // campaign: Ali (opted in) gets it, Said (opted out) and Hamad (not opted in) are skipped
  assert.equal((await call('POST', '/api/whatsapp/campaign', { name: 'x', template: { name: 'offer_jl' }, recipients: [] }, T.salim)).status, 403);
  const cmp = (await call('POST', '/api/whatsapp/campaign', { name: 'JL offer', template: { name: 'offer_jl', lang: 'en' }, recipients: [{ to: '+968 9111 1111', name: 'Ali', params: ['Ali', '10% off'] }, { to: '92222222', name: 'Said', params: ['Said', '10% off'] }, { to: '96893333333', name: 'Hamad', params: ['Hamad', 'x'] }] }, T.owner)).body;
  const done = await wait(async () => { const x = (await call('GET', '/api/whatsapp/campaign/' + cmp.id, null, T.owner)).body; return x.done && x; });
  assert.deepEqual([done.sent, done.skipped, done.failed], [1, 2, 0]);
  assert.deepEqual((await call('GET', '/api/whatsapp/templates', null, T.owner)).body.items[0].params, ['{{1}}', '{{2}}']);
  // a customer who answers STOP no longer gets offers
  const stop = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '96891111111', id: 'wamid.in2', timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'STOP' } }] } }] }] });
  await fetch(base + '/api/whatsapp/webhook', { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + crypto.createHmac('sha256', 'app-secret').update(stop).digest('hex') }, body: stop });
  assert.equal((await state(T.owner)).customers.find(x => x.id === 'c1').optIn, false);
});
