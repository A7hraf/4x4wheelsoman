/* ============================================================
   Business Hub – dashboard application
   ============================================================ */
(function () {
  'use strict';
  const db = DB.load();
  const D = () => DB.data;
  const t = I18N.t;
  I18N.set(D().settings.lang || 'en');

  // ---------------- utilities ----------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cur = () => D().settings.currency || 'OMR';
  const fmt = (n, d = 3) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = (n, d = 3) => `<span class="num">${cur()} ${fmt(n, d)}</span>`;
  const moneyTxt = (n, d = 3) => `${cur()} ${fmt(n, d)}`;
  const big = (n) => `<small>${cur()}</small>${fmt(n, Math.abs(n) >= 1000 ? 0 : 3)}`;
  const pct = (n) => (isFinite(n) ? n : 0).toFixed(1) + '%';
  const locale = () => (I18N.lang === 'ar' ? 'ar-OM' : 'en-GB');
  const fDate = (ts) => new Date(ts).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  const fDT = (ts) => new Date(ts).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const sod = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const DAY = DB.DAY;
  const catName = (id) => { const c = D().categories.find(x => x.id === id); return c ? (c[I18N.lang] || c.en) : id; };
  const CAT_COLOR = { wheels: '--c1', tyres: '--c8', suspension: '--c2', bumpers: '--c4', lighting: '--c6', recovery: '--c3', roof: '--c5', accessories: '--c7' };
  const CAT_ICON = { wheels: 'refresh', tyres: 'refresh', suspension: 'shield', bumpers: 'shield', lighting: 'sun', recovery: 'truck', roof: 'box', accessories: 'tag' };
  const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const catColor = (id) => cssVar(CAT_COLOR[id] || '--c8');
  const thumb = (p) => `<div class="thumb">${productArt(p)}</div>`;
  const statusPill = (s) => `<span class="pill s-${s}">${t('st_' + s)}</span>`;
  const srcLabel = (s) => t('src_' + s);
  const payLabel = (p) => t(p);
  const revenueSales = () => D().sales.filter(DB.countsAsRevenue);

  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = icon('check') + esc(msg);
    document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
  }

  function modal({ title, body, footer, wide, onMount }) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${title}</h3><button class="icon-btn" data-close aria-label="${t('close')}">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    const m = { el: ov, close };
    if (onMount) onMount(ov, m);
    const first = ov.querySelector('input, select, textarea'); if (first) first.focus();
    return m;
  }
  function confirmBox(msg, onYes) {
    modal({
      title: t('delete'), body: `<p>${esc(msg)}</p>`, footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="yes">${t('delete')}</button>`,
      onMount: (el, m) => $('#yes', el).onclick = () => { m.close(); onYes(); }
    });
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) { return rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }

  // ---------------- periods ----------------
  function range(key) {
    const now = Date.now(), today = sod(now);
    if (key === 'today') return { from: today, to: now, pFrom: today - DAY, pTo: now - DAY, days: 1 };
    if (key === 'month') {
      const d = new Date(today); d.setDate(1); const from = d.getTime();
      const p = new Date(from); p.setMonth(p.getMonth() - 1);
      return { from, to: now, pFrom: p.getTime(), pTo: p.getTime() + (now - from), days: Math.ceil((now - from) / DAY) };
    }
    const n = key === '90' ? 90 : 30;
    const from = today - (n - 1) * DAY;
    return { from, to: now, pFrom: from - n * DAY, pTo: from, days: n };
  }
  const inRange = (arr, from, to) => arr.filter(x => x.date >= from && x.date <= to);
  function summarize(sales) {
    const ns = sales.reduce((a, s) => a + DB.netSales(s), 0);
    const cg = sales.reduce((a, s) => a + DB.cogs(s), 0);
    return { net: ns, cogs: cg, gp: ns - cg, gross: sales.reduce((a, s) => a + s.total, 0), vat: sales.reduce((a, s) => a + s.vat, 0), ship: sales.reduce((a, s) => a + (s.shippingFee || 0), 0), n: sales.length };
  }
  function delta(curV, prevV) {
    if (!prevV) return '';
    const d = (curV - prevV) / Math.abs(prevV) * 100;
    return `<span class="delta ${d >= 0 ? 'up' : 'down'}">${icon(d >= 0 ? 'up' : 'down')}${Math.abs(d).toFixed(1)}%</span>`;
  }
  const rangeSeg = (curKey, id) => `<div class="seg" id="${id}">${['today', 'month', '30', '90'].map(k => `<button data-k="${k}" class="${k === curKey ? 'on' : ''}">${t({ today: 'today', month: 'this_month', '30': 'last_30', '90': 'last_90' }[k])}</button>`).join('')}</div>`;
  function bindSeg(id, cb) { $$(`#${id} button`).forEach(b => b.onclick = () => cb(b.dataset.k)); }

  // ---------------- charts ----------------
  let charts = [];
  function chart(canvas, cfg) {
    if (!window.Chart || !canvas) return;
    const c = new Chart(canvas, cfg); charts.push(c); return c;
  }
  function killCharts() { charts.forEach(c => c.destroy()); charts = []; }
  function chartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = cssVar('--text-3');
    Chart.defaults.borderColor = cssVar('--border');
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = cssVar('--side');
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.maintainAspectRatio = false;
  }
  const moneyTick = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : v);
  const tipMoney = { callbacks: { label: (c) => ` ${c.dataset.label || c.label}: ${moneyTxt(c.parsed.y != null ? c.parsed.y : c.parsed)}` } };
  const barAxes = (stacked) => ({
    x: { stacked, reverse: I18N.lang === 'ar', grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: { stacked, beginAtZero: true, grid: { color: cssVar('--border') }, border: { display: false }, ticks: { callback: moneyTick } }
  });

  function buckets(r) {
    const out = [];
    if (r.days === 1) {
      for (let h = 8; h <= 22; h++) out.push({ from: r.from + h * 3600000, to: r.from + (h + 1) * 3600000 - 1, label: String(h).padStart(2, '0') + ':00' });
    } else if (r.days <= 31) {
      for (let ts = r.from; ts <= r.to; ts += DAY) out.push({ from: ts, to: ts + DAY - 1, label: new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) });
    } else {
      for (let ts = r.from; ts <= r.to; ts += 7 * DAY) out.push({ from: ts, to: Math.min(ts + 7 * DAY - 1, r.to), label: new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) });
    }
    return out;
  }

  // ---------------- shell ----------------
  const ROUTES = [
    { id: 'dashboard', icon: 'dashboard', grp: 'grp_ops' },
    { id: 'pos', icon: 'pos', grp: 'grp_ops' },
    { id: 'orders', icon: 'orders', grp: 'grp_ops', badge: () => D().sales.filter(s => s.channel === 'online' && s.status === 'new').length },
    { id: 'inventory', icon: 'inventory', grp: 'grp_ops', badge: () => D().products.filter(p => p.active !== false && p.stock <= p.reorder).length },
    { id: 'purchases', icon: 'purchases', grp: 'grp_ops' },
    { id: 'advisor', icon: 'sparkle', grp: 'grp_ai' },
    { id: 'finance', icon: 'finance', grp: 'grp_money' },
    { id: 'reports', icon: 'reports', grp: 'grp_money' },
    { id: 'customers', icon: 'customers', grp: 'grp_admin' },
    { id: 'settings', icon: 'settings', grp: 'grp_admin' }
  ];
  let route = 'dashboard';
  const state = { dashRange: '30', finRange: 'month', repRange: '30', orderTab: 'online', orderStatus: 'all', orderQ: '', orderSrc: 'all', invQ: '', invCat: 'all', invStock: 'all', invTab: 'products', custQ: '', advDays: 30, chat: [], aiBusy: null, cart: [], posCat: 'all', posQ: '', posPay: 'cash', posDisc: 0, posCust: '' };

  function renderShell() {
    const s = D().settings;
    const initials = (s.name || 'BH').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    let html = `<a class="logo" href="#/dashboard"><div class="logo-mark">4x4</div><div><b>${esc(s.name)}</b><small>Business Hub</small></div></a><nav class="nav">`;
    let grp = '';
    ROUTES.forEach(r => {
      if (r.grp !== grp) { grp = r.grp; html += `<div class="nav-group">${t(grp)}</div>`; }
      const b = r.badge ? r.badge() : 0;
      html += `<a href="#/${r.id}" class="${route === r.id ? 'active' : ''}">${icon(r.icon)}<span>${t(r.id)}</span>${b ? `<span class="badge">${b}</span>` : ''}</a>`;
    });
    html += `</nav><div class="side-foot"><a class="store-link" href="index.html" target="_blank" rel="noopener">${icon('store')}<div>${t('storefront')}<small>${t('open_store')} ↗</small></div></a></div>`;
    $('#side').innerHTML = html;
    $('#menuBtn').innerHTML = icon('menu');
    $('#langBtn').innerHTML = `<span style="font-weight:700;font-size:12px">${I18N.lang === 'ar' ? 'EN' : 'ع'}</span>`;
    $('#themeBtn').innerHTML = icon(document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sun' : 'moon');
    $('#avatar').textContent = initials;
    $('#pageTitle').textContent = t(route);
    document.title = t(route) + ' · ' + s.name;
    $('#gsearch').innerHTML = `${icon('search')}<input id="gq" placeholder="${t('search')}" autocomplete="off"><div class="gresults hide" id="gres"></div>`;
    bindGlobalSearch();
  }

  function bindGlobalSearch() {
    const inp = $('#gq'), res = $('#gres');
    inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) { res.classList.add('hide'); return; }
      const prods = D().products.filter(p => (p.name + ' ' + p.sku + ' ' + p.brand).toLowerCase().includes(q)).slice(0, 5);
      const ords = D().sales.filter(s => (s.no + ' ' + s.customerName + ' ' + s.phone).toLowerCase().includes(q)).slice(-5).reverse();
      const custs = D().customers.filter(c => (c.name + ' ' + c.phone).toLowerCase().includes(q)).slice(0, 4);
      let h = '';
      prods.forEach(p => h += `<a href="#/inventory" data-prod="${p.id}"><span>${esc(p.name)}</span><span class="faint">${esc(p.sku)}</span></a>`);
      ords.forEach(s => h += `<a href="#/orders" data-order="${s.id}"><span>${esc(s.no)} · ${esc(s.customerName)}</span>${money(s.total)}</a>`);
      custs.forEach(c => h += `<a href="#/customers" data-cust="${c.id}"><span>${esc(c.name)}</span><span class="faint">${esc(c.phone)}</span></a>`);
      res.innerHTML = h || `<div class="empty">${t('no_results')}</div>`;
      res.classList.remove('hide');
    };
    res.onclick = (e) => {
      const a = e.target.closest('a'); if (!a) return;
      res.classList.add('hide'); inp.value = '';
      setTimeout(() => {
        if (a.dataset.prod) productModal(D().products.find(p => p.id === a.dataset.prod));
        if (a.dataset.order) orderModal(a.dataset.order);
        if (a.dataset.cust) customerModal(a.dataset.cust);
      }, 60);
    };
    inp.onblur = () => setTimeout(() => res.classList.add('hide'), 200);
  }

  function go() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    route = ROUTES.find(r => r.id === h) ? h : 'dashboard';
    $('#app').classList.remove('nav-open');
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    killCharts(); chartDefaults();
    renderShell();
    const v = $('#view');
    VIEWS[route](v);
  }

  // =====================================================
  // DASHBOARD
  // =====================================================
  function viewDashboard(v) {
    const r = range(state.dashRange);
    const all = revenueSales();
    const cur = inRange(all, r.from, r.to), prev = inRange(all, r.pFrom, r.pTo);
    const S = summarize(cur), P = summarize(prev);
    const shop = summarize(cur.filter(s => s.channel === 'shop')), web = summarize(cur.filter(s => s.channel === 'online'));
    const pending = D().sales.filter(s => s.channel === 'online' && ['new', 'processing'].includes(s.status));
    const low = D().products.filter(p => p.active !== false && p.stock <= p.reorder).sort((a, b) => a.stock - b.stock);
    const stockVal = D().products.reduce((a, p) => a + p.stock * p.cost, 0);
    const hr = new Date().getHours();
    const greet = I18N.lang === 'ar' ? (hr < 12 ? 'صباح الخير' : 'مساء الخير') : (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');

    // top products
    const prodAgg = {};
    cur.forEach(s => s.items.forEach(it => { const a = prodAgg[it.pid] || (prodAgg[it.pid] = { pid: it.pid, name: it.name, qty: 0, rev: 0 }); a.qty += it.qty; a.rev += it.qty * it.price; }));
    const top = Object.values(prodAgg).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const topMax = top.length ? top[0].rev : 1;
    const recent = D().sales.slice().sort((a, b) => b.date - a.date).slice(0, 8);

    v.innerHTML = `
      <section class="hero">
        <div><h2>${greet} 👋</h2><p>${t('overview_sub')} · ${new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div class="actions">
          <a class="btn primary" href="#/pos">${icon('pos')}${t('new_sale')}</a>
          <a class="btn" href="#/orders">${icon('orders')}${t('orders')}${pending.length ? ` · ${pending.length}` : ''}</a>
          <a class="btn" href="#/advisor">${icon('sparkle')}${t('advisor')}</a>
          <a class="btn" href="index.html" target="_blank" rel="noopener">${icon('external')}${t('open_store')}</a>
        </div>
      </section>
      <div class="page-head" style="margin-bottom:14px"><div></div>${rangeSeg(state.dashRange, 'dseg')}</div>
      <div class="grid g-kpi">
        ${kpi('finance', 'tone-brand', t('net_sales'), big(S.net), `${delta(S.net, P.net)}<span>${t('vs_prev')}</span>`)}
        ${kpi('reports', 'tone-ok', t('gross_profit'), big(S.gp), `${delta(S.gp, P.gp)}<span>${t('margin')} ${pct(S.gp / S.net * 100)}</span>`)}
        ${kpi('orders', 'tone-info', t('orders_n'), `<span class="num">${S.n}</span>`, `${delta(S.n, P.n)}<span>${t('avg_order')} ${moneyTxt(S.n ? S.gross / S.n : 0)}</span>`)}
        ${kpi('truck', 'tone-violet', t('pending_orders'), `<span class="num">${pending.length}</span>`, `<span>${D().sales.filter(s => s.channel === 'online' && s.status === 'new').length} ${t('st_new').toLowerCase()} · ${pending.filter(s => s.status === 'processing').length} ${t('st_processing').toLowerCase()}</span>`)}
      </div>
      <div class="grid g-21 mt">
        <div class="card"><div class="card-h"><h3>${t('sales_trend')}</h3><div class="legend"><span><i style="background:var(--c1)"></i>${t('shop')}</span><span><i style="background:var(--c2)"></i>${t('online')}</span></div></div>
          <div class="card-b"><div class="chart-box"><canvas id="cTrend"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('channel_split')}</h3></div>
          <div class="card-b"><div class="chart-box sm"><canvas id="cChan"></canvas></div>
            <div class="stat-line"><span><span class="legend"><span><i style="background:var(--c1)"></i>${t('shop_sales')}</span></span></span><b>${money(shop.net, 0)}</b></div>
            <div class="stat-line"><span><span class="legend"><span><i style="background:var(--c2)"></i>${t('online_sales')}</span></span></span><b>${money(web.net, 0)}</b></div>
          </div></div>
      </div>
      <div class="grid g-3 mt">
        <div class="card"><div class="card-h"><h3>${t('top_products')}</h3><a href="#/reports">${t('view_all')}</a></div><div class="card-b">
          <ul class="mini-list">${top.map(p => `<li><div class="grow"><div class="name">${esc(p.name)}</div><div class="bar"><span style="width:${p.rev / topMax * 100}%"></span></div></div><div style="text-align:end"><b>${money(p.rev, 0)}</b><div class="faint" style="font-size:12px">${p.qty} ${t('units')}</div></div></li>`).join('') || `<div class="empty">${t('no_results')}</div>`}</ul></div></div>
        <div class="card"><div class="card-h"><h3>${t('stock_alerts')}</h3><a href="#/inventory" data-low>${t('view_all')}</a></div><div class="card-b">
          <ul class="mini-list">${low.slice(0, 6).map(p => `<li>${thumb(p)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="faint" style="font-size:12px">${esc(p.sku)} · ${t('reorder')} ${p.reorder}</div></div><span class="pill ${p.stock === 0 ? 's-cancelled' : 's-processing'}">${p.stock === 0 ? t('out_of_stock') : p.stock + ' ' + t('units')}</span></li>`).join('') || `<div class="empty">✓</div>`}</ul></div></div>
        <div class="card"><div class="card-h"><h3>${t('by_category')}</h3></div><div class="card-b"><div class="chart-box sm"><canvas id="cCat"></canvas></div></div></div>
      </div>
      <div class="card mt"><div class="card-h"><h3>${t('recent_orders')}</h3><a href="#/orders">${t('view_all')}</a></div>
        <div class="card-b" style="padding:12px 0 0"><div class="table-wrap">${ordersTable(recent, true)}</div></div></div>
      <div class="grid g-kpi mt">
        ${kpi('pos', 'tone-brand', t('shop_sales'), big(shop.net), `<span>${shop.n} ${t('orders_n').toLowerCase()}</span>`)}
        ${kpi('globe', 'tone-info', t('online_sales'), big(web.net), `<span>${web.n} ${t('orders_n').toLowerCase()}</span>`)}
        ${kpi('box', 'tone-ok', t('stock_value'), big(stockVal), `<span>${D().products.reduce((a, p) => a + p.stock, 0)} ${t('units')}</span>`)}
        ${kpi('alert', 'tone-warn', t('low_stock'), `<span class="num">${low.length}</span>`, `<span>${low.filter(p => p.stock === 0).length} ${t('out_of_stock').toLowerCase()}</span>`)}
      </div>`;

    bindSeg('dseg', k => { state.dashRange = k; render(); });
    $('[data-low]', v).onclick = () => { state.invStock = 'low'; };
    bindOrderRows(v);

    const bk = buckets(r);
    const shopD = bk.map(b => summarize(cur.filter(s => s.channel === 'shop' && s.date >= b.from && s.date <= b.to)).net);
    const webD = bk.map(b => summarize(cur.filter(s => s.channel === 'online' && s.date >= b.from && s.date <= b.to)).net);
    chart($('#cTrend'), {
      type: 'bar', data: { labels: bk.map(b => b.label), datasets: [
        { label: t('shop'), data: shopD, backgroundColor: cssVar('--c1'), borderRadius: 4, maxBarThickness: 26 },
        { label: t('online'), data: webD, backgroundColor: cssVar('--c2'), borderRadius: 4, maxBarThickness: 26 }] },
      options: { scales: barAxes(true), plugins: { tooltip: { mode: 'index', intersect: false, ...tipMoney } } }
    });
    chart($('#cChan'), {
      type: 'doughnut', data: { labels: [t('shop'), t('online')], datasets: [{ data: [shop.net, web.net], backgroundColor: [cssVar('--c1'), cssVar('--c2')], borderWidth: 0, spacing: 2 }] },
      options: { cutout: '70%', plugins: { tooltip: { callbacks: { label: (c) => ` ${c.label}: ${moneyTxt(c.parsed)}` } } } }
    });
    const catAgg = {};
    cur.forEach(s => s.items.forEach(it => { const p = DB.product(it.pid); const c = p ? p.category : 'accessories'; catAgg[c] = (catAgg[c] || 0) + it.qty * it.price; }));
    const cats = Object.entries(catAgg).sort((a, b) => b[1] - a[1]);
    chart($('#cCat'), {
      type: 'bar', data: { labels: cats.map(c => catName(c[0])), datasets: [{ label: t('revenue'), data: cats.map(c => c[1]), backgroundColor: cats.map(c => catColor(c[0])), borderRadius: 4, barThickness: 14 }] },
      options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: cssVar('--border') }, border: { display: false }, ticks: { callback: moneyTick } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => ' ' + moneyTxt(c.parsed.x) } } } }
    });
  }
  function kpi(ic, tone, label, val, sub) {
    return `<div class="card kpi"><div class="lbl"><span class="ic-wrap ${tone}">${icon(ic)}</span>${label}</div><div class="val">${val}</div><div class="sub">${sub || ''}</div></div>`;
  }

  // =====================================================
  // ORDERS
  // =====================================================
  function ordersTable(list, compact) {
    if (!list.length) return `<div class="empty">${t('no_results')}</div>`;
    return `<table class="t"><thead><tr><th>${t('order')}</th><th>${t('date')}</th><th>${t('customer')}</th>${compact ? '' : `<th>${t('city')}</th>`}<th>${t('source')}</th>${compact ? '' : `<th>${t('payment')}</th>`}<th class="r">${t('total')}</th><th>${t('status')}</th></tr></thead><tbody>
      ${list.map(s => `<tr class="click" data-oid="${s.id}"><td class="strong">${esc(s.no)}</td><td class="muted">${fDT(s.date)}</td><td>${esc(s.customerName)}</td>${compact ? '' : `<td class="muted">${esc(s.city || '—')}</td>`}<td><span class="chip">${srcLabel(s.source)}</span></td>${compact ? '' : `<td class="muted">${payLabel(s.payment)}</td>`}<td class="r strong">${money(s.total)}</td><td>${statusPill(s.status)}</td></tr>`).join('')}
    </tbody></table>`;
  }
  function bindOrderRows(root) { $$('[data-oid]', root).forEach(tr => tr.onclick = () => orderModal(tr.dataset.oid)); }

  function viewOrders(v) {
    const online = D().sales.filter(s => s.channel === 'online');
    const shop = D().sales.filter(s => s.channel === 'shop');
    const STAT = ['new', 'processing', 'shipped', 'delivered', 'cancelled'];
    let list = state.orderTab === 'online' ? online : state.orderTab === 'shop' ? shop : D().sales.slice();
    if (state.orderTab === 'online' && state.orderStatus !== 'all') list = list.filter(s => s.status === state.orderStatus);
    if (state.orderSrc !== 'all') list = list.filter(s => s.source === state.orderSrc);
    const q = state.orderQ.toLowerCase();
    if (q) list = list.filter(s => (s.no + ' ' + s.customerName + ' ' + s.phone + ' ' + s.city).toLowerCase().includes(q));
    list = list.sort((a, b) => b.date - a.date);
    const shown = list.slice(0, 200);

    v.innerHTML = `
      <div class="page-head"><div><h2>${t('orders')}</h2><p>${t('pipeline')}</p></div>
        <div class="actions"><button class="btn" id="oexp">${icon('download')}${t('export_csv')}</button><button class="btn primary" id="oadd">${icon('plus')}${t('add_order')}</button></div></div>
      <div class="pipeline">${STAT.map(st => `<div class="pipe ${state.orderTab === 'online' && state.orderStatus === st ? 'on' : ''}" data-st="${st}"><div class="l">${statusPill(st)}</div><div class="n num">${online.filter(s => s.status === st).length}</div><div class="faint" style="font-size:12px">${money(online.filter(s => s.status === st).reduce((a, s) => a + s.total, 0), 0)}</div></div>`).join('')}</div>
      <div class="card mt">
        <div class="toolbar">
          <div class="seg" id="otab">${[['online', t('online')], ['shop', t('shop')], ['all', t('all')]].map(([k, l]) => `<button data-k="${k}" class="${state.orderTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="search-in">${icon('search')}<input class="input" id="oq" placeholder="${t('search')}" value="${esc(state.orderQ)}"></div>
          <select class="input" id="osrc"><option value="all">${t('source')}: ${t('all')}</option>${['website', 'instagram', 'whatsapp', 'pos'].map(s => `<option value="${s}" ${state.orderSrc === s ? 'selected' : ''}>${srcLabel(s)}</option>`).join('')}</select>
          ${state.orderStatus !== 'all' && state.orderTab === 'online' ? `<button class="btn sm ghost" id="oclr">${icon('x')}${t('st_' + state.orderStatus)}</button>` : ''}
          <span class="faint" style="margin-inline-start:auto">${list.length} ${t('orders_n').toLowerCase()}</span>
        </div>
        <div class="table-wrap">${ordersTable(shown)}</div>
      </div>`;
    $$('.pipe', v).forEach(p => p.onclick = () => { state.orderTab = 'online'; state.orderStatus = state.orderStatus === p.dataset.st ? 'all' : p.dataset.st; render(); });
    bindSeg('otab', k => { state.orderTab = k; state.orderStatus = 'all'; render(); });
    const oq = $('#oq'); oq.oninput = debounce(() => { state.orderQ = oq.value; render(); $('#oq').focus(); const e = $('#oq'); e.setSelectionRange(e.value.length, e.value.length); }, 250);
    $('#osrc').onchange = (e) => { state.orderSrc = e.target.value; render(); };
    if ($('#oclr')) $('#oclr').onclick = () => { state.orderStatus = 'all'; render(); };
    $('#oadd').onclick = addOrderModal;
    $('#oexp').onclick = () => exportSales(list, 'orders');
    bindOrderRows(v);
  }
  function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

  function exportSales(list, name) {
    const rows = [['Order', 'Date', 'Channel', 'Source', 'Customer', 'Phone', 'Governorate', 'Items', 'Subtotal', 'Discount', 'VAT', 'Shipping', 'Total', 'Payment', 'Status']];
    list.forEach(s => rows.push([s.no, new Date(s.date).toISOString(), s.channel, s.source, s.customerName, s.phone, s.city, s.items.map(i => i.qty + 'x ' + i.sku).join(' | '), fmt(s.subtotal), fmt(s.discount), fmt(s.vat), fmt(s.shippingFee || 0), fmt(s.total), s.payment, s.status]));
    download(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), 'text/csv');
  }

  function orderModal(id) {
    const s = D().sales.find(x => x.id === id); if (!s) return;
    const online = s.channel === 'online';
    const flow = ['new', 'processing', 'shipped', 'delivered'];
    const body = `
      <div class="grid g-2" style="gap:20px">
        <dl class="kv"><dt>${t('order')}</dt><dd>${esc(s.no)}</dd><dt>${t('date')}</dt><dd>${fDT(s.date)}</dd><dt>${t('source')}</dt><dd>${srcLabel(s.source)}</dd><dt>${t('payment')}</dt><dd>${payLabel(s.payment)}</dd><dt>${t('status')}</dt><dd>${statusPill(s.status)}</dd></dl>
        <dl class="kv"><dt>${t('customer')}</dt><dd>${esc(s.customerName)}</dd><dt>${t('phone')}</dt><dd>${esc(s.phone || '—')}</dd>${online ? `<dt>${t('city')}</dt><dd>${esc(s.city || '—')}</dd><dt>${t('address')}</dt><dd>${esc(s.address || '—')}</dd>` : ''}${s.note ? `<dt>${t('note')}</dt><dd>${esc(s.note)}</dd>` : ''}</dl>
      </div>
      <div class="card mt" style="box-shadow:none"><div class="table-wrap"><table class="t"><thead><tr><th>${t('product')}</th><th class="r">${t('qty')}</th><th class="r">${t('price')}</th><th class="r">${t('total')}</th></tr></thead><tbody>
        ${s.items.map(it => `<tr><td><div class="strong">${esc(it.name)}</div><div class="faint" style="font-size:12px">${esc(it.sku)}</div></td><td class="r num">${it.qty}</td><td class="r">${money(it.price)}</td><td class="r strong">${money(it.qty * it.price)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="totals">
        <div class="ln"><span>${t('subtotal')}</span>${money(s.subtotal)}</div>
        ${s.discount ? `<div class="ln"><span>${t('discount')}</span><span class="num">− ${fmt(s.discount)}</span></div>` : ''}
        <div class="ln"><span>${t('vat')} (${D().settings.vat}%)</span>${money(s.vat)}</div>
        ${s.shippingFee ? `<div class="ln"><span>${t('shipping')}</span>${money(s.shippingFee)}</div>` : ''}
        <div class="ln big"><span>${t('total')}</span>${money(s.total)}</div>
      </div></div>
      ${online ? `<div class="mt"><div class="field"><label>${t('status')}</label><div class="actions">${flow.concat('cancelled').map(st => `<button class="btn sm ${s.status === st ? 'primary' : ''}" data-set="${st}">${t('st_' + st)}</button>`).join('')}</div></div></div>` : ''}`;
    modal({
      title: `${t('order')} ${esc(s.no)}`, body, wide: true,
      footer: `<button class="btn" id="oprint">${icon('printer')}${t('print')}</button>${online && flow.indexOf(s.status) > -1 && flow.indexOf(s.status) < 3 ? `<button class="btn primary" id="onext">${icon('arrowRight')}${t('st_' + flow[flow.indexOf(s.status) + 1])}</button>` : ''}`,
      onMount: (el, m) => {
        $$('[data-set]', el).forEach(b => b.onclick = () => { DB.setOrderStatus(s.id, b.dataset.set); m.close(); toast(t('saved')); render(); orderModal(s.id); });
        if ($('#onext', el)) $('#onext', el).onclick = () => { DB.setOrderStatus(s.id, flow[flow.indexOf(s.status) + 1]); m.close(); toast(t('saved')); render(); };
        $('#oprint', el).onclick = () => { m.close(); receiptModal(s); };
      }
    });
  }

  function linesEditor(host, lines, mode) {
    const prods = D().products.filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name));
    function draw() {
      host.innerHTML = `<table class="t"><thead><tr><th>${t('product')}</th><th style="width:90px">${t('qty')}</th><th style="width:130px">${mode === 'po' ? t('cost') : t('price')}</th><th style="width:40px"></th></tr></thead><tbody>
        ${lines.map((l, i) => `<tr><td><select class="input" data-i="${i}" data-f="pid">${prods.map(p => `<option value="${p.id}" ${p.id === l.pid ? 'selected' : ''}>${esc(p.name)} (${p.stock})</option>`).join('')}</select></td>
          <td><input class="input num" type="number" min="1" data-i="${i}" data-f="qty" value="${l.qty}"></td>
          <td><input class="input num" type="number" min="0" step="0.001" data-i="${i}" data-f="val" value="${l.val}"></td>
          <td><button class="icon-btn" data-rm="${i}" aria-label="${t('delete')}">${icon('trash')}</button></td></tr>`).join('')}
      </tbody></table><button class="btn sm mt" id="addLine" type="button">${icon('plus')}${t('product')}</button>`;
      $$('[data-f]', host).forEach(inp => inp.onchange = () => {
        const l = lines[+inp.dataset.i];
        if (inp.dataset.f === 'pid') { l.pid = inp.value; const p = DB.product(l.pid); l.val = mode === 'po' ? p.cost : p.price; draw(); }
        else l[inp.dataset.f] = Math.max(inp.dataset.f === 'qty' ? 1 : 0, parseFloat(inp.value) || 0);
        host.dispatchEvent(new Event('change'));
      });
      $$('[data-rm]', host).forEach(b => b.onclick = () => { lines.splice(+b.dataset.rm, 1); draw(); host.dispatchEvent(new Event('change')); });
      $('#addLine', host).onclick = () => { const p = prods[0]; lines.push({ pid: p.id, qty: 1, val: mode === 'po' ? p.cost : p.price }); draw(); host.dispatchEvent(new Event('change')); };
    }
    if (!lines.length) { const p = prods[0]; lines.push({ pid: p.id, qty: 1, val: mode === 'po' ? p.cost : p.price }); }
    draw();
  }

  function addOrderModal() {
    const lines = [];
    modal({
      title: t('add_order'), wide: true,
      body: `<div class="form-grid">
        <div class="field"><label>${t('customer_name')}</label><input class="input" id="f_name" required></div>
        <div class="field"><label>${t('phone')}</label><input class="input" id="f_phone" placeholder="+968"></div>
        <div class="field"><label>${t('city')}</label><select class="input" id="f_city">${DB.GOVERNORATES.map(g => `<option>${g}</option>`).join('')}</select></div>
        <div class="field"><label>${t('address')}</label><input class="input" id="f_addr"></div>
        <div class="field"><label>${t('source')}</label><select class="input" id="f_src">${['website', 'instagram', 'whatsapp'].map(s => `<option value="${s}">${srcLabel(s)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('payment')}</label><select class="input" id="f_pay">${['cod', 'card', 'transfer'].map(s => `<option value="${s}">${payLabel(s)}</option>`).join('')}</select></div>
        <div class="field"><label>${t('shipping')} (${cur()})</label><input class="input num" type="number" step="0.001" min="0" id="f_ship" value="2"></div>
        <div class="field"><label>${t('discount')} (${cur()})</label><input class="input num" type="number" step="0.001" min="0" id="f_disc" value="0"></div>
        <div class="field full"><label>${t('items')}</label><div id="f_lines"></div></div>
        <div class="field full"><label>${t('note')}</label><input class="input" id="f_note"></div>
      </div><div class="totals mt" id="f_tot" style="border-radius:10px"></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="f_save">${icon('check')}${t('save')}</button>`,
      onMount: (el, m) => {
        const host = $('#f_lines', el);
        const upd = () => {
          const sub = lines.reduce((a, l) => a + l.qty * l.val, 0), disc = +$('#f_disc', el).value || 0, ship = +$('#f_ship', el).value || 0;
          const vat = (sub - disc) * D().settings.vat / 100;
          $('#f_tot', el).innerHTML = `<div class="ln"><span>${t('subtotal')}</span>${money(sub)}</div><div class="ln"><span>${t('vat')}</span>${money(vat)}</div><div class="ln"><span>${t('shipping')}</span>${money(ship)}</div><div class="ln big"><span>${t('total')}</span>${money(sub - disc + vat + ship)}</div>`;
        };
        linesEditor(host, lines, 'sale'); host.addEventListener('change', upd); $('#f_disc', el).oninput = upd; $('#f_ship', el).oninput = upd; upd();
        $('#f_save', el).onclick = () => {
          const name = $('#f_name', el).value.trim();
          if (!name) { $('#f_name', el).focus(); return; }
          if (!lines.length) return;
          const c = DB.findOrCreateCustomer(name, $('#f_phone', el).value.trim(), $('#f_city', el).value);
          const s = DB.createSale({ channel: 'online', source: $('#f_src', el).value, customerId: c.id, city: $('#f_city', el).value, address: $('#f_addr', el).value, payment: $('#f_pay', el).value, shippingFee: +$('#f_ship', el).value || 0, discount: +$('#f_disc', el).value || 0, note: $('#f_note', el).value, items: lines.map(l => ({ pid: l.pid, qty: l.qty, price: l.val })) });
          m.close(); toast(`${s.no} · ${t('saved')}`); state.orderTab = 'online'; state.orderStatus = 'all'; render();
        };
      }
    });
  }

  function receiptModal(s) {
    const st = D().settings;
    modal({
      title: t('receipt'),
      body: `<div class="receipt"><h4>${esc(st.name)}</h4><div class="c">${esc(st.address)}<br>${esc(st.phone)} · CR ${esc(st.cr)}</div><hr>
        <div class="ln"><span>${esc(s.no)}</span><span>${new Date(s.date).toLocaleString('en-GB')}</span></div><div>${esc(s.customerName)}</div><hr>
        ${s.items.map(it => `<div>${esc(it.name)}</div><div class="ln"><span>${it.qty} x ${fmt(it.price)}</span><span>${fmt(it.qty * it.price)}</span></div>`).join('')}<hr>
        <div class="ln"><span>Subtotal</span><span>${fmt(s.subtotal)}</span></div>${s.discount ? `<div class="ln"><span>Discount</span><span>-${fmt(s.discount)}</span></div>` : ''}
        <div class="ln"><span>VAT ${st.vat}%</span><span>${fmt(s.vat)}</span></div>${s.shippingFee ? `<div class="ln"><span>Shipping</span><span>${fmt(s.shippingFee)}</span></div>` : ''}
        <div class="ln" style="font-weight:800;font-size:14px"><span>TOTAL ${esc(cur())}</span><span>${fmt(s.total)}</span></div><div class="ln"><span>Paid by</span><span>${esc(t(s.payment))}</span></div><hr><div class="c">Thank you for your business!</div></div>`,
      footer: `<button class="btn" data-close>${t('close')}</button><button class="btn primary" id="rprint">${icon('printer')}${t('print')}</button>`,
      onMount: (el) => $('#rprint', el).onclick = () => window.print()
    });
  }

  // =====================================================
  // POINT OF SALE
  // =====================================================
  function viewPOS(v) {
    v.innerHTML = `<div class="pos">
      <div>
        <div class="toolbar card" style="border-radius:12px">
          <div class="search-in" style="max-width:none">${icon('search')}<input class="input" id="pq" placeholder="${t('search')} — ${t('product')}, ${t('sku')}, ${t('brand')}" value="${esc(state.posQ)}"></div>
        </div>
        <div class="pos-cats" id="pcats"><button data-c="all" class="${state.posCat === 'all' ? 'on' : ''}">${t('all_categories')}</button>${D().categories.map(c => `<button data-c="${c.id}" class="${state.posCat === c.id ? 'on' : ''}">${catName(c.id)}</button>`).join('')}</div>
        <div class="pos-grid" id="pgrid"></div>
      </div>
      <div class="card cart" id="cart"></div>
    </div>`;
    const drawGrid = () => {
      const q = state.posQ.toLowerCase();
      const list = D().products.filter(p => p.active !== false && (state.posCat === 'all' || p.category === state.posCat) && (!q || (p.name + ' ' + p.sku + ' ' + p.brand + ' ' + p.fitment).toLowerCase().includes(q)));
      $('#pgrid').innerHTML = list.map(p => {
        const inCart = (state.cart.find(c => c.pid === p.id) || {}).qty || 0;
        const left = p.stock - inCart;
        return `<button class="pcard" data-pid="${p.id}" ${left <= 0 ? 'disabled' : ''}><div class="art">${productArt(p)}</div>
          <div class="nm">${esc(p.name)}</div><div class="row"><span class="pr num">${fmt(p.price)}</span><span class="${left <= p.reorder ? 'neg-val' : 'faint'}">${left} ${t('in_stock').toLowerCase()}</span></div></button>`;
      }).join('') || `<div class="empty">${t('no_results')}</div>`;
      $$('.pcard', $('#pgrid')).forEach(b => b.onclick = () => { addToCart(b.dataset.pid); });
    };
    const addToCart = (pid) => {
      const p = DB.product(pid); const l = state.cart.find(c => c.pid === pid);
      if (l) { if (l.qty < p.stock) l.qty++; } else state.cart.push({ pid, qty: 1 });
      drawGrid(); drawCart();
    };
    const drawCart = () => {
      const vatR = D().settings.vat;
      const sub = state.cart.reduce((a, l) => a + l.qty * DB.product(l.pid).price, 0);
      const disc = Math.min(state.posDisc || 0, sub);
      const vat = (sub - disc) * vatR / 100, tot = sub - disc + vat;
      $('#cart').innerHTML = `<div class="card-h" style="padding-bottom:12px;border-bottom:1px solid var(--border)"><h3>${icon('cart')} ${t('new_sale')}</h3>${state.cart.length ? `<button class="btn sm ghost" id="cclr">${t('clear')}</button>` : ''}</div>
        <div style="padding:12px 16px 0"><select class="input" id="pcust"><option value="">${t('walk_in')}</option>${D().customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}" ${state.posCust === c.id ? 'selected' : ''}>${esc(c.name)} · ${esc(c.phone)}</option>`).join('')}</select></div>
        <div class="cart-items">${state.cart.length ? state.cart.map(l => { const p = DB.product(l.pid); return `<div class="cline"><div><div class="nm">${esc(p.name)}</div><div class="faint" style="font-size:12px">${fmt(p.price)} × ${l.qty}</div></div><b class="num">${fmt(p.price * l.qty)}</b>
          <div class="qty"><button data-dec="${p.id}" aria-label="-">${icon('minus')}</button><span class="num">${l.qty}</span><button data-inc="${p.id}" aria-label="+">${icon('plus')}</button></div><button class="btn sm ghost danger" data-rm="${p.id}">${icon('trash')}</button></div>`; }).join('') : `<div class="empty">${icon('cart')}<br>${t('cart_empty')}</div>`}</div>
        <div class="totals">
          <div class="ln"><span>${t('subtotal')}</span>${money(sub)}</div>
          <div class="ln" style="align-items:center"><span>${t('discount')}</span><input class="input num" id="pdisc" type="number" min="0" step="0.5" value="${state.posDisc || ''}" placeholder="0.000" style="width:110px;text-align:end;padding:4px 8px"></div>
          <div class="ln"><span>${t('vat')} (${vatR}%)</span>${money(vat)}</div>
          <div class="ln big"><span>${t('grand_total')}</span>${money(tot)}</div>
          <div class="pay-opts">${['cash', 'card', 'transfer'].map(p => `<button data-pay="${p}" class="${state.posPay === p ? 'on' : ''}">${t(p)}</button>`).join('')}</div>
          <button class="btn primary lg" style="width:100%" id="pcharge" ${state.cart.length ? '' : 'disabled'}>${icon('check')}${t('charge')} ${moneyTxt(tot)}</button>
        </div>`;
      const c = $('#cart');
      $$('[data-inc]', c).forEach(b => b.onclick = () => addToCart(b.dataset.inc));
      $$('[data-dec]', c).forEach(b => b.onclick = () => { const l = state.cart.find(x => x.pid === b.dataset.dec); l.qty--; if (l.qty <= 0) state.cart = state.cart.filter(x => x !== l); drawGrid(); drawCart(); });
      $$('[data-rm]', c).forEach(b => b.onclick = () => { state.cart = state.cart.filter(x => x.pid !== b.dataset.rm); drawGrid(); drawCart(); });
      $$('[data-pay]', c).forEach(b => b.onclick = () => { state.posPay = b.dataset.pay; drawCart(); });
      if ($('#cclr')) $('#cclr').onclick = () => { state.cart = []; state.posDisc = 0; drawGrid(); drawCart(); };
      $('#pcust').onchange = (e) => state.posCust = e.target.value;
      $('#pdisc').onchange = (e) => { state.posDisc = Math.max(0, parseFloat(e.target.value) || 0); drawCart(); };
      $('#pcharge').onclick = () => {
        if (!state.cart.length) return;
        const sale = DB.createSale({ channel: 'shop', source: 'pos', customerId: state.posCust || null, payment: state.posPay, discount: state.posDisc, items: state.cart.map(l => ({ pid: l.pid, qty: l.qty })) });
        state.cart = []; state.posDisc = 0; state.posCust = '';
        renderShell(); drawGrid(); drawCart();
        toast(`${t('sale_done')} · ${sale.no}`);
        receiptModal(sale);
      };
    };
    drawGrid(); drawCart();
    $$('#pcats button').forEach(b => b.onclick = () => { state.posCat = b.dataset.c; $$('#pcats button').forEach(x => x.classList.toggle('on', x === b)); drawGrid(); });
    $('#pq').oninput = (e) => { state.posQ = e.target.value; drawGrid(); };
  }

  // =====================================================
  // INVENTORY
  // =====================================================
  function viewInventory(v) {
    const P = D().products;
    const units = P.reduce((a, p) => a + p.stock, 0), val = P.reduce((a, p) => a + p.stock * p.cost, 0), rval = P.reduce((a, p) => a + p.stock * p.price, 0);
    const low = P.filter(p => p.stock <= p.reorder).length;
    let list = P.slice();
    const q = state.invQ.toLowerCase();
    if (q) list = list.filter(p => (p.name + ' ' + p.sku + ' ' + p.brand + ' ' + p.fitment).toLowerCase().includes(q));
    if (state.invCat !== 'all') list = list.filter(p => p.category === state.invCat);
    if (state.invStock === 'low') list = list.filter(p => p.stock <= p.reorder);
    if (state.invStock === 'out') list = list.filter(p => p.stock === 0);

    v.innerHTML = `
      <div class="page-head"><div><h2>${t('inventory')}</h2><p>${P.length} ${t('products').toLowerCase()} · ${D().categories.length} ${t('category').toLowerCase()}</p></div>
        <div class="actions"><button class="btn" id="iexp">${icon('download')}${t('export_csv')}</button><button class="btn primary" id="iadd">${icon('plus')}${t('add_product')}</button></div></div>
      <div class="grid g-kpi">
        ${kpi('box', 'tone-brand', t('sku_count'), `<span class="num">${P.filter(p => p.active !== false).length}</span>`, `<span>${P.filter(p => p.online !== false).length} ${t('online').toLowerCase()}</span>`)}
        ${kpi('inventory', 'tone-info', t('inventory_units'), `<span class="num">${units.toLocaleString()}</span>`, '')}
        ${kpi('wallet', 'tone-ok', t('stock_value'), big(val), `<span>${t('retail_value')} ${moneyTxt(rval, 0)}</span>`)}
        ${kpi('alert', 'tone-warn', t('low_stock'), `<span class="num">${low}</span>`, `<span>${P.filter(p => p.stock === 0).length} ${t('out_of_stock').toLowerCase()}</span>`)}
      </div>
      <div class="tabs mt" id="itabs"><button data-k="products" class="${state.invTab === 'products' ? 'on' : ''}">${t('products')}</button><button data-k="moves" class="${state.invTab === 'moves' ? 'on' : ''}">${t('move_history')}<span class="count">${D().moves.length}</span></button></div>
      <div class="card" id="ibody"></div>`;

    if (state.invTab === 'moves') {
      const mv = D().moves.slice(0, 200);
      $('#ibody').innerHTML = mv.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${t('date')}</th><th>${t('product')}</th><th>${t('type')}</th><th>${t('order')}</th><th class="r">${t('qty')}</th><th>${t('note')}</th></tr></thead><tbody>
        ${mv.map(m => { const p = DB.product(m.pid) || { name: '?' }; return `<tr><td class="muted">${fDT(m.date)}</td><td>${esc(p.name)}</td><td><span class="chip">${esc(m.type)}</span></td><td>${esc(m.ref)}</td><td class="r strong ${m.qty > 0 ? 'pos-val' : 'neg-val'}">${m.qty > 0 ? '+' : ''}${m.qty}</td><td class="muted">${esc(m.note)}</td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${t('no_results')} — POS, online orders, purchases and adjustments will appear here.</div>`;
    } else {
      $('#ibody').innerHTML = `<div class="toolbar">
          <div class="search-in">${icon('search')}<input class="input" id="iq" placeholder="${t('search')}" value="${esc(state.invQ)}"></div>
          <select class="input" id="icat"><option value="all">${t('all_categories')}</option>${D().categories.map(c => `<option value="${c.id}" ${state.invCat === c.id ? 'selected' : ''}>${catName(c.id)}</option>`).join('')}</select>
          <div class="seg" id="istock">${[['all', t('all')], ['low', t('low_stock')], ['out', t('out_of_stock')]].map(([k, l]) => `<button data-k="${k}" class="${state.invStock === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <span class="faint" style="margin-inline-start:auto">${list.length}</span></div>
        <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>${t('product')}</th><th>${t('brand')}</th><th>${t('category')}</th><th class="r">${t('cost')}</th><th class="r">${t('price')}</th><th class="r">${t('margin')}</th><th class="r">${t('stock')}</th><th>${t('location')}</th><th></th></tr></thead><tbody>
          ${list.map(p => `<tr><td><div class="cell-prod">${thumb(p)}<div><div class="strong">${esc(p.name)}</div><div class="faint" style="font-size:12px">${esc(p.sku)} · ${esc(p.fitment)}</div></div></div></td><td>${esc(p.brand)}</td><td><span class="chip">${catName(p.category)}</span></td>
            <td class="r">${money(p.cost)}</td><td class="r strong">${money(p.price)}</td><td class="r muted num">${pct((p.price - p.cost) / p.price * 100)}</td>
            <td class="r"><span class="pill ${p.stock === 0 ? 's-cancelled' : p.stock <= p.reorder ? 's-processing' : 's-delivered'}">${p.stock}</span></td><td class="muted">${esc(p.location)}</td>
            <td class="r" style="white-space:nowrap"><button class="btn sm" data-adj="${p.id}">± ${t('stock')}</button> <button class="btn sm ghost" data-edit="${p.id}" aria-label="${t('edit')}">${icon('edit')}</button></td></tr>`).join('')}
          </tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div>`;
      const iq = $('#iq'); iq.oninput = debounce(() => { state.invQ = iq.value; render(); const e = $('#iq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250);
      $('#icat').onchange = (e) => { state.invCat = e.target.value; render(); };
      bindSeg('istock', k => { state.invStock = k; render(); });
      $$('[data-edit]', v).forEach(b => b.onclick = () => productModal(DB.product(b.dataset.edit)));
      $$('[data-adj]', v).forEach(b => b.onclick = () => adjustModal(DB.product(b.dataset.adj)));
    }
    $$('#itabs button').forEach(b => b.onclick = () => { state.invTab = b.dataset.k; render(); });
    $('#iadd').onclick = () => productModal(null);
    $('#iexp').onclick = () => {
      const rows = [['SKU', 'Name', 'Brand', 'Category', 'Fitment', 'Cost', 'Price', 'Stock', 'Reorder', 'Bin', 'Stock value']];
      P.forEach(p => rows.push([p.sku, p.name, p.brand, p.category, p.fitment, fmt(p.cost), fmt(p.price), p.stock, p.reorder, p.location, fmt(p.stock * p.cost)]));
      download(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv(rows), 'text/csv');
    };
  }

  function productModal(p) {
    const isNew = !p;
    p = p || { sku: '', name: '', brand: '', category: 'accessories', cost: 0, price: 0, stock: 0, reorder: 2, location: '', fitment: 'Universal', active: true, online: true, image: '', oldPrice: 0, description: '', featured: false };
    let img = p.image || '';
    const f = (k, lbl, type, extra) => `<div class="field ${extra || ''}"><label>${lbl}</label><input class="input ${type === 'number' ? 'num' : ''}" id="p_${k}" type="${type || 'text'}" ${type === 'number' ? 'step="0.001" min="0"' : ''} value="${esc(p[k])}"></div>`;
    modal({
      title: isNew ? t('add_product') : t('edit_product'), wide: true,
      body: `<div class="photo-row"><div class="photo-box" id="p_photo"></div><div><div class="field"><label>${t('photo')}</label><div class="actions"><label class="btn sm">${icon('image')}${t('upload')}<input type="file" id="p_file" accept="image/*" hidden></label><button class="btn sm ghost danger" id="p_rmimg" type="button">${t('remove_photo')}</button></div><p class="faint" style="margin:6px 0 0;font-size:12.5px">JPG / PNG · auto-resized</p></div></div></div>
        <div class="form-grid mt">${f('name', t('product'), 'text', 'full')}${f('sku', t('sku'))}${f('brand', t('brand'))}
        <div class="field"><label>${t('category')}</label><select class="input" id="p_category">${D().categories.map(c => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${catName(c.id)}</option>`).join('')}</select></div>
        ${f('fitment', t('fitment'))}${f('cost', `${t('cost')} (${cur()})`, 'number')}${f('price', `${t('price')} (${cur()})`, 'number')}
        ${isNew ? f('stock', t('stock'), 'number') : `<div class="field"><label>${t('stock')}</label><div class="input" style="background:var(--surface-2)">${p.stock} — ${t('adjust_stock')} ↗</div></div>`}
        ${f('reorder', t('reorder'), 'number')}${f('location', t('location'))}${f('oldPrice', `${t('old_price')} (${cur()})`, 'number')}
        <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="p_online" ${p.online !== false ? 'checked' : ''}> ${t('active_online')}</label><label class="check"><input type="checkbox" id="p_featured" ${p.featured ? 'checked' : ''}> ${t('featured')}</label></div>
        <div class="field full"><label>${t('description')}</label><textarea class="input" id="p_description" rows="3">${esc(p.description || '')}</textarea></div>
      </div>${!isNew ? `<div class="notice mt">${icon('reports')}<div>${t('margin')}: <b>${pct((p.price - p.cost) / p.price * 100)}</b> · ${t('stock_value')}: <b>${moneyTxt(p.stock * p.cost)}</b></div></div>` : ''}`,
      footer: `${!isNew ? `<button class="btn danger" id="p_del" style="margin-inline-end:auto">${icon('trash')}${t('delete')}</button>` : ''}<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="p_save">${icon('check')}${t('save')}</button>`,
      onMount: (el, m) => {
        const drawImg = () => { $('#p_photo', el).innerHTML = productArt(Object.assign({}, p, { image: img, category: $('#p_category', el).value })); $('#p_rmimg', el).classList.toggle('hide', !img); };
        drawImg();
        $('#p_category', el).onchange = drawImg;
        $('#p_rmimg', el).onclick = () => { img = ''; drawImg(); };
        $('#p_file', el).onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; try { img = await shrinkImage(fl, 700); drawImg(); } catch (er) { alert('Could not read this image'); } };
        $('#p_save', el).onclick = () => {
          const g = (k) => $('#p_' + k, el);
          const name = g('name').value.trim(); if (!name) { g('name').focus(); return; }
          const data = { name, sku: g('sku').value.trim() || 'SKU-' + Date.now().toString(36).toUpperCase(), brand: g('brand').value.trim(), category: g('category').value, fitment: g('fitment').value.trim(), cost: DB.r3(+g('cost').value || 0), price: DB.r3(+g('price').value || 0), reorder: Math.max(0, parseInt(g('reorder').value, 10) || 0), location: g('location').value.trim(), online: g('online').checked, featured: g('featured').checked, oldPrice: DB.r3(+g('oldPrice').value || 0), description: g('description').value.trim(), image: img };
          if (isNew) { const np = Object.assign({ id: DB.uid('p'), active: true, stock: 0 }, data); D().products.push(np); const st = parseInt(g('stock').value, 10) || 0; if (st) DB.adjustStock(np.id, st, 'adjust', '', 'Opening stock'); }
          else Object.assign(p, data);
          if (!DB.save()) alert('Browser storage is full — the photo was not saved. Use a smaller photo or remove some.');
          m.close(); toast(t('saved')); render();
        };
        if ($('#p_del', el)) $('#p_del', el).onclick = () => { m.close(); confirmBox(t('confirm_delete'), () => { D().products = D().products.filter(x => x.id !== p.id); DB.save(); toast(t('deleted')); render(); }); };
      }
    });
  }

  function adjustModal(p) {
    modal({
      title: `${t('adjust_stock')} · ${esc(p.name)}`,
      body: `<div class="form-grid"><div class="field"><label>${t('stock')}</label><div class="input" style="background:var(--surface-2)"><b class="num">${p.stock}</b> ${t('units')}</div></div>
        <div class="field"><label>${t('qty')} (+ / −)</label><input class="input num" type="number" id="a_q" value="1"></div>
        <div class="field full"><label>${t('reason')}</label><select class="input" id="a_r"><option>Stock count correction</option><option>Damaged / defective</option><option>Customer return</option><option>Received without PO</option><option>Used in workshop</option></select></div></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="a_s">${t('save')}</button>`,
      onMount: (el, m) => $('#a_s', el).onclick = () => { const q = parseInt($('#a_q', el).value, 10) || 0; if (!q) return; DB.adjustStock(p.id, q, 'adjust', '', $('#a_r', el).value); DB.save(); m.close(); toast(t('saved')); render(); }
    });
  }

  // =====================================================
  // PURCHASING
  // =====================================================
  function viewPurchases(v) {
    const pos = D().purchases.slice().sort((a, b) => b.date - a.date);
    const reorder = D().products.filter(p => p.active !== false && p.stock <= p.reorder).map(p => ({ p, qty: Math.max(p.reorder * 2 - p.stock, 1) }));
    const openPO = pos.filter(p => p.status === 'ordered');
    v.innerHTML = `
      <div class="page-head"><div><h2>${t('purchases')}</h2><p>${t('suppliers')} · ${t('reorder_list')}</p></div><div class="actions"><button class="btn primary" id="poadd">${icon('plus')}${t('new_po')}</button></div></div>
      <div class="grid g-kpi">
        ${kpi('truck', 'tone-warn', t('st_ordered'), `<span class="num">${openPO.length}</span>`, `<span>${moneyTxt(openPO.reduce((a, p) => a + p.total, 0), 0)}</span>`)}
        ${kpi('check', 'tone-ok', t('st_received'), `<span class="num">${pos.length - openPO.length}</span>`, `<span>${moneyTxt(pos.filter(p => p.status === 'received').reduce((a, p) => a + p.total, 0), 0)}</span>`)}
        ${kpi('alert', 'tone-bad', t('reorder_list'), `<span class="num">${reorder.length}</span>`, `<span>≈ ${moneyTxt(reorder.reduce((a, r) => a + r.qty * r.p.cost, 0), 0)}</span>`)}
        ${kpi('customers', 'tone-info', t('suppliers'), `<span class="num">${D().suppliers.length}</span>`, '')}
      </div>
      <div class="grid g-21 mt">
        <div class="card"><div class="card-h"><h3>${t('purchases')}</h3></div><div class="card-b" style="padding:12px 0 0"><div class="table-wrap">
          ${pos.length ? `<table class="t"><thead><tr><th>PO</th><th>${t('date')}</th><th>${t('supplier')}</th><th>${t('items')}</th><th class="r">${t('total')}</th><th>${t('status')}</th><th></th></tr></thead><tbody>
          ${pos.map(po => `<tr><td class="strong">${esc(po.no)}</td><td class="muted">${fDate(po.date)}</td><td>${esc((DB.supplier(po.supplierId) || {}).name || '—')}</td><td class="muted">${po.items.map(i => i.qty + '× ' + esc((DB.product(i.pid) || {}).sku || '')).join(', ')}</td><td class="r strong">${money(po.total)}</td><td>${statusPill(po.status)}</td><td class="r">${po.status === 'ordered' ? `<button class="btn sm primary" data-recv="${po.id}">${icon('check')}${t('receive')}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div></div>
        <div class="card"><div class="card-h"><h3>${t('reorder_list')}</h3>${reorder.length ? `<button class="btn sm" id="poauto">${icon('plus')}PO</button>` : ''}</div><div class="card-b">
          <ul class="mini-list">${reorder.map(r => `<li>${thumb(r.p)}<div class="grow"><div class="name">${esc(r.p.name)}</div><div class="faint" style="font-size:12px">${t('stock')} ${r.p.stock} / ${t('reorder')} ${r.p.reorder}</div></div><b class="num">+${r.qty}</b></li>`).join('') || `<div class="empty">✓</div>`}</ul></div></div>
      </div>
      <div class="card mt"><div class="card-h"><h3>${t('suppliers')}</h3><button class="btn sm" id="supadd">${icon('plus')}${t('supplier')}</button></div><div class="card-b" style="padding:12px 0 0"><div class="table-wrap"><table class="t"><thead><tr><th>${t('supplier')}</th><th>Country</th><th>${t('phone')}</th><th class="r">${t('purchases')}</th></tr></thead><tbody>
        ${D().suppliers.map(s => `<tr><td class="strong">${esc(s.name)}</td><td>${esc(s.country)}</td><td class="muted">${esc(s.phone)}</td><td class="r">${money(D().purchases.filter(p => p.supplierId === s.id).reduce((a, p) => a + p.total, 0))}</td></tr>`).join('')}</tbody></table></div></div></div>`;
    $$('[data-recv]', v).forEach(b => b.onclick = () => { DB.receivePurchase(b.dataset.recv); toast(t('st_received')); render(); });
    $('#poadd').onclick = () => poModal([]);
    if ($('#poauto')) $('#poauto').onclick = () => poModal(reorder.map(r => ({ pid: r.p.id, qty: r.qty, val: r.p.cost })));
    $('#supadd').onclick = () => modal({
      title: t('supplier'), body: `<div class="form-grid"><div class="field full"><label>${t('supplier')}</label><input class="input" id="s_n"></div><div class="field"><label>Country</label><input class="input" id="s_c" value="Oman"></div><div class="field"><label>${t('phone')}</label><input class="input" id="s_p"></div></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="s_s">${t('save')}</button>`,
      onMount: (el, m) => $('#s_s', el).onclick = () => { const n = $('#s_n', el).value.trim(); if (!n) return; D().suppliers.push({ id: DB.uid('s'), name: n, country: $('#s_c', el).value, phone: $('#s_p', el).value }); DB.save(); m.close(); toast(t('saved')); render(); }
    });
  }
  function poModal(lines) {
    modal({
      title: t('new_po'), wide: true,
      body: `<div class="form-grid"><div class="field"><label>${t('supplier')}</label><select class="input" id="po_s">${D().suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div class="field"><label>${t('total')}</label><div class="input" id="po_t" style="background:var(--surface-2);font-weight:700"></div></div>
        <div class="field full"><label>${t('items')}</label><div id="po_l"></div></div></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn" id="po_o">${t('save')} (${t('st_ordered')})</button><button class="btn primary" id="po_r">${icon('check')}${t('save')} + ${t('receive')}</button>`,
      onMount: (el, m) => {
        const host = $('#po_l', el); const upd = () => $('#po_t', el).innerHTML = money(lines.reduce((a, l) => a + l.qty * l.val, 0));
        linesEditor(host, lines, 'po'); host.addEventListener('change', upd); upd();
        const save = (recv) => {
          if (!lines.length) return;
          const po = { id: DB.uid('po'), no: DB.nextNo('PO-', 300), date: Date.now(), supplierId: $('#po_s', el).value, status: 'ordered', items: lines.map(l => ({ pid: l.pid, qty: l.qty, cost: l.val })) };
          po.total = DB.r3(po.items.reduce((a, i) => a + i.qty * i.cost, 0));
          D().purchases.push(po); DB.save(); if (recv) DB.receivePurchase(po.id);
          m.close(); toast(`${po.no} · ${t('saved')}`); render();
        };
        $('#po_o', el).onclick = () => save(false); $('#po_r', el).onclick = () => save(true);
      }
    });
  }

  // =====================================================
  // FINANCE
  // =====================================================
  const EXP_CATS = ['rent', 'salaries', 'utilities', 'marketing', 'shipping', 'maintenance', 'software', 'inventory', 'other'];
  function viewFinance(v) {
    const r = range(state.finRange);
    const sales = inRange(revenueSales(), r.from, r.to), pSales = inRange(revenueSales(), r.pFrom, r.pTo);
    const exps = inRange(D().expenses, r.from, r.to), pExps = inRange(D().expenses, r.pFrom, r.pTo);
    const S = summarize(sales), PS = summarize(pSales);
    const opex = exps.filter(e => e.category !== 'inventory').reduce((a, e) => a + e.amount, 0);
    const pOpex = pExps.filter(e => e.category !== 'inventory').reduce((a, e) => a + e.amount, 0);
    const stockBuy = exps.filter(e => e.category === 'inventory').reduce((a, e) => a + e.amount, 0);
    const np = S.gp - opex, pNp = PS.gp - pOpex;
    const cashIn = S.gross, cashOut = opex + stockBuy;
    const payMix = {}; sales.forEach(s => payMix[s.payment] = (payMix[s.payment] || 0) + s.total);
    const expMix = {}; exps.forEach(e => expMix[e.category] = (expMix[e.category] || 0) + e.amount);

    v.innerHTML = `
      <div class="page-head"><div><h2>${t('finance')}</h2><p>${fDate(r.from)} – ${fDate(r.to)}</p></div><div class="actions">${rangeSeg(state.finRange, 'fseg')}<button class="btn primary" id="eadd">${icon('plus')}${t('add_expense')}</button></div></div>
      <div class="grid g-kpi">
        ${kpi('finance', 'tone-brand', t('net_sales'), big(S.net), `${delta(S.net, PS.net)}<span>${t('vs_prev')}</span>`)}
        ${kpi('reports', 'tone-ok', t('gross_profit'), big(S.gp), `${delta(S.gp, PS.gp)}<span>${t('margin')} ${pct(S.gp / S.net * 100)}</span>`)}
        ${kpi('wallet', 'tone-warn', t('op_expenses'), big(opex), `${delta(opex, pOpex)}<span>${t('vs_prev')}</span>`)}
        ${kpi('check', np >= 0 ? 'tone-ok' : 'tone-bad', t('net_profit'), `<span class="${np >= 0 ? '' : 'neg-val'}">${big(np)}</span>`, `${delta(np, pNp)}<span>${t('margin')} ${pct(np / S.net * 100)}</span>`)}
      </div>
      <div class="grid g-21 mt">
        <div class="card"><div class="card-h"><h3>${t('income_vs_exp')}</h3><div class="legend"><span><i style="background:var(--c3)"></i>${t('net_sales')}</span><span><i style="background:var(--c1)"></i>${t('expenses')}</span><span><i style="background:var(--c2)"></i>${t('net_profit')}</span></div></div><div class="card-b"><div class="chart-box"><canvas id="cIE"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('pnl')}</h3></div><div class="card-b">
          <div class="stat-line"><span>${t('net_sales')}</span><b>${money(S.net)}</b></div>
          <div class="stat-line"><span>− ${t('cogs')}</span><span class="neg-val">${money(S.cogs)}</span></div>
          <div class="stat-line"><b>${t('gross_profit')}</b><b>${money(S.gp)}</b></div>
          ${EXP_CATS.filter(c => c !== 'inventory' && expMix[c]).map(c => `<div class="stat-line" style="padding-inline-start:12px"><span class="muted">− ${c[0].toUpperCase() + c.slice(1)}</span><span class="neg-val">${money(expMix[c])}</span></div>`).join('')}
          <div class="stat-line total"><span>${t('net_profit')}</span><span class="${np >= 0 ? 'pos-val' : 'neg-val'}">${money(np)}</span></div>
        </div></div>
      </div>
      <div class="grid g-3 mt">
        <div class="card"><div class="card-h"><h3>${t('cashflow')}</h3></div><div class="card-b">
          <div class="stat-line"><span>${t('cash_in')}</span><b class="pos-val">${money(cashIn)}</b></div>
          <div class="stat-line"><span>${t('cash_out')} · ${t('op_expenses').toLowerCase()}</span><span class="neg-val">${money(opex)}</span></div>
          <div class="stat-line"><span>${t('cash_out')} · ${t('purchases').toLowerCase()}</span><span class="neg-val">${money(stockBuy)}</span></div>
          <div class="stat-line total"><span>${t('net_cash')}</span><span class="${cashIn - cashOut >= 0 ? 'pos-val' : 'neg-val'}">${money(cashIn - cashOut)}</span></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('vat_summary')}</h3></div><div class="card-b">
          <div class="stat-line"><span>${t('net_sales')}</span><b>${money(S.net)}</b></div>
          <div class="stat-line"><span>${t('vat_collected')} ${D().settings.vat}%</span><b>${money(S.vat)}</b></div>
          <div class="stat-line"><span>${t('shipping')}</span><span>${money(S.ship)}</span></div>
          <div class="stat-line total"><span>${t('total')}</span><span>${money(S.gross)}</span></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('payments_mix')}</h3></div><div class="card-b"><div class="chart-box sm"><canvas id="cPay"></canvas></div></div></div>
      </div>
      <div class="grid g-21 mt">
        <div class="card"><div class="card-h"><h3>${t('expenses')}</h3><button class="btn sm" id="eexp">${icon('download')}CSV</button></div><div class="card-b" style="padding:12px 0 0"><div class="table-wrap">
          ${exps.length ? `<table class="t"><thead><tr><th>${t('date')}</th><th>${t('category')}</th><th>${t('description')}</th><th>${t('method')}</th><th class="r">${t('amount')}</th><th></th></tr></thead><tbody>
          ${exps.slice().sort((a, b) => b.date - a.date).map(e => `<tr><td class="muted">${fDate(e.date)}</td><td><span class="chip">${esc(e.category)}</span></td><td>${esc(e.desc)}</td><td class="muted">${t(e.method)}</td><td class="r strong">${money(e.amount)}</td><td class="r">${e.ref ? '' : `<button class="btn sm ghost danger" data-edel="${e.id}" aria-label="${t('delete')}">${icon('trash')}</button>`}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div></div>
        <div class="card"><div class="card-h"><h3>${t('exp_breakdown')}</h3></div><div class="card-b"><div class="chart-box sm"><canvas id="cExp"></canvas></div><div class="legend mt" id="expLeg"></div></div></div>
      </div>`;
    bindSeg('fseg', k => { state.finRange = k; render(); });
    $('#eadd').onclick = expenseModal;
    $$('[data-edel]', v).forEach(b => b.onclick = () => confirmBox(t('confirm_delete'), () => { D().expenses = D().expenses.filter(e => e.id !== b.dataset.edel); DB.save(); toast(t('deleted')); render(); }));
    $('#eexp').onclick = () => { const rows = [['Date', 'Category', 'Description', 'Method', 'Amount']]; exps.forEach(e => rows.push([new Date(e.date).toISOString().slice(0, 10), e.category, e.desc, e.method, fmt(e.amount)])); download('expenses.csv', csv(rows), 'text/csv'); };

    // monthly income vs expenses (last 6 months)
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i); const e = new Date(d); e.setMonth(e.getMonth() + 1); months.push({ from: d.getTime(), to: e.getTime() - 1, label: d.toLocaleDateString(locale(), { month: 'short', year: '2-digit' }) }); }
    const inc = months.map(m => summarize(inRange(revenueSales(), m.from, m.to)));
    const ex = months.map(m => inRange(D().expenses, m.from, m.to).filter(e => e.category !== 'inventory').reduce((a, e) => a + e.amount, 0));
    chart($('#cIE'), {
      data: { labels: months.map(m => m.label), datasets: [
        { type: 'bar', label: t('net_sales'), data: inc.map(s => s.net), backgroundColor: cssVar('--c3'), borderRadius: 5, maxBarThickness: 34 },
        { type: 'bar', label: t('expenses'), data: ex.map((e, i) => e + inc[i].cogs), backgroundColor: cssVar('--c1'), borderRadius: 5, maxBarThickness: 34 },
        { type: 'line', label: t('net_profit'), data: inc.map((s, i) => s.gp - ex[i]), borderColor: cssVar('--c2'), backgroundColor: cssVar('--c2'), borderWidth: 2.5, pointRadius: 4, tension: .3 }] },
      options: { scales: barAxes(false), plugins: { tooltip: { mode: 'index', intersect: false, ...tipMoney } } }
    });
    const payKeys = Object.keys(payMix), palette = ['--c1', '--c2', '--c3', '--c5', '--c4', '--c6', '--c7', '--c8', '--c1'].map(cssVar);
    chart($('#cPay'), { type: 'doughnut', data: { labels: payKeys.map(k => t(k)), datasets: [{ data: payKeys.map(k => payMix[k]), backgroundColor: palette, borderWidth: 0, spacing: 2 }] }, options: { cutout: '65%', plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3 } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${moneyTxt(c.parsed)}` } } } } });
    const ek = Object.keys(expMix).sort((a, b) => expMix[b] - expMix[a]);
    chart($('#cExp'), { type: 'doughnut', data: { labels: ek, datasets: [{ data: ek.map(k => expMix[k]), backgroundColor: palette, borderWidth: 0, spacing: 2 }] }, options: { cutout: '65%', plugins: { tooltip: { callbacks: { label: (c) => ` ${c.label}: ${moneyTxt(c.parsed)}` } } } } });
    $('#expLeg').innerHTML = ek.map((k, i) => `<span><i style="background:${palette[i]}"></i>${k} · ${fmt(expMix[k], 0)}</span>`).join('');
  }
  function expenseModal() {
    modal({
      title: t('add_expense'),
      body: `<div class="form-grid"><div class="field"><label>${t('category')}</label><select class="input" id="x_c">${EXP_CATS.filter(c => c !== 'inventory').map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>${t('amount')} (${cur()})</label><input class="input num" type="number" step="0.001" min="0" id="x_a"></div>
        <div class="field full"><label>${t('description')}</label><input class="input" id="x_d"></div>
        <div class="field"><label>${t('date')}</label><input class="input" type="date" id="x_dt" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>${t('method')}</label><select class="input" id="x_m">${['cash', 'card', 'transfer'].map(m => `<option value="${m}">${t(m)}</option>`).join('')}</select></div></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="x_s">${t('save')}</button>`,
      onMount: (el, m) => $('#x_s', el).onclick = () => {
        const a = parseFloat($('#x_a', el).value); if (!(a > 0)) { $('#x_a', el).focus(); return; }
        const dt = new Date($('#x_dt', el).value + 'T12:00:00').getTime() || Date.now();
        D().expenses.push({ id: DB.uid('e'), date: Math.min(dt, Date.now()), category: $('#x_c', el).value, desc: $('#x_d', el).value.trim() || $('#x_c', el).value, amount: DB.r3(a), method: $('#x_m', el).value });
        DB.save(); m.close(); toast(t('saved')); render();
      }
    });
  }

  // =====================================================
  // CUSTOMERS
  // =====================================================
  function custStats(c) {
    const s = D().sales.filter(x => x.customerId === c.id && DB.countsAsRevenue(x));
    return { n: s.length, spent: s.reduce((a, x) => a + x.total, 0), last: s.reduce((a, x) => Math.max(a, x.date), 0) };
  }
  function viewCustomers(v) {
    const q = state.custQ.toLowerCase();
    const list = D().customers.filter(c => !q || (c.name + ' ' + c.phone + ' ' + c.city).toLowerCase().includes(q)).map(c => Object.assign({ c }, custStats(c))).sort((a, b) => b.spent - a.spent);
    const all = D().customers.map(custStats);
    v.innerHTML = `
      <div class="page-head"><div><h2>${t('customers')}</h2><p>${D().customers.length} ${t('customers').toLowerCase()}</p></div><div class="actions"><button class="btn primary" id="cadd">${icon('plus')}${t('add_customer')}</button></div></div>
      <div class="grid g-kpi">
        ${kpi('customers', 'tone-brand', t('customers'), `<span class="num">${D().customers.length}</span>`, `<span>${D().customers.filter(c => c.type === 'workshop').length} ${t('workshop')}</span>`)}
        ${kpi('finance', 'tone-ok', t('total_spent'), big(all.reduce((a, s) => a + s.spent, 0)), '')}
        ${kpi('orders', 'tone-info', t('avg_order'), big(all.reduce((a, s) => a + s.spent, 0) / Math.max(1, all.reduce((a, s) => a + s.n, 0))), '')}
        ${kpi('star', 'tone-violet', 'Repeat', `<span class="num">${all.filter(s => s.n > 1).length}</span>`, `<span>${pct(all.filter(s => s.n > 1).length / Math.max(1, all.length) * 100)}</span>`)}
      </div>
      <div class="card mt"><div class="toolbar"><div class="search-in">${icon('search')}<input class="input" id="cq" placeholder="${t('search')}" value="${esc(state.custQ)}"></div></div>
        <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>${t('customer')}</th><th>${t('phone')}</th><th>${t('city')}</th><th>${t('type')}</th><th class="r">${t('orders_n')}</th><th class="r">${t('total_spent')}</th><th>${t('last_order')}</th></tr></thead><tbody>
          ${list.map(x => `<tr class="click" data-cid="${x.c.id}"><td><div class="cell-prod" style="min-width:0"><div class="avatar" style="width:32px;height:32px;font-size:12px">${esc(x.c.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2))}</div><b>${esc(x.c.name)}</b></div></td><td class="muted">${esc(x.c.phone)}</td><td>${esc(x.c.city)}</td><td><span class="chip">${t(x.c.type)}</span></td><td class="r num">${x.n}</td><td class="r strong">${money(x.spent)}</td><td class="muted">${x.last ? fDate(x.last) : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div>`;
    const cq = $('#cq'); cq.oninput = debounce(() => { state.custQ = cq.value; render(); const e = $('#cq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 250);
    $$('[data-cid]', v).forEach(tr => tr.onclick = () => customerModal(tr.dataset.cid));
    $('#cadd').onclick = () => modal({
      title: t('add_customer'),
      body: `<div class="form-grid"><div class="field full"><label>${t('customer_name')}</label><input class="input" id="k_n"></div><div class="field"><label>${t('phone')}</label><input class="input" id="k_p" placeholder="+968"></div><div class="field"><label>${t('city')}</label><input class="input" id="k_c" value="Muscat"></div><div class="field"><label>${t('type')}</label><select class="input" id="k_t"><option value="retail">${t('retail')}</option><option value="workshop">${t('workshop')}</option></select></div></div>`,
      footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="k_s">${t('save')}</button>`,
      onMount: (el, m) => $('#k_s', el).onclick = () => { const n = $('#k_n', el).value.trim(); if (!n) return; D().customers.push({ id: DB.uid('c'), name: n, phone: $('#k_p', el).value.trim(), city: $('#k_c', el).value.trim(), type: $('#k_t', el).value, created: Date.now() }); DB.save(); m.close(); toast(t('saved')); render(); }
    });
  }
  function customerModal(id) {
    const c = DB.customer(id); if (!c) return; const st = custStats(c);
    const orders = D().sales.filter(s => s.customerId === id).sort((a, b) => b.date - a.date);
    modal({
      title: esc(c.name), wide: true,
      body: `<div class="grid g-3" style="margin-bottom:16px">${kpi('orders', 'tone-info', t('orders_n'), `<span class="num">${st.n}</span>`, '')}${kpi('finance', 'tone-ok', t('total_spent'), big(st.spent), '')}${kpi('phone', 'tone-brand', t('phone'), `<span style="font-size:16px">${esc(c.phone || '—')}</span>`, `<span>${esc(c.city)} · ${t(c.type)}</span>`)}</div>
        <div class="card" style="box-shadow:none"><div class="table-wrap">${ordersTable(orders, true)}</div></div>`,
      onMount: (el, m) => $$('[data-oid]', el).forEach(tr => tr.onclick = () => { m.close(); orderModal(tr.dataset.oid); })
    });
  }

  // =====================================================
  // REPORTS
  // =====================================================
  function viewReports(v) {
    const r = range(state.repRange);
    const sales = inRange(revenueSales(), r.from, r.to);
    const agg = {};
    sales.forEach(s => s.items.forEach(it => { const a = agg[it.pid] || (agg[it.pid] = { pid: it.pid, name: it.name, sku: it.sku, qty: 0, rev: 0, cost: 0 }); a.qty += it.qty; a.rev += it.qty * it.price; a.cost += it.qty * it.cost; }));
    const best = Object.values(agg).sort((a, b) => b.rev - a.rev);
    const brand = {}; best.forEach(b => { const p = DB.product(b.pid); const k = p ? p.brand : '—'; brand[k] = (brand[k] || 0) + b.rev; });
    const gov = {}; sales.filter(s => s.channel === 'online').forEach(s => gov[s.city || '—'] = (gov[s.city || '—'] || 0) + 1);
    const wd = [0, 0, 0, 0, 0, 0, 0]; sales.forEach(s => wd[new Date(s.date).getDay()] += DB.netSales(s));
    const src = {}; sales.forEach(s => src[s.source] = (src[s.source] || 0) + DB.netSales(s));
    const S = summarize(sales);
    v.innerHTML = `
      <div class="page-head"><div><h2>${t('reports')}</h2><p>${fDate(r.from)} – ${fDate(r.to)} · ${S.n} ${t('orders_n').toLowerCase()} · ${moneyTxt(S.net, 0)}</p></div><div class="actions">${rangeSeg(state.repRange, 'rseg')}<button class="btn" id="rexp">${icon('download')}${t('export_csv')}</button></div></div>
      <div class="grid g-2">
        <div class="card"><div class="card-h"><h3>${t('sales_by_brand')}</h3></div><div class="card-b"><div class="chart-box"><canvas id="cBrand"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('sales_by_gov')}</h3></div><div class="card-b"><div class="chart-box"><canvas id="cGov"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>${I18N.lang === 'ar' ? 'المبيعات حسب اليوم' : 'Sales by weekday'}</h3></div><div class="card-b"><div class="chart-box sm"><canvas id="cWd"></canvas></div></div></div>
        <div class="card"><div class="card-h"><h3>${t('source')}</h3></div><div class="card-b"><div class="chart-box sm"><canvas id="cSrc"></canvas></div></div></div>
      </div>
      <div class="card mt"><div class="card-h"><h3>${t('best_sellers')}</h3></div><div class="card-b" style="padding:12px 0 0"><div class="table-wrap">
        ${best.length ? `<table class="t"><thead><tr><th>#</th><th>${t('product')}</th><th class="r">${t('qty')}</th><th class="r">${t('revenue')}</th><th class="r">${t('gross_profit')}</th><th class="r">${t('margin')}</th></tr></thead><tbody>
        ${best.slice(0, 20).map((b, i) => `<tr><td class="faint num">${i + 1}</td><td><div class="strong">${esc(b.name)}</div><div class="faint" style="font-size:12px">${esc(b.sku)}</div></td><td class="r num">${b.qty}</td><td class="r strong">${money(b.rev)}</td><td class="r">${money(b.rev - b.cost)}</td><td class="r muted num">${pct((b.rev - b.cost) / b.rev * 100)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div></div>`;
    bindSeg('rseg', k => { state.repRange = k; render(); });
    $('#rexp').onclick = () => exportSales(sales, 'sales-report');
    const hbar = (el, entries, color, isMoney) => chart(el, { type: 'bar', data: { labels: entries.map(e => e[0]), datasets: [{ data: entries.map(e => e[1]), backgroundColor: color, borderRadius: 4, barThickness: 14 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: cssVar('--border') }, border: { display: false }, ticks: { callback: isMoney ? moneyTick : undefined, precision: 0 } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: (c) => ' ' + (isMoney ? moneyTxt(c.parsed.x) : c.parsed.x) } } } } });
    hbar($('#cBrand'), Object.entries(brand).sort((a, b) => b[1] - a[1]).slice(0, 10), cssVar('--c1'), true);
    hbar($('#cGov'), Object.entries(gov).sort((a, b) => b[1] - a[1]), cssVar('--c2'), false);
    const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(locale(), { weekday: 'short' })); // Nov 1 2026 = Sunday
    chart($('#cWd'), { type: 'bar', data: { labels: days, datasets: [{ label: t('net_sales'), data: wd, backgroundColor: cssVar('--c3'), borderRadius: 4, maxBarThickness: 30 }] }, options: { scales: barAxes(false), plugins: { tooltip: tipMoney } } });
    const sk = Object.keys(src);
    chart($('#cSrc'), { type: 'doughnut', data: { labels: sk.map(srcLabel), datasets: [{ data: sk.map(k => src[k]), backgroundColor: ['--c1', '--c2', '--c7', '--c3'].map(cssVar), borderWidth: 0, spacing: 2 }] }, options: { cutout: '62%', plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 10, boxHeight: 10 } }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${moneyTxt(c.parsed)}` } } } } });
  }

  // =====================================================
  // AI ADVISOR
  // =====================================================
  const SUGGEST = {
    en: ['Analyze my business for the last 30 days and give me the 5 most important actions.', 'Which products should I reorder this week, and how many?', 'How can I grow online sales on Instagram and WhatsApp?', 'Which items should I put on offer to free up cash?', 'Where am I losing money? Review my expenses and margins.'],
    ar: ['حلّل نشاطي التجاري لآخر 30 يومًا وأعطني أهم 5 إجراءات.', 'ما المنتجات التي يجب أن أعيد طلبها هذا الأسبوع وبأي كمية؟', 'كيف أزيد المبيعات الإلكترونية عبر إنستغرام وواتساب؟', 'ما الأصناف التي يجب أن أضعها في عرض لتحرير السيولة؟', 'أين أخسر المال؟ راجع مصروفاتي وهوامش الربح.']
  };
  function viewAdvisor(v) {
    const ins = AI.insights(I18N.lang);
    const hasKey = !!AI.getKey();
    const scoreColor = ins.score >= 70 ? 'var(--ok)' : ins.score >= 45 ? 'var(--warn)' : 'var(--bad)';
    const lvlIcon = { good: ['check', 'tone-ok'], warn: ['alert', 'tone-warn'], bad: ['alert', 'tone-bad'], info: ['reports', 'tone-info'] };
    v.innerHTML = `
      <div class="page-head"><div><h2>${icon('sparkle')} ${t('advisor')}</h2><p>${t('overview_sub')}</p></div>
        <div class="actions"><div class="seg" id="aseg">${[[30, t('last_30')], [90, t('last_90')]].map(([k, l]) => `<button data-k="${k}" class="${state.advDays === k ? 'on' : ''}">${l}</button>`).join('')}</div><button class="btn primary" id="genRep">${icon('reports')}${t('gen_report')}</button></div></div>
      ${hasKey ? '' : `<div class="notice" style="margin-bottom:16px">${icon('sparkle')}<div>${t('no_key')} <a href="#/settings" style="text-decoration:underline;font-weight:700">${t('settings')} →</a></div></div>`}
      <div class="grid adv">
        <div>
          <div class="card"><div class="card-b" style="display:flex;gap:18px;align-items:center">
            <div class="ring" style="--v:${ins.score};--c:${scoreColor}"><b>${ins.score}</b><span>/100</span></div>
            <div><h3 style="margin:0 0 4px">${t('health')}</h3><p class="muted" style="margin:0">${t('net_sales')} ${moneyTxt(ins.snap.totals.net_sales, 0)} · ${t('gross_profit')} ${moneyTxt(ins.snap.totals.gross_profit, 0)} · ${ins.snap.totals.orders} ${t('orders_n').toLowerCase()}</p></div></div></div>
          <div class="card mt"><div class="card-h"><h3>${t('insights')}</h3></div><div class="card-b">
            <ul class="mini-list">${ins.items.map(i => `<li style="align-items:flex-start"><span class="ic-wrap ${lvlIcon[i.level][1]}" style="width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex:none">${icon(lvlIcon[i.level][0])}</span><div class="grow"><div class="strong">${esc(i.title)}</div><div class="muted" style="font-size:13px">${esc(i.text)}</div>${i.action ? `<div style="font-size:13px;color:var(--brand);font-weight:600;margin-top:2px">→ ${esc(i.action)}</div>` : ''}</div>${hasKey ? `<button class="btn sm ghost" data-why="${esc(i.title)}" title="${t('ask_ai')}">${icon('sparkle')}</button>` : ''}</li>`).join('')}</ul></div></div>
        </div>
        <div class="card chat"><div class="card-h"><h3>${icon('sparkle')} ${t('ask_ai')}</h3>${state.chat.length ? `<button class="btn sm ghost" id="clrChat">${t('clear_chat')}</button>` : ''}</div>
          <div class="chat-log" id="chatLog"></div>
          <div class="chips" id="chips">${(SUGGEST[I18N.lang] || SUGGEST.en).map(q => `<button>${esc(q)}</button>`).join('')}</div>
          <form class="chat-in" id="chatForm"><textarea class="input" id="chatQ" rows="2" placeholder="${t('ask_ph')}"></textarea><button class="btn primary" id="chatSend" type="submit" aria-label="send">${icon('send')}</button></form>
        </div>
      </div>`;
    bindSeg('aseg', k => { state.advDays = +k; render(); });
    const log = $('#chatLog');
    const drawLog = (liveText) => {
      const msgs = state.chat.map(m => `<div class="msg ${m.role}">${m.role === 'assistant' ? `<div class="md">${AI.md(m.content)}</div>` : esc(m.content)}</div>`).join('');
      const live = state.aiBusy ? `<div class="msg assistant">${liveText ? `<div class="md">${AI.md(liveText)}</div>` : `<div class="typing"><i></i><i></i><i></i> ${t('thinking')}</div>`}</div>` : '';
      log.innerHTML = msgs + live || `<div class="empty">${icon('sparkle', 'big')}<p>${hasKey ? t('ask_ph') : t('no_key')}</p></div>`;
      log.scrollTop = log.scrollHeight;
      $('#chips').classList.toggle('hide', state.chat.length > 0);
      $('#chatSend').innerHTML = state.aiBusy ? icon('x') : icon('send');
      $('#chatSend').title = state.aiBusy ? t('stop') : '';
    };
    drawLog();
    const send = async (q) => {
      q = (q || '').trim();
      if (state.aiBusy) { state.aiBusy.abort(); return; }
      if (!q) return;
      if (!AI.getKey()) { toast(t('no_key')); location.hash = '#/settings'; return; }
      state.chat.push({ role: 'user', content: q });
      $('#chatQ').value = '';
      const ctrl = new AbortController(); state.aiBusy = ctrl; drawLog();
      try {
        const text = await AI.ask({ messages: state.chat, lang: I18N.lang, days: state.advDays, signal: ctrl.signal, onText: (txt) => { if ($('#chatLog') === log) drawLog(txt); } });
        state.chat.push({ role: 'assistant', content: text });
      } catch (e) {
        state.chat.push({ role: 'assistant', content: '⚠️ ' + AI.explainError(e, I18N.lang) });
      }
      state.aiBusy = null;
      if ($('#chatLog') === log) drawLog();
    };
    $('#chatForm').onsubmit = (e) => { e.preventDefault(); send($('#chatQ').value); };
    $('#chatQ').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send($('#chatQ').value); } };
    $$('#chips button').forEach(b => b.onclick = () => send(b.textContent));
    $$('[data-why]', v).forEach(b => b.onclick = () => send((I18N.lang === 'ar' ? 'اشرح هذه الملاحظة وما الذي يجب أن أفعله: ' : 'Explain this finding and what I should do about it: ') + b.dataset.why));
    if ($('#clrChat')) $('#clrChat').onclick = () => { if (state.aiBusy) state.aiBusy.abort(); state.chat = []; render(); };
    $('#genRep').onclick = () => reportModal(state.advDays);
  }

  function reportModal(days) {
    let aiHTML = '';
    const lang = I18N.lang;
    modal({
      title: `${t('gen_report')} · ${days === 90 ? t('last_90') : t('last_30')}`, wide: true,
      body: `<iframe id="repFrame" class="rep-frame" title="report"></iframe><div id="repStatus" class="muted" style="margin-top:8px;font-size:13px"></div>`,
      footer: `${AI.getKey() ? `<button class="btn" id="repAI" style="margin-inline-end:auto">${icon('sparkle')}${t('ai_summary')}</button>` : `<a class="faint" href="#/settings" data-close style="margin-inline-end:auto;font-size:12.5px">${icon('sparkle')} ${t('ai_key')} → ${t('settings')}</a>`}<button class="btn" id="repDl">${icon('download')}${t('download_html')}</button><button class="btn primary" id="repPrint">${icon('printer')}${t('print')} / PDF</button>`,
      onMount: (el, m) => {
        const frame = $('#repFrame', el);
        const draw = () => { frame.srcdoc = AI.reportHTML({ days, lang, aiHTML }); };
        draw();
        $('#repDl', el).onclick = () => download(`business-report-${new Date().toISOString().slice(0, 10)}.html`, AI.reportHTML({ days, lang, aiHTML }), 'text/html');
        $('#repPrint', el).onclick = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { const w = window.open('', '_blank'); if (w) { w.document.write(AI.reportHTML({ days, lang, aiHTML })); w.document.close(); w.print(); } } };
        const aiBtn = $('#repAI', el);
        if (aiBtn) aiBtn.onclick = async () => {
          aiBtn.disabled = true; $('#repStatus', el).innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${t('thinking')}`;
          const prompt = lang === 'ar'
            ? `اكتب ملخصًا تنفيذيًا لتقرير أداء آخر ${days} يومًا لمالك النشاط: (1) ملخص في 3–4 جمل، (2) ما الذي يسير بشكل جيد، (3) المخاطر والمشكلات، (4) أهم 5 توصيات مرتبة بالأولوية مع الأثر المتوقع، (5) أهداف مقترحة للشهر القادم. استخدم عناوين ونقاطًا مختصرة.`
            : `Write the executive summary for a ${days}-day business performance report for the owner: (1) a 3–4 sentence overview, (2) what is going well, (3) risks and problems, (4) the top 5 prioritised recommendations with expected impact, (5) suggested targets for next month. Use short headings and bullets.`;
          let last = 0;
          try {
            const text = await AI.ask({ messages: [{ role: 'user', content: prompt }], lang, days, onText: (txt) => { aiHTML = AI.md(txt); if (Date.now() - last > 700) { last = Date.now(); draw(); } } });
            aiHTML = AI.md(text); draw(); $('#repStatus', el).textContent = '✓';
          } catch (e) { $('#repStatus', el).textContent = '⚠️ ' + AI.explainError(e, lang); aiBtn.disabled = false; }
        };
      }
    });
  }

  // =====================================================
  // SETTINGS
  // =====================================================
  function viewSettings(v) {
    const s = D().settings;
    const f = (k, lbl, type) => `<div class="field"><label>${lbl}</label><input class="input" id="st_${k}" type="${type || 'text'}" value="${esc(s[k])}"></div>`;
    v.innerHTML = `
      <div class="page-head"><div><h2>${t('settings')}</h2></div></div>
      <div class="grid g-21">
        <div class="card"><div class="card-h"><h3>${t('business_info')}</h3></div><div class="card-b">
          <div class="form-grid">${f('name', t('business_name'))}${f('tagline', t('tagline'))}${f('phone', t('phone'))}${f('email', t('email'), 'email')}${f('address', t('address'))}${f('cr', t('cr_no'))}${f('vat', t('vat_rate'), 'number')}${f('currency', 'Currency')}</div>
          <h3 style="margin:22px 0 12px;font-size:15px">${icon('store')} ${t('store_settings')}</h3>
          <div class="form-grid">${f('whatsapp', t('whatsapp_no'))}${f('shipping', `${t('ship_fee')} (${s.currency})`, 'number')}${f('freeShipOver', `${t('free_ship')} (${s.currency})`, 'number')}<div></div>
            <div class="field full"><label>${t('hero_title')}</label><input class="input" id="st_heroTitle" value="${esc(s.heroTitle || '')}"></div>
            <div class="field full"><label>${t('hero_text')}</label><textarea class="input" id="st_heroText" rows="2">${esc(s.heroText || '')}</textarea></div></div>
          <div class="actions mt"><button class="btn primary" id="st_save">${icon('check')}${t('save')}</button><a class="btn" href="index.html" target="_blank" rel="noopener">${icon('external')}${t('open_store')}</a></div></div></div>
        <div>
          <div class="card"><div class="card-h"><h3>${t('language')} & ${t('theme')}</h3></div><div class="card-b">
            <div class="field"><label>${t('language')}</label><div class="seg" id="st_lang"><button data-k="en" class="${I18N.lang === 'en' ? 'on' : ''}">English</button><button data-k="ar" class="${I18N.lang === 'ar' ? 'on' : ''}">العربية</button></div></div>
            <div class="field mt"><label>${t('theme')}</label><div class="seg" id="st_theme"><button data-k="light" class="${s.theme !== 'dark' ? 'on' : ''}">${t('light')}</button><button data-k="dark" class="${s.theme === 'dark' ? 'on' : ''}">${t('dark')}</button></div></div></div></div>
          <div class="card mt"><div class="card-h"><h3>${icon('sparkle')} ${t('ai_key')}</h3>${AI.getKey() ? `<span class="pill s-delivered">ON</span>` : ''}</div><div class="card-b">
            <p class="muted" style="margin:0 0 10px">${t('ai_key_help')}</p>
            <div class="actions"><input class="input" id="st_key" type="password" autocomplete="off" placeholder="${AI.getKey() ? '•••••••• ' + esc(AI.getKey().slice(-4)) : 'sk-ant-…'}" style="flex:1;min-width:180px"><button class="btn primary" id="st_keysave">${t('save')}</button>${AI.getKey() ? `<button class="btn danger" id="st_keyrm">${t('remove_key')}</button>` : ''}</div></div></div>
          <div class="card mt"><div class="card-h"><h3>${t('data_mgmt')}</h3></div><div class="card-b">
            <div class="notice">${icon('alert')}<div>${t('unpaid_note')}</div></div>
            <div class="actions mt"><button class="btn" id="st_bk">${icon('download')}${t('backup')}</button><label class="btn">${icon('upload')}${t('restore')}<input type="file" id="st_rs" accept=".json,application/json" hidden></label><button class="btn danger" id="st_reset">${icon('refresh')}${t('reset_demo')}</button></div></div></div>
        </div>
      </div>`;
    $('#st_save').onclick = () => { ['name', 'tagline', 'phone', 'email', 'address', 'cr', 'currency', 'whatsapp', 'heroTitle', 'heroText'].forEach(k => s[k] = $('#st_' + k).value.trim()); ['vat', 'shipping', 'freeShipOver'].forEach(k => s[k] = Math.max(0, parseFloat($('#st_' + k).value) || 0)); DB.save(); toast(t('saved')); render(); };
    $('#st_keysave').onclick = () => { const k = $('#st_key').value.trim(); if (!k) return; AI.setKey(k); toast(t('saved')); render(); };
    if ($('#st_keyrm')) $('#st_keyrm').onclick = () => { AI.setKey(''); toast(t('deleted')); render(); };
    bindSeg('st_lang', k => setLang(k));
    bindSeg('st_theme', k => setTheme(k));
    $('#st_bk').onclick = () => download(`business-hub-backup-${new Date().toISOString().slice(0, 10)}.json`, DB.exportJSON(), 'application/json');
    $('#st_rs').onchange = (e) => { const file = e.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { DB.importJSON(rd.result); toast(t('saved')); render(); } catch (er) { alert(er.message); } }; rd.readAsText(file); };
    $('#st_reset').onclick = () => confirmBox(t('reset_demo') + '?', () => { DB.reset(); state.cart = []; toast(t('saved')); render(); });
  }

  function setLang(l) { D().settings.lang = l; DB.save(); I18N.set(l); render(); }
  function setTheme(th) { D().settings.theme = th; DB.save(); document.documentElement.dataset.theme = th; render(); }

  const VIEWS = { advisor: viewAdvisor, dashboard: viewDashboard, pos: viewPOS, orders: viewOrders, inventory: viewInventory, purchases: viewPurchases, finance: viewFinance, customers: viewCustomers, reports: viewReports, settings: viewSettings };

  // ---------------- boot ----------------
  $('#menuBtn').onclick = () => $('#app').classList.toggle('nav-open');
  $('#scrim').onclick = () => $('#app').classList.remove('nav-open');
  $('#langBtn').onclick = () => setLang(I18N.lang === 'ar' ? 'en' : 'ar');
  $('#themeBtn').onclick = () => {
    const isDark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark ? 'light' : 'dark');
  };
  window.addEventListener('hashchange', go);
  // live update when an order arrives from the storefront in another tab
  window.addEventListener('db:change', (e) => { if (e.detail && e.detail.external && !document.querySelector('.overlay')) { render(); if (route !== 'pos') toast(I18N.lang === 'ar' ? 'تم تحديث البيانات' : 'New activity received'); } });
  go();
})();
