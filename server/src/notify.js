// Notifications for the owner and employees: new orders, orders and tasks given to someone,
// task reminders, approval requests and answers, supplier changes, WhatsApp messages.
import { atLeast, isOwner } from './perms.js';
import { writeRow } from './store.js';

const now = () => Date.now();
const money = (n) => 'OMR ' + (Number(n) || 0).toFixed(3);

export async function notify(db, userIds, n) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  for (const uid of ids) {
    await db.query('INSERT INTO notifications (user_id, at, kind, title, body, link) VALUES ($1,$2,$3,$4,$5,$6)',
      [uid, now(), n.kind || 'info', String(n.title || '').slice(0, 200), String(n.body || '').slice(0, 400), String(n.link || '').slice(0, 200)]);
  }
}
// active people who can see a section (the owner always can)
export async function usersWith(db, modules, level = 'view') {
  const r = await db.query('SELECT id, role, perms FROM users WHERE active');
  return r.rows.filter(u => isOwner(u) || [].concat(modules).some(m => atLeast(u, m, level))).map(u => u.id);
}
export const owners = async (db) => (await db.query("SELECT id FROM users WHERE role='owner' AND active")).rows.map(r => r.id);

export async function afterApply(db, user, plan) {
  for (const p of plan || []) {
    const { col } = p.change; const a = p.after, b = p.before;
    if (!a) continue;
    if (col === 'sales' && !b && a.channel !== 'shop') {
      const to = (await usersWith(db, 'orders')).filter(id => id !== user.id);
      await notify(db, to, { kind: 'order', title: `New online order ${a.no}`, body: `${a.customerName || ''} · ${money(a.total)}`, link: '#/orders' });
    }
    if (col === 'sales' && a.assignedTo && (!b || b.assignedTo !== a.assignedTo) && a.assignedTo !== user.id) {
      await notify(db, [a.assignedTo], { kind: 'assigned', title: `Order ${a.no} is yours`, body: `${user.name} gave you order ${a.no} (${a.customerName || ''}).`, link: '#/orders' });
    }
    if (col === 'tasks' && a.assignedTo && (!b || b.assignedTo !== a.assignedTo) && a.assignedTo !== user.id) {
      await notify(db, [a.assignedTo], { kind: 'task', title: `New task: ${a.title}`, body: `${user.name}${a.due ? ' · due ' + new Date(a.due).toISOString().slice(0, 16).replace('T', ' ') : ''}`, link: '#/dashboard' });
    }
    if (col === 'tasks' && b && !b.done && a.done && a.createdBy && a.createdBy !== user.id) {
      await notify(db, [a.createdBy], { kind: 'task_done', title: `Done: ${a.title}`, body: `${user.name} finished the task.`, link: '#/team' });
    }
  }
}
export async function onRequest(db, user, summary) {
  await notify(db, await owners(db), { kind: 'approval', title: `${user.name} asks for approval`, body: summary, link: '#/approvals' });
}
export async function onDecide(db, a, approve, note) {
  await notify(db, [a.user_id], { kind: approve ? 'approved' : 'rejected', title: approve ? 'Request approved' : 'Request rejected', body: a.summary + (note ? ' — ' + note : ''), link: '#/approvals' });
}

// Reminders for tasks due within the next hour (once per task).
export async function remindTasks(pool) {
  const t = now();
  const r = await pool.query(`SELECT id, data FROM rows WHERE col='tasks' AND NOT deleted AND COALESCE((data->>'done')::boolean, false) = false
    AND (data->>'due') IS NOT NULL AND (data->>'due')::bigint < $1 AND (data->>'remindedAt') IS NULL`, [t + 3600000]);
  for (const row of r.rows) {
    const d = row.data;
    const late = Number(d.due) < t;
    if (d.assignedTo) await notify(pool, [d.assignedTo], { kind: 'reminder', title: (late ? 'Overdue: ' : 'Due soon: ') + d.title, body: new Date(Number(d.due)).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', link: '#/dashboard' });
    await writeRow(pool, { id: 'system' }, 'tasks', row.id, Object.assign({}, d, { remindedAt: t }));
  }
}

export async function list(pool, user, limit) {
  const r = await pool.query('SELECT id, at, kind, title, body, link, read FROM notifications WHERE user_id=$1 ORDER BY at DESC LIMIT $2', [user.id, Math.min(200, limit || 50)]);
  return r.rows.map(x => ({ id: String(x.id), at: Number(x.at), kind: x.kind, title: x.title, body: x.body, link: x.link, read: x.read }));
}
export async function unread(pool, user) {
  return (await pool.query('SELECT COUNT(*)::int AS n, COALESCE(MAX(at),0)::bigint AS last FROM notifications WHERE user_id=$1 AND NOT read', [user.id])).rows[0];
}
export async function markRead(pool, user, ids) {
  if (ids === 'all') await pool.query('UPDATE notifications SET read=true WHERE user_id=$1 AND NOT read', [user.id]);
  else await pool.query('UPDATE notifications SET read=true WHERE user_id=$1 AND id = ANY($2::bigint[])', [user.id, (ids || []).map(Number).filter(Number.isFinite)]);
}
