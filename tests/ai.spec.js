// AI features with a fake Claude API (same wire format as the real one, so the real SDK runs).
const { test } = require('@playwright/test');
const { API_KEY, XSS, offline, watchErrors, setupAdmin, go, fakeClaude, setApiKey, noXss, expect } = require('./helpers');

test.beforeEach(async ({ context }) => { await offline(context); });

test('advisor looks up real records with tools and answers from them', async ({ page, context }) => {
  const errors = watchErrors(page);
  const sdkLoads = [];
  page.on('request', r => { if (/anthropic-sdk|jsdelivr|unpkg|esm\.sh/.test(r.url())) sdkLoads.push(r.url()); });
  const calls = await fakeClaude(context, (body) => {
    const last = body.messages[body.messages.length - 1];
    const toolResult = Array.isArray(last.content) && last.content.find(c => c.type === 'tool_result');
    if (!toolResult) return { blocks: [{ type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 'toolu_1', name: 'customer_history', input: { query: 'Ahmed' } }], stop: 'tool_use' };
    const data = JSON.parse(toolResult.content);
    return { blocks: [{ type: 'text', text: `**${data[0].name}** has ${data[0].orders} orders, total spent OMR ${data[0].total_spent}.` }] };
  });
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'advisor');
  await page.locator('#chatQ').fill('What has Ahmed bought from us?');
  await page.locator('#chatSend').click();
  await expect(page.locator('.msg.assistant').last()).toContainText('Ahmed Al Balushi has', { timeout: 20000 });
  await expect(page.locator('.msg.assistant').last().locator('b')).toHaveText('Ahmed Al Balushi');
  // request 1: key, browser header, model, tools and the business snapshot
  expect(calls).toHaveLength(2);
  expect(calls[0].headers['authorization']).toBe('Bearer ' + API_KEY); // the SDK 1.x sends the key as a Bearer token
  expect(calls[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(calls[0].body.model).toBe('claude-opus-5-5');
  expect(calls[0].body.tools.map(t => t.name)).toEqual(['search_products', 'customer_history', 'find_orders', 'sales_breakdown', 'reorder_plan', 'open_quotes']);
  expect(calls[0].body.messages[0].content).toContain('Business snapshot (JSON)');
  // request 2: the tool call and its result were sent back
  const m = calls[1].body.messages;
  expect(m[m.length - 2].content.some(b => b.type === 'tool_use' && b.name === 'customer_history')).toBe(true);
  const tr = JSON.parse(m[m.length - 1].content[0].content);
  const truth = await page.evaluate(() => { const c = DB.data.customers.find(x => x.name === 'Ahmed Al Balushi'); return DB.data.sales.filter(s => s.customerId === c.id).length; });
  expect(tr[0].orders).toBe(truth);
  // SDK is served from this site, not a CDN
  expect(sdkLoads.every(u => u.includes('/assets/vendor/anthropic-sdk.mjs'))).toBe(true);
  expect(sdkLoads.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('every advisor tool returns sensible data', async ({ page }) => {
  await setupAdmin(page);
  const r = await page.evaluate(() => ({
    products: AI.runTool('search_products', { query: 'bp-51 y62' }),
    orders: AI.runTool('find_orders', { channel: 'online', status: 'new', limit: 5 }),
    unpaid: AI.runTool('find_orders', { unpaid_only: true }),
    byCat: AI.runTool('sales_breakdown', { days: 30, by: 'category' }),
    byDay: AI.runTool('sales_breakdown', { days: 90, by: 'weekday' }),
    plan: AI.runTool('reorder_plan', {}),
    quotes: AI.runTool('open_quotes', {}),
    bad: AI.runTool('nope', {}),
    net30: AI.snapshot(30).totals.net_sales
  }));
  expect(r.products[0].name).toContain('Patrol Y62');
  expect(r.orders.orders.every(o => o.channel === 'online' && o.status === 'new')).toBe(true);
  expect(r.unpaid.orders.every(o => o.paid === false)).toBe(true);
  // category breakdown adds up to net sales for the same period
  const sum = r.byCat.rows.reduce((a, x) => a + x.net_sales, 0);
  expect(Math.abs(sum - r.net30)).toBeLessThan(1);
  expect(r.byDay.rows.find(x => x.key === 'Fri')).toBeUndefined(); // shop is closed on Friday
  expect(Array.isArray(r.plan)).toBe(true);
  expect(r.quotes.every(q => ['new', 'sent', 'accepted'].includes(q.status))).toBe(true);
  expect(r.bad.error).toContain('Unknown tool');
});

test('AI text is shown safely (no HTML from the model runs)', async ({ page, context }) => {
  await fakeClaude(context, () => ({ blocks: [{ type: 'text', text: 'Here: ' + XSS + ' and `code` and a table:\n\n| A | B |\n|---|---|\n| <b>x</b> | 1 |' }] }));
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'advisor');
  await page.locator('#chatQ').fill('hi');
  await page.locator('#chatSend').click();
  await expect(page.locator('.msg.assistant').last()).toContainText('<img src=x', { timeout: 20000 });
  await expect(page.locator('.msg.assistant table')).toHaveCount(1);
  await noXss(page);
});

test('advisor explains API errors in plain language', async ({ page, context }) => {
  await fakeClaude(context, () => ({ status: 401 }));
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'advisor');
  await page.locator('#chips button').first().click();
  await expect(page.locator('.msg.assistant').last()).toContainText('API key was rejected', { timeout: 20000 });
});

test('report: AI executive summary is added (without tools)', async ({ page, context }) => {
  const calls = await fakeClaude(context, () => ({ blocks: [{ type: 'text', text: '## Overview\nSales grew **12%**.\n- Reorder BP-51 kits' }] }));
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'advisor');
  await page.locator('#genRep').click();
  await page.locator('#repAI').click();
  const frame = page.frameLocator('#repFrame');
  await expect(frame.locator('.ai')).toContainText('Sales grew 12%', { timeout: 20000 });
  expect(calls[0].body.tools).toBeUndefined();
});

test('AI reads any customer message into a quote; unknown ids are dropped', async ({ page, context }) => {
  let pid;
  const calls = await fakeClaude(context, (body) => ({ json: { customer_name: 'Saif', vehicle: 'Patrol 2019', wants_qpay: true, items: [{ product_id: pid, qty: 2, why: 'شكل' }, { product_id: 'p_fake', qty: 1, why: 'x' }], not_in_catalog: ['winch'], reply_language: 'ar' } }));
  await setupAdmin(page);
  pid = await page.evaluate(() => DB.data.products.find(p => p.slug === 'saber-soft-shackle-15k').id);
  await setApiKey(page);
  await go(page, 'quotes');
  await page.locator('#qimp').click();
  await page.locator('#im_t').fill('السلام عليكم، اسمي سيف. ابغى ٢ شكل ونش للباترول ٢٠١٩ وأبي أقسط');
  await page.locator('#im_ai').click();
  await expect(page.locator('.overlay #q_v')).toHaveValue('Patrol 2019', { timeout: 20000 });
  await expect(page.locator('.overlay #q_q')).toBeChecked();
  await expect(page.locator('.overlay #q_note')).toHaveValue(/Not in catalog: winch/);
  const opts = await page.evaluate(() => [...document.querySelectorAll('.overlay [data-f="pid"]')].map(s => s.selectedOptions[0].textContent));
  expect(opts).toEqual([expect.stringContaining('Saber Soft Shackle')]);
  // structured output was requested, and the catalog (not costs/customers) was sent
  const b = calls[0].body;
  expect(b.output_config.format.type).toBe('json_schema');
  expect(b.messages[0].content).toContain('Saber Soft Shackle');
  expect(b.messages[0].content).not.toContain('"cost"');
  expect(b.messages[0].content).not.toContain('Ahmed Al Balushi');
});

test('AI writes product copy in English and Arabic', async ({ page, context }) => {
  await fakeClaude(context, () => ({ json: { name_ar: 'منتج تجريبي', description_en: 'Strong recovery shackle.', description_ar: 'شكل سحب قوي.', bullets_en: ['Light', 'Strong'], bullets_ar: ['خفيف', 'قوي'] } }));
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'inventory');
  await page.locator('#iadd').click();
  await page.locator('.overlay #p_name').fill('Test Shackle');
  await page.locator('.overlay #p_ai').click();
  await expect(page.locator('.overlay #p_description')).toHaveValue('Strong recovery shackle.', { timeout: 20000 });
  await expect(page.locator('.overlay #p_descriptionAr')).toHaveValue('شكل سحب قوي.');
  await expect(page.locator('.overlay #p_nameAr')).toHaveValue('منتج تجريبي');
  await page.locator('.overlay #p_save').click();
  const p = await page.evaluate(() => DB.data.products.find(x => x.name === 'Test Shackle'));
  expect(p.bullets).toEqual(['Light', 'Strong']);
  expect(p.bulletsAr).toEqual(['خفيف', 'قوي']);
});

test('AI writes the WhatsApp campaign message', async ({ page, context }) => {
  const calls = await fakeClaude(context, () => ({ json: { message: 'Hi {name}! New lights at {shop}. Reply STOP to opt out.' } }));
  await setupAdmin(page);
  await setApiKey(page);
  await go(page, 'whatsapp');
  await page.locator('#wa_new').click();
  await page.locator('.overlay #cp_ai').click();
  await expect(page.locator('.overlay #cp_m')).toHaveValue(/New lights at \{shop\}/, { timeout: 20000 });
  await expect(page.locator('.overlay #cp_prev')).toContainText('New lights at 4x4 Wheels Oman');
  expect(calls[0].body.system).toContain('Reply STOP');
});

test('without an API key the AI buttons explain what to do and send nothing', async ({ page, context }) => {
  const calls = await fakeClaude(context, () => ({ json: {} }));
  await setupAdmin(page);
  await go(page, 'inventory');
  await page.locator('#iadd').click();
  await page.locator('.overlay #p_name').fill('X');
  await page.locator('.overlay #p_ai').click();
  await expect(page.locator('.toast')).toContainText('Claude API key');
  await go(page, 'advisor');
  await expect(page.locator('.notice')).toContainText('Claude API key');
  expect(calls).toHaveLength(0);
});
