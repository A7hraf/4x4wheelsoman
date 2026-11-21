// WhatsApp Business (Meta Cloud API).
// Ready for the owner's keys: phone number ID, business account ID, access token and app secret.
//   • send bills / order updates / replies (free text inside the 24-hour window after the customer's last
//     message, otherwise an approved template),
//   • receive messages through the webhook → conversations in the dashboard, linked to customers
//     (new numbers become customers),
//   • marketing campaigns with approved templates, only to customers who agreed to receive offers.
import crypto from 'node:crypto';
import { writeRow, logActivity } from './store.js';
import { notify, usersWith } from './notify.js';

const now = () => Date.now();
const DAY = 86400000;
export const digits = (p) => String(p || '').replace(/[^\d]/g, '');
// Oman numbers written locally (8 digits) get the 968 country code
export const intl = (p) => { const d = digits(p).replace(/^00/, ''); return d.length === 8 ? '968' + d : d; };

export function createWA({ pool, kvGet, kvSet, box, fetchImpl }) {
  async function cfg() {
    const c = (await kvGet('waCfg')) || {};
    return Object.assign({ version: 'v26.0', phoneId: '', wabaId: '', billTemplate: '', billLang: 'en', verifyToken: '' }, c, { token: box.open(await kvGet('waToken')), appSecret: box.open(await kvGet('waAppSecret')) });
  }
  async function publicCfg() {
    const c = await cfg();
    if (!c.verifyToken) { c.verifyToken = crypto.randomBytes(16).toString('hex'); await kvSet('waCfg', Object.assign({}, (await kvGet('waCfg')) || {}, { verifyToken: c.verifyToken })); }
    return { configured: !!(c.phoneId && c.token), phoneId: c.phoneId, wabaId: c.wabaId, version: c.version, billTemplate: c.billTemplate, billLang: c.billLang, verifyToken: c.verifyToken, hasToken: !!c.token, hasAppSecret: !!c.appSecret, displayNumber: c.displayNumber || '' };
  }
  async function save(b) {
    const c = (await kvGet('waCfg')) || {};
    for (const k of ['phoneId', 'wabaId', 'version', 'billTemplate', 'billLang']) if (typeof b[k] === 'string') c[k] = b[k].trim().slice(0, 100);
    if (c.version && !/^v\d{2}\.\d$/.test(c.version)) c.version = 'v26.0';
    if (c.phoneId && !/^\d{5,30}$/.test(c.phoneId)) throw Object.assign(new Error('Phone number ID is a long number from the WhatsApp settings in Meta.'), { status: 400 });
    if (c.wabaId && !/^\d{5,30}$/.test(c.wabaId)) throw Object.assign(new Error('Business account ID is a long number.'), { status: 400 });
    await kvSet('waCfg', c);
    if (typeof b.token === 'string') await kvSet('waToken', b.token.trim() ? box.seal(b.token.trim()) : '');
    if (typeof b.appSecret === 'string') await kvSet('waAppSecret', b.appSecret.trim() ? box.seal(b.appSecret.trim()) : '');
    return publicCfg();
  }
  async function graph(c, path, body, method) {
    const r = await fetchImpl(`https://graph.facebook.com/${c.version}/${path}`, { method: method || (body ? 'POST' : 'GET'), headers: Object.assign({ authorization: 'Bearer ' + c.token }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { const e = new Error((j.error && (j.error.error_user_msg || j.error.message)) || 'WhatsApp answered ' + r.status); e.code = j.error && j.error.code; e.status = r.status === 401 ? 401 : 502; throw e; }
    return j;
  }
  async function test() {
    const c = await cfg();
    if (!c.phoneId || !c.token) throw Object.assign(new Error('Enter the phone number ID and access token first.'), { status: 400 });
    const j = await graph(c, `${c.phoneId}?fields=display_phone_number,verified_name,quality_rating`);
    const s = (await kvGet('waCfg')) || {}; s.displayNumber = j.display_phone_number || ''; await kvSet('waCfg', s);
    return { ok: true, number: j.display_phone_number, name: j.verified_name, quality: j.quality_rating };
  }
  async function templates() {
    const c = await cfg();
    if (!c.wabaId || !c.token) return { items: [] };
    const j = await graph(c, `${c.wabaId}/message_templates?fields=name,status,language,category,components&limit=200`);
    return { items: (j.data || []).map(t => ({ name: t.name, status: t.status, language: t.language, category: t.category, body: ((t.components || []).find(x => x.type === 'BODY') || {}).text || '', params: (((t.components || []).find(x => x.type === 'BODY') || {}).text || '').match(/\{\{\d+\}\}/g) || [] })) };
  }
  // last message from this number → is the free-reply (customer service) window open?
  async function windowOpen(wa) {
    const r = await pool.query("SELECT MAX(at)::bigint AS t FROM wa_messages WHERE wa_id=$1 AND direction='in'", [wa]);
    return Number(r.rows[0].t || 0) > now() - DAY;
  }
  async function record(o) {
    await pool.query('INSERT INTO wa_messages (wamid, wa_id, direction, type, body, name, at, status, kind, ref, user_id, read, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (wamid) DO NOTHING',
      [o.wamid || null, o.wa, o.direction, o.type || 'text', String(o.body || '').slice(0, 4000), o.name || null, o.at || now(), o.status || null, o.kind || null, o.ref || null, o.user || null, o.direction === 'out', o.error || null]);
  }
  // Send a message. Returns { sent:true } or { fallback:true, reason } so the dashboard can open WhatsApp instead.
  async function send(user, { to, text, kind, ref, template, name }) {
    const c = await cfg();
    const wa = intl(to);
    if (!wa || wa.length < 8) throw Object.assign(new Error('No valid phone number.'), { status: 400 });
    if (!c.phoneId || !c.token) return { fallback: true, reason: 'not_configured' };
    let payload, body = text;
    if (template && template.name) {
      payload = { type: 'template', template: { name: template.name, language: { code: template.lang || 'en' }, components: (template.params || []).length ? [{ type: 'body', parameters: template.params.map(p => ({ type: 'text', text: String(p).slice(0, 1000) })) }] : [] } };
      body = `[${template.name}] ${(template.params || []).join(' · ')}`;
    } else if (await windowOpen(wa)) {
      payload = { type: 'text', text: { body: String(text || '').slice(0, 4096), preview_url: true } };
    } else if (c.billTemplate && ['bill', 'confirmed', 'ready', 'shipped', 'delivered', 'reminder', 'qpay', 'quote'].includes(kind) && template !== false) {
      // outside the 24-hour window only approved templates can be sent: use the owner's order-update template
      const p = (template && template.params) || [];
      payload = { type: 'template', template: { name: c.billTemplate, language: { code: c.billLang || 'en' }, components: p.length ? [{ type: 'body', parameters: p.map(x => ({ type: 'text', text: String(x) })) }] : [] } };
    } else return { fallback: true, reason: 'outside_window' };
    try {
      const j = await graph(c, `${c.phoneId}/messages`, Object.assign({ messaging_product: 'whatsapp', recipient_type: 'individual', to: wa }, payload));
      const wamid = j.messages && j.messages[0] && j.messages[0].id;
      await record({ wamid, wa, direction: 'out', type: payload.type, body, name, status: 'sent', kind, ref, user: user && user.id });
      return { sent: true, id: wamid };
    } catch (e) {
      await record({ wa, direction: 'out', type: payload.type, body, name, status: 'failed', kind, ref, user: user && user.id, error: e.message });
      if (e.code === 131047 || /24 hours|re-engagement/i.test(e.message)) return { fallback: true, reason: 'outside_window' };
      throw e;
    }
  }

  // ---- campaigns (marketing templates) ----
  const campaigns = new Map();
  async function optedIn() {
    const r = await pool.query("SELECT data FROM rows WHERE col='customers' AND NOT deleted");
    return new Map(r.rows.map(x => x.data).filter(c => c && c.optIn !== false && c.phone).map(c => [intl(c.phone), c]));
  }
  async function startCampaign(user, { name, template, recipients }) {
    const c = await cfg();
    if (!c.phoneId || !c.token) throw Object.assign(new Error('Connect WhatsApp first (Settings → WhatsApp).'), { status: 400 });
    if (!template || !template.name) throw Object.assign(new Error('Choose an approved marketing template.'), { status: 400 });
    const allowed = await optedIn();
    const list = (recipients || []).slice(0, 5000).map(r => Object.assign({}, r, { wa: intl(r.to) })).filter(r => r.wa);
    const id = 'cmp_' + crypto.randomBytes(5).toString('hex');
    const st = { id, name, total: list.length, sent: 0, failed: 0, skipped: 0, done: false, started: now(), errors: [] };
    campaigns.set(id, st);
    await logActivity(pool, user, 'campaign', 'whatsapp', `Started WhatsApp campaign "${name}" to ${list.length} customers`);
    (async () => {
      for (const r of list) {
        if (!allowed.has(r.wa)) { st.skipped++; continue; } // only customers who agreed to receive offers
        try { await send(user, { to: r.wa, kind: 'campaign', ref: name, name: r.name, template: { name: template.name, lang: template.lang, params: r.params || [] } }); st.sent++; }
        catch (e) { st.failed++; if (st.errors.length < 10) st.errors.push(e.message); }
        await new Promise(res => setTimeout(res, Number(process.env.WA_PAUSE_MS || 250)));
      }
      st.done = true; st.finished = now();
      await logActivity(pool, user, 'campaign', 'whatsapp', `Campaign "${name}": ${st.sent} sent, ${st.failed} failed, ${st.skipped} skipped (no opt-in)`);
    })().catch(e => { st.done = true; st.errors.push(e.message); });
    return st;
  }
  const campaign = (id) => campaigns.get(id) || null;

  // ---- webhook (Meta → server) ----
  async function verify(q) {
    const c = await publicCfg();
    if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') && q.get('hub.verify_token') === c.verifyToken) return q.get('hub.challenge') || '';
    return null;
  }
  async function receive(raw, signature) {
    const c = await cfg();
    if (!c.appSecret) throw Object.assign(new Error('App secret not set'), { status: 403 });
    const expect = 'sha256=' + crypto.createHmac('sha256', c.appSecret).update(raw).digest('hex');
    const a = Buffer.from(String(signature || '')), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw Object.assign(new Error('Bad signature'), { status: 403 });
    const j = JSON.parse(raw.toString('utf8'));
    for (const entry of j.entry || []) for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const names = new Map((v.contacts || []).map(x => [x.wa_id, x.profile && x.profile.name]));
      for (const m of v.messages || []) {
        const body = m.text ? m.text.body : m.button ? m.button.text : m.interactive ? ((m.interactive.button_reply || m.interactive.list_reply || {}).title || '') : (m[m.type] && (m[m.type].caption || m[m.type].filename)) || `[${m.type}]`;
        const wa = m.from;
        await record({ wamid: m.id, wa, direction: 'in', type: m.type, body, name: names.get(wa), at: Number(m.timestamp) * 1000 || now() });
        const cust = await linkCustomer(wa, names.get(wa));
        // customers can reply STOP to stop offers
        if (/^\s*(stop|إيقاف|الغاء|إلغاء)\s*$/i.test(body) && cust) await writeRow(pool, { id: 'system' }, 'customers', cust.id, Object.assign({}, cust, { optIn: false }));
        await notify(pool, await usersWith(pool, 'whatsapp'), { kind: 'whatsapp', title: `WhatsApp: ${names.get(wa) || '+' + wa}`, body: String(body).slice(0, 140), link: '#/whatsapp' });
      }
      for (const s of v.statuses || []) await pool.query('UPDATE wa_messages SET status=$2, error=COALESCE($3, error) WHERE wamid=$1', [s.id, s.status, s.errors && s.errors[0] ? s.errors[0].title : null]);
    }
  }
  // new numbers become customers (source WhatsApp); they are not signed up for offers until they agree
  async function linkCustomer(wa, name) {
    const r = await pool.query("SELECT id, data FROM rows WHERE col='customers' AND NOT deleted");
    const hit = r.rows.find(x => x.data && intl(x.data.phone) === wa);
    if (hit) return hit.data;
    const id = 'c_wa_' + wa;
    const c = { id, name: name || '+' + wa, phone: '+' + wa, source: 'whatsapp', created: now(), optIn: false, notes: 'Added from a WhatsApp message' };
    await writeRow(pool, { id: 'system' }, 'customers', id, c);
    return c;
  }

  async function conversations() {
    const r = await pool.query(`SELECT DISTINCT ON (wa_id) wa_id, body, at, direction, name, status FROM wa_messages ORDER BY wa_id, at DESC`);
    const unread = new Map((await pool.query("SELECT wa_id, COUNT(*)::int AS n FROM wa_messages WHERE direction='in' AND NOT read GROUP BY 1")).rows.map(x => [x.wa_id, x.n]));
    const lastIn = new Map((await pool.query("SELECT wa_id, MAX(at)::bigint AS t FROM wa_messages WHERE direction='in' GROUP BY 1")).rows.map(x => [x.wa_id, Number(x.t)]));
    return r.rows.map(x => ({ wa: x.wa_id, last: x.body, at: Number(x.at), direction: x.direction, name: x.name, unread: unread.get(x.wa_id) || 0, open: (lastIn.get(x.wa_id) || 0) > now() - DAY })).sort((a, b) => b.at - a.at).slice(0, 300);
  }
  async function messages(wa) {
    const r = await pool.query('SELECT id, direction, type, body, name, at, status, kind, error FROM wa_messages WHERE wa_id=$1 ORDER BY at DESC LIMIT 200', [digits(wa)]);
    return r.rows.reverse().map(x => ({ id: String(x.id), direction: x.direction, type: x.type, body: x.body, at: Number(x.at), status: x.status, kind: x.kind, error: x.error }));
  }
  const markRead = (wa) => pool.query("UPDATE wa_messages SET read=true WHERE wa_id=$1 AND direction='in'", [digits(wa)]);
  const unreadCount = async () => (await pool.query("SELECT COUNT(*)::int AS n FROM wa_messages WHERE direction='in' AND NOT read")).rows[0].n;

  return { publicCfg, save, test, templates, send, startCampaign, campaign, verify, receive, conversations, messages, markRead, unreadCount, windowOpen };
}
