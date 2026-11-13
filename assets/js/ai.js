/* ============================================================
   AI Advisor – local insight engine + Claude integration + report builder
   ============================================================ */
(function (global) {
  'use strict';
  const KEY = 'bh_ai_key';
  const MODEL = 'claude-opus-5-5';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
  const DAY = 86400000;
  const D = () => DB.data;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const fmt = (n, d = 3) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sod = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

  const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch (e) { } };

  // ---------- numbers ----------
  const rev = () => D().sales.filter(DB.countsAsRevenue);
  const within = (arr, from, to) => arr.filter(x => x.date >= from && x.date <= to);
  function sum(sales) {
    const net = sales.reduce((a, s) => a + DB.netSales(s), 0), cogs = sales.reduce((a, s) => a + DB.cogs(s), 0);
    return { orders: sales.length, net_sales: r3(net), cogs: r3(cogs), gross_profit: r3(net - cogs), gross_margin_pct: net ? +((net - cogs) / net * 100).toFixed(1) : 0, collected_incl_vat: r3(sales.reduce((a, s) => a + s.total, 0)), avg_order: sales.length ? r3(sales.reduce((a, s) => a + s.total, 0) / sales.length) : 0 };
  }
  function opex(from, to) { return r3(within(D().expenses, from, to).filter(e => e.category !== 'inventory').reduce((a, e) => a + e.amount, 0)); }
  function periods(days) {
    const now = Date.now(), from = sod(now) - (days - 1) * DAY;
    return { from, to: now, pFrom: from - days * DAY, pTo: from - 1 };
  }
  function productAgg(sales) {
    const m = {};
    sales.forEach(s => s.items.forEach(it => { const a = m[it.pid] || (m[it.pid] = { pid: it.pid, name: it.name, sku: it.sku, qty: 0, revenue: 0, cost: 0 }); a.qty += it.qty; a.revenue += it.qty * it.price; a.cost += it.qty * it.cost; }));
    return Object.values(m);
  }
  const catOf = (pid) => (DB.product(pid) || {}).category || 'other';

  // ---------- compact business snapshot (sent to Claude) ----------
  function snapshot(days) {
    days = days || 30;
    const P = periods(days), all = rev(), cur = within(all, P.from, P.to), prev = within(all, P.pFrom, P.pTo);
    const agg = productAgg(cur).sort((a, b) => b.revenue - a.revenue);
    const by = (arr, keyFn) => { const o = {}; arr.forEach(s => { const k = keyFn(s); o[k] = r3((o[k] || 0) + DB.netSales(s)); }); return o; };
    const catRev = {}; cur.forEach(s => s.items.forEach(it => { const c = catOf(it.pid); catRev[c] = r3((catRev[c] || 0) + it.qty * it.price); }));
    const last60 = new Set(); within(all, Date.now() - 60 * DAY, Date.now()).forEach(s => s.items.forEach(it => last60.add(it.pid)));
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], wdo = {}; cur.forEach(s => { const k = wd[new Date(s.date).getDay()]; wdo[k] = r3((wdo[k] || 0) + DB.netSales(s)); });
    const months = [];
    for (let i = 2; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i); const e = new Date(d); e.setMonth(e.getMonth() + 1); const s = sum(within(all, d.getTime(), e.getTime() - 1)); const ox = opex(d.getTime(), e.getTime() - 1); months.push({ month: d.toISOString().slice(0, 7), net_sales: s.net_sales, gross_profit: s.gross_profit, operating_expenses: ox, net_profit: r3(s.gross_profit - ox), partial_month: i === 0 }); }
    const custSpend = {}; cur.forEach(s => { if (s.customerId) custSpend[s.customerId] = (custSpend[s.customerId] || 0) + s.total; });
    const allCust = {}; all.forEach(s => { if (s.customerId) allCust[s.customerId] = (allCust[s.customerId] || 0) + 1; });
    const pending = D().sales.filter(s => s.channel === 'online' && ['new', 'processing'].includes(s.status));
    const expCat = {}; within(D().expenses, P.from, P.to).forEach(e => expCat[e.category] = r3((expCat[e.category] || 0) + e.amount));
    const cancelled = within(D().sales, P.from, P.to).filter(s => s.status === 'cancelled').length;
    return {
      business: { name: D().settings.name, type: 'Off-road / 4x4 parts and accessories retailer in Oman with a physical shop (POS) and an online store (website, Instagram, WhatsApp)', currency: D().settings.currency, vat_pct: D().settings.vat, today: new Date().toISOString().slice(0, 10) },
      period: { days, from: new Date(P.from).toISOString().slice(0, 10), to: new Date(P.to).toISOString().slice(0, 10) },
      totals: sum(cur), previous_period: sum(prev), operating_expenses: opex(P.from, P.to), operating_expenses_prev: opex(P.pFrom, P.pTo), expenses_by_category: expCat,
      by_channel: { shop: sum(cur.filter(s => s.channel === 'shop')), online: sum(cur.filter(s => s.channel === 'online')) },
      online_by_source: by(cur.filter(s => s.channel === 'online'), s => s.source), payment_mix: by(cur, s => s.payment),
      revenue_by_category: catRev, sales_by_weekday: wdo, cancelled_orders: cancelled,
      online_orders_by_governorate: cur.filter(s => s.channel === 'online').reduce((o, s) => (o[s.city || '?'] = (o[s.city || '?'] || 0) + 1, o), {}),
      top_products: agg.slice(0, 10).map(a => ({ name: a.name, sku: a.sku, qty: a.qty, revenue: r3(a.revenue), margin_pct: +((a.revenue - a.cost) / a.revenue * 100).toFixed(1), stock_now: (DB.product(a.pid) || {}).stock })),
      low_stock: D().products.filter(p => p.active !== false && p.stock <= p.reorder).map(p => ({ name: p.name, sku: p.sku, stock: p.stock, reorder_level: p.reorder, sold_in_period: (agg.find(a => a.pid === p.id) || {}).qty || 0 })),
      slow_movers_no_sales_60d: D().products.filter(p => p.active !== false && p.stock > 0 && !last60.has(p.id)).map(p => ({ name: p.name, sku: p.sku, stock: p.stock, capital_tied: r3(p.stock * p.cost) })),
      inventory: { skus: D().products.length, units: D().products.reduce((a, p) => a + p.stock, 0), value_at_cost: r3(D().products.reduce((a, p) => a + p.stock * p.cost, 0)), value_at_retail: r3(D().products.reduce((a, p) => a + p.stock * p.price, 0)) },
      pending_online_orders: { count: pending.length, older_than_2_days: pending.filter(s => Date.now() - s.date > 2 * DAY).length, value: r3(pending.reduce((a, s) => a + s.total, 0)) },
      customers: { total: D().customers.length, buyers_in_period: Object.keys(custSpend).length, repeat_customers_all_time: Object.values(allCust).filter(n => n > 1).length, top_customers: Object.entries(custSpend).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ name: (DB.customer(id) || {}).name, type: (DB.customer(id) || {}).type, spent: r3(v) })) },
      last_3_months_pnl: months,
      open_purchase_orders: D().purchases.filter(p => p.status === 'ordered').map(p => ({ no: p.no, total: p.total, supplier: (DB.supplier(p.supplierId) || {}).name }))
    };
  }

  // ---------- local rule-based insights (work without any API key) ----------
  function insights(lang) {
    const ar = lang === 'ar';
    const s = snapshot(30), T = s.totals, PV = s.previous_period, out = [];
    const push = (level, title, text, action) => out.push({ level, title, text, action });
    const chg = PV.net_sales ? (T.net_sales - PV.net_sales) / PV.net_sales * 100 : 0;
    if (chg >= 5) push('good', ar ? 'المبيعات في نمو' : 'Sales are growing', ar ? `صافي المبيعات ارتفع ${chg.toFixed(1)}% مقارنة بالـ30 يومًا السابقة (${fmt(T.net_sales, 0)} ر.ع).` : `Net sales are up ${chg.toFixed(1)}% vs the previous 30 days (OMR ${fmt(T.net_sales, 0)}).`);
    else if (chg <= -5) push('bad', ar ? 'المبيعات تتراجع' : 'Sales are declining', ar ? `صافي المبيعات انخفض ${Math.abs(chg).toFixed(1)}% عن الفترة السابقة.` : `Net sales are down ${Math.abs(chg).toFixed(1)}% vs the previous 30 days.`, ar ? 'أطلق عرضًا على الأصناف الأكثر طلبًا وروّج له على إنستغرام وواتساب.' : 'Run an offer on best sellers and promote it on Instagram & WhatsApp.');
    else push('info', ar ? 'المبيعات مستقرة' : 'Sales are steady', ar ? `تغير بنسبة ${chg.toFixed(1)}% فقط.` : `Only ${chg.toFixed(1)}% change vs the previous 30 days.`);
    const np = T.gross_profit - s.operating_expenses;
    push(np >= 0 ? 'good' : 'bad', ar ? 'صافي الربح (30 يومًا)' : 'Net profit (30 days)', ar ? `${fmt(np, 0)} ر.ع بعد المصروفات التشغيلية ${fmt(s.operating_expenses, 0)} ر.ع. هامش الربح الإجمالي ${T.gross_margin_pct}%.` : `OMR ${fmt(np, 0)} after OMR ${fmt(s.operating_expenses, 0)} operating costs. Gross margin ${T.gross_margin_pct}%.`, np < 0 ? (ar ? 'راجع الإيجار والتسويق، وارفع الأسعار على الأصناف ذات الهامش المنخفض.' : 'Review rent and marketing, and lift prices on low-margin items.') : null);
    const oos = s.low_stock.filter(p => p.stock === 0), hot = s.low_stock.filter(p => p.sold_in_period > 0);
    if (oos.length) push('bad', ar ? `${oos.length} منتج نفد من المخزون` : `${oos.length} product(s) out of stock`, oos.slice(0, 3).map(p => p.name).join(', '), ar ? 'أنشئ أمر شراء من صفحة المشتريات.' : 'Create a purchase order from the Purchasing page.');
    if (hot.length) push('warn', ar ? 'أصناف رائجة على وشك النفاد' : 'Best sellers running low', hot.slice(0, 4).map(p => `${p.name} (${p.stock})`).join(', '), ar ? 'اطلبها الآن لتجنب خسارة المبيعات.' : 'Reorder now to avoid lost sales.');
    const slowCap = s.slow_movers_no_sales_60d.reduce((a, p) => a + p.capital_tied, 0);
    if (s.slow_movers_no_sales_60d.length) push('warn', ar ? 'مخزون راكد' : 'Slow-moving stock', ar ? `${s.slow_movers_no_sales_60d.length} صنف بلا مبيعات منذ 60 يومًا — ${fmt(slowCap, 0)} ر.ع مجمّدة.` : `${s.slow_movers_no_sales_60d.length} item(s) with no sales in 60 days — OMR ${fmt(slowCap, 0)} of cash tied up.`, ar ? 'ضعها في باقة أو عرض لتحرير السيولة.' : 'Bundle or discount them to free up cash.');
    if (s.pending_online_orders.older_than_2_days) push('warn', ar ? 'طلبات متأخرة' : 'Orders waiting too long', ar ? `${s.pending_online_orders.older_than_2_days} طلب إلكتروني لم يُشحن منذ أكثر من يومين.` : `${s.pending_online_orders.older_than_2_days} online order(s) not shipped for 2+ days.`, ar ? 'جهّزها اليوم وأبلغ العملاء عبر واتساب.' : 'Ship them today and update customers on WhatsApp.');
    const sh = s.by_channel.online.net_sales / Math.max(1, T.net_sales) * 100;
    push('info', ar ? 'حصة المبيعات الإلكترونية' : 'Online share of sales', ar ? `${sh.toFixed(0)}% من المبيعات تأتي من القنوات الإلكترونية.` : `${sh.toFixed(0)}% of net sales come from online channels.`, sh < 35 ? (ar ? 'وسّع الإعلانات وأضف صور منتجات حقيقية لرفع التحويل.' : 'Add real product photos and run targeted ads to grow online.') : null);
    const wdE = Object.entries(s.sales_by_weekday).sort((a, b) => b[1] - a[1]);
    if (wdE.length > 1) push('info', ar ? 'أفضل يوم للمبيعات' : 'Best trading day', ar ? `${wdE[0][0]} هو الأقوى، و${wdE[wdE.length - 1][0]} الأضعف.` : `${wdE[0][0]} is strongest, ${wdE[wdE.length - 1][0]} is weakest.`, ar ? 'جدول العروض والموظفين حسب ذلك.' : 'Plan staff and promotions around it.');
    const topCat = Object.entries(s.revenue_by_category).sort((a, b) => b[1] - a[1])[0];
    if (topCat) push('good', ar ? 'الفئة الأقوى' : 'Strongest category', ar ? `${topCat[0]} بإيرادات ${fmt(topCat[1], 0)} ر.ع.` : `${topCat[0]} with OMR ${fmt(topCat[1], 0)} revenue.`);
    // health score
    let score = 60;
    score += Math.max(-15, Math.min(15, chg));
    score += np > 0 ? 10 : -15;
    score += T.gross_margin_pct >= 30 ? 5 : -5;
    score -= oos.length * 3 + s.pending_online_orders.older_than_2_days * 2;
    score -= Math.min(10, slowCap / 500);
    return { score: Math.max(5, Math.min(100, Math.round(score))), items: out, snap: s };
  }

  // ---------- tiny markdown renderer (safe: escapes first) ----------
  function md(src) {
    const lines = esc(src || '').split('\n'); let html = '', list = null, table = [];
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const flushList = () => { if (list) { html += `</${list}>`; list = null; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
      html += '<div class="table-wrap"><table class="t md-t"><thead><tr>' + rows[0].map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      table = [];
    };
    lines.forEach(l => {
      if (/^\s*\|.*\|\s*$/.test(l)) { flushList(); table.push(l.trim()); return; } else flushTable();
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { flushList(); const n = Math.min(4, m[1].length + 1); html += `<h${n}>${inline(m[2])}</h${n}>`; }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { flushList(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { flushList(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if (/^\s*(-{3,}|_{3,})\s*$/.test(l)) { flushList(); html += '<hr>'; }
      else if (!l.trim()) { flushList(); }
      else { flushList(); html += `<p>${inline(l)}</p>`; }
    });
    flushList(); flushTable();
    return html;
  }

  // ---------- Claude ----------
  let sdkPromise = null;
  function loadSDK() { if (!sdkPromise) sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic).catch(e => { sdkPromise = null; throw e; }); return sdkPromise; }

  function systemPrompt(lang) {
    return `You are the AI business advisor inside the management dashboard of "${D().settings.name}", an off-road / 4x4 parts and accessories retailer in Oman with a physical shop and an online store.
You are talking to the business owner. Ground every statement in the JSON business snapshot provided in the conversation; quote concrete numbers (currency ${D().settings.currency}, round to whole rials unless precision matters). If something cannot be answered from the data, say what data is missing instead of guessing.
Give practical, prioritised recommendations a small retail owner in Oman can act on this week (pricing, stock, purchasing, marketing on Instagram/WhatsApp, staffing, cash flow). Keep it concise and scannable: short headings, bullet points, and small tables where useful.
Reply in ${lang === 'ar' ? 'Arabic' : 'the same language the owner writes in (Arabic or English)'}.`;
  }

  // messages: [{role:'user'|'assistant', content:string}] ; returns final text
  async function ask({ messages, lang, days, onText, signal }) {
    const apiKey = getKey();
    if (!apiKey) throw new Error('NO_KEY');
    const Anthropic = await loadSDK();
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const snap = snapshot(days || 30);
    const convo = messages.slice();
    convo[0] = { role: 'user', content: `Business snapshot (JSON):\n${JSON.stringify(snap)}\n\n${convo[0].content}` };
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: systemPrompt(lang),
      messages: convo
    }, { signal });
    if (onText) stream.on('text', (_d, snapshotText) => onText(snapshotText));
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new Error('REFUSAL');
    return final.content.filter(b => b.type === 'text').map(b => b.text).join('');
  }

  function explainError(e, lang) {
    const ar = lang === 'ar';
    const msg = String((e && e.message) || e);
    if (msg === 'NO_KEY') return ar ? 'أضف مفتاح Claude API من الإعدادات لتفعيل المستشار الذكي.' : 'Add your Claude API key in Settings to enable the AI advisor.';
    if (msg === 'REFUSAL') return ar ? 'تعذر على النموذج الإجابة على هذا الطلب. جرّب صياغة أخرى.' : 'The model declined this request. Try rephrasing it.';
    if (e && e.status === 401) return ar ? 'مفتاح API غير صالح. تحقق منه في الإعدادات.' : 'The API key was rejected (401). Check it in Settings.';
    if (e && e.status === 429) return ar ? 'تم تجاوز حد الاستخدام مؤقتًا. حاول بعد قليل.' : 'Rate limit reached. Please try again in a minute.';
    if (e && e.status >= 500) return ar ? 'خدمة Claude غير متاحة مؤقتًا. حاول لاحقًا.' : 'Claude is temporarily unavailable. Please retry shortly.';
    if (e && e.name === 'APIUserAbortError') return ar ? 'تم الإيقاف.' : 'Stopped.';
    if (/import|fetch|network|Failed/i.test(msg)) return ar ? 'تعذر الاتصال. تحقق من الإنترنت.' : 'Could not reach the AI service. Check your internet connection.';
    return msg;
  }

  // ---------- printable report ----------
  function reportHTML({ days, lang, aiHTML }) {
    const ar = lang === 'ar', s = snapshot(days), ins = insights(lang), st = D().settings, T = s.totals, PV = s.previous_period;
    const L = (en, a) => (ar ? a : en);
    const pct = (a, b) => (b ? ((a - b) / Math.abs(b) * 100).toFixed(1) + '%' : '—');
    const np = r3(T.gross_profit - s.operating_expenses), pnp = r3(PV.gross_profit - s.operating_expenses_prev);
    const row = (k, a, b) => `<tr><td>${k}</td><td class="r">${a}</td><td class="r">${b}</td><td class="r">${typeof a === 'number' ? pct(a, b) : ''}</td></tr>`;
    const money = (n) => fmt(n, 0);
    return `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(st.name)} – ${L('Business report', 'تقرير الأعمال')}</title>
<style>
:root{--b:#d9480f;--t:#15171a;--m:#5f6670;--l:#e6e8eb}
body{font-family:Inter,Cairo,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--t);margin:0;background:#fff;line-height:1.55;font-size:14px}
.page{max-width:900px;margin:0 auto;padding:36px 28px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid var(--b);padding-bottom:16px;margin-bottom:22px;gap:12px;flex-wrap:wrap}
h1{margin:0;font-size:26px}h2{font-size:18px;margin:28px 0 10px;border-inline-start:4px solid var(--b);padding-inline-start:10px}h3{font-size:15px;margin:18px 0 6px}h4{margin:14px 0 4px}
.muted{color:var(--m)}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kpi{border:1px solid var(--l);border-radius:10px;padding:12px}.kpi b{display:block;font-size:20px}.kpi span{color:var(--m);font-size:12px}
table{width:100%;border-collapse:collapse;margin:6px 0}th,td{padding:7px 9px;border-bottom:1px solid var(--l);text-align:start}th{background:#f6f7f8;font-size:12px;color:var(--m)}.r{text-align:end;font-variant-numeric:tabular-nums}
.ins{border:1px solid var(--l);border-radius:10px;padding:10px 12px;margin:8px 0;border-inline-start:4px solid #868e96}.ins.good{border-inline-start-color:#12805c}.ins.warn{border-inline-start-color:#e8590c}.ins.bad{border-inline-start-color:#c4320a}
.ai{background:#fbf7f3;border:1px solid #f3dccb;border-radius:12px;padding:6px 18px}
footer{margin-top:30px;color:var(--m);font-size:12px;border-top:1px solid var(--l);padding-top:10px}
@media(max-width:640px){.kpis{grid-template-columns:1fr 1fr}.page{padding:20px 16px}}
@media print{.page{padding:0}h2{break-after:avoid}table,.ins{break-inside:avoid}}
</style></head><body><div class="page">
<header><div><div class="muted">${esc(st.name)} · ${esc(st.address)}</div><h1>${L('Business performance report', 'تقرير أداء الأعمال')}</h1></div><div class="muted">${s.period.from} → ${s.period.to}<br>${L('Generated', 'تاريخ الإصدار')}: ${new Date().toLocaleString(ar ? 'ar-OM' : 'en-GB')}</div></header>
<div class="kpis"><div class="kpi"><span>${L('Net sales', 'صافي المبيعات')}</span><b>${money(T.net_sales)}</b><span>${pct(T.net_sales, PV.net_sales)} ${L('vs prev.', 'عن السابق')}</span></div>
<div class="kpi"><span>${L('Gross profit', 'إجمالي الربح')}</span><b>${money(T.gross_profit)}</b><span>${T.gross_margin_pct}% ${L('margin', 'هامش')}</span></div>
<div class="kpi"><span>${L('Net profit', 'صافي الربح')}</span><b>${money(np)}</b><span>${L('after opex', 'بعد المصروفات')} ${money(s.operating_expenses)}</span></div>
<div class="kpi"><span>${L('Orders', 'الطلبات')}</span><b>${T.orders}</b><span>${L('Avg', 'متوسط')} ${fmt(T.avg_order)}</span></div></div>
<h2>${L('Health score', 'مؤشر صحة النشاط')}: ${ins.score}/100</h2>
${aiHTML ? `<h2>${L('AI executive summary & recommendations', 'ملخص تنفيذي وتوصيات الذكاء الاصطناعي')}</h2><div class="ai">${aiHTML}</div>` : ''}
<h2>${L('Key findings', 'أهم الملاحظات')}</h2>${ins.items.map(i => `<div class="ins ${i.level}"><b>${esc(i.title)}</b> — ${esc(i.text)}${i.action ? `<div class="muted">→ ${esc(i.action)}</div>` : ''}</div>`).join('')}
<h2>${L('Financial summary', 'الملخص المالي')} (${st.currency})</h2><table><thead><tr><th></th><th class="r">${L('This period', 'هذه الفترة')}</th><th class="r">${L('Previous', 'السابقة')}</th><th class="r">${L('Change', 'التغير')}</th></tr></thead><tbody>
${row(L('Net sales', 'صافي المبيعات'), T.net_sales, PV.net_sales)}${row(L('Cost of goods sold', 'تكلفة البضاعة'), T.cogs, PV.cogs)}${row(L('Gross profit', 'إجمالي الربح'), T.gross_profit, PV.gross_profit)}${row(L('Operating expenses', 'المصروفات التشغيلية'), s.operating_expenses, s.operating_expenses_prev)}${row(L('Net profit', 'صافي الربح'), np, pnp)}${row(L('Orders', 'الطلبات'), T.orders, PV.orders)}</tbody></table>
<h3>${L('Sales by channel', 'المبيعات حسب القناة')}</h3><table><thead><tr><th></th><th class="r">${L('Orders', 'الطلبات')}</th><th class="r">${L('Net sales', 'صافي المبيعات')}</th><th class="r">${L('Margin', 'الهامش')}</th></tr></thead><tbody>
<tr><td>${L('Shop', 'المحل')}</td><td class="r">${s.by_channel.shop.orders}</td><td class="r">${money(s.by_channel.shop.net_sales)}</td><td class="r">${s.by_channel.shop.gross_margin_pct}%</td></tr>
<tr><td>${L('Online', 'أونلاين')}</td><td class="r">${s.by_channel.online.orders}</td><td class="r">${money(s.by_channel.online.net_sales)}</td><td class="r">${s.by_channel.online.gross_margin_pct}%</td></tr></tbody></table>
<h3>${L('Monthly P&L', 'الأرباح والخسائر الشهرية')}</h3><table><thead><tr><th>${L('Month', 'الشهر')}</th><th class="r">${L('Net sales', 'المبيعات')}</th><th class="r">${L('Gross profit', 'إجمالي الربح')}</th><th class="r">${L('Opex', 'المصروفات')}</th><th class="r">${L('Net profit', 'صافي الربح')}</th></tr></thead><tbody>
${s.last_3_months_pnl.map(m => `<tr><td>${m.month}${m.partial_month ? ' *' : ''}</td><td class="r">${money(m.net_sales)}</td><td class="r">${money(m.gross_profit)}</td><td class="r">${money(m.operating_expenses)}</td><td class="r">${money(m.net_profit)}</td></tr>`).join('')}</tbody></table>
<h2>${L('Top products', 'أفضل المنتجات')}</h2><table><thead><tr><th>${L('Product', 'المنتج')}</th><th class="r">${L('Qty', 'الكمية')}</th><th class="r">${L('Revenue', 'الإيراد')}</th><th class="r">${L('Margin', 'الهامش')}</th><th class="r">${L('Stock', 'المخزون')}</th></tr></thead><tbody>
${s.top_products.map(p => `<tr><td>${esc(p.name)}</td><td class="r">${p.qty}</td><td class="r">${money(p.revenue)}</td><td class="r">${p.margin_pct}%</td><td class="r">${p.stock_now}</td></tr>`).join('')}</tbody></table>
<h2>${L('Inventory', 'المخزون')}</h2><p>${s.inventory.skus} SKUs · ${s.inventory.units} ${L('units', 'وحدة')} · ${L('value at cost', 'القيمة بالتكلفة')} ${money(s.inventory.value_at_cost)} · ${L('at retail', 'بسعر البيع')} ${money(s.inventory.value_at_retail)}</p>
${s.low_stock.length ? `<h3>${L('Reorder now', 'يجب إعادة طلبها')}</h3><table><thead><tr><th>${L('Product', 'المنتج')}</th><th class="r">${L('Stock', 'المخزون')}</th><th class="r">${L('Reorder at', 'حد الطلب')}</th><th class="r">${L('Sold in period', 'المباع')}</th></tr></thead><tbody>${s.low_stock.map(p => `<tr><td>${esc(p.name)}</td><td class="r">${p.stock}</td><td class="r">${p.reorder_level}</td><td class="r">${p.sold_in_period}</td></tr>`).join('')}</tbody></table>` : ''}
${s.slow_movers_no_sales_60d.length ? `<h3>${L('Slow movers (no sales in 60 days)', 'أصناف راكدة (بلا مبيعات 60 يومًا)')}</h3><table><thead><tr><th>${L('Product', 'المنتج')}</th><th class="r">${L('Stock', 'المخزون')}</th><th class="r">${L('Capital tied', 'رأس المال المجمد')}</th></tr></thead><tbody>${s.slow_movers_no_sales_60d.map(p => `<tr><td>${esc(p.name)}</td><td class="r">${p.stock}</td><td class="r">${money(p.capital_tied)}</td></tr>`).join('')}</tbody></table>` : ''}
<h2>${L('Customers', 'العملاء')}</h2><p>${s.customers.buyers_in_period} ${L('identified buyers in period', 'مشترٍ معروف في الفترة')} · ${s.customers.repeat_customers_all_time} ${L('repeat customers', 'عميل متكرر')}</p>
<table><thead><tr><th>${L('Top customers', 'أفضل العملاء')}</th><th>${L('Type', 'النوع')}</th><th class="r">${L('Spent', 'الإنفاق')}</th></tr></thead><tbody>${s.customers.top_customers.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.type)}</td><td class="r">${money(c.spent)}</td></tr>`).join('')}</tbody></table>
<footer>${esc(st.name)} · ${L('Amounts in', 'المبالغ بـ')} ${st.currency}, ${L('net sales exclude VAT', 'صافي المبيعات لا يشمل الضريبة')} ${st.vat}%. ${L('* partial month', '* شهر غير مكتمل')}</footer>
</div></body></html>`;
  }

  global.AI = { getKey, setKey, snapshot, insights, ask, md, explainError, reportHTML, MODEL };
})(window);
