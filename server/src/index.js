// 4x4 Wheels Oman – Business Hub API.
// Shared data for the owner and employees, permissions, owner approvals, activity log,
// supplier catalogue sync and a private Claude proxy (the AI key never reaches a browser).
import http from 'node:http';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPool, migrate, readState, changesSince, submit, decide, importAll, logActivity, evaluate, hooks } from './store.js';
import * as N from './notify.js';
import { makeAIFetch, PROVIDERS } from './aiproxy.js';
import { createWA } from './whatsapp.js';
import * as A from './auth.js';
import { MODULES, LEVELS, PRESETS, atLeast, anyAtLeast, isOwner, seesCosts } from './perms.js';
import * as S from './suppliers.js';
import { handle as assistantHandle } from '../../worker/assistant-proxy.js';

const now = () => Date.now();
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const need = (cond, status, msg) => { if (!cond) throw new HttpError(status, msg); };

// ---------- secrets (AI key, GitHub token) encrypted at rest with APP_SECRET ----------
function secretBox(appSecret) {
  const key = crypto.createHash('sha256').update('x4w-secrets:' + (appSecret || '')).digest();
  return {
    seal: (txt) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key, iv); const enc = Buffer.concat([c.update(String(txt), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); },
    open: (s) => { if (!s) return ''; try { const [iv, tag, enc] = s.split('.').map(x => Buffer.from(x, 'base64')); const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag); return Buffer.concat([d.update(enc), d.final()]).toString('utf8'); } catch { return ''; } }
  };
}

export function createApp({ pool, env = process.env, fetchImpl = globalThis.fetch }) {
  const box = secretBox(env.APP_SECRET || env.SETUP_CODE || '');
  const origins = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const kvGet = async (k) => { const r = await pool.query('SELECT value FROM kv WHERE key=$1', [k]); return r.rows[0] ? r.rows[0].value : null; };
  const kvSet = (k, v) => pool.query('INSERT INTO kv (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, JSON.stringify(v)]);
  // AI: the owner picks a provider (Claude, Gemini free tier, or any OpenAI-compatible service)
  const keyName = (p) => (p === 'claude' || !p ? 'aiKey' : 'aiKey:' + p);
  const aiCfg = async () => {
    const c = Object.assign({ provider: 'claude', model: '', baseUrl: '' }, (await kvGet('aiCfg')) || {});
    c.key = box.open(await kvGet(keyName(c.provider))) || (c.provider === 'claude' ? env.ANTHROPIC_API_KEY || '' : '');
    return c;
  };
  const aiKey = async () => (await aiCfg()).key;
  const aiFetch = makeAIFetch(fetchImpl, aiCfg);
  const WA = createWA({ pool, kvGet, kvSet, box, fetchImpl });
  hooks.afterApply = async (db, u, plan) => { await N.afterApply(db, u, plan); if ((plan || []).some(p => p.change.col === 'products' || p.change.col === 'meta')) S.clearAvailabilityCache(); };
  hooks.onRequest = (db, u, summary) => N.onRequest(db, u, summary);
  hooks.onDecide = (db, a, ok, note) => N.onDecide(db, a, ok, note);
  const aiHits = new Map();

  function corsHeaders(req) {
    const o = req.headers.origin;
    if (!o || !origins.includes(o)) return { Vary: 'Origin' };
    return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': String(req.headers['access-control-request-headers'] || 'Content-Type, Authorization').slice(0, 800), 'Access-Control-Max-Age': '600', 'Access-Control-Expose-Headers': 'request-id, retry-after', Vary: 'Origin' };
  }
  const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
  function send(res, req, status, obj, extra) {
    res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, baseHeaders, corsHeaders(req), extra || {}));
    res.end(JSON.stringify(obj));
  }
  function body(req, limit = 1e6) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Too much data')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { const t = Buffer.concat(chunks).toString('utf8'); if (!t) return resolve({}); try { resolve(JSON.parse(t)); } catch { reject(new HttpError(400, 'Bad JSON')); } });
      req.on('error', reject);
    });
  }
  const ipOf = (req) => String(req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || '').trim();
  const tokenOf = (req) => { const h = String(req.headers.authorization || ''); return h.startsWith('Bearer ') ? h.slice(7).trim() : String(req.headers['x-api-key'] || '').trim(); };
  async function user(req) { const u = await A.authenticate(pool, tokenOf(req)); need(u, 401, 'Please sign in again.'); return u; }
  const owner = (u) => need(isOwner(u), 403, 'Only the owner can do this.');
  const counts = async (u) => {
    const q = isOwner(u) ? await pool.query("SELECT COUNT(*)::int AS n FROM approvals WHERE status='pending'") : await pool.query("SELECT COUNT(*)::int AS n FROM approvals WHERE status='pending' AND user_id=$1", [u.id]);
    const mine = await pool.query("SELECT COALESCE(MAX(decided_at),0)::bigint AS t FROM approvals WHERE user_id=$1 AND status<>'pending'", [u.id]);
    const nt = await N.unread(pool, u);
    const out = { pending: q.rows[0].n, decidedAt: Number(mine.rows[0].t), ai: !!(await aiKey()), notes: nt.n, notesAt: Number(nt.last) };
    if (isOwner(u) || anyAtLeast(u, ['suppliers', 'pricing'], 'view')) out.supplierChanges = await S.unseenChanges(pool, u.id);
    if (isOwner(u) || atLeast(u, 'whatsapp', 'view')) out.waUnread = await WA.unreadCount();
    return out;
  };

  // ---------- route table ----------
  const routes = [];
  const on = (method, path, fn) => routes.push({ method, path, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  on('GET', '/', async () => ({ ok: true, name: '4x4 Wheels Oman Business Hub API' }));
  on('GET', '/api/health', async () => { await pool.query('SELECT 1'); return { ok: true, time: now() }; });
  on('GET', '/api/status', async () => ({ setup: (await A.userCount(pool)) === 0, minPassword: A.MIN_PW, modules: MODULES, levels: LEVELS, presets: PRESETS }));

  // first owner account (needs the one-time setup code from the server settings)
  on('POST', '/api/setup', async ({ req, b }) => {
    need(env.SETUP_CODE, 503, 'Server is missing SETUP_CODE.');
    need((await A.userCount(pool)) === 0, 409, 'The owner account already exists. Sign in instead.');
    const a = Buffer.from(String(b.code || '')), c = Buffer.from(String(env.SETUP_CODE));
    if (!(a.length === c.length && crypto.timingSafeEqual(a, c))) { await new Promise(r => setTimeout(r, 800)); throw new HttpError(403, 'Wrong setup code.'); }
    const u = await A.createUser(pool, { username: b.username, name: b.name, password: b.password, role: 'owner' });
    await logActivity(pool, u, 'setup', 'team', 'Owner account created');
    const s = await A.login(pool, b.username, b.password, ipOf(req), req.headers['user-agent']);
    return { token: s.token, me: A.publicUser(s.user) };
  });
  on('POST', '/api/login', async ({ req, b }) => {
    try {
      const s = await A.login(pool, b.username, b.password, ipOf(req), req.headers['user-agent']);
      await logActivity(pool, s.user, 'login', null, 'Signed in');
      return { token: s.token, me: A.publicUser(s.user) };
    } catch (e) { if (e.wait) e.extra = { 'Retry-After': String(Math.ceil(e.wait / 1000)) }; throw e; }
  });
  on('POST', '/api/logout', async ({ req }) => { await A.logout(pool, tokenOf(req)); return { ok: true }; });
  on('GET', '/api/me', async ({ u }) => Object.assign({ me: A.publicUser(u) }, await counts(u)));
  on('POST', '/api/me/password', async ({ req, u, b }) => {
    const full = (await pool.query('SELECT pass_hash FROM users WHERE id=$1', [u.id])).rows[0];
    need(await A.checkPassword(String(b.current || ''), full.pass_hash), 403, 'Current password is wrong.');
    await A.setPassword(pool, u.id, b.password); await A.endSessions(pool, u.id, tokenOf(req));
    await logActivity(pool, u, 'password', 'team', 'Changed own password');
    return { ok: true };
  });

  // ---------- data ----------
  on('GET', '/api/state', async ({ u }) => Object.assign(await readState(pool, u), { me: A.publicUser(u) }, await counts(u)));
  on('GET', '/api/changes', async ({ u, q }) => Object.assign(await changesSince(pool, u, String(q.get('since') || '0').replace(/\D/g, '') || '0'), await counts(u), { me: A.publicUser(u) }));
  const kick = () => { S.ensureKnown(pool).then(() => S.autoSync(pool, fetchImpl)).catch(e => console.error('auto sync', e.message)); };
  on('POST', '/api/sync', async ({ u, b }) => {
    const r = await submit(pool, u, b.batch);
    if (r.status === 'ok' && (b.batch || []).some(c => c && c.col === 'suppliers' && c.data)) kick();
    return r;
  });
  on('POST', '/api/import', async ({ u, b }) => { owner(u); const count = await importAll(pool, u, b.data); kick(); return { ok: true, count }; });

  // ---------- secrets (owner) ----------
  const aiInfo = async () => { const c = await aiCfg(); const has = {}; for (const p of Object.keys(PROVIDERS)) has[p] = !!box.open(await kvGet(keyName(p))) || (p === 'claude' && !!env.ANTHROPIC_API_KEY); return { provider: c.provider, model: c.model, baseUrl: c.baseUrl, hasKey: has, providers: PROVIDERS }; };
  on('GET', '/api/secrets', async ({ u }) => { owner(u); return { ghToken: box.open(await kvGet('ghToken')), hasAiKey: !!(await aiKey()), ai: await aiInfo() }; });
  on('PUT', '/api/secrets', async ({ u, b }) => {
    owner(u);
    if (typeof b.ghToken === 'string') await kvSet('ghToken', b.ghToken.trim() ? box.seal(b.ghToken.trim().slice(0, 300)) : '');
    if (b.aiProvider !== undefined || b.aiModel !== undefined || b.aiBaseUrl !== undefined) {
      const c = Object.assign({ provider: 'claude', model: '', baseUrl: '' }, (await kvGet('aiCfg')) || {});
      if (b.aiProvider !== undefined) { need(PROVIDERS[b.aiProvider], 400, 'Unknown AI provider'); c.provider = b.aiProvider; }
      if (typeof b.aiModel === 'string') { need(/^[\w.:\/-]{0,100}$/.test(b.aiModel.trim()), 400, 'Model name: letters, numbers, dots, dashes'); c.model = b.aiModel.trim(); }
      if (typeof b.aiBaseUrl === 'string') { need(!b.aiBaseUrl.trim() || S.safeUrl(b.aiBaseUrl.trim()), 400, 'Use a public https:// address'); c.baseUrl = b.aiBaseUrl.trim(); }
      await kvSet('aiCfg', c);
    }
    if (typeof b.aiKey === 'string') {
      const prov = b.aiKeyFor || ((await kvGet('aiCfg')) || {}).provider || 'claude'; need(PROVIDERS[prov], 400, 'Unknown AI provider');
      await kvSet(keyName(prov), b.aiKey.trim() ? box.seal(b.aiKey.trim().slice(0, 400)) : '');
      await logActivity(pool, u, 'settings', 'ai', (b.aiKey.trim() ? 'Saved the AI key for ' : 'Removed the AI key for ') + PROVIDERS[prov].label);
    }
    return { ok: true, hasAiKey: !!(await aiKey()), ai: await aiInfo() };
  });

  // ---------- team ----------
  const cleanPerms = (p) => { const o = {}; MODULES.forEach(m => { if (LEVELS.includes(p && p[m])) o[m] = p[m]; }); o.costs = !!(p && p.costs); o.export = !!(p && p.export); o.maxDiscount = Number(p && p.maxDiscount) || 0; return o; };
  on('GET', '/api/users', async ({ u }) => {
    need(isOwner(u) || atLeast(u, 'team', 'view'), 403, 'No access to the team.');
    const r = await pool.query('SELECT * FROM users ORDER BY role DESC, created_at');
    return { users: r.rows.map(x => A.publicUser(Object.assign(x, { perms: x.perms }))) };
  });
  on('POST', '/api/users', async ({ u, b }) => {
    owner(u);
    const nu = await A.createUser(pool, { username: b.username, name: b.name, password: b.password, phone: b.phone, role: 'staff', perms: cleanPerms(b.perms) });
    await logActivity(pool, u, 'team', 'team', `Added employee ${nu.name} (@${nu.username})`, { userId: nu.id });
    return { user: A.publicUser(nu) };
  });
  on('PUT', '/api/users/:id', async ({ req, u, b, p }) => {
    owner(u);
    const t = await A.getUser(pool, p.id); need(t, 404, 'Not found');
    const changes = [];
    if (t.role === 'owner') { need(b.active !== false && b.perms == null, 400, "The owner's access can't be limited."); }
    if (typeof b.name === 'string' && b.name.trim()) { await pool.query('UPDATE users SET name=$2 WHERE id=$1', [t.id, b.name.trim().slice(0, 60)]); changes.push('name'); }
    if (typeof b.phone === 'string') { await pool.query('UPDATE users SET phone=$2 WHERE id=$1', [t.id, b.phone.slice(0, 30)]); }
    if (b.perms && t.role !== 'owner') { await pool.query('UPDATE users SET perms=$2 WHERE id=$1', [t.id, JSON.stringify(cleanPerms(b.perms))]); changes.push('permissions'); }
    if (typeof b.active === 'boolean' && t.role !== 'owner') { await pool.query('UPDATE users SET active=$2 WHERE id=$1', [t.id, b.active]); if (!b.active) await A.endSessions(pool, t.id); changes.push(b.active ? 'switched on' : 'switched off'); }
    if (b.password) { await A.setPassword(pool, t.id, b.password); await A.endSessions(pool, t.id, t.id === u.id ? tokenOf(req) : ''); changes.push('password reset'); }
    if (changes.length) await logActivity(pool, u, 'team', 'team', `Updated ${t.name}: ${changes.join(', ')}`, { userId: t.id });
    return { user: A.publicUser(await A.getUser(pool, t.id)) };
  });
  on('POST', '/api/users/:id/signout', async ({ u, p }) => { owner(u); await A.endSessions(pool, p.id); return { ok: true }; });

  on('GET', '/api/team/stats', async ({ u, q }) => {
    need(isOwner(u) || atLeast(u, 'team', 'view'), 403, 'No access to the team.');
    return teamStats(u, Number(q.get('days')), null);
  });
  // an employee's own numbers (for "My work")
  on('GET', '/api/me/stats', async ({ u, q }) => { const r = await teamStats(u, Number(q.get('days')), u.id, true); return { days: r.days, me: r.users[0] || null }; });
  on('GET', '/api/users/brief', async ({ u }) => {
    need(isOwner(u) || anyAtLeast(u, ['orders', 'pos', 'quotes', 'team'], 'edit') || atLeast(u, 'team', 'view'), 403, 'No access.');
    return { users: (await pool.query('SELECT id, name FROM users WHERE active ORDER BY name')).rows };
  });
  on('GET', '/api/notifications', async ({ u, q }) => ({ items: await N.list(pool, u, Number(q.get('limit')) || 50), unread: (await N.unread(pool, u)).n }));
  on('POST', '/api/notifications/read', async ({ u, b }) => { await N.markRead(pool, u, b.all ? 'all' : b.ids); return { ok: true }; });
  async function teamStats(u, daysIn, onlyId, self) {
    const days = Math.min(366, Math.max(1, daysIn || 30)); const since = now() - days * 86400000;
    const users = (await pool.query('SELECT id, name, username, role, active, last_seen FROM users ' + (onlyId ? 'WHERE id=$1 ' : '') + 'ORDER BY created_at', onlyId ? [onlyId] : [])).rows;
    const sales = (await pool.query(`SELECT data->>'createdBy' AS uid, data->>'channel' AS ch, COUNT(*)::int AS n,
        SUM(CASE WHEN data->>'status' IN ('cancelled','refunded') THEN 0 ELSE (data->>'total')::numeric END) AS revenue,
        SUM(CASE WHEN data->>'status' IN ('cancelled','refunded') THEN 1 ELSE 0 END)::int AS cancelled,
        SUM((data->>'discount')::numeric) AS discount
      FROM rows WHERE col='sales' AND NOT deleted AND (data->>'date')::bigint >= $1 GROUP BY 1,2`, [since])).rows;
    const handled = (await pool.query(`SELECT e->>'by' AS uid, COUNT(*)::int AS n FROM rows, jsonb_array_elements(COALESCE(data->'statusLog','[]'::jsonb)) e
      WHERE col='sales' AND NOT deleted AND (e->>'at')::bigint >= $1 GROUP BY 1`, [since])).rows;
    const quotes = (await pool.query(`SELECT data->>'createdBy' AS uid, COUNT(*)::int AS n, SUM(CASE WHEN data->>'status'='accepted' OR data->>'saleId' IS NOT NULL THEN 1 ELSE 0 END)::int AS won
      FROM rows WHERE col='quotes' AND NOT deleted AND COALESCE((data->>'date')::bigint, (data->>'created')::bigint, 0) >= $1 GROUP BY 1`, [since])).rows;
    const pos = (await pool.query(`SELECT data->>'createdBy' AS uid, COUNT(*)::int AS n FROM rows WHERE col='purchases' AND NOT deleted AND COALESCE((data->>'date')::bigint,0) >= $1 GROUP BY 1`, [since])).rows;
    const act = (await pool.query(`SELECT user_id AS uid, kind, COUNT(*)::int AS n FROM activity WHERE at >= $1 GROUP BY 1,2`, [since])).rows;
    const appr = (await pool.query(`SELECT user_id AS uid, status, COUNT(*)::int AS n FROM approvals WHERE created_at >= $1 GROUP BY 1,2`, [since])).rows;
    const daily = (await pool.query(`SELECT data->>'createdBy' AS uid, ((data->>'date')::bigint / 86400000) AS d, COUNT(*)::int AS n, SUM((data->>'total')::numeric) AS v
      FROM rows WHERE col='sales' AND NOT deleted AND (data->>'date')::bigint >= $1 AND data->>'status' NOT IN ('cancelled','refunded') GROUP BY 1,2`, [since])).rows;
    const showMoney = self || seesCosts(u) || atLeast(u, 'reports', 'view') || isOwner(u);
    return {
      days, users: users.map(x => {
        const mine = (arr) => arr.filter(r => r.uid === x.id);
        const s = mine(sales);
        const a = Object.fromEntries(mine(act).map(r => [r.kind, r.n]));
        const ap = Object.fromEntries(mine(appr).map(r => [r.status, r.n]));
        return {
          id: x.id, name: x.name, username: x.username, role: x.role, active: x.active, lastSeen: Number(x.last_seen) || null,
          sales: s.filter(r => r.ch === 'shop').reduce((n, r) => n + r.n, 0), orders: s.filter(r => r.ch !== 'shop').reduce((n, r) => n + r.n, 0),
          revenue: showMoney ? s.reduce((n, r) => n + Number(r.revenue || 0), 0) : null, discount: showMoney ? s.reduce((n, r) => n + Number(r.discount || 0), 0) : null,
          cancelled: s.reduce((n, r) => n + r.cancelled, 0), handled: (mine(handled)[0] || {}).n || 0,
          quotes: (mine(quotes)[0] || {}).n || 0, quotesWon: (mine(quotes)[0] || {}).won || 0, purchases: (mine(pos)[0] || {}).n || 0,
          actions: Object.values(a).reduce((n, v) => n + v, 0) - (a.login || 0), logins: a.login || 0,
          requests: (ap.pending || 0) + (ap.approved || 0) + (ap.rejected || 0) + (ap.withdrawn || 0), approved: ap.approved || 0, rejected: ap.rejected || 0,
          daily: mine(daily).map(r => ({ d: Number(r.d), n: r.n, v: showMoney ? Number(r.v) : null }))
        };
      })
    };
  }
  on('GET', '/api/activity', async ({ u, q }) => {
    const all = isOwner(u) || atLeast(u, 'team', 'view');
    const who = all ? q.get('user') : u.id;
    const limit = Math.min(300, Math.max(1, Number(q.get('limit')) || 100));
    const before = Number(q.get('before')) || 9e15;
    const args = [before]; let w = 'a.at < $1';
    if (who) { args.push(who); w += ` AND a.user_id=$${args.length}`; }
    if (q.get('module')) { args.push(q.get('module')); w += ` AND a.module=$${args.length}`; }
    const r = await pool.query(`SELECT a.*, u.name FROM activity a LEFT JOIN users u ON u.id=a.user_id WHERE ${w} ORDER BY a.at DESC LIMIT ${limit}`, args);
    return { items: r.rows.map(x => ({ id: String(x.id), at: Number(x.at), userId: x.user_id, name: x.name || 'System', kind: x.kind, module: x.module, summary: x.summary })) };
  });

  // ---------- approvals ----------
  async function preview(batch) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const ev = await evaluate(client, { role: 'owner', id: 'preview', perms: {} }, batch); return ev.plan.map(p => ({ col: p.change.col, id: p.change.id, op: p.cls.op, before: p.before, after: p.after })); }
    finally { await client.query('ROLLBACK').catch(() => {}); client.release(); }
  }
  const diffOf = (b, a) => { if (!b || !a) return null; const ks = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]) && !['updated', 'statusLog'].includes(k)); return ks.slice(0, 30).map(k => ({ field: k, from: b[k], to: a[k] })); };
  on('GET', '/api/approvals', async ({ u, q }) => {
    const status = ['pending', 'approved', 'rejected', 'withdrawn', 'all'].includes(q.get('status')) ? q.get('status') : 'pending';
    const mineOnly = !isOwner(u) || q.get('mine') === '1';
    const args = []; const w = [];
    if (status !== 'all') { args.push(status); w.push(`a.status=$${args.length}`); }
    if (mineOnly) { args.push(u.id); w.push(`a.user_id=$${args.length}`); }
    const r = await pool.query(`SELECT a.*, u.name, d.name AS decided_name FROM approvals a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN users d ON d.id=a.decided_by ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY a.created_at DESC LIMIT 200`, args);
    const items = [];
    for (const x of r.rows) {
      const it = { id: x.id, userId: x.user_id, name: x.name, at: Number(x.created_at), summary: x.summary, module: x.module, status: x.status, decidedBy: x.decided_name, decidedAt: x.decided_at ? Number(x.decided_at) : null, note: x.note };
      if (x.status === 'pending' && isOwner(u)) it.changes = (await preview(x.batch)).filter(c => !['moves', 'waLog'].includes(c.col)).map(c => ({ col: c.col, id: c.id, op: c.op, label: (c.after || c.before || {}).no || (c.after || c.before || {}).name || c.id, diff: diffOf(c.before, c.after), after: c.op === 'create' ? c.after : undefined }));
      items.push(it);
    }
    return { items };
  });
  on('POST', '/api/approvals/:id/approve', async ({ u, p, b }) => { owner(u); return decide(pool, u, p.id, true, b.note); });
  on('POST', '/api/approvals/:id/reject', async ({ u, p, b }) => { owner(u); return decide(pool, u, p.id, false, b.note); });
  on('POST', '/api/approvals/:id/withdraw', async ({ u, p }) => {
    const r = await pool.query("UPDATE approvals SET status='withdrawn', decided_at=$3, decided_by=$2 WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING summary", [p.id, u.id, now()]);
    need(r.rows.length, 404, 'Request not found or already decided.');
    await logActivity(pool, u, 'withdraw', null, 'Withdrew request: ' + r.rows[0].summary);
    return { ok: true };
  });

  // ---------- suppliers & catalogue ----------
  const canSource = (u) => isOwner(u) || anyAtLeast(u, ['suppliers', 'pricing', 'purchases'], 'view');
  const canSync = (u) => isOwner(u) || anyAtLeast(u, ['suppliers'], 'edit');
  const hidePrices = (u, x) => { if (seesCosts(u)) return x; (x.items || []).forEach(i => { i.price = null; i.compareAt = null; i.prevPrice = null; i.oldPrice = null; (i.also || []).forEach(a => { a.price = null; }); }); return x; };
  on('GET', '/api/catalog', async ({ u, q }) => { need(canSource(u), 403, 'No access to supplier catalogues.'); return hidePrices(u, await S.searchCatalog(pool, Object.fromEntries(q))); });
  on('POST', '/api/catalog/lookup', async ({ u, b }) => { need(canSource(u), 403, 'No access to supplier catalogues.'); return hidePrices(u, { items: (await S.lookup(pool, b.refs)).map(i => Object.assign(i, { also: [] })) }); });
  on('GET', '/api/suppliers/stats', async ({ u }) => { need(canSource(u), 403, 'No access.'); return { stats: await S.supplierStats(pool) }; });
  on('POST', '/api/suppliers/detect', async ({ u, b }) => { need(canSync(u), 403, 'No permission.'); return S.detect(String(b.url || ''), fetchImpl); });
  const supRow = async (id) => { const r = (await pool.query("SELECT data FROM rows WHERE col='suppliers' AND id=$1 AND NOT deleted", [id])).rows[0]; need(r, 404, 'Supplier not found.'); return r.data; };
  // read one product page (name, code, price, stock) to fill the "add from link" form
  on('POST', '/api/suppliers/read-link', async ({ u, b }) => {
    need(isOwner(u) || anyAtLeast(u, ['suppliers', 'pricing', 'inventory', 'purchases'], 'request'), 403, 'No permission.');
    const p = await S.readProductPage(String(b.url || ''), fetchImpl);
    const host = (x) => { try { return new URL(x).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const sup = (await S.supplierRows(pool)).find(s => s && host(s.website) === host(b.url));
    return Object.assign(p, { supplierId: sup ? sup.id : null });
  });
  on('POST', '/api/suppliers/:id/import', async ({ u, p, b }) => { need(canSync(u), 403, 'No permission.'); return S.importList(pool, await supRow(p.id), b.items, !!b.replace); });
  on('GET', '/api/supplier-changes', async ({ u, q }) => { need(canSource(u), 403, 'No access.'); return hidePrices(u, { items: await S.changes(pool, Object.fromEntries(q)) }); });
  on('POST', '/api/supplier-changes/seen', async ({ u }) => { await S.markChangesSeen(pool, u.id); return { ok: true }; });
  on('POST', '/api/suppliers/:id/sync', async ({ u, p }) => {
    need(canSync(u), 403, 'No permission to sync suppliers.');
    const r = (await pool.query("SELECT data FROM rows WHERE col='suppliers' AND id=$1 AND NOT deleted", [p.id])).rows[0];
    need(r, 404, 'Supplier not found.');
    return S.syncSupplier(pool, r.data, fetchImpl, u);
  });

  // ---------- WhatsApp Business ----------
  const waView = (u) => isOwner(u) || atLeast(u, 'whatsapp', 'view');
  on('GET', '/api/whatsapp/config', async ({ u }) => { need(waView(u) || anyAtLeast(u, ['orders', 'pos', 'quotes'], 'view'), 403, 'No access.'); const c = await WA.publicCfg(); if (!isOwner(u)) delete c.verifyToken; return Object.assign(c, { webhook: (env.PUBLIC_URL || '') + '/api/whatsapp/webhook' }); });
  on('PUT', '/api/whatsapp/config', async ({ u, b }) => { owner(u); const c = await WA.save(b); await logActivity(pool, u, 'settings', 'whatsapp', 'Updated WhatsApp settings'); return c; });
  on('POST', '/api/whatsapp/test', async ({ u }) => { owner(u); return WA.test(); });
  on('GET', '/api/whatsapp/templates', async ({ u }) => { need(waView(u), 403, 'No access.'); return WA.templates(); });
  on('POST', '/api/whatsapp/send', async ({ u, b }) => {
    const marketing = b.kind === 'campaign';
    need(isOwner(u) || (marketing ? atLeast(u, 'whatsapp', 'edit') : anyAtLeast(u, ['whatsapp', 'orders', 'pos', 'quotes', 'qpay', 'customers'], 'request')), 403, 'No permission to send WhatsApp messages.');
    return WA.send(u, b);
  });
  on('POST', '/api/whatsapp/campaign', async ({ u, b }) => { need(isOwner(u) || atLeast(u, 'whatsapp', 'edit'), 403, 'No permission to send campaigns.'); return WA.startCampaign(u, b); });
  on('GET', '/api/whatsapp/campaign/:id', async ({ u, p }) => { need(waView(u), 403, 'No access.'); return WA.campaign(p.id) || { done: true, missing: true }; });
  on('GET', '/api/whatsapp/conversations', async ({ u }) => { need(waView(u), 403, 'No access.'); return { items: await WA.conversations() }; });
  on('GET', '/api/whatsapp/messages', async ({ u, q }) => { need(waView(u), 403, 'No access.'); return { items: await WA.messages(q.get('wa')), open: await WA.windowOpen(String(q.get('wa') || '').replace(/\D/g, '')) }; });
  on('POST', '/api/whatsapp/read', async ({ u, b }) => { need(waView(u), 403, 'No access.'); await WA.markRead(b.wa); return { ok: true }; });

  // ---------- AI provider test (owner) ----------
  on('POST', '/api/ai/test', async ({ u }) => {
    owner(u);
    const r = await aiFetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: PROVIDERS.claude.model, max_tokens: 60, messages: [{ role: 'user', content: 'Reply with: OK, ready.' }] }) });
    const j = await r.json().catch(() => ({}));
    need(r.ok, r.status === 401 ? 400 : (r.status || 502), (j.error && j.error.message) || 'The AI provider did not answer.');
    return { ok: true, text: ((j.content || []).find(c => c.type === 'text') || {}).text || '', model: j.model };
  });

  // ---------- Claude proxy (dashboard AI) ----------
  async function aiProxy(req, res, u) {
    need(isOwner(u) || atLeast(u, 'ai', 'view') || anyAtLeast(u, ['quotes', 'inventory', 'whatsapp'], 'edit'), 403, 'No permission to use the AI.');
    const key = await aiKey(); need(key, 412, 'The owner has not added an AI key yet (Settings → AI).');
    const t = now(); const h = (aiHits.get(u.id) || []).filter(x => t - x < 60000); h.push(t); aiHits.set(u.id, h);
    need(h.length <= (isOwner(u) ? 60 : 30), 429, 'Too many AI requests. Wait a minute.');
    const raw = await new Promise((resolve, reject) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > 2e6) { reject(new HttpError(413, 'Too much data')); req.destroy(); } else c.push(d); }); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });
    const fwd = { 'content-type': 'application/json', 'anthropic-version': String(req.headers['anthropic-version'] || '2023-06-01') };
    if (req.headers['anthropic-beta']) fwd['anthropic-beta'] = String(req.headers['anthropic-beta']);
    const upstream = await aiFetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: fwd, body: raw });
    const out = Object.assign({}, baseHeaders, corsHeaders(req), { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    ['request-id', 'retry-after'].forEach(k => { const v = upstream.headers.get(k); if (v) out[k] = v; });
    res.writeHead(upstream.status, out);
    if (upstream.body && upstream.body.getReader) { const rd = upstream.body.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; res.write(Buffer.from(value)); } res.end(); }
    else res.end(Buffer.from(await upstream.arrayBuffer()));
    logActivity(pool, u, 'ai', 'ai', 'Used the AI').catch(() => {});
  }

  // ---------- store assistant (public website chat) ----------
  async function assistant(req, res) {
    const raw = await new Promise((resolve, reject) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > 20000) { reject(new HttpError(413, 'Too much data')); req.destroy(); } else c.push(d); }); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    headers.set('CF-Connecting-IP', ipOf(req));
    const r = await assistantHandle(new Request('https://local' + req.url, { method: req.method, headers, body: req.method === 'POST' ? raw : undefined }), { ANTHROPIC_API_KEY: (await aiKey()) ? 'via-server' : '', ALLOWED_ORIGINS: env.ALLOWED_ORIGINS || '', CATALOG_URL: env.CATALOG_URL || '', MODEL: env.ASSISTANT_MODEL || '' }, aiFetch);
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname === '/api/assistant') return await assistant(req, res);
      // website: products the supplier ran out of (public, no prices)
      if (url.pathname === '/api/public/availability' && (req.method === 'GET' || req.method === 'OPTIONS')) {
        res.writeHead(req.method === 'OPTIONS' ? 204 : 200, Object.assign({ 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=120', 'Access-Control-Allow-Origin': '*' }));
        return res.end(req.method === 'OPTIONS' ? '' : JSON.stringify(await S.publicAvailability(pool)));
      }
      // WhatsApp webhook (Meta): verification and incoming messages, checked with the app secret
      if (url.pathname === '/api/whatsapp/webhook') {
        if (req.method === 'GET') { const ch = await WA.verify(url.searchParams); res.writeHead(ch == null ? 403 : 200, { 'Content-Type': 'text/plain' }); return res.end(ch == null ? 'Forbidden' : ch); }
        if (req.method === 'POST') {
          const raw = await new Promise((resolve, reject) => { const c = []; let n = 0; req.on('data', d => { n += d.length; if (n > 1e6) { reject(new HttpError(413, 'Too much data')); req.destroy(); } else c.push(d); }); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });
          await WA.receive(raw, req.headers['x-hub-signature-256']);
          res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok');
        }
      }
      if (req.method === 'OPTIONS') { res.writeHead(204, Object.assign({}, baseHeaders, corsHeaders(req))); return res.end(); }
      if (url.pathname === '/api/ai/v1/messages' && req.method === 'POST') { const u = await user(req); return await aiProxy(req, res, u); }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re); if (!m) continue;
        const b = req.method === 'GET' ? {} : await body(req, r.path.endsWith('/import') ? 8e6 : 2e6);
        const open = ['/', '/api/health', '/api/status', '/api/setup', '/api/login', '/api/logout'].includes(url.pathname);
        const u = open ? null : await user(req);
        const out = await r.fn({ req, res, u, b, p: m.groups || {}, q: url.searchParams });
        return send(res, req, 200, out);
      }
      send(res, req, 404, { error: 'Not found' });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      if (!res.headersSent) send(res, req, status, { error: status >= 500 && !e.expose ? (e.status ? e.message : 'Server error') : e.message }, e.extra);
      else try { res.end(); } catch {}
    }
  };
}

export async function start(env = process.env) {
  need(env.DATABASE_URL, 500, 'DATABASE_URL is not set');
  const pool = createPool(env.DATABASE_URL);
  await migrate(pool);
  const app = createApp({ pool, env });
  const server = http.createServer(app);
  server.requestTimeout = 120000; server.headersTimeout = 30000;
  const port = Number(env.PORT) || 8080;
  await new Promise(r => server.listen(port, r));
  console.log('Business Hub API listening on', port);
  if (env.DISABLE_SCHEDULER !== '1') {
    S.startScheduler(pool, globalThis.fetch);
    S.ensureKnown(pool).then(() => S.autoSync(pool, globalThis.fetch)).catch(e => console.error('auto sync', e.message));
    setInterval(() => N.remindTasks(pool).catch(e => console.error('task reminders', e.message)), 5 * 60000);
  }
  return { server, pool };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) start().catch(e => { console.error(e); process.exit(1); });
