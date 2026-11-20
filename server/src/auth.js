// Accounts and sign-in. Passwords are stored as scrypt hashes; sessions as SHA-256 of a random token.
import crypto from 'node:crypto';
import { normalizePerms, MODULES } from './perms.js';

const now = () => Date.now();
const SESSION_HOURS = 12;
const IDLE_HOURS = 4;
export const MIN_PW = 8;

const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('base64') + '$' + (await scrypt(pw, salt)).toString('base64');
}
export async function checkPassword(pw, stored) {
  const [, s, h] = String(stored).split('$');
  if (!s || !h) return false;
  const k = await scrypt(pw, Buffer.from(s, 'base64'));
  const want = Buffer.from(h, 'base64');
  return want.length === k.length && crypto.timingSafeEqual(want, k);
}
export function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < MIN_PW) return `Use at least ${MIN_PW} characters.`;
  if (pw.length > 200) return 'Too long.';
  let s = 0; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^\w\s]/.test(pw)) s++; if (pw.length >= 12) s++;
  if (s < 1) return 'Too easy to guess: mix letters with numbers or symbols, or make it longer.';
  return '';
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const cleanUsername = (u) => String(u || '').trim().toLowerCase();
export const validUsername = (u) => /^[a-z0-9._-]{3,32}$/.test(cleanUsername(u));

export const publicUser = (u) => u && ({ id: u.id, username: u.username, name: u.name, role: u.role, perms: u.role === 'owner' ? ownerPerms() : normalizePerms(u.perms), active: u.active, phone: u.phone || '', lastSeen: Number(u.last_seen) || null, created: Number(u.created_at) });
function ownerPerms() { const p = { costs: true, export: true, maxDiscount: 100 }; MODULES.forEach(m => { p[m] = 'full'; }); return p; }

export async function userCount(pool) { return (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n; }

export async function createUser(pool, { username, name, password, role, perms, phone }) {
  username = cleanUsername(username);
  if (!validUsername(username)) throw Object.assign(new Error('User name: 3–32 letters, numbers, dot, dash or underscore.'), { status: 400 });
  const prob = passwordProblem(password); if (prob) throw Object.assign(new Error(prob), { status: 400 });
  if (!String(name || '').trim()) throw Object.assign(new Error('Enter a name.'), { status: 400 });
  const exists = await pool.query('SELECT 1 FROM users WHERE username=$1', [username]);
  if (exists.rows.length) throw Object.assign(new Error('That user name is taken.'), { status: 409 });
  const id = 'u_' + crypto.randomBytes(6).toString('hex');
  await pool.query('INSERT INTO users (id,username,name,role,perms,pass_hash,phone,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, username, String(name).trim().slice(0, 60), role === 'owner' ? 'owner' : 'staff', JSON.stringify(normalizePerms(perms || {})), await hashPassword(password), String(phone || '').slice(0, 30), now()]);
  return getUser(pool, id);
}
export async function getUser(pool, id) { const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]); return r.rows[0] ? withPerms(r.rows[0]) : null; }
const withPerms = (u) => Object.assign(u, { perms: u.role === 'owner' ? ownerPerms() : normalizePerms(u.perms) });

// Sign-in with lock-out: after 5 wrong passwords the account waits 30 s, doubling up to 15 minutes.
const ipHits = new Map();
export async function login(pool, username, password, ip, ua) {
  const t = now();
  const hits = (ipHits.get(ip) || []).filter(x => t - x < 15 * 60000); hits.push(t); ipHits.set(ip, hits);
  if (ipHits.size > 10000) ipHits.clear();
  if (hits.length > 40) throw Object.assign(new Error('Too many sign-in attempts from this network. Try again in a few minutes.'), { status: 429 });
  const r = await pool.query('SELECT * FROM users WHERE username=$1', [cleanUsername(username)]);
  const u = r.rows[0];
  if (u && Number(u.locked_until) > t) throw Object.assign(new Error(`Too many wrong tries. Try again in ${Math.ceil((u.locked_until - t) / 1000)} s.`), { status: 429, wait: Number(u.locked_until) - t });
  const ok = u ? await checkPassword(password, u.pass_hash) : (await checkPassword(password, 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='), false);
  if (!u || !ok) {
    if (u) { const n = u.failed + 1; const lock = n >= 5 ? t + Math.min(15 * 60000, 30000 * 2 ** (n - 5)) : 0; await pool.query('UPDATE users SET failed=$2, locked_until=$3 WHERE id=$1', [u.id, n, lock]); }
    throw Object.assign(new Error('Wrong user name or password.'), { status: 401 });
  }
  if (!u.active) throw Object.assign(new Error('This account is switched off. Ask the owner.'), { status: 403 });
  await pool.query('UPDATE users SET failed=0, locked_until=0, last_seen=$2 WHERE id=$1', [u.id, t]);
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO sessions (token_hash,user_id,created_at,expires_at,last_seen,ip,ua) VALUES ($1,$2,$3,$4,$3,$5,$6)', [sha(token), u.id, t, t + SESSION_HOURS * 3600000, String(ip || '').slice(0, 64), String(ua || '').slice(0, 200)]);
  await pool.query('DELETE FROM sessions WHERE expires_at < $1', [t]);
  return { token, user: withPerms(u) };
}
export async function authenticate(pool, token) {
  if (!token || token.length > 100) return null;
  const t = now();
  const r = await pool.query('SELECT s.token_hash, s.expires_at, s.last_seen AS s_seen, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1', [sha(token)]);
  const row = r.rows[0];
  if (!row || Number(row.expires_at) < t || t - Number(row.s_seen) > IDLE_HOURS * 3600000 || !row.active) { if (row) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [row.token_hash]); return null; }
  if (t - Number(row.s_seen) > 60000) { await pool.query('UPDATE sessions SET last_seen=$2 WHERE token_hash=$1', [row.token_hash, t]); await pool.query('UPDATE users SET last_seen=$2 WHERE id=$1', [row.id, t]); }
  return withPerms(row);
}
export async function logout(pool, token) { if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]); }
export async function endSessions(pool, userId, exceptToken) { await pool.query('DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2', [userId, exceptToken ? sha(exceptToken) : '']); }
export async function setPassword(pool, userId, pw) {
  const prob = passwordProblem(pw); if (prob) throw Object.assign(new Error(prob), { status: 400 });
  await pool.query('UPDATE users SET pass_hash=$2, failed=0, locked_until=0 WHERE id=$1', [userId, await hashPassword(pw)]);
}
