// Customer-facing store: browsing, fitment, quote list → WhatsApp, installments, Arabic, mobile, parts assistant.
const { test } = require('@playwright/test');
const { offline, watchErrors, captureOpen, opened, expect, noXss, XSS } = require('./helpers');

test.beforeEach(async ({ context, page }) => { await offline(context); await captureOpen(page); });

test('every store page loads without errors', async ({ page }) => {
  const errors = watchErrors(page);
  for (const r of ['', '#/shop', '#/categories', '#/vehicles', '#/installments', '#/visit', '#/quote', '#/terms', '#/privacy', '#/p/ome-bp51-lc300', '#/p/does-not-exist']) {
    await page.goto('index.html' + r);
    await expect(page.locator('#root header')).toBeVisible();
  }
  await expect(page.locator('#root')).toContainText('404');
  expect(errors).toEqual([]);
});

test('shop filters: vehicle, category, brand, search and sort', async ({ page }) => {
  await page.goto('index.html#/shop?v=patrol-y62&c=suspension');
  const names = await page.locator('.card .nm').allTextContents();
  expect(names.length).toBeGreaterThan(0);
  for (const n of names) expect(n).toMatch(/Patrol Y62|Y62/);
  await page.goto('index.html#/shop');
  await page.locator('#sf input').fill('EKBP00173');
  await page.locator('#sf input').press('Enter');
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card .nm')).toContainText('Land Cruiser 300');
  await page.goto('index.html#/shop?b=Baja%20Designs');
  for (const b of await page.locator('.card .br').allTextContents()) expect(b.toUpperCase()).toContain('BAJA');
  await page.goto('index.html#/shop?q=zzzz-nothing');
  await expect(page.locator('.empty')).toContainText('No parts match');
});

test('product page: fit checker says yes / no for the chosen vehicle', async ({ page }) => {
  await page.goto('index.html#/p/ome-bp51-lc300');
  await page.locator('[data-fm="Toyota"]').click();
  await page.locator('[data-fmod="land-cruiser-300"]').click();
  await expect(page.locator('#fitRes')).toContainText('Fits your Toyota Land Cruiser 300');
  await page.locator('[data-fm="Nissan"]').click();
  await page.locator('[data-fmod="patrol-y62"]').click();
  await expect(page.locator('#fitRes')).toContainText('Not listed for the');
});

test('quote list → WhatsApp message the admin can read back', async ({ page }) => {
  await page.goto('index.html#/p/ome-bp51-y62');
  await page.locator('[data-q="1"]').click();
  await page.locator('#addQ').click();
  await page.goto('index.html#/p/saber-soft-shackle-15k');
  await page.locator('#addQ').click();
  await page.goto('index.html#/quote');
  await expect(page.locator('.qline')).toHaveCount(2);
  await page.locator('#q_make').selectOption('Nissan');
  await page.locator('#q_model').selectOption('patrol-y62');
  await page.locator('#q_year').fill('2021');
  await page.locator('#q_name').fill('Salim');
  await page.locator('#q_qpay').check();
  await page.locator('#qform button[type=submit]').click();
  const links = await opened(page);
  expect(links).toHaveLength(1);
  const u = new URL(links[0]);
  expect(u.host).toBe('api.whatsapp.com');
  expect(u.searchParams.get('phone')).toBe('96895152025');
  const msg = u.searchParams.get('text');
  expect(msg).toContain('• 2 × Old Man Emu BP-51 Suspension Kit (Patrol Y62)');
  expect(msg).toContain('• 1 × Saber Soft Shackle');
  expect(msg).toContain('Vehicle: Nissan Patrol Y62 2021');
  expect(msg).toContain('Name: Salim');
  expect(msg).toMatch(/Qpay/);
  expect(msg).toMatch(/Ref: Q[A-Z0-9]+/);
  // quantity controls and remove
  await page.locator('[data-dq][data-d="-1"]').first().click();
  await page.locator('[data-rm]').first().click();
  await expect(page.locator('.qline')).toHaveCount(1);
});

test('installments calculator splits into 4', async ({ page }) => {
  await page.goto('index.html#/installments');
  await page.locator('#calc').fill('480');
  await expect(page.locator('#calcI')).toContainText('120.000');
});

test('Arabic version switches direction and text', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('#langBtn').click();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await expect(page.locator('#root')).toContainText('تسوّق');
});

test('no horizontal scrolling on phones (store + assistant)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  for (const r of ['', '#/shop', '#/p/ome-bp51-lc300', '#/quote', '#/installments', '#/visit']) {
    await page.goto('index.html' + r);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
  await page.locator('.pa-fab').click();
  const box = await page.locator('.pa').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});

// ---------- parts assistant (built-in engine, no server) ----------
const ask = async (page, q) => { await page.locator('#paQ').fill(q); await page.locator('#paQ').press('Enter'); };
const lastBot = (page) => page.locator('.pa-m.bot').last();

test('assistant finds parts that fit the vehicle and adds them to the quote list', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await expect(page.locator('.pa-m.bot').first()).toContainText('Which vehicle');
  await ask(page, 'I need a lift kit for my land cruiser 2023');
  await expect(lastBot(page)).toContainText('Land Cruiser 300');
  const cards = lastBot(page).locator('.pa-card');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const n of await lastBot(page).locator('.pa-nm').allTextContents()) expect(n).toContain('Land Cruiser 300');
  await expect(lastBot(page).locator('.pa-fit').first()).toContainText('Fits your');
  await lastBot(page).locator('[data-add]').first().click();
  await expect(lastBot(page).locator('[data-add]').first()).toHaveText('Added');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('x4w_quote')).length)).toBe(1);
  // context is remembered: follow-up without the vehicle
  await ask(page, 'and side steps?');
  await expect(lastBot(page)).toContainText('Electric Side Steps (Land Cruiser 300)');
  expect(errors).toEqual([]);
});

test('assistant asks for the vehicle when it matters, then answers from the chips', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await ask(page, 'suspension');
  await expect(lastBot(page)).toContainText('Which vehicle');
  await lastBot(page).locator('[data-make="Ford"]').click();
  await lastBot(page).locator('[data-veh="bronco"]').click();
  await expect(lastBot(page)).toContainText('Bronco');
  for (const n of await lastBot(page).locator('.pa-nm').allTextContents()) expect(n).toContain('Bronco');
});

test('assistant understands Arabic and answers in Arabic', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await ask(page, 'ابي كفرات للباترول 2021');
  await expect(lastBot(page)).toContainText('باترول');
  expect(await lastBot(page).locator('.pa-card').count()).toBeGreaterThan(0);
  await ask(page, 'وين موقعكم؟');
  await expect(lastBot(page)).toContainText('المعبيلة');
});

test('assistant answers shop questions (hours, Qpay, delivery) and hands off to WhatsApp', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await ask(page, 'are you open on friday?');
  await expect(lastBot(page)).toContainText('closed on Friday');
  await ask(page, 'can I pay in installments?');
  await expect(lastBot(page)).toContainText('4 interest-free payments');
  await ask(page, 'do you deliver to salalah');
  await expect(lastBot(page)).toContainText('delivery');
  await ask(page, 'I need a winch for my gladiator');
  const href = await page.locator('#paWa').getAttribute('href');
  const text = new URL(href).searchParams.get('text');
  expect(text).toContain('winch');
  expect(text).toContain('Gladiator');
});

test('assistant treats input as text (no HTML injection)', async ({ page }) => {
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await ask(page, XSS + ' lights');
  await expect(page.locator('.pa-m.me').last()).toContainText('<img');
  await noXss(page);
});

// ---------- optional Claude answers through the owner's proxy ----------
test('with an AI assistant URL the store shows Claude answers safely, and falls back when it fails', async ({ page, context }) => {
  const calls = [];
  await context.route('https://assistant.example.workers.dev/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    calls.push(body);
    if (body.messages.slice(-1)[0].content.includes('fail')) return route.fulfill({ status: 500, body: '{}' });
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify({ reply: 'For the **LC300** I recommend the BP-51 kit. <img src=x onerror="window.__xss=1">', products: ['ome-bp51-lc300', 'not-a-real-slug'], vehicle: 'land-cruiser-300' }) });
  });
  // the AI URL comes from the published catalog settings
  await page.addInitScript(() => { Object.defineProperty(window, 'CATALOG', { configurable: true, set(v) { v.settings = Object.assign({}, v.settings, { aiEndpoint: 'https://assistant.example.workers.dev/' }); Object.defineProperty(window, 'CATALOG', { value: v, writable: true }); }, get() { return undefined; } }); });
  await page.goto('index.html');
  await page.locator('.pa-fab').click();
  await ask(page, 'what suspension for my LC300?');
  await expect(lastBot(page)).toContainText('I recommend the BP-51 kit');
  await expect(lastBot(page).locator('b')).toHaveText('LC300');
  await expect(lastBot(page).locator('.pa-card')).toHaveCount(1); // unknown slug dropped
  await expect(lastBot(page)).toContainText('AI answers can be wrong');
  await noXss(page);
  expect(calls[0].messages.slice(-1)[0]).toEqual({ role: 'user', content: 'what suspension for my LC300?' });
  // proxy down → built-in engine answers instead
  await ask(page, 'fail: light bar');
  await expect(lastBot(page)).toContainText('Baja Designs');
});
