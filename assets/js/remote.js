/* ============================================================
   4x4 Wheels Oman – online mode (shared data, employee accounts)
   ------------------------------------------------------------
   When assets/js/config.js sets window.X4W_API, the dashboard signs in to the
   Business Hub server instead of the password-on-this-device vault:
     • each person has their own user name and password (owner + employees);
     • data is shared by everyone and kept on the server;
     • every save is sent to the server, which checks the person's permissions
       and applies it, sends it to the owner for approval, or refuses it;
     • other people's changes arrive every few seconds.
   It provides the same window.Auth interface as auth.js, so the rest of the
   dashboard works unchanged.
   ============================================================ */
(function (global) {
  'use strict';
  const API = String(global.X4W_API || '').replace(/\/+$/, '');
  if (!API) return;
  const SESS = 'x4w_rsess', LOCK_AT = 'x4w_lock_at';
  const COLS = ['products', 'categories', 'vehicles', 'customers', 'suppliers', 'sales', 'expenses', 'purchases', 'moves', 'quotes', 'campaigns', 'waLog', 'held', 'tasks'];
  const APPEND_ONLY = ['moves', 'waLog'];   // old log lines dropped on this device are not deleted on the server
  const LOCAL_SETTINGS = ['theme', 'lang']; // per person / per device
  const POLL_MS = 8000;
  const MIN_LEN = 8;

  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };
  const jget = (k, d) => { try { const v = ls.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => (jget('x4w_ui', {}).lang === 'ar' ? 'ar' : 'en');
  const T = (en, ar) => (lang() === 'ar' ? ar : en);
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

  let token = null, me = null, seq = '0', started = false, onReady = [], inbox = { pending: 0, decidedAt: 0, ai: false, notes: 0, notesAt: 0, supplierChanges: 0, waUnread: 0 };
  let sess = null, hiddenAt = 0, lastActive = Date.now();

  // ---------- server calls ----------
  async function api(method, path, body, opts) {
    let r;
    try {
      r = await fetch(API + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body == null ? undefined : JSON.stringify(body), keepalive: !!(opts && opts.keepalive), cache: 'no-store' });
    } catch (e) { const er = new Error(T('No connection to the server. Check the internet and try again.', 'لا يوجد اتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.')); er.offline = true; throw er; }
    let j = null; try { j = await r.json(); } catch (e) { }
    if (r.status === 401 && token && !(opts && opts.noLock)) { lock(false, T('Your session ended. Please sign in again.', 'انتهت الجلسة. سجّل الدخول مرة أخرى.')); throw new Error('signed out'); }
    if (!r.ok) { const er = new Error((j && j.error) || ('HTTP ' + r.status)); er.status = r.status; er.retry = +r.headers.get('retry-after') || 0; throw er; }
    return j;
  }

  // ---------- rows: the dashboard's single data object <-> server rows ----------
  const keyOf = (col, id) => col + '\u0001' + id;
  function rowsOf(d) {
    const m = new Map();
    for (const k of Object.keys(d)) {
      if (k === 'secrets') continue;
      if (COLS.includes(k) && Array.isArray(d[k])) { for (const r of d[k]) if (r && r.id != null) m.set(keyOf(k, String(r.id)), JSON.stringify(r)); }
      else if (k === 'settings') { const s = Object.assign({}, d.settings); LOCAL_SETTINGS.forEach(x => delete s[x]); m.set(keyOf('meta', k), JSON.stringify(s)); }
      else m.set(keyOf('meta', k), JSON.stringify(d[k]));
    }
    return m;
  }
  let shadow = new Map(); // what the server has (as far as this device knows)
  const getLocal = (col, id) => {
    const d = DB.data;
    if (col === 'meta') { if (id === 'settings') { const s = Object.assign({}, d.settings); LOCAL_SETTINGS.forEach(x => delete s[x]); return s; } return d[id]; }
    return (d[col] || []).find(r => String(r.id) === id);
  };
  function setLocal(col, id, val) {
    const d = DB.data;
    if (col === 'meta') {
      if (id === 'settings') { const keep = {}; LOCAL_SETTINGS.forEach(x => { keep[x] = d.settings[x]; }); d.settings = Object.assign(val || {}, keep); return; }
      if (val === undefined || val === null) delete d[id]; else d[id] = val; return;
    }
    const arr = d[col] = d[col] || [];
    const i = arr.findIndex(r => String(r.id) === id);
    if (val == null) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = val;
    else if (col === 'moves' || col === 'waLog') arr.unshift(val); else arr.push(val);
  }
  // Field-level rebase: keep what this person changed since `base`, take everything else from `server`.
  function rebase(local, base, server, col) {
    if (server == null) return local === undefined || JSON.stringify(local) === JSON.stringify(base) ? null : local;
    if (local == null || base == null || typeof server !== 'object' || Array.isArray(server)) return JSON.stringify(local) === JSON.stringify(base) ? server : (local == null ? server : local);
    const out = clone(server);
    for (const k of new Set([...Object.keys(local), ...Object.keys(base)])) {
      if (JSON.stringify(local[k]) === JSON.stringify(base[k])) continue; // not changed here
      if (col === 'products' && k === 'stock') { out.stock = Math.max(0, (+server.stock || 0) + (+local.stock || 0) - (+base.stock || 0)); continue; }
      if (k in local) out[k] = clone(local[k]); else delete out[k];
    }
    return out;
  }

  // ---------- sending changes ----------
  let busy = false, dirty = false, lastJSON = null;
  function persist(json) { lastJSON = json; dirty = true; flushSoon(); }
  let flushTimer = null;
  function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 120); }
  async function flush() {
    if (busy || !dirty || !token) return;
    busy = true; dirty = false;
    try {
      const cur = rowsOf(JSON.parse(lastJSON));
      const batch = [];
      for (const [k, v] of cur) if (shadow.get(k) !== v) { const [col, id] = k.split('\u0001'); batch.push({ col, id, prev: shadow.has(k) ? JSON.parse(shadow.get(k)) : null, data: JSON.parse(v) }); }
      for (const k of shadow.keys()) if (!cur.has(k)) { const [col, id] = k.split('\u0001'); if (!APPEND_ONLY.includes(col)) batch.push({ col, id, prev: JSON.parse(shadow.get(k)), data: null }); }
      if (!batch.length) return;
      setStatus('saving');
      let res;
      try { res = await api('POST', '/api/sync', { batch }); }
      catch (e) { if (e.offline) { dirty = true; setStatus('offline'); setTimeout(flushSoon, 5000); return; } throw e; }
      // take the server's version of each row, keeping anything changed here since it was sent
      let changed = false;
      for (const r of res.rows || []) {
        const sent = batch.find(b => b.col === r.col && b.id === r.id);
        const k = keyOf(r.col, r.id);
        const local = getLocal(r.col, r.id);
        const next = rebase(local === undefined ? null : clone(local), sent ? sent.data : null, r.data, r.col);
        if (JSON.stringify(next) !== JSON.stringify(local)) { setLocal(r.col, r.id, clone(next)); changed = true; }
        if (r.data == null) shadow.delete(k); else shadow.set(k, JSON.stringify(r.col === 'meta' && r.id === 'settings' ? stripLocal(r.data) : r.data));
      }
      if (res.status === 'pending') { inbox.pending++; note(T('Sent to the owner for approval. You will see it here once approved.', 'أُرسل إلى المالك للموافقة. سيظهر هنا بعد الموافقة.'), 'info'); }
      if (res.status === 'denied') note(res.message || T('Not saved: you do not have permission.', 'لم يُحفظ: ليست لديك صلاحية.'), 'bad');
      if (changed) emit(true);
      setStatus('ok');
    } catch (e) {
      if (e.message !== 'signed out') { note(T('Could not save: ', 'تعذر الحفظ: ') + e.message, 'bad'); setStatus('error'); }
    } finally { busy = false; if (dirty) flushSoon(); }
  }
  const stripLocal = (s) => { const c = Object.assign({}, s); LOCAL_SETTINGS.forEach(x => delete c[x]); return c; };

  // ---------- receiving other people's changes ----------
  let pollTimer = null, polling = false;
  async function poll() {
    if (polling || busy || dirty || !token || document.hidden) return;
    polling = true;
    try {
      const r = await api('GET', '/api/changes?since=' + encodeURIComponent(seq));
      updateMe(r);
      let changed = false;
      for (const c of r.changes || []) {
        const k = keyOf(c.col, c.id);
        const base = shadow.has(k) ? JSON.parse(shadow.get(k)) : null;
        const local = getLocal(c.col, c.id);
        const server = c.deleted ? null : (c.col === 'meta' && c.id === 'settings' ? stripLocal(c.data) : c.data);
        const next = rebase(local === undefined ? null : clone(local), base, server, c.col);
        if (JSON.stringify(next) !== JSON.stringify(local === undefined ? null : local)) { setLocal(c.col, c.id, clone(next)); changed = true; }
        if (server == null) shadow.delete(k); else shadow.set(k, JSON.stringify(server));
      }
      seq = r.seq;
      if (changed) emit();
    } catch (e) { if (e.offline) setStatus('offline'); }
    finally { polling = false; }
  }
  // own = the server's answer to this person's own save (no "new activity" message)
  function emit(own) { try { global.dispatchEvent(new CustomEvent('db:change', { detail: { external: true, remote: true, own: !!own } })); } catch (e) { } }
  let lastDecided = 0;
  function updateMe(r) {
    if (r.me) { const permsChanged = me && JSON.stringify(me.perms) !== JSON.stringify(r.me.perms); me = r.me; if (permsChanged) { note(T('Your permissions were changed by the owner. Reloading…', 'غيّر المالك صلاحياتك. جارٍ إعادة التحميل…'), 'info'); setTimeout(() => location.reload(), 1500); } }
    const before = inbox.pending, badgesBefore = [inbox.notes, inbox.supplierChanges, inbox.waUnread].join();
    const notesAtBefore = inbox.notesAt;
    if (r.pending != null) inbox.pending = r.pending;
    if (r.ai != null) inbox.ai = r.ai;
    ['notes', 'notesAt', 'supplierChanges', 'waUnread'].forEach(k => { if (r[k] != null) inbox[k] = r[k]; });
    // new notifications for this person → shown by the bell (admin-work.js)
    if (started && inbox.notesAt > notesAtBefore) try { global.dispatchEvent(new CustomEvent('x4w:notes', { detail: { at: inbox.notesAt, n: inbox.notes } })); } catch (e) { }
    const badgesChanged = badgesBefore !== [inbox.notes, inbox.supplierChanges, inbox.waUnread].join();
    if (r.decidedAt && lastDecided && r.decidedAt > lastDecided && me.role !== 'owner') note(T('The owner answered one of your requests — see Approvals.', 'ردّ المالك على أحد طلباتك — راجع الموافقات.'), 'info');
    if (r.decidedAt) lastDecided = r.decidedAt;
    if (me && me.role === 'owner' && inbox.pending > before && started) note(T('New request waiting for your approval.', 'طلب جديد بانتظار موافقتك.'), 'info');
    if ((inbox.pending !== before || badgesChanged) && global.BH && global.BH.renderShell) try { global.BH.renderShell(); } catch (e) { }
    try { global.dispatchEvent(new CustomEvent('x4w:inbox')); } catch (e) { }
  }

  // ---------- small UI helpers ----------
  function note(msg, tone) {
    const el = document.createElement('div'); el.className = 'toast ' + (tone || ''); el.setAttribute('role', 'status'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), tone === 'bad' ? 6000 : 3500);
  }
  function setStatus(s) { document.documentElement.dataset.sync = s; }

  // ---------- session (same rules as the on-device login) ----------
  const lockedSince = () => +ls.get(LOCK_AT) || 0;
  const graceMs = () => { const v = DB.data && DB.data.settings ? DB.data.settings.awayLockSec : undefined; return (v == null ? 60 : +v) * 1000; };
  const idleMs = () => ((DB.data && DB.data.settings && DB.data.settings.autoLockMin) || 15) * 60000;
  function saveSess() { if (!sess) return; sess.grace = graceMs(); try { sessionStorage.setItem(SESS, JSON.stringify(sess)); } catch (e) { } }
  function sessionValid(s) { const now = Date.now(); return !!(s && s.t && s.exp > now && now - (s.seen || 0) <= Math.max(s.grace == null ? 60000 : s.grace, 15000) && (s.at || 0) > lockedSince()); }
  const broadcastLock = () => ls.set(LOCK_AT, String(Date.now()));

  let locking = false;
  async function lock(fromOtherTab, message) {
    if (locking) return; locking = true;
    document.documentElement.classList.remove('unlocked');
    const v = document.getElementById('view'); if (v) v.innerHTML = '';
    document.querySelectorAll('.overlay, .modal').forEach(el => el.remove());
    try { if (dirty || busy) { await Promise.race([flushWait(), new Promise(r => setTimeout(r, 2500))]); } } catch (e) { }
    if (token && !fromOtherTab) api('POST', '/api/logout', {}, { keepalive: true, noLock: true }).catch(() => { });
    try { sessionStorage.removeItem(SESS); if (message) sessionStorage.setItem('x4w_rmsg', message); } catch (e) { }
    if (!fromOtherTab) broadcastLock();
    token = null; sess = null;
    location.reload();
  }
  const flushWait = async () => { for (let i = 0; i < 25 && (dirty || busy); i++) { if (!busy) flush(); await new Promise(r => setTimeout(r, 100)); } };

  function watch() {
    const bump = () => { const now = Date.now(); if (now - lastActive < 15000) return; lastActive = now; if (sess) { sess.exp = now + idleMs(); sess.seen = now; saveSess(); } };
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => global.addEventListener(ev, bump, { passive: true }));
    const check = () => { if (!token) return; if (Date.now() - lastActive > idleMs()) return lock(); if (sess && lockedSince() >= sess.at) return lock(true); };
    setInterval(check, 5000);
    setInterval(() => { if (sess && !document.hidden) { sess.seen = Date.now(); saveSess(); } }, 5000);
    const away = () => { hiddenAt = Date.now(); if (sess) { sess.seen = hiddenAt; saveSess(); } document.documentElement.classList.add('away'); if (dirty) flush(); };
    const back = () => { document.documentElement.classList.remove('away'); if (!token) return; if (hiddenAt && Date.now() - hiddenAt > graceMs()) return lock(); hiddenAt = 0; check(); poll(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) away(); else back(); });
    global.addEventListener('pagehide', away);
    global.addEventListener('pageshow', (e) => { if (e.persisted) { let s = null; try { s = JSON.parse(sessionStorage.getItem(SESS) || 'null'); } catch (er) { } if (!sessionValid(s) || (hiddenAt && Date.now() - hiddenAt > graceMs())) lock(); else back(); } });
    global.addEventListener('focus', () => { if (!document.hidden) back(); });
    global.addEventListener('storage', (e) => { if (e.key === LOCK_AT && sess && (+e.newValue || 0) >= sess.at) lock(true); });
    global.addEventListener('online', () => { setStatus('ok'); flushSoon(); poll(); });
    clearInterval(pollTimer); pollTimer = setInterval(poll, POLL_MS);
  }

  // ---------- start with the server's data ----------
  function fill(data) {
    const d = data || {};
    COLS.forEach(c => { if (!Array.isArray(d[c])) d[c] = []; });
    ['makes', 'brands'].forEach(c => { if (!Array.isArray(d[c])) d[c] = []; });
    d.settings = d.settings || {};
    return d;
  }
  async function begin(state, at) {
    const d = fill(state.data);
    const ui = jget('x4w_ui', {});
    DB.init(d);
    // personal choices stay on this device
    if (ui.lang) DB.data.settings.lang = ui.lang;
    if (ui.theme) DB.data.settings.theme = ui.theme;
    shadow = rowsOf(DB.data);
    // the server didn't send these (empty or not readable): don't treat local defaults as new rows
    seq = state.seq || '0';
    updateMe(state);
    if (me.role === 'owner') { try { const s = await api('GET', '/api/secrets'); DB.data.secrets.ghToken = s.ghToken || ''; inbox.ai = s.hasAiKey; } catch (e) { } }
    DB.setPersist(persist);
    const now = Date.now();
    sess = { t: token, at: Math.max(at || now, lockedSince() + 1), exp: now + idleMs(), seen: now };
    saveSess();
    unmountGate();
    document.documentElement.classList.add('unlocked', 'online-mode');
    document.documentElement.classList.toggle('is-owner', me.role === 'owner');
    setStatus('ok');
    watch();
    if (!started) { started = true; onReady.splice(0).forEach(fn => fn()); }
  }
  async function resume() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESS) || 'null');
      if (!sessionValid(s)) { sessionStorage.removeItem(SESS); return false; }
      token = s.t;
      const st = await api('GET', '/api/state', null, { noLock: true });
      if (st.empty || !(st.data && st.data.settings)) { token = null; return false; }
      await begin(st, s.at);
      return true;
    } catch (e) { token = null; try { sessionStorage.removeItem(SESS); } catch (er) { } return false; }
  }

  // ---------- sign-in screen ----------
  let gate = null;
  function unmountGate() { if (gate) { gate.remove(); gate = null; } document.documentElement.classList.remove('locked'); }
  function shell(inner) {
    unmountGate();
    document.documentElement.classList.add('locked');
    gate = document.createElement('div'); gate.className = 'auth'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `<div class="auth-card"><div class="auth-logo"><img src="assets/img/site/logo-mark.png" alt=""><div><b>4x4 Wheels Oman</b><small>Business Hub</small></div></div>${inner}
      <div class="auth-foot"><a href="index.html">← ${T('Back to the store', 'العودة إلى المتجر')}</a><button type="button" class="auth-link" id="authLang">${lang() === 'ar' ? 'English' : 'العربية'}</button></div></div>`;
    document.body.appendChild(gate);
    gate.querySelector('#authLang').onclick = () => { const u = jget('x4w_ui', {}); u.lang = lang() === 'ar' ? 'en' : 'ar'; ls.set('x4w_ui', JSON.stringify(u)); document.documentElement.lang = u.lang; document.documentElement.dir = u.lang === 'ar' ? 'rtl' : 'ltr'; mountGate(); };
    return (s) => gate.querySelector(s);
  }
  async function mountGate() {
    document.documentElement.classList.add('locked'); document.documentElement.classList.remove('unlocked');
    broadcastLock();
    let st = null;
    const $ = shell(`<p class="auth-sub">${T('Connecting…', 'جارٍ الاتصال…')}</p>`);
    try { st = await api('GET', '/api/status'); }
    catch (e) {
      const $2 = shell(`<h1>${T('Cannot reach the server', 'تعذر الوصول إلى الخادم')}</h1><p class="auth-sub">${esc(e.message)}</p><button class="btn primary lg auth-go" id="retry" type="button">${T('Try again', 'حاول مرة أخرى')}</button>`);
      $2('#retry').onclick = mountGate; return;
    }
    if (st.setup) return setupForm(st);
    loginForm();
    void $;
  }
  function loginForm() {
    let msg = ''; try { msg = sessionStorage.getItem('x4w_rmsg') || ''; sessionStorage.removeItem('x4w_rmsg'); } catch (e) { }
    const $ = shell(`<form id="authForm" autocomplete="on" novalidate>
      <h1>${T('Sign in', 'تسجيل الدخول')}</h1>
      <p class="auth-sub">${T('Use the user name and password the owner gave you.', 'استخدم اسم المستخدم وكلمة المرور التي أعطاك إياها المالك.')}</p>
      ${msg ? `<div class="auth-note">${esc(msg)}</div>` : ''}
      <label class="auth-f"><span>${T('User name', 'اسم المستخدم')}</span><input class="input" id="authUser" autocomplete="username" autocapitalize="none" spellcheck="false" required dir="ltr"></label>
      <label class="auth-f"><span>${T('Password', 'كلمة المرور')}</span><input class="input" type="password" id="authPw" autocomplete="current-password" required></label>
      <label class="auth-show"><input type="checkbox" id="authShow"> ${T('Show password', 'إظهار كلمة المرور')}</label>
      <div class="auth-err" id="authErr" role="alert" aria-live="polite"></div>
      <button class="btn primary lg auth-go" type="submit" id="authGo">${T('Sign in', 'دخول')}</button>
      <p class="auth-sub" style="margin-top:12px;font-size:12.5px">${T('Forgot your password? Ask the owner to reset it in Team.', 'نسيت كلمة المرور؟ اطلب من المالك إعادة تعيينها من صفحة الفريق.')}</p></form>`);
    const u = $('#authUser'), pw = $('#authPw'), go = $('#authGo'), err = (m) => { $('#authErr').textContent = m || ''; };
    u.value = ls.get('x4w_last_user') || ''; setTimeout(() => (u.value ? pw : u).focus(), 30);
    $('#authShow').onchange = (e) => { pw.type = e.target.checked ? 'text' : 'password'; };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault(); err('');
      if (!u.value.trim() || !pw.value) { (u.value.trim() ? pw : u).focus(); return; }
      go.disabled = true; const label = go.textContent; go.textContent = T('Checking…', 'جارٍ التحقق…');
      try {
        const r = await api('POST', '/api/login', { username: u.value.trim(), password: pw.value });
        token = r.token; me = r.me; ls.set('x4w_last_user', r.me.username);
        await afterSignIn();
      } catch (ex) {
        go.textContent = label; go.disabled = false; pw.value = ''; pw.focus();
        if (ex.retry) { let w = ex.retry; go.disabled = true; const tick = () => { if (w <= 0) { go.disabled = false; err(''); return; } err(T(`Too many wrong tries. Try again in ${w} s.`, `محاولات خاطئة كثيرة. حاول بعد ${w} ثانية.`)); w--; setTimeout(tick, 1000); }; tick(); }
        else err(ex.status === 401 ? T('Wrong user name or password.', 'اسم المستخدم أو كلمة المرور غير صحيحة.') : ex.message);
      }
    };
  }
  function strength(pw) { let s = 0; if (pw.length >= MIN_LEN) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^\w\s]/.test(pw)) s++; return Math.min(4, s); }
  function setupForm() {
    const $ = shell(`<form id="authForm" autocomplete="on" novalidate>
      <h1>${T('Create the owner account', 'إنشاء حساب المالك')}</h1>
      <p class="auth-sub">${T('First time online. Enter the setup code you were given, then choose your user name and password. You will add employees afterwards.', 'أول دخول للنظام. أدخل رمز الإعداد الذي حصلت عليه، ثم اختر اسم المستخدم وكلمة المرور. ستضيف الموظفين بعد ذلك.')}</p>
      <label class="auth-f"><span>${T('Setup code', 'رمز الإعداد')}</span><input class="input" id="sCode" autocomplete="off" spellcheck="false" dir="ltr" required></label>
      <label class="auth-f"><span>${T('Your name', 'اسمك')}</span><input class="input" id="sName" autocomplete="name" required></label>
      <label class="auth-f"><span>${T('User name', 'اسم المستخدم')}</span><input class="input" id="authUser" autocomplete="username" autocapitalize="none" spellcheck="false" dir="ltr" placeholder="owner" required></label>
      <label class="auth-f"><span>${T('Password', 'كلمة المرور')}</span><input class="input" type="password" id="authPw" autocomplete="new-password" required></label>
      <div class="auth-meter" id="authMeter"><i></i><i></i><i></i><i></i></div>
      <label class="auth-f"><span>${T('Confirm password', 'تأكيد كلمة المرور')}</span><input class="input" type="password" id="authPw2" autocomplete="new-password" required></label>
      <div class="auth-err" id="authErr" role="alert" aria-live="polite"></div>
      <button class="btn primary lg auth-go" type="submit" id="authGo">${T('Create account', 'إنشاء الحساب')}</button></form>`);
    const pw = $('#authPw'), err = (m) => { $('#authErr').textContent = m || ''; };
    pw.oninput = () => { $('#authMeter').dataset.s = pw.value ? strength(pw.value) : ''; };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault(); err('');
      const v = pw.value;
      if (v.length < MIN_LEN) return err(T(`Use at least ${MIN_LEN} characters.`, `استخدم ${MIN_LEN} أحرف على الأقل.`));
      if (strength(v) < 2) return err(T('This password is too easy to guess. Make it longer, or mix letters, numbers and symbols.', 'كلمة المرور سهلة التخمين. اجعلها أطول أو امزج الحروف والأرقام والرموز.'));
      if (v !== $('#authPw2').value) return err(T('The two passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      $('#authGo').disabled = true;
      try {
        const r = await api('POST', '/api/setup', { code: $('#sCode').value.trim(), name: $('#sName').value.trim(), username: $('#authUser').value.trim(), password: v });
        token = r.token; me = r.me; ls.set('x4w_last_user', r.me.username);
        await afterSignIn();
      } catch (ex) { $('#authGo').disabled = false; err(ex.message); }
    };
  }
  async function afterSignIn() {
    const st = await api('GET', '/api/state');
    if (!st.empty && st.data && st.data.settings) return begin(st);
    if (me.role !== 'owner') {
      shell(`<h1>${T('Not ready yet', 'النظام غير جاهز بعد')}</h1><p class="auth-sub">${T('The owner has not moved the shop data online yet. Try again later.', 'لم ينقل المالك بيانات المتجر إلى النظام بعد. حاول لاحقاً.')}</p>`);
      return;
    }
    firstData();
  }
  // Owner, first time: bring the data that is on this device, or start with demo / empty data.
  function firstData() {
    const hasVault = global.LocalVault && global.LocalVault.hasAccount();
    const $ = shell(`<h1>${T('Move your data online', 'انقل بياناتك إلى النظام')}</h1>
      <p class="auth-sub">${T('The online system is empty. Choose what to start with. Everyone you add will share this data.', 'النظام فارغ. اختر ما تبدأ به. كل من تضيفه سيشارك هذه البيانات.')}</p>
      ${hasVault ? `<form id="fromDev" class="auth-opt"><b>${T('Upload the data on this device', 'رفع البيانات الموجودة على هذا الجهاز')}</b><small>${T('Enter the old dashboard password of this device to unlock it.', 'أدخل كلمة مرور اللوحة القديمة على هذا الجهاز لفتحها.')}</small>
        <input type="text" name="username" value="admin" autocomplete="username" hidden><input class="input" type="password" id="oldPw" autocomplete="current-password" placeholder="${T('Old dashboard password', 'كلمة مرور اللوحة القديمة')}"><button class="btn primary" type="submit">${T('Upload', 'رفع')}</button></form>` : ''}
      <button class="auth-opt" type="button" id="useBackup"><b>${T('Upload a backup file', 'رفع ملف نسخة احتياطية')}</b><small>${T('A .json backup downloaded from Settings.', 'ملف ‎.json‎ نزّلته من الإعدادات.')}</small></button><input type="file" id="bkFile" accept=".json,application/json" hidden>
      <button class="auth-opt" type="button" id="useCatalog"><b>${T('Start with my product catalog', 'البدء بكتالوج منتجاتي')}</b><small>${T('Your website products and settings, with no demo orders or customers.', 'منتجات الموقع والإعدادات، بدون طلبات أو عملاء تجريبيين.')}</small></button>
      <button class="auth-opt" type="button" id="useDemo"><b>${T('Start with demo data', 'البدء ببيانات تجريبية')}</b><small>${T('Sample orders and customers to try things out. You can clear them later in Settings.', 'طلبات وعملاء تجريبيون للتجربة. يمكنك حذفها لاحقاً من الإعدادات.')}</small></button>
      <div class="auth-err" id="authErr" role="alert"></div>`);
    const err = (m) => { $('#authErr').textContent = m || ''; };
    const upload = async (data) => {
      err(''); gate.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try { delete data.secrets; await api('POST', '/api/import', { data }); const st = await api('GET', '/api/state'); await begin(st); }
      catch (e) { err(e.message); gate.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    };
    if ($('#fromDev')) $('#fromDev').onsubmit = async (e) => {
      e.preventDefault();
      try { const data = await global.LocalVault.decrypt($('#oldPw').value); await upload(data); }
      catch (ex) { err(T('That password did not unlock this device\'s data.', 'كلمة المرور لم تفتح بيانات هذا الجهاز.')); }
    };
    $('#useBackup').onclick = () => $('#bkFile').click();
    $('#bkFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.settings || !Array.isArray(d.products)) throw 0; upload(d); } catch (er) { err(T('That file is not a dashboard backup.', 'هذا الملف ليس نسخة احتياطية للوحة.')); } }; rd.readAsText(f); };
    $('#useDemo').onclick = () => upload(DB.buildSeed());
    $('#useCatalog').onclick = () => {
      const d = DB.buildSeed();
      d.sales = []; d.expenses = []; d.purchases = []; d.moves = []; d.quotes = []; d.campaigns = []; d.waLog = []; d.customers = []; d.held = [];
      d.products.forEach(p => { p.stock = 0; }); d.demo = false;
      upload(d);
    };
  }

  // ---------- account ----------
  async function changePassword(current, next) {
    if (String(next).length < MIN_LEN) throw new Error(T(`The new password needs at least ${MIN_LEN} characters.`, `كلمة المرور الجديدة يجب أن تكون ${MIN_LEN} أحرف على الأقل.`));
    await api('POST', '/api/me/password', { current, password: next });
  }
  const LEVELS = ['none', 'view', 'request', 'edit', 'full'];
  function level(m) { if (!me) return 'none'; if (me.role === 'owner') return 'full'; return (me.perms && me.perms[m]) || 'none'; }
  function can(m, l) { return LEVELS.indexOf(level(m)) >= LEVELS.indexOf(l || 'view'); }

  function boot() {
    if (global.top !== global.self) { document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">This page cannot be shown inside a frame.</p>'; return; }
    resume().then(ok => { if (!ok) mountGate(); });
  }

  global.Auth = {
    mode: 'server', API, MIN_LEN,
    ready(fn) { if (started) fn(); else onReady.push(fn); },
    lock: () => lock(), changePassword,
    eraseAll() { note(T('Online data cannot be erased from a device.', 'لا يمكن حذف بيانات النظام من جهاز.'), 'bad'); },
    hasAccount: () => true, flush: flushWait,
    api, token: () => token, me: () => me, level, can, inbox: () => inbox,
    isOwner: () => !!(me && me.role === 'owner'),
    seesCosts: () => !!(me && (me.role === 'owner' || (me.perms && me.perms.costs) || can('finance', 'view'))),
    refresh: poll
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
