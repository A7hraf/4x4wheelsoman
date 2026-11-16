// Login page, encryption at rest, lock / auto-lock, lock-out, change password, migration.
const { test } = require('@playwright/test');
const { unlocked, PASSWORD, offline, watchErrors, setupAdmin, login, go, expect } = require('./helpers');

test.beforeEach(async ({ context }) => { await offline(context); });

test('first visit asks to create a password and rejects weak or mismatched ones', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('admin.html');
  await expect(page.locator('.auth h1')).toHaveText('Create your admin password');
  await expect(page.locator('.app')).toBeHidden();
  await page.locator('#authPw').fill('short'); await page.locator('#authPw2').fill('short');
  await page.locator('#authGo').click();
  await expect(page.locator('#authErr')).toContainText('at least 8');
  await page.locator('#authPw').fill('aaaaaaaa'); await page.locator('#authPw2').fill('aaaaaaaa');
  await page.locator('#authGo').click();
  await expect(page.locator('#authErr')).toContainText('too easy');
  await page.locator('#authPw').fill(PASSWORD); await page.locator('#authPw2').fill(PASSWORD + 'x');
  await page.locator('#authGo').click();
  await expect(page.locator('#authErr')).toContainText('do not match');
  await page.locator('#authPw2').fill(PASSWORD);
  await page.locator('#authGo').click();
  await unlocked(page);
  expect(errors).toEqual([]);
});

test('all data is encrypted at rest — no customer names, costs or keys in storage', async ({ page }) => {
  await setupAdmin(page);
  await go(page, 'settings');
  await page.locator('#st_key').fill('sk-ant-secret-should-not-leak');
  await page.locator('#st_keysave').click();
  await page.evaluate(() => Auth.flush());
  const dump = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage, sessionStorage)));
  for (const secret of ['Ahmed Al Balushi', 'sk-ant-secret-should-not-leak', '+968 9123 4567', 'INV-10', '"cost"']) expect(dump).not.toContain(secret);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  expect(keys).toEqual(['x4w_auth', 'x4w_lock_at', 'x4w_ui', 'x4w_vault']); // x4w_lock_at is only a time stamp
  const vault = await page.evaluate(() => JSON.parse(localStorage.getItem('x4w_vault')));
  expect(vault).toMatchObject({ v: 1, z: true });
  expect(vault.iv).toMatch(/^[A-Za-z0-9+/=]{16}$/);
  const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('x4w_auth')));
  expect(auth.iter).toBeGreaterThanOrEqual(600000);
});

test('reload keeps the session; the Lock button locks', async ({ page }) => {
  await setupAdmin(page);
  await page.reload();
  await unlocked(page);
  await page.locator('#lockBtn').click();
  await expect(page.locator('.auth h1')).toHaveText('Sign in');
  await expect(page.locator('#app')).toBeHidden();
  await login(page);
  await unlocked(page);
});

// ---- the dashboard must never be reachable while a sign-in page is showing ----
const setHidden = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);

test('opening the sign-in page in another tab locks the open dashboard tab too', async ({ page, context }) => {
  await setupAdmin(page);
  const p2 = await context.newPage();
  await p2.goto('admin.html');
  await expect(p2.locator('.auth h1')).toHaveText('Sign in');
  await page.bringToFront();                       // "swipe" back to the first tab
  await expect(page.locator('.auth h1')).toHaveText('Sign in');
  await expect(page.locator('#app')).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem('x4w_sess'))).toBeNull();
  // signing in again in one tab works normally
  await login(p2);
  await unlocked(p2);
});

test('locking in one tab locks every tab', async ({ page, context }) => {
  await setupAdmin(page);
  // a duplicated tab (same session) opens straight into the dashboard
  const sess = await page.evaluate(() => sessionStorage.getItem('x4w_sess'));
  const p2 = await context.newPage();
  await p2.addInitScript((v) => { if (!sessionStorage.getItem('dup')) { sessionStorage.setItem('x4w_sess', v); sessionStorage.setItem('dup', '1'); } }, sess);
  await p2.goto('admin.html');
  await unlocked(p2);
  await expect(page.locator('.auth')).toHaveCount(0);
  await p2.locator('#lockBtn').click();
  await expect(page.locator('.auth h1')).toHaveText('Sign in');
  await expect(page.locator('#app')).toBeHidden();
});

test('leaving the app for more than 1 minute locks it; a quick switch does not', async ({ page }) => {
  await page.clock.install();
  await setupAdmin(page);
  await setHidden(page, true);
  await expect(page.locator('html')).toHaveClass(/away/);            // blurred in the app switcher
  await page.clock.fastForward('00:30');
  await setHidden(page, false);
  await page.waitForTimeout(300);
  await expect(page.locator('.auth')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/away/);
  await setHidden(page, true);
  await page.clock.fastForward('01:30');
  await setHidden(page, false);
  await expect(page.locator('.auth h1')).toHaveText('Sign in', { timeout: 10000 });
  await expect(page.locator('#app')).toBeHidden();
});

test('"Lock immediately when I leave" setting', async ({ page }) => {
  await page.clock.install();
  await setupAdmin(page);
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.locator('#sec_away').selectOption('0');
  await setHidden(page, true);
  await page.clock.fastForward('00:02');
  await setHidden(page, false);
  await expect(page.locator('.auth h1')).toHaveText('Sign in', { timeout: 10000 });
});

test('a tab restored later (browser closed, phone restarted) asks for the password', async ({ page }) => {
  await setupAdmin(page);
  // leave the dashboard, then pretend it was last open 10 minutes ago
  await page.goto('index.html');
  await page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('x4w_sess')); s.seen = Date.now() - 10 * 60000; sessionStorage.setItem('x4w_sess', JSON.stringify(s)); });
  await page.goto('admin.html');
  await expect(page.locator('.auth h1')).toHaveText('Sign in');
  await expect(page.locator('#app')).toBeHidden();
});

test('a page brought back by the Back gesture re-checks the lock', async ({ page }) => {
  await setupAdmin(page);
  await page.evaluate(() => { sessionStorage.removeItem('x4w_sess'); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
  await expect(page.locator('.auth h1')).toHaveText('Sign in', { timeout: 10000 });
});

test('swiping / scrolling on a phone never reveals the dashboard', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  await offline(ctx);
  const page = await ctx.newPage();
  await setupAdmin(page);
  await page.locator('#lockBtn').click();
  await expect(page.locator('.auth h1')).toHaveText('Sign in');
  const cdp = await ctx.newCDPSession(page);
  for (const [y0, y1] of [[700, 100], [100, 700], [740, 20], [400, 50]]) {           // swipe up / down
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: y0 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y0 + (y1 - y0) * i / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(150);
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('.auth')).toBeVisible();
  }
  expect(await page.evaluate(() => document.getElementById('view').innerHTML)).toBe('');
  await ctx.close();
});

test('before the password is checked nothing of the dashboard is shown', async ({ page }) => {
  await setupAdmin(page);
  await page.reload();
  // right at load (session still being checked) the dashboard is hidden
  await page.goto('admin.html', { waitUntil: 'commit' });
  const shownEarly = await page.evaluate(() => { const a = document.getElementById('app'); return a ? getComputedStyle(a).display !== 'none' && document.documentElement.classList.contains('unlocked') : false; });
  expect(shownEarly).toBe(false);
});

test('wrong passwords are refused and lead to a timed lock-out', async ({ page }) => {
  await setupAdmin(page);
  await page.locator('#lockBtn').click();
  await expect(page.locator('#authPw')).toBeVisible();
  for (let i = 1; i <= 4; i++) {
    await login(page, 'not-the-password-' + i);
    await expect(page.locator('#authErr')).toContainText('Wrong password');
  }
  await login(page, 'not-the-password-5');
  await expect(page.locator('#authErr')).toContainText('Too many wrong tries');
  await expect(page.locator('#authGo')).toBeDisabled();
  // even the right password is refused during the lock-out
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('x4w_auth_fail')));
  expect(r.n).toBe(5);
  expect(r.until).toBeGreaterThan(Date.now());
  // after the wait, the right password works and the counter resets
  await page.evaluate(() => localStorage.setItem('x4w_auth_fail', JSON.stringify({ n: 5, until: Date.now() - 1 })));
  await page.reload();
  await login(page);
  await unlocked(page);
  expect(await page.evaluate(() => localStorage.getItem('x4w_auth_fail'))).toBeNull();
});

test('change password: old one stops working, new one works, data kept', async ({ page }) => {
  await setupAdmin(page);
  const orders = await page.evaluate(() => DB.data.sales.length);
  await go(page, 'settings');
  await page.locator('#sec_cur').fill('wrong');
  await page.locator('#sec_new').fill('New-Pass-4x4-2027'); await page.locator('#sec_new2').fill('New-Pass-4x4-2027');
  await page.locator('#sec_go').click();
  await expect(page.locator('#sec_msg')).toContainText('current password is wrong');
  await page.locator('#sec_cur').fill(PASSWORD);
  await page.locator('#sec_go').click();
  await expect(page.locator('#sec_msg')).toContainText('Password changed', { timeout: 20000 });
  await page.locator('#lockBtn').click();
  await login(page, PASSWORD);
  await expect(page.locator('#authErr')).toContainText('Wrong password');
  await login(page, 'New-Pass-4x4-2027');
  await unlocked(page);
  expect(await page.evaluate(() => DB.data.sales.length)).toBe(orders);
});

test('auto-lock after the idle time', async ({ page }) => {
  await page.clock.install();
  await setupAdmin(page);
  await page.clock.fastForward('16:00'); // default auto-lock: 15 minutes
  await expect(page.locator('.auth h1')).toHaveText('Sign in', { timeout: 15000 });
});

test('existing plain-text data from the old version is migrated and the plain copies removed', async ({ page }) => {
  await page.goto('index.html');
  // simulate the old dashboard: plain database + keys in localStorage
  await page.evaluate(() => {
    localStorage.setItem('x4w_db_v2', JSON.stringify({ version: 2, settings: { name: 'Old Shop', currency: 'OMR', vat: 5, templates: {} }, products: [], sales: [], customers: [{ id: 'c1', name: 'Legacy Customer', phone: '+96891111111' }], expenses: [], purchases: [], suppliers: [], categories: [{ id: 'recovery', en: 'Recovery' }], moves: [] }));
    localStorage.setItem('bh_ai_key', 'sk-ant-legacy');
    localStorage.setItem('x4w_gh_token', 'github_pat_legacy');
  });
  await page.goto('admin.html');
  await expect(page.locator('.auth-note')).toContainText('existing dashboard data');
  await page.locator('#authPw').fill(PASSWORD); await page.locator('#authPw2').fill(PASSWORD);
  await page.locator('#authGo').click();
  await unlocked(page);
  const r = await page.evaluate(() => ({ name: DB.data.settings.name, cust: DB.data.customers[0].name, sec: DB.data.secrets, keys: Object.keys(localStorage) }));
  expect(r.name).toBe('Old Shop');
  expect(r.cust).toBe('Legacy Customer');
  expect(r.sec).toEqual(expect.objectContaining({ aiKey: 'sk-ant-legacy', ghToken: 'github_pat_legacy' }));
  expect(r.keys).not.toContain('x4w_db_v2');
  expect(r.keys).not.toContain('bh_ai_key');
  expect(r.keys).not.toContain('x4w_gh_token');
});

test('forgot password: ERASE wipes the device and starts over', async ({ page }) => {
  await setupAdmin(page);
  await page.locator('#lockBtn').click();
  page.once('dialog', d => d.accept('ERASE'));
  await page.locator('#authForgot').click();
  await expect(page.locator('.auth h1')).toHaveText('Create your admin password');
  expect(await page.evaluate(() => localStorage.getItem('x4w_vault'))).toBeNull();
});

test('Arabic login screen', async ({ page }) => {
  await page.goto('admin.html');
  await page.locator('#authLang').click();
  await expect(page.locator('.auth h1')).toHaveText('أنشئ كلمة مرور المدير');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
});
