/* ============================================================
   4x4 Wheels Oman – admin login and encrypted storage
   ------------------------------------------------------------
   The dashboard is a static page, so there is no server to check a password.
   Instead the password unlocks the data itself:
     • PBKDF2-SHA256 (600,000 rounds, random salt) turns the password into an AES-256 key.
     • All admin data (orders, customers, costs, the Claude API key and the GitHub
       token) is gzip-compressed and encrypted with AES-GCM before it is stored.
     • Without the password the stored data is unreadable, even to other pages on
       the same github.io address or to someone who copies the browser profile.
   Also: lock-out after repeated wrong passwords, auto-lock when idle, a Lock button,
   change password, and refusing to run inside a frame (click-jacking).
   ============================================================ */
(function (global) {
  'use strict';
  const AUTH = 'x4w_auth', VAULT = 'x4w_vault', FAILS = 'x4w_auth_fail', SESS = 'x4w_sess';
  const LEGACY_DB = 'x4w_db_v2', LEGACY_AI = 'bh_ai_key', LEGACY_GH = 'x4w_gh_token';
  const ITER = 600000, MIN_LEN = 8, MAX_FREE_TRIES = 5;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = global.crypto && global.crypto.subtle;

  // ---------- small helpers ----------
  const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rand = (n) => global.crypto.getRandomValues(new Uint8Array(n));
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { localStorage.setItem(k, v); }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
  const jget = (k, d) => { try { const v = ls.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => { const u = jget('x4w_ui', {}); return u.lang === 'ar' ? 'ar' : 'en'; };
  const T = (en, ar) => (lang() === 'ar' ? ar : en);

  async function deriveKey(password, salt, iter) {
    const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, 256);
    return importRaw(bits);
  }
  const importRaw = (raw) => subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

  async function gzip(bytes) {
    if (!global.CompressionStream) return { z: false, data: bytes };
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { z: true, data: new Uint8Array(out) };
  }
  async function gunzip(bytes) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }

  async function seal(key, text) {
    const iv = rand(12), packed = await gzip(enc.encode(text));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, packed.data);
    return JSON.stringify({ v: 1, z: packed.z, iv: b64(iv), ct: b64(ct) });
  }
  async function open(key, sealed) {
    const o = typeof sealed === 'string' ? JSON.parse(sealed) : sealed;
    const pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct)));
    return dec.decode(o.z ? await gunzip(pt) : pt);
  }

  // ---------- state ----------
  let key = null, saving = Promise.resolve(), seq = 0, idleTimer = null, lastActive = Date.now(), onReady = [], started = false;
  const hasAccount = () => !!jget(AUTH, null);

  // Each save encrypts the latest snapshot; saves are chained so an older one never overwrites a newer one.
  function persist(json) {
    const my = ++seq, k = key;
    saving = saving.then(async () => {
      if (my !== seq || !k) return; // a newer save is queued
      try { ls.set(VAULT, await seal(k, json)); }
      catch (e) { global.dispatchEvent(new CustomEvent('db:save-error', { detail: e })); if (global.BH && global.BH.toast) global.BH.toast(T('Could not save: browser storage is full.', 'تعذر الحفظ: مساحة التخزين ممتلئة.')); }
    });
  }

  async function startSession(k, rawKey) {
    key = k;
    const sealed = ls.get(VAULT);
    let data = null;
    if (sealed) data = JSON.parse(await open(k, sealed));
    DB.init(data);
    DB.setPersist(persist);
    if (!sealed) DB.save();
    try { ls.set('x4w_ui', JSON.stringify({ theme: DB.data.settings.theme, lang: DB.data.settings.lang })); } catch (e) { }
    try { sessionStorage.setItem(SESS, JSON.stringify({ k: b64(rawKey || await subtle.exportKey('raw', k)), exp: Date.now() + idleMs() })); } catch (e) { }
    unmountGate();
    watchIdle();
    if (!started) { started = true; onReady.splice(0).forEach(fn => fn()); }
  }
  const idleMs = () => ((DB.data && DB.data.settings && DB.data.settings.autoLockMin) || 15) * 60000;

  // ---------- first-time setup ----------
  async function createAccount(password) {
    const salt = rand(16), k = await deriveKey(password, salt, ITER);
    const check = await seal(k, 'x4w-ok');
    // Bring over data saved by older versions in plain text, then delete the plain copies.
    let legacy = null;
    try { const raw = ls.get(LEGACY_DB); if (raw) legacy = JSON.parse(raw); } catch (e) { }
    const data = DB.init(legacy);
    data.secrets.aiKey = data.secrets.aiKey || ls.get(LEGACY_AI) || '';
    data.secrets.ghToken = data.secrets.ghToken || ls.get(LEGACY_GH) || '';
    ls.set(VAULT, await seal(k, JSON.stringify(data)));
    ls.set(AUTH, JSON.stringify({ v: 1, salt: b64(salt), iter: ITER, check, created: Date.now() }));
    [LEGACY_DB, LEGACY_AI, LEGACY_GH].forEach(ls.del);
    ls.del(FAILS);
    await startSession(k);
  }

  // ---------- login ----------
  function lockState() { const f = jget(FAILS, { n: 0, until: 0 }); return { n: f.n || 0, until: f.until || 0, wait: Math.max(0, (f.until || 0) - Date.now()) }; }
  function recordFail() {
    const f = lockState(); const n = f.n + 1;
    // after 5 wrong tries: wait 30 s, then 1, 2, 4… minutes (max 15)
    const until = n >= MAX_FREE_TRIES ? Date.now() + Math.min(15 * 60000, 30000 * Math.pow(2, n - MAX_FREE_TRIES)) : 0;
    ls.set(FAILS, JSON.stringify({ n, until }));
    return { n, until };
  }
  async function login(password) {
    const ls0 = lockState(); if (ls0.wait) return { ok: false, wait: ls0.wait };
    const a = jget(AUTH, null); if (!a) return { ok: false };
    const k = await deriveKey(password, unb64(a.salt), a.iter || ITER);
    try { if (await open(k, a.check) !== 'x4w-ok') throw new Error('bad'); }
    catch (e) { const f = recordFail(); return { ok: false, tries: f.n, wait: Math.max(0, f.until - Date.now()) }; }
    ls.del(FAILS);
    await startSession(k);
    return { ok: true };
  }
  async function resumeSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESS) || 'null');
      if (!s || !s.k || s.exp < Date.now() || !hasAccount()) { sessionStorage.removeItem(SESS); return false; }
      const raw = unb64(s.k), k = await importRaw(raw);
      const a = jget(AUTH, null); if (await open(k, a.check) !== 'x4w-ok') return false;
      await startSession(k, raw);
      return true;
    } catch (e) { try { sessionStorage.removeItem(SESS); } catch (er) { } return false; }
  }

  async function changePassword(current, next) {
    if (String(next).length < MIN_LEN) throw new Error(T(`The new password needs at least ${MIN_LEN} characters.`, `كلمة المرور الجديدة يجب أن تكون ${MIN_LEN} أحرف على الأقل.`));
    const a = jget(AUTH, null);
    const k0 = await deriveKey(current, unb64(a.salt), a.iter || ITER);
    try { if (await open(k0, a.check) !== 'x4w-ok') throw 0; } catch (e) { throw new Error(T('The current password is wrong.', 'كلمة المرور الحالية غير صحيحة.')); }
    await saving;
    const salt = rand(16), k = await deriveKey(next, salt, ITER);
    const vault = await seal(k, JSON.stringify(DB.data));
    const check = await seal(k, 'x4w-ok');
    ls.set(VAULT, vault);
    ls.set(AUTH, JSON.stringify({ v: 1, salt: b64(salt), iter: ITER, check, created: a.created, changed: Date.now() }));
    key = k;
    try { sessionStorage.setItem(SESS, JSON.stringify({ k: b64(await subtle.exportKey('raw', k)), exp: Date.now() + idleMs() })); } catch (e) { }
  }

  async function lock() {
    await saving;
    try { sessionStorage.removeItem(SESS); } catch (e) { }
    key = null;
    location.reload();
  }
  // Forgot password: the data cannot be recovered without it, so the only option is to erase it.
  function eraseAll() {
    [AUTH, VAULT, FAILS, LEGACY_DB, LEGACY_AI, LEGACY_GH, 'x4w_preview'].forEach(ls.del);
    try { sessionStorage.removeItem(SESS); } catch (e) { }
    location.reload();
  }

  // ---------- idle auto-lock ----------
  function watchIdle() {
    const bump = () => {
      const now = Date.now();
      if (now - lastActive < 15000) return; // throttle
      lastActive = now;
      try { const s = JSON.parse(sessionStorage.getItem(SESS) || 'null'); if (s) { s.exp = now + idleMs(); sessionStorage.setItem(SESS, JSON.stringify(s)); } } catch (e) { }
    };
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => global.addEventListener(ev, bump, { passive: true }));
    const check = () => { if (Date.now() - lastActive > idleMs()) lock(); };
    clearInterval(idleTimer); idleTimer = setInterval(check, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  // ---------- cross-tab sync (another admin tab saved) ----------
  global.addEventListener('storage', async (e) => {
    if (!key) return;
    if (e.key === VAULT && e.newValue) { try { DB.replace(JSON.parse(await open(key, e.newValue))); } catch (er) { } }
    if (e.key === AUTH && e.newValue !== e.oldValue) lock(); // password changed or erased elsewhere
  });

  // ---------- login screen ----------
  let gate = null;
  function unmountGate() { if (gate) { gate.remove(); gate = null; } document.documentElement.classList.remove('locked'); }
  function strength(pw) {
    let s = 0; if (pw.length >= MIN_LEN) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^\w\s]/.test(pw)) s++;
    return Math.min(4, s);
  }
  function mountGate() {
    document.documentElement.classList.add('locked');
    const setup = !hasAccount();
    const legacy = setup && !!ls.get(LEGACY_DB);
    gate = document.createElement('div');
    gate.className = 'auth';
    gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `<form class="auth-card" id="authForm" autocomplete="on" novalidate>
      <div class="auth-logo"><img src="assets/img/site/logo-mark.png" alt=""><div><b>4x4 Wheels Oman</b><small>Business Hub</small></div></div>
      <h1>${setup ? T('Create your admin password', 'أنشئ كلمة مرور المدير') : T('Sign in', 'تسجيل الدخول')}</h1>
      <p class="auth-sub">${setup ? T('This password locks the dashboard and encrypts your orders, customers, costs and keys on this device. There is no way to recover it, so keep it somewhere safe.', 'تقفل كلمة المرور لوحة التحكم وتشفّر الطلبات والعملاء والتكاليف والمفاتيح على هذا الجهاز. لا يمكن استعادتها، فاحفظها في مكان آمن.') : T('Enter the admin password to unlock the dashboard.', 'أدخل كلمة مرور المدير لفتح لوحة التحكم.')}</p>
      ${legacy ? `<div class="auth-note">${T('Your existing dashboard data was found and will be encrypted with this password.', 'تم العثور على بيانات اللوحة الحالية وسيتم تشفيرها بكلمة المرور هذه.')}</div>` : ''}
      <input type="text" name="username" autocomplete="username" value="admin" hidden>
      <label class="auth-f"><span>${T('Password', 'كلمة المرور')}</span><input class="input" type="password" id="authPw" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? MIN_LEN : 1}" autofocus></label>
      ${setup ? `<div class="auth-meter" id="authMeter"><i></i><i></i><i></i><i></i></div>
      <label class="auth-f"><span>${T('Confirm password', 'تأكيد كلمة المرور')}</span><input class="input" type="password" id="authPw2" autocomplete="new-password" required></label>` : ''}
      <label class="auth-show"><input type="checkbox" id="authShow"> ${T('Show password', 'إظهار كلمة المرور')}</label>
      <div class="auth-err" id="authErr" role="alert" aria-live="polite"></div>
      <button class="btn primary lg auth-go" type="submit" id="authGo">${setup ? T('Create password and open', 'إنشاء وفتح اللوحة') : T('Unlock', 'فتح')}</button>
      ${setup ? '' : `<button class="auth-link" type="button" id="authForgot">${T('Forgot password?', 'نسيت كلمة المرور؟')}</button>`}
      <div class="auth-foot"><a href="index.html">← ${T('Back to the store', 'العودة إلى المتجر')}</a><button type="button" class="auth-link" id="authLang">${lang() === 'ar' ? 'English' : 'العربية'}</button></div>
    </form>`;
    document.body.appendChild(gate);
    const $ = (s) => gate.querySelector(s);
    const err = (m) => { $('#authErr').textContent = m || ''; };
    const pw = $('#authPw'), go = $('#authGo');
    $('#authShow').onchange = (e) => gate.querySelectorAll('input[type=password],input[data-pw]').forEach(i => { i.dataset.pw = 1; i.type = e.target.checked ? 'text' : 'password'; });
    $('#authLang').onclick = () => { const u = jget('x4w_ui', {}); u.lang = lang() === 'ar' ? 'en' : 'ar'; ls.set('x4w_ui', JSON.stringify(u)); document.documentElement.lang = u.lang; document.documentElement.dir = u.lang === 'ar' ? 'rtl' : 'ltr'; unmountGate(); mountGate(); };
    if (setup) pw.oninput = () => { const s = strength(pw.value); $('#authMeter').dataset.s = pw.value ? s : ''; };
    let timer = null;
    const showWait = (ms) => {
      clearInterval(timer); go.disabled = true;
      const tick = () => { const w = lockState().wait; if (!w) { clearInterval(timer); go.disabled = false; err(''); return; } err(T(`Too many wrong tries. Try again in ${Math.ceil(w / 1000)} s.`, `محاولات خاطئة كثيرة. حاول بعد ${Math.ceil(w / 1000)} ثانية.`)); };
      tick(); timer = setInterval(tick, 1000);
    };
    if (!setup && lockState().wait) showWait();
    if ($('#authForgot')) $('#authForgot').onclick = () => {
      const typed = prompt(T('Without the password the data cannot be decrypted. You can erase everything on this device and start again (then restore a backup file from Settings).\n\nType ERASE to delete all dashboard data on this device:', 'بدون كلمة المرور لا يمكن فك تشفير البيانات. يمكنك حذف كل شيء على هذا الجهاز والبدء من جديد (ثم استعادة نسخة احتياطية من الإعدادات).\n\nاكتب ERASE لحذف كل بيانات اللوحة على هذا الجهاز:'));
      if (typed === 'ERASE') eraseAll();
    };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault(); err('');
      if (!subtle) { err(T('This browser cannot encrypt data. Open the dashboard over https in an up-to-date browser.', 'هذا المتصفح لا يدعم التشفير. افتح اللوحة عبر https في متصفح حديث.')); return; }
      const v = pw.value;
      if (setup) {
        if (v.length < MIN_LEN) { err(T(`Use at least ${MIN_LEN} characters.`, `استخدم ${MIN_LEN} أحرف على الأقل.`)); pw.focus(); return; }
        if (strength(v) < 2) { err(T('This password is too easy to guess. Make it longer, or mix letters, numbers and symbols.', 'كلمة المرور سهلة التخمين. اجعلها أطول أو امزج الحروف والأرقام والرموز.')); pw.focus(); return; }
        if (v !== $('#authPw2').value) { err(T('The two passwords do not match.', 'كلمتا المرور غير متطابقتين.')); $('#authPw2').focus(); return; }
      } else if (!v) { pw.focus(); return; }
      go.disabled = true; const label = go.textContent; go.textContent = T('Checking…', 'جارٍ التحقق…');
      try {
        if (setup) await createAccount(v);
        else {
          const r = await login(v);
          if (!r.ok) {
            go.textContent = label; go.disabled = false; pw.value = ''; pw.focus();
            if (r.wait) showWait(r.wait);
            else err(T(`Wrong password.${r.tries >= 3 ? ` ${MAX_FREE_TRIES - r.tries} tries left before a short lock-out.` : ''}`, `كلمة مرور خاطئة.${r.tries >= 3 ? ` تبقى ${MAX_FREE_TRIES - r.tries} محاولات قبل الإيقاف المؤقت.` : ''}`));
          }
        }
      } catch (ex) { go.textContent = label; go.disabled = false; err(T('Could not unlock: ', 'تعذر الفتح: ') + (ex && ex.message || ex)); }
    };
    setTimeout(() => pw.focus(), 30);
  }

  // ---------- boot ----------
  function boot() {
    if (global.top !== global.self) { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">This page cannot be shown inside a frame.</p>'; return; }
    if (!subtle) { mountGate(); return; }
    resumeSession().then(ok => { if (!ok) mountGate(); });
  }

  global.Auth = {
    ready(fn) { if (started) fn(); else onReady.push(fn); },
    lock, changePassword, eraseAll, hasAccount, MIN_LEN,
    flush: () => saving,
    // exposed for tests of the crypto format
    _seal: seal, _open: open, _deriveKey: deriveKey
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
