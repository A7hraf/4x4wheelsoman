// Shared helpers for the end-to-end tests.
const { expect } = require('@playwright/test');

const PASSWORD = 'Desert-Fox-2026!';
const API_KEY = 'sk-ant-test-0000000000000000';

// Offline: Google Fonts are not needed for the tests.
async function offline(context) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
}

// Collect page errors, console errors and CSP violations so every test can assert "no errors".
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Record window.open calls (WhatsApp links) instead of opening popups.
async function captureOpen(page) {
  await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return { closed: false, focus() {}, document: { write() {}, close() {} } }; }; });
}
const opened = (page) => page.evaluate(() => window.__opened || []);

// First visit: create the admin password and wait for the dashboard.
async function setupAdmin(page, hash) {
  await page.goto('admin.html' + (hash || ''));
  await page.locator('#authPw').fill(PASSWORD);
  await page.locator('#authPw2').fill(PASSWORD);
  await page.locator('#authGo').click();
  await unlocked(page);
}
// The dashboard is ready when the lock screen is gone and a view has rendered.
async function unlocked(page) {
  await expect(page.locator('.auth')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('#view > *').first()).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => window.DB && DB.data && DB.data.settings);
}
async function login(page, pw) {
  await page.locator('#authPw').fill(pw || PASSWORD);
  await page.locator('#authGo').click();
}
const go = (page, route) => page.evaluate(r => { location.hash = '#/' + r; }, route);
const db = (page, fn, arg) => page.evaluate(fn, arg);

// ---------- fake Claude API ----------
// Answers like the real Messages API (JSON or server-sent events), so the real SDK code path is tested.
function sse(events) { return events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''); }
function streamBody(blocks, stop) {
  const ev = [{ type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }];
  blocks.forEach((b, i) => {
    if (b.type === 'text') {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
      b.text.match(/.{1,40}/gs).forEach(ch => ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: ch } }));
    } else {
      ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    ev.push({ type: 'content_block_stop', index: i });
  });
  ev.push({ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 20 } });
  ev.push({ type: 'message_stop' });
  return sse(ev);
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

// handler(body) returns { blocks:[...], stop } for streams or { json } for structured outputs
async function fakeClaude(context, handler) {
  const calls = [];
  await context.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const body = JSON.parse(req.postData() || '{}');
    calls.push({ body, headers: await req.allHeaders(), url: req.url() });
    const r = await handler(body, req);
    if (r.status) return route.fulfill({ status: r.status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify({ type: 'error', error: { type: 'x', message: 'fail' } }) });
    if (body.stream) return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream' }, CORS), body: streamBody(r.blocks, r.stop || 'end_turn') });
    return route.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: JSON.stringify({ id: 'msg_t', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: typeof r.json === 'string' ? r.json : JSON.stringify(r.json) }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 5 } }) });
  });
  return calls;
}

async function setApiKey(page) {
  await go(page, 'settings');
  await page.locator('#st_key').fill(API_KEY);
  await page.locator('#st_keysave').click();
  await expect(page.locator('#st_keyrm')).toBeVisible();
}

const XSS = '<img src=x onerror="window.__xss=1">';
async function noXss(page) {
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
}

module.exports = { unlocked, PASSWORD, API_KEY, XSS, offline, watchErrors, captureOpen, opened, setupAdmin, login, go, db, fakeClaude, setApiKey, noXss, expect };
