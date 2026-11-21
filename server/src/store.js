// Data store: the dashboard's collections (products, sales, customers…) are kept as rows of JSON.
// Each save from the dashboard arrives as a batch of row changes. The batch is checked against the
// user's permissions and is applied, sent to the owner for approval, or refused — always as a whole,
// so stock, orders and logs never get out of step.
import pg from 'pg';
import crypto from 'node:crypto';
import { classify, verdict, canRead, canReadRow, redact, seesCosts, isOwner } from './perms.js';

// called after changes are applied (notifications); set by index.js
export const hooks = { afterApply: async () => {}, onRequest: async () => {}, onDecide: async () => {} };

export function createPool(url) {
  const ssl = /sslmode=require|railway\.internal/.test(url) ? false : undefined;
  const pool = new pg.Pool({ connectionString: url, max: 8, ssl });
  // a dropped idle connection (database restart, network blip) must not stop the server
  pool.on('error', (e) => console.error('database connection error:', e.message));
  return pool;
}

export async function migrate(pool) {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS row_seq;
    CREATE TABLE IF NOT EXISTS rows (
      col text NOT NULL, id text NOT NULL, data jsonb, version int NOT NULL DEFAULT 1,
      deleted boolean NOT NULL DEFAULT false, seq bigint NOT NULL DEFAULT nextval('row_seq'),
      updated_at bigint NOT NULL, updated_by text, PRIMARY KEY (col, id));
    CREATE INDEX IF NOT EXISTS rows_seq ON rows (seq);
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL DEFAULT 'staff',
      perms jsonb NOT NULL DEFAULT '{}', pass_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
      phone text DEFAULT '', created_at bigint NOT NULL, last_seen bigint, failed int NOT NULL DEFAULT 0, locked_until bigint NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at bigint NOT NULL, expires_at bigint NOT NULL, last_seen bigint NOT NULL, ip text, ua text);
    CREATE TABLE IF NOT EXISTS approvals (
      id text PRIMARY KEY, user_id text NOT NULL, created_at bigint NOT NULL, summary text NOT NULL, module text,
      batch jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', decided_by text, decided_at bigint, note text);
    CREATE TABLE IF NOT EXISTS activity (
      id bigserial PRIMARY KEY, at bigint NOT NULL, user_id text, kind text NOT NULL, module text, summary text NOT NULL, meta jsonb);
    CREATE INDEX IF NOT EXISTS activity_at ON activity (at);
    CREATE INDEX IF NOT EXISTS activity_user ON activity (user_id, at);
    CREATE TABLE IF NOT EXISTS supplier_items (
      supplier_id text NOT NULL, sku text NOT NULL, skey text NOT NULL, title text NOT NULL, vendor text, ptype text, tags text,
      price numeric, compare_at numeric, currency text, available boolean, url text, image text,
      first_seen bigint NOT NULL, last_seen bigint NOT NULL, prev_price numeric, price_changed_at bigint,
      PRIMARY KEY (supplier_id, sku));
    CREATE INDEX IF NOT EXISTS supplier_items_skey ON supplier_items (skey);
    CREATE TABLE IF NOT EXISTS sync_runs (
      id bigserial PRIMARY KEY, supplier_id text NOT NULL, started_at bigint NOT NULL, finished_at bigint, ok boolean, items int, changed int, error text);
    CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, value jsonb);
    ALTER TABLE supplier_items ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;
    ALTER TABLE supplier_items ADD COLUMN IF NOT EXISTS part_no text;
    ALTER TABLE supplier_items ALTER COLUMN available DROP NOT NULL;
    CREATE TABLE IF NOT EXISTS supplier_changes (
      id bigserial PRIMARY KEY, supplier_id text NOT NULL, sku text NOT NULL, kind text NOT NULL, title text, url text,
      old_price numeric, new_price numeric, currency text, at bigint NOT NULL);
    CREATE INDEX IF NOT EXISTS supplier_changes_at ON supplier_changes (at);
    CREATE TABLE IF NOT EXISTS notifications (
      id bigserial PRIMARY KEY, user_id text NOT NULL, at bigint NOT NULL, kind text, title text, body text, link text, read boolean NOT NULL DEFAULT false);
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications (user_id, at);
    CREATE TABLE IF NOT EXISTS wa_messages (
      id bigserial PRIMARY KEY, wamid text UNIQUE, wa_id text NOT NULL, direction text NOT NULL, type text, body text, name text,
      at bigint NOT NULL, status text, kind text, ref text, user_id text, read boolean NOT NULL DEFAULT false, error text);
    CREATE INDEX IF NOT EXISTS wa_messages_conv ON wa_messages (wa_id, at);
  `);
}

const now = () => Date.now();
const uid = (p) => p + '_' + crypto.randomBytes(6).toString('hex');
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

// ---------- reading ----------
// The client's database object is rebuilt from rows: arrays of {id} become collections, everything else is "meta".
export async function readState(pool, user) {
  const { rows } = await pool.query('SELECT col, id, data, version FROM rows WHERE NOT deleted ORDER BY seq');
  const seq = (await pool.query('SELECT COALESCE(MAX(seq),0)::bigint AS s FROM rows')).rows[0].s;
  const data = {}, versions = {};
  for (const r of rows) {
    if (!canRead(user, r.col, r.id) || !canReadRow(user, r.col, r.data)) continue;
    if (r.col === 'meta') { data[r.id] = r.data && Object.prototype.hasOwnProperty.call(r.data, '__v') ? r.data.__v : r.data; if (r.id === 'settings') data.settings = sanitizeSettings(user, data.settings); }
    else { (data[r.col] = data[r.col] || []).push(redact(user, r.col, r.data)); }
    versions[r.col + '/' + r.id] = r.version;
  }
  return { data, seq: String(seq), empty: rows.length === 0 };
}
function sanitizeSettings(user, s) {
  if (!s || isOwner(user)) return s;
  const c = clone(s); delete c.github; return c;
}
export async function changesSince(pool, user, since) {
  const { rows } = await pool.query('SELECT col, id, data, deleted, seq FROM rows WHERE seq > $1 ORDER BY seq LIMIT 5000', [since || 0]);
  const out = [];
  let seq = since || 0;
  for (const r of rows) {
    seq = r.seq;
    if (!canRead(user, r.col, r.id) || (!r.deleted && !canReadRow(user, r.col, r.data))) continue;
    let d = r.deleted ? null : r.col === 'meta' ? (r.data && Object.prototype.hasOwnProperty.call(r.data, '__v') ? r.data.__v : r.data) : redact(user, r.col, r.data);
    if (r.col === 'meta' && r.id === 'settings' && d) d = sanitizeSettings(user, d);
    out.push({ col: r.col, id: r.id, data: d, deleted: r.deleted });
  }
  return { changes: out, seq: String(seq) };
}

// ---------- writing ----------
// change = { col, id, prev (what the client last saw, or null when new), data (new value, or null to delete) }
// Fields are merged one by one onto the current server row, so two people editing different fields
// of the same record don't overwrite each other. Stock is applied as a difference (sold 2 → minus 2).
function merge(current, prev, next, col) {
  if (next == null) return null;
  if (!current || !prev) return clone(next);
  const out = clone(current);
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = JSON.stringify(prev[k]), b = JSON.stringify(next[k]);
    if (a === b) continue;
    if (col === 'products' && k === 'stock') { out.stock = Math.max(0, (Number(current.stock) || 0) + (Number(next.stock) || 0) - (Number(prev.stock) || 0)); continue; }
    if (!(k in next)) delete out[k]; else out[k] = clone(next[k]);
  }
  return out;
}
const wrapMeta = (col, v) => (col === 'meta' && (v === null || typeof v !== 'object' || Array.isArray(v)) ? { __v: v } : v);
const unwrapMeta = (col, v) => (col === 'meta' && v && Object.prototype.hasOwnProperty.call(v, '__v') ? v.__v : v);

const money = (n) => 'OMR ' + (Number(n) || 0).toFixed(3);
export function describe(col, id, before, after) {
  const x = after || before || {};
  const name = x.no || x.name || x.desc || id;
  if (col === 'sales') {
    if (!before) return `New ${x.channel === 'shop' ? 'sale' : 'order'} ${x.no} · ${money(x.total)}${x.discount ? ` · discount ${money(x.discount)}` : ''}`;
    if (!after) return `Delete order ${name}`;
    if (before.status !== after.status) return `Order ${x.no}: ${before.status} → ${after.status}`;
    if ((after.returns || []).length > (before.returns || []).length) return `Return on ${x.no} · ${money(before.total - after.total)}`;
    if (JSON.stringify(before.qpay) !== JSON.stringify(after.qpay)) return `Qpay on ${x.no}: ${(after.qpay || {}).status}`;
    if (before.paid !== after.paid) return `Order ${x.no} marked ${after.paid ? 'paid' : 'unpaid'}`;
    return `Update order ${x.no}`;
  }
  if (col === 'products') {
    if (!before) return `New product ${x.name}${x.price ? ` · ${money(x.price)}` : ''}`;
    if (!after) return `Delete product ${name}`;
    if (before.price !== after.price) return `Price of ${x.name}: ${money(before.price)} → ${money(after.price)}`;
    if (before.stock !== after.stock) return `Stock of ${x.name}: ${before.stock} → ${after.stock}`;
    return `Update product ${x.name}`;
  }
  if (col === 'quotes') return !before ? `New quote ${x.no}` : !after ? `Delete quote ${name}` : before.status !== after.status ? `Quote ${x.no}: ${before.status} → ${after.status}` : `Update quote ${x.no}`;
  if (col === 'purchases') return !before ? `New supplier order ${x.no} · ${money(x.total)}` : !after ? `Delete supplier order ${name}` : before.status !== after.status ? `Supplier order ${x.no}: ${before.status} → ${after.status}` : `Update supplier order ${x.no}`;
  if (col === 'expenses') return !before ? `Expense ${x.desc} · ${money(x.amount)}` : !after ? `Delete expense ${name}` : `Update expense ${x.desc}`;
  if (col === 'customers') return !before ? `New customer ${x.name}` : !after ? `Delete customer ${name}` : `Update customer ${x.name}`;
  if (col === 'suppliers') return !before ? `New supplier ${x.name}` : !after ? `Delete supplier ${name}` : `Update supplier ${x.name}`;
  if (col === 'meta') return `Update ${id}`;
  return `${!before ? 'Add' : !after ? 'Delete' : 'Update'} ${col} ${name}`;
}
const MAIN_ORDER = ['sales', 'quotes', 'purchases', 'products', 'customers', 'suppliers', 'expenses', 'campaigns', 'meta', 'categories', 'vehicles', 'held', 'moves', 'waLog'];

// Check a batch. Returns { decision: 'allow'|'approve'|'deny', plan:[{change,current,merged,cls}], summary, module, reason }
export async function evaluate(client, user, batch) {
  const plan = [];
  let decision = 'allow', reason = '';
  for (const ch of batch) {
    if (!ch || typeof ch.col !== 'string' || typeof ch.id !== 'string' || !/^[\w-]{1,40}$/.test(ch.col) || ch.id.length > 120) throw Object.assign(new Error('Bad change'), { status: 400 });
    const cur = await client.query('SELECT data, deleted FROM rows WHERE col=$1 AND id=$2 FOR UPDATE', [ch.col, ch.id]);
    const currentRaw = cur.rows[0] && !cur.rows[0].deleted ? cur.rows[0].data : null;
    const current = unwrapMeta(ch.col, currentRaw);
    let prev = ch.prev == null ? null : ch.prev, next = ch.data == null ? null : ch.data;
    if (ch.col === 'meta') { prev = prev == null ? null : wrapMeta('meta', prev); next = next == null ? null : wrapMeta('meta', next); }
    // people who can't see costs can't set them either
    if (!seesCosts(user) && next && ['products', 'purchases'].includes(ch.col)) {
      next = clone(next);
      if (ch.col === 'products') { if (!currentRaw) { next.cost = 0; } else { delete next.cost; if (prev) { prev = clone(prev); delete prev.cost; } } }
    }
    let merged = ch.col === 'meta' ? (next == null ? null : (currentRaw && prev && typeof next === 'object' && !('__v' in next) ? merge(currentRaw, prev, next) : next)) : merge(current, prev, next, ch.col);
    if (!currentRaw && next == null) continue; // deleting something that isn't there
    const before = ch.col === 'meta' ? unwrapMeta('meta', currentRaw) : current;
    const after = ch.col === 'meta' ? unwrapMeta('meta', merged) : merged;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    // never sync passwords or keys through data rows
    if (ch.col === 'meta' && ch.id === 'secrets') continue;
    const cls = classify(ch.col, ch.id, before, after);
    if (ch.col === 'tasks' && !isOwner(user)) {
      const mine = (x) => x && x.assignedTo === user.id;
      const ownKeys = ['done', 'doneAt', 'status', 'notes', 'updated'];
      if (cls.op === 'create' && mine(after) && after.createdBy === user.id) cls.self = true;
      if (cls.op === 'update' && mine(before) && mine(after) && Object.keys(Object.assign({}, before, after)).every(k => ownKeys.includes(k) || JSON.stringify(before[k]) === JSON.stringify(after[k]))) cls.self = true;
    }
    let v = verdict(user, cls);
    // discount limit at the till / on orders
    if (ch.col === 'sales' && !before && after && !isOwner(user)) {
      // a lowered line price counts as discount too (against the product's list price)
      let list = 0, sub = 0;
      for (const it of after.items || []) {
        const pr = await client.query("SELECT data FROM rows WHERE col='products' AND id=$1", [it.pid]);
        const lp = pr.rows[0] ? Number(pr.rows[0].data.price) || 0 : 0;
        list += (Number(it.qty) || 0) * (lp > 0 ? lp : Number(it.price) || 0); sub += (Number(it.qty) || 0) * (Number(it.price) || 0);
      }
      const totalDisc = Math.max(0, list - sub) + (Number(after.discount) || 0);
      const pct = list ? totalDisc / list * 100 : 0;
      if (pct > (user.perms.maxDiscount || 0) + 0.001) { v = 'deny'; reason = `Discount ${pct.toFixed(1)}% is above your limit of ${user.perms.maxDiscount || 0}%. Ask the owner.`; }
    }
    if (v === 'deny' && !reason) reason = `You don't have permission to ${cls.op === 'create' ? 'add' : cls.op === 'delete' ? 'delete' : 'change'} ${labelOf(ch.col, ch.id)}.`;
    if (v === 'deny') decision = 'deny';
    else if (v === 'approve' && decision !== 'deny') decision = 'approve';
    plan.push({ change: { col: ch.col, id: ch.id, prev: ch.prev == null ? null : ch.prev, data: ch.data == null ? null : ch.data }, before, after, cls, verdict: v });
  }
  plan.sort((a, b) => MAIN_ORDER.indexOf(a.change.col) - MAIN_ORDER.indexOf(b.change.col));
  const main = plan.find(p => !p.cls.side) || plan[0];
  const summary = main ? describe(main.change.col, main.change.id, main.before, main.after) + (plan.length > 1 ? ` (+${plan.length - 1} related change${plan.length > 2 ? 's' : ''})` : '') : '';
  return { decision, plan, summary, module: main ? main.cls.anyOf[0] : '', reason };
}
function labelOf(col, id) { return { products: 'products', sales: 'orders', quotes: 'quotes', purchases: 'supplier orders', suppliers: 'suppliers', customers: 'customers', expenses: 'expenses', campaigns: 'campaigns', meta: id === 'settings' ? 'settings' : id }[col] || col; }

// Server-side touches that keep records trustworthy.
async function stamp(client, user, p, actingFor) {
  const { col } = p.change; const a = p.after; const b = p.before;
  if (!a) return;
  const who = actingFor || user;
  if (col === 'sales') {
    if (!b) {
      a.createdBy = who.id; a.createdByName = who.name;
      // cost comes from the server's product record, never from the device
      for (const it of a.items || []) { const pr = await client.query("SELECT data FROM rows WHERE col='products' AND id=$1", [it.pid]); if (pr.rows[0]) it.cost = Number(pr.rows[0].data.cost) || 0; }
      await uniqueNo(client, 'sales', a);
    }
    if (b && b.status !== a.status) { a.statusLog = (b.statusLog || []).concat([{ s: a.status, at: now(), by: who.id, name: who.name }]); a.handledBy = who.id; }
  }
  if (col === 'tasks') { if (!b) { a.createdBy = a.createdBy || who.id; a.createdByName = who.name; a.created = a.created || now(); } if (a.done && !(b && b.done)) a.doneAt = now(); }
  if (col === 'sales' && a.assignedTo && (!b || b.assignedTo !== a.assignedTo)) { const u = await client.query('SELECT name FROM users WHERE id=$1', [a.assignedTo]); a.assignedName = u.rows[0] ? u.rows[0].name : ''; a.assignedAt = now(); }
  if (!b && (col === 'quotes' || col === 'purchases')) { a.createdBy = who.id; a.createdByName = who.name; await uniqueNo(client, col, a); }
  if (b && col === 'quotes' && b.status !== a.status) a.statusLog = (b.statusLog || []).concat([{ s: a.status, at: now(), by: who.id, name: who.name }]);
  if (b && col === 'purchases' && b.status !== a.status) a.statusLog = (b.statusLog || []).concat([{ s: a.status, at: now(), by: who.id, name: who.name }]);
}
// Two devices can pick the same next number (INV-1043); the server gives the later one the next free number.
async function uniqueNo(client, col, a) {
  if (!a.no) return;
  const m = String(a.no).match(/^(.*?)(\d+)$/); if (!m) return;
  const clash = await client.query(`SELECT 1 FROM rows WHERE col=$1 AND NOT deleted AND data->>'no'=$2 AND id<>$3 LIMIT 1`, [col, a.no, a.id || '']);
  if (!clash.rows.length) return;
  const all = await client.query(`SELECT data->>'no' AS no FROM rows WHERE col=$1 AND data->>'no' LIKE $2`, [col, m[1] + '%']);
  const max = all.rows.reduce((x, r) => Math.max(x, parseInt(String(r.no).slice(m[1].length), 10) || 0), 0);
  a.no = m[1] + (max + 1);
}

async function writeRow(client, user, col, id, value) {
  const t = now();
  if (value == null) {
    await client.query(`UPDATE rows SET deleted=true, data=NULL, version=version+1, seq=nextval('row_seq'), updated_at=$3, updated_by=$4 WHERE col=$1 AND id=$2`, [col, id, t, user.id]);
    return null;
  }
  const v = wrapMeta(col, value);
  await client.query(`INSERT INTO rows (col,id,data,updated_at,updated_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (col,id) DO UPDATE SET data=EXCLUDED.data, deleted=false, version=rows.version+1, seq=nextval('row_seq'), updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by`, [col, id, v, t, user.id]);
  return value;
}

export { writeRow };
export async function logActivity(db, user, kind, module, summary, meta) {
  await db.query('INSERT INTO activity (at,user_id,kind,module,summary,meta) VALUES ($1,$2,$3,$4,$5,$6)', [now(), user ? user.id : null, kind, module || null, String(summary).slice(0, 400), meta ? JSON.stringify(meta) : null]);
}

// Apply (or queue) a batch. Returns { status, rows: current rows to show, approvalId?, message?, seq }
export async function submit(pool, user, batch) {
  if (!Array.isArray(batch) || batch.length > 400) throw Object.assign(new Error('Bad batch'), { status: 400 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await evaluate(client, user, batch);
    let status = 'ok', approvalId = null, message = '';
    if (!ev.plan.length) { await client.query('COMMIT'); return { status: 'ok', rows: [], seq: await maxSeq(pool) }; }
    if (ev.decision === 'deny') { status = 'denied'; message = ev.reason; }
    else if (ev.decision === 'approve') {
      approvalId = uid('ap');
      await client.query('INSERT INTO approvals (id,user_id,created_at,summary,module,batch) VALUES ($1,$2,$3,$4,$5,$6)', [approvalId, user.id, now(), ev.summary, ev.module, JSON.stringify(ev.plan.map(p => p.change))]);
      await logActivity(client, user, 'request', ev.module, 'Asked for approval: ' + ev.summary, { approvalId });
      await hooks.onRequest(client, user, ev.summary, approvalId);
      status = 'pending'; message = 'Sent to the owner for approval';
    } else {
      for (const p of ev.plan) { await stamp(client, user, p); await writeRow(client, user, p.change.col, p.change.id, p.after); }
      await hooks.afterApply(client, user, ev.plan);
      await logActivity(client, user, 'change', ev.module, ev.summary, { cols: [...new Set(ev.plan.map(p => p.change.col))], ids: ev.plan.slice(0, 20).map(p => p.change.col + '/' + p.change.id) });
    }
    await client.query('COMMIT');
    // send back the server's version of every row in the batch (for reverting or for server-set fields)
    const rows = await currentRows(pool, user, batch);
    return { status, rows, approvalId, message, seq: await maxSeq(pool) };
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}
async function maxSeq(pool) { return String((await pool.query('SELECT COALESCE(MAX(seq),0)::bigint AS s FROM rows')).rows[0].s); }
async function currentRows(pool, user, batch) {
  const out = [];
  for (const ch of batch) {
    const r = await pool.query('SELECT data, deleted FROM rows WHERE col=$1 AND id=$2', [ch.col, ch.id]);
    const d = r.rows[0] && !r.rows[0].deleted ? unwrapMeta(ch.col, r.rows[0].data) : null;
    out.push({ col: ch.col, id: ch.id, data: d == null ? null : (ch.col === 'meta' ? (ch.id === 'settings' ? sanitizeSettings(user, d) : d) : redact(user, ch.col, d)) });
  }
  return out;
}

// ---------- approvals ----------
export async function decide(pool, owner, id, approve, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const a = (await client.query('SELECT * FROM approvals WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!a) throw Object.assign(new Error('Not found'), { status: 404 });
    if (a.status !== 'pending') throw Object.assign(new Error('Already decided'), { status: 409 });
    const requester = (await client.query('SELECT * FROM users WHERE id=$1', [a.user_id])).rows[0];
    if (approve) {
      // re-check against current data, then apply as the owner on behalf of the employee
      const ev = await evaluate(client, owner, a.batch);
      for (const p of ev.plan) { await stamp(client, owner, p, requester || owner); await writeRow(client, owner, p.change.col, p.change.id, p.after); }
      await hooks.afterApply(client, requester || owner, ev.plan);
      await logActivity(client, owner, 'approve', a.module, `Approved ${requester ? requester.name + "'s" : ''} request: ${a.summary}`, { approvalId: id, for: a.user_id });
      if (requester) await logActivity(client, requester, 'change', a.module, a.summary + ' (approved)', { approvalId: id });
    } else {
      await logActivity(client, owner, 'reject', a.module, `Rejected ${requester ? requester.name + "'s" : ''} request: ${a.summary}${note ? ' — ' + note : ''}`, { approvalId: id, for: a.user_id });
    }
    await client.query('UPDATE approvals SET status=$2, decided_by=$3, decided_at=$4, note=$5 WHERE id=$1', [id, approve ? 'approved' : 'rejected', owner.id, now(), (note || '').slice(0, 300)]);
    await hooks.onDecide(client, a, approve, note);
    await client.query('COMMIT');
    return { ok: true, seq: await maxSeq(pool) };
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}

// First load of an empty system: the owner uploads the data that was on the device (or demo data).
export async function importAll(pool, user, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const n = (await client.query('SELECT COUNT(*)::int AS n FROM rows')).rows[0].n;
    if (n > 0) throw Object.assign(new Error('Data already exists online'), { status: 409 });
    let count = 0;
    for (const [k, v] of Object.entries(data || {})) {
      if (k === 'secrets') continue;
      if (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object' && typeof x.id === 'string')) {
        for (const row of v) { await writeRow(client, user, k, row.id, row); count++; }
      } else { await writeRow(client, user, 'meta', k, v); count++; }
    }
    await logActivity(client, user, 'import', 'settings', `Moved ${count} records online`);
    await client.query('COMMIT');
    return count;
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}
