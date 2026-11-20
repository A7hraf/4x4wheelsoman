/* ============================================================
   4x4 Wheels Oman – suppliers, sourcing, team and approvals
   ------------------------------------------------------------
   Suppliers     each supplier's page: what to buy now (for customer orders and
                 restocking), supplier orders, history, products and how to buy.
   Sourcing      search the suppliers' online catalogues, pick products to sell,
                 set your margin and selling price, watch supplier price changes.
   Team          employee accounts with detailed permissions, performance, activity.
   Approvals     changes employees asked for, waiting for the owner.
   Team and Approvals need the online server (assets/js/config.js); the rest also
   works with data kept on one device.
   ============================================================ */
(function () {
  'use strict';
  I18N.add('en', {
    sourcing: 'Supplier catalog', team: 'Team', approvals: 'Approvals', suppliers: 'Suppliers',
    to_buy: 'To buy', sup_orders: 'Supplier orders', history: 'History', products: 'Products', how_to_buy: 'How to buy'
  });
  I18N.add('ar', {
    sourcing: 'كتالوج الموردين', team: 'الفريق', approvals: 'الموافقات', suppliers: 'الموردون',
    to_buy: 'للشراء', sup_orders: 'طلبات الموردين', history: 'السجل', products: 'المنتجات', how_to_buy: 'طريقة الشراء'
  });

  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS, ROUTES, TABS) {
    const { D, t, $, $$, esc, fmt, money, moneyTxt, modal, toast, confirmBox, fDate, fDT, kpi, statusPill, thumb, download, csv, chart, cssVar, state } = H;
    const L = (en, ar) => (I18N.lang === 'ar' ? ar : en);
    const online = () => !!(window.Auth && Auth.mode === 'server');
    const can = (m, l) => !online() || Auth.can(m, l || 'view');
    const isOwner = () => !online() || Auth.isOwner();
    const seesCosts = () => !online() || Auth.seesCosts();
    const r3 = DB.r3;
    const ago = (ts) => { if (!ts) return '—'; const s = (Date.now() - ts) / 1000; if (s < 60) return L('just now', 'الآن'); if (s < 3600) return Math.round(s / 60) + L(' min ago', ' د'); if (s < 86400) return Math.round(s / 3600) + L(' h ago', ' س'); return fDate(ts); };
    const routeIs = (id) => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'dashboard') === id;

    // ---------- async data cache (server calls) ----------
    const cache = {};
    function load(key, fn, maxAge) {
      const c = cache[key];
      if (c && !c.loading && Date.now() - c.at < (maxAge == null ? 30000 : maxAge)) return c;
      if (!c || !c.loading) {
        const route = location.hash;
        cache[key] = Object.assign(c || {}, { loading: true });
        fn().then(d => { cache[key] = { at: Date.now(), data: d }; }).catch(e => { cache[key] = { at: Date.now(), err: e.message }; })
          .then(() => { if (location.hash !== route) return; if (document.querySelector('.overlay')) pendingRender = true; else H.render(); });
      }
      return cache[key];
    }
    // a refresh that arrives while a window is open waits until it closes
    let pendingRender = false;
    new MutationObserver(() => { if (pendingRender && !document.querySelector('.overlay')) { pendingRender = false; H.render(); } }).observe(document.body, { childList: true });
    window.addEventListener('db:change', (e) => { if (e.detail && e.detail.external && document.querySelector('.overlay')) pendingRender = true; });
    const drop = (prefix) => Object.keys(cache).forEach(k => { if (k.startsWith(prefix)) delete cache[k]; });
    const spinner = `<div class="empty"><span class="typing"><i></i><i></i><i></i></span></div>`;
    const errBox = (m) => `<div class="notice">${icon('alert')}<div>${esc(m)}</div></div>`;

    // =====================================================
    // SUPPLIERS: settings, costs and prices
    // =====================================================
    const FX = { OMR: 1, AED: 0.1047, USD: 0.3845, SAR: 0.1025, QAR: 0.1056, EUR: 0.42, KWD: 1.25, BHD: 1.02 };
    const PLAT = { shopify: L('Automatic · Shopify', 'تلقائي · Shopify'), magento: L('Automatic · Magento', 'تلقائي · Magento'), manual: L('Manual (link + price)', 'يدوي (رابط + سعر)') };
    // The owner's real suppliers (from the websites he buys from)
    const KNOWN = [
      { name: 'AM Wrangler', website: 'https://am-wrangler.com', platform: 'shopify', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'Shopify online shop. Use "Open cart on website" to get a ready cart with the items, or send the list on WhatsApp. Prices on the site are in AED.' },
      { name: 'Offroad Zone', website: 'https://www.offroad-zone.com/en', platform: 'magento', currency: 'AED', addVatPct: 5, country: 'UAE', howToOrder: 'Online shop (prices shown without 5% UAE VAT). Order on the website or send the list on WhatsApp.' },
      { name: 'Titan Performance', website: 'https://titanperformanceuae.com', platform: 'manual', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'The website shows prices that may not be accurate. Confirm price and stock by WhatsApp/phone before ordering. Add products by pasting the product link and the confirmed price.' },
      { name: 'Ramy Automotive', website: 'https://www.ramyautomotive.com', platform: 'manual', currency: 'AED', addVatPct: 0, country: 'UAE', howToOrder: 'Add products by pasting the product link and price. Confirm stock before ordering.' }
    ];
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
    const sup = (s) => Object.assign({ platform: 'manual', currency: 'AED', addVatPct: 0, fxRate: 0, shippingPct: 10, fixedFee: 0, leadDays: 7, defaultMarkup: 35, roundTo: 1, active: true, website: '', contact: '', phone: '', whatsapp: '', email: '', howToOrder: '', paymentTerms: '', minOrder: 0, notes: '' }, s || {});
    const fxOf = (s) => (+s.fxRate > 0 ? +s.fxRate : (FX[s.currency] || 1));
    // landed cost in OMR of one item bought at `price` (supplier currency)
    const landed = (s, price) => { s = sup(s); return r3((+price || 0) * (1 + (+s.addVatPct || 0) / 100) * fxOf(s) * (1 + (+s.shippingPct || 0) / 100) + (+s.fixedFee || 0)); };
    const roundUp = (x, step) => (step > 0 ? Math.ceil(x / step - 1e-9) * step : x);
    const sellPrice = (cost, markup, step) => r3(roundUp(cost * (1 + (+markup || 0) / 100), +step || 0));
    const supName = (id) => (DB.supplier(id) || {}).name || L('No supplier', 'بدون مورد');
    const sourceOf = (p, sid) => (p.sources || []).find(x => x.supplierId === sid);
    const curTxt = (n, c) => `${c || 'AED'} ${fmt(n, 2)}`;

    // lines in customer orders that still have to be bought (not in stock, no supplier order yet)
    function buyLines(sid) {
      const out = [];
      D().sales.forEach(s => {
        if (!DB.countsAsRevenue(s)) return;
        (s.items || []).forEach(it => { if (it.toBuy > 0 && !it.poId && (sid === undefined || (it.supplierId || '') === sid)) out.push({ s, it }); });
      });
      return out.sort((a, b) => a.s.date - b.s.date);
    }
    const restockFor = (sid) => AI.reorderPlan().filter(r => { const p = DB.product(r.pid); const src = p && DB.preferredSource(p); return src && src.supplierId === sid; });
    const openPOs = (sid) => D().purchases.filter(p => p.status === 'ordered' && (!sid || p.supplierId === sid));
    const unitCost = (p, s) => { const src = sourceOf(p, s.id); return src && src.price ? landed(s, src.price) : (+p.cost || 0); };

    function createPO(s, lines, note) {
      const po = { id: DB.uid('po'), no: DB.nextNo('PO-', 300), date: Date.now(), supplierId: s.id, status: 'ordered', note: note || '', items: [] };
      lines.forEach(l => {
        let it = po.items.find(x => x.pid === l.pid);
        if (!it) { const p = DB.product(l.pid) || {}; const src = sourceOf(p, s.id) || {}; it = { pid: l.pid, qty: 0, cost: r3(l.cost != null ? l.cost : unitCost(p, s)), supSku: src.sku || '', supPrice: src.price || null, url: src.url || '', forSales: [] }; po.items.push(it); }
        it.qty += l.qty;
        if (l.sale) it.forSales.push({ id: l.sale.id, no: l.sale.no, qty: l.qty });
      });
      po.total = r3(po.items.reduce((a, i) => a + i.qty * i.cost, 0));
      D().purchases.push(po);
      lines.forEach(l => { if (l.line) l.line.poId = po.id; });
      DB.save();
      return po;
    }
    function orderText(s, po) {
      s = sup(s);
      const lines = po.items.map(i => { const p = DB.product(i.pid) || {}; return `• ${i.qty} × ${p.name || i.pid}${i.supSku ? ` — ${L('code', 'رمز')} ${i.supSku}` : ''}${i.url ? `\n  ${i.url}` : ''}`; });
      return L(`Hello${s.contact ? ' ' + s.contact : ''}, new order from ${D().settings.name} (${po.no}):\n\n${lines.join('\n')}\n\nPlease confirm price, availability and delivery date. Thank you.`,
        `مرحباً${s.contact ? ' ' + s.contact : ''}، طلب جديد من ${D().settings.name} (${po.no}):\n\n${lines.join('\n')}\n\nيرجى تأكيد السعر والتوفر وموعد التسليم. شكراً.`);
    }
    // Shopify can open a ready cart: /cart/VARIANT:QTY,VARIANT:QTY
    function cartLink(s, po) {
      if (sup(s).platform !== 'shopify') return '';
      const parts = po.items.map(i => { const m = /[?&]variant=(\d+)/.exec(i.url || ''); return m ? `${m[1]}:${i.qty}` : null; });
      if (!parts.length || parts.some(x => !x)) return '';
      try { return new URL(s.website).origin + '/cart/' + parts.join(','); } catch (e) { return ''; }
    }
    const waLink = (num, text) => `https://wa.me/${String(num || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;
    function sendPOModal(po) {
      const s = sup(DB.supplier(po.supplierId)); const text = orderText(s, po); const cart = cartLink(s, po);
      modal({
        title: `${L('Send order', 'إرسال الطلب')} ${esc(po.no)} → ${esc(s.name)}`,
        body: `${s.howToOrder ? `<div class="notice">${icon('file')}<div><b>${L('How to buy from this supplier', 'طريقة الشراء من هذا المورد')}</b><br>${esc(s.howToOrder)}</div></div>` : ''}
          <div class="field mt"><label>${L('Message', 'الرسالة')}</label><textarea class="input" id="po_txt" rows="9" dir="auto">${esc(text)}</textarea></div>
          <div class="actions mt">
            ${s.whatsapp || s.phone ? `<a class="btn wa" id="po_wa" target="_blank" rel="noopener" href="${esc(waLink(s.whatsapp || s.phone, text))}">${H.WA || icon('whatsapp')}WhatsApp</a>` : ''}
            ${s.email ? `<a class="btn" id="po_mail" href="mailto:${esc(s.email)}?subject=${encodeURIComponent(po.no)}&body=${encodeURIComponent(text)}">${icon('send')}Email</a>` : ''}
            ${cart ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(cart)}">${icon('cart')}${L('Open cart on website', 'فتح السلة في الموقع')}</a>` : ''}
            ${s.website && !cart ? `<a class="btn" target="_blank" rel="noopener" href="${esc(s.website)}">${icon('external')}${L('Supplier website', 'موقع المورد')}</a>` : ''}
            <button class="btn" id="po_copy">${icon('file')}${L('Copy', 'نسخ')}</button></div>
          ${!s.whatsapp && !s.phone && !s.email ? `<p class="faint" style="font-size:12.5px">${L('Add the supplier\'s WhatsApp or email in "How to buy" to send with one tap.', 'أضف واتساب أو بريد المورد في "طريقة الشراء" للإرسال بضغطة.')}</p>` : ''}`,
        footer: `<button class="btn" data-close>${t('close')}</button>`,
        onMount: (el) => {
          const upd = () => { const v = $('#po_txt', el).value; if ($('#po_wa', el)) $('#po_wa', el).href = waLink(s.whatsapp || s.phone, v); if ($('#po_mail', el)) $('#po_mail', el).href = `mailto:${s.email}?subject=${encodeURIComponent(po.no)}&body=${encodeURIComponent(v)}`; };
          $('#po_txt', el).oninput = upd;
          $('#po_copy', el).onclick = async () => { try { await navigator.clipboard.writeText($('#po_txt', el).value); toast(L('Copied', 'تم النسخ')); } catch (e) { $('#po_txt', el).select(); } };
          if (!po.sentAt) { const live = D().purchases.find(x => x.id === po.id); if (live) { $$('a.btn', el).forEach(a => a.addEventListener('click', () => { if (!live.sentAt) { live.sentAt = Date.now(); DB.save(); } })); } }
        }
      });
    }
    function receivePO(po) {
      const n = po.items.reduce((a, i) => a + (i.forSales || []).reduce((b, f) => b + f.qty, 0), 0);
      confirmBox(L(`Mark ${po.no} as received? Stock goes up${n ? `; ${n} item(s) go straight to the waiting customer orders` : ''}, and the cost is recorded.`, `تأكيد استلام ${po.no}؟ سيزيد المخزون${n ? ` وستذهب ${n} قطعة مباشرة لطلبات العملاء المنتظرة` : ''} وتُسجّل التكلفة.`), () => { DB.receivePurchase(po.id); toast(t('st_received')); H.render(); }, t('receive'));
    }
    function cancelPO(po) {
      confirmBox(L(`Cancel supplier order ${po.no}? Customer order lines in it go back to "To buy".`, `إلغاء طلب المورد ${po.no}؟ تعود بنود طلبات العملاء فيه إلى "للشراء".`), () => {
        po.status = 'cancelled';
        D().sales.forEach(s => s.items.forEach(li => { if (li.poId === po.id) delete li.poId; }));
        DB.save(); toast(t('saved')); H.render();
      }, L('Cancel order', 'إلغاء الطلب'));
    }

    // Line info in the order window: where it comes from and whether it's bought yet
    H.lineSource = (it) => {
      if (!it.toBuy && !it.supplierId) return '';
      const po = it.poId && D().purchases.find(p => p.id === it.poId);
      const st = it.arrived ? `<span class="pill s-delivered">${L('Arrived', 'وصل')}</span>` : po ? `<span class="pill s-processing">${esc(po.no)} · ${t('st_' + po.status)}</span>` : it.toBuy ? `<span class="pill s-new">${L('To buy', 'للشراء')}: ${it.toBuy}</span>` : '';
      return `<div class="line-src">${icon('factory')}<a href="#/suppliers/${esc(it.supplierId || '')}">${esc(supName(it.supplierId))}</a>${st}</div>`;
    };
    H.orderPeople = (s) => {
      const bits = [];
      if (s.createdByName) bits.push(`${L('Created by', 'أنشأه')} <b>${esc(s.createdByName)}</b>`);
      (s.statusLog || []).slice(-4).forEach(x => bits.push(`${t('st_' + x.s)} · ${esc(x.name)} · ${fDT(x.at)}`));
      return bits.length ? `<p class="faint people-line">${icon('users')} ${bits.join(' &nbsp;·&nbsp; ')}</p>` : '';
    };
    H.extraTodo = (add) => {
      if (can('suppliers') || can('purchases')) { const b = buyLines(); add(b.length, 'brand', 'factory', L('order lines to buy from suppliers', 'بنود طلبات يجب شراؤها من الموردين'), '#/suppliers', L('Buy', 'شراء')); }
      if (online() && isOwner()) add(Auth.inbox().pending, 'violet', 'inbox', L('employee requests waiting for your approval', 'طلبات موظفين بانتظار موافقتك'), '#/approvals', L('Review', 'مراجعة'));
    };

    // ---------- Suppliers page ----------
    VIEWS.suppliers = function (v) {
      if (state.sub) { const s = DB.supplier(state.sub); if (s) return supplierPage(v, s); }
      const list = D().suppliers.slice().sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
      const stats = online() && can('suppliers') ? load('supstats', () => Auth.api('GET', '/api/suppliers/stats')) : null;
      const st = (stats && stats.data && stats.data.stats) || {};
      const lines = buyLines();
      const noSup = lines.filter(l => !l.it.supplierId || !DB.supplier(l.it.supplierId));
      const known = KNOWN.filter(k => !D().suppliers.some(s => host(s.website) === host(k.website)));
      const mon = new Date(); mon.setDate(1); mon.setHours(0, 0, 0, 0);
      const spentMonth = D().purchases.filter(p => p.status !== 'cancelled' && p.date >= mon.getTime()).reduce((a, p) => a + (p.total || 0), 0);
      const edit = can('suppliers', 'request');
      v.innerHTML = `
        <div class="page-head"><div><h2>${t('suppliers')}</h2><p>${L('Who you buy from, what to buy now, and how.', 'من تشتري منه، وما يجب شراؤه الآن، وكيف.')}</p></div><div class="actions">${edit ? `<button class="btn primary" id="supNew">${icon('plus')}${L('Add supplier', 'إضافة مورد')}</button>` : ''}<a class="btn" href="#/sourcing">${icon('link')}${t('sourcing')}</a></div></div>
        <div class="grid g-kpi">
          ${kpi('cart', 'tone-brand', L('Lines to buy', 'بنود للشراء'), `<span class="num">${lines.length}</span>`, `<span>${lines.reduce((a, l) => a + l.it.toBuy, 0)} ${L('items for customer orders', 'قطعة لطلبات العملاء')}</span>`)}
          ${kpi('truck', 'tone-warn', L('Open supplier orders', 'طلبات موردين مفتوحة'), `<span class="num">${openPOs().length}</span>`, seesCosts() ? `<span>${moneyTxt(openPOs().reduce((a, p) => a + (p.total || 0), 0), 0)}</span>` : '')}
          ${seesCosts() ? kpi('wallet', 'tone-info', L('Bought this month', 'المشتريات هذا الشهر'), H.big(spentMonth), '') : ''}
          ${kpi('factory', 'tone-violet', t('suppliers'), `<span class="num">${list.filter(s => s.active !== false).length}</span>`, `<span>${list.filter(s => ['shopify', 'magento'].includes(s.platform)).length} ${L('synced automatically', 'متزامن تلقائياً')}</span>`)}
        </div>
        ${known.length && edit ? `<div class="notice mt">${icon('sparkle')}<div><b>${L('Add the suppliers you buy from', 'أضف الموردين الذين تشتري منهم')}</b><br>${known.map(k => esc(k.name)).join(' · ')}<div class="actions" style="margin-top:8px"><button class="btn sm primary" id="supKnown">${icon('plus')}${L('Add them', 'إضافتهم')}</button></div></div></div>` : ''}
        ${noSup.length ? `<div class="card mt"><div class="card-h"><h3>${icon('alert')} ${L('Order lines with no supplier', 'بنود بدون مورد')}</h3></div><div class="card-b" style="padding:8px 0 0"><div class="table-wrap"><table class="t"><thead><tr><th>${t('order')}</th><th>${t('product')}</th><th class="r">${L('To buy', 'للشراء')}</th><th>${t('supplier')}</th></tr></thead><tbody>
          ${noSup.map((l, i) => `<tr><td><a href="#" data-oid="${l.s.id}" class="strong">${esc(l.s.no)}</a><div class="faint">${esc(l.s.customerName)}</div></td><td>${esc(l.it.name)}</td><td class="r num">${l.it.toBuy}</td><td>${edit ? `<select class="input sm" data-assign="${i}"><option value="">${L('Choose…', 'اختر…')}</option>${list.filter(s => s.active !== false).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>` : '—'}</td></tr>`).join('')}</tbody></table></div></div></div>` : ''}
        <div class="sup-grid mt">${list.map(s0 => {
          const s = sup(s0), b = buyLines(s.id), o = openPOs(s.id), x = st[s.id] || {};
          const linked = D().products.filter(p => sourceOf(p, s.id)).length;
          return `<a class="card sup-card ${s.active === false ? 'off' : ''}" href="#/suppliers/${esc(s.id)}">
            <div class="sup-top"><span class="sup-logo">${esc(s.name.slice(0, 2).toUpperCase())}</span><div class="grow"><b>${esc(s.name)}</b><small>${esc(host(s.website) || s.country || '')}</small></div>${b.length ? `<span class="badge-big">${b.length}</span>` : ''}</div>
            <div class="sup-meta"><span class="pill plain ${s.platform === 'manual' ? '' : 's-delivered'}">${PLAT[s.platform] || s.platform}</span>${s.active === false ? `<span class="pill">${L('Inactive', 'غير نشط')}</span>` : ''}</div>
            <dl class="sup-nums"><div><dt>${L('To buy', 'للشراء')}</dt><dd>${b.reduce((a, l) => a + l.it.toBuy, 0)}</dd></div><div><dt>${L('Open orders', 'طلبات مفتوحة')}</dt><dd>${o.length}</dd></div><div><dt>${L('My products', 'منتجاتي')}</dt><dd>${linked}</dd></div>${x.items ? `<div><dt>${L('In catalog', 'في الكتالوج')}</dt><dd>${x.items}</dd></div>` : ''}</dl>
            ${x.lastRun ? `<div class="faint sup-sync">${x.lastRun.ok ? icon('check') : icon('alert')} ${L('Synced', 'مزامنة')} ${ago(x.lastRun.done || x.lastRun.at)}${x.lastRun.ok ? '' : ' · ' + L('failed', 'فشلت')}</div>` : ''}
          </a>`;
        }).join('') || `<div class="empty">${t('no_results')}</div>`}</div>`;
      if ($('#supNew')) $('#supNew').onclick = () => supplierForm();
      if ($('#supKnown')) $('#supKnown').onclick = () => { known.forEach(k => D().suppliers.push(Object.assign({ id: DB.uid('s'), phone: '', active: true }, sup(k), k))); DB.save(); toast(t('saved')); drop('supstats'); H.render(); };
      $$('[data-assign]', v).forEach(sel => sel.onchange = () => { const l = noSup[+sel.dataset.assign]; if (!sel.value) return; l.it.supplierId = sel.value; DB.save(); toast(t('saved')); H.render(); });
      $$('[data-oid]', v).forEach(a => a.onclick = (e) => { e.preventDefault(); H.orderModal(a.dataset.oid); });
    };

    function supplierPage(v, s0) {
      const s = sup(s0), tab = state.supTab || 'buy';
      const lines = buyLines(s.id), restock = restockFor(s.id), open = openPOs(s.id);
      const all = D().purchases.filter(p => p.supplierId === s.id).sort((a, b) => b.date - a.date);
      const prods = D().products.filter(p => sourceOf(p, s.id));
      const edit = can('purchases', 'request') || can('suppliers', 'request');
      const auto = ['shopify', 'magento'].includes(s.platform);
      const stats = online() && can('suppliers') ? load('supstats', () => Auth.api('GET', '/api/suppliers/stats')) : null;
      const x = (stats && stats.data && stats.data.stats && stats.data.stats[s.id]) || {};
      const tabs = [['buy', t('to_buy'), lines.length + restock.length], ['orders', t('sup_orders'), open.length], ['history', t('history'), 0], ['products', t('products'), prods.length], ['how', t('how_to_buy'), 0]];
      v.innerHTML = `
        <div class="page-head"><div><a class="back" href="#/suppliers">← ${t('suppliers')}</a><h2 style="display:block">${esc(s.name)}</h2><p>${esc(PLAT[s.platform] || '')}${s.website ? ` · <a href="${esc(s.website)}" target="_blank" rel="noopener">${esc(host(s.website))} ↗</a>` : ''}${s.leadDays ? ` · ${L('delivery', 'التوصيل')} ~${s.leadDays} ${L('days', 'يوم')}` : ''}</p></div>
          <div class="actions">${s.whatsapp || s.phone ? `<a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(s.whatsapp || s.phone, L('Hello', 'مرحباً')))}">${H.WA || icon('whatsapp')}WhatsApp</a>` : ''}${s.phone ? `<a class="btn" href="tel:${esc(s.phone)}">${icon('phone')}${t('phone')}</a>` : ''}${auto && online() && can('suppliers', 'edit') ? `<button class="btn" id="supSync">${icon('refresh')}${L('Sync catalog', 'مزامنة الكتالوج')}</button>` : ''}<a class="btn primary" href="#/sourcing" id="supBrowse">${icon('search')}${L('Find products', 'ابحث عن منتجات')}</a></div></div>
        ${x.lastRun ? `<p class="faint" style="margin:-6px 0 12px;font-size:12.5px">${x.items || 0} ${L('products in catalog', 'منتج في الكتالوج')} · ${L('last sync', 'آخر مزامنة')} ${ago(x.lastRun.done || x.lastRun.at)}${x.lastRun.ok === false ? ` · <span class="bad-t">${esc(x.lastRun.error || '')}</span>` : x.lastRun.changed ? ` · ${x.lastRun.changed} ${L('price changes', 'تغيير سعر')}` : ''}</p>` : ''}
        <div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n ? ` <span class="count">${n}</span>` : ''}</button>`).join('')}</div>
        <div id="supBody" class="mt"></div>`;
      const body = $('#supBody');
      $$('[data-tab]', v).forEach(b => b.onclick = () => { state.supTab = b.dataset.tab; H.render(); });
      if ($('#supBrowse')) $('#supBrowse').onclick = () => { state.srcSup = auto ? s.id : ''; state.srcTab = auto ? 'search' : 'mine'; };
      if ($('#supSync')) $('#supSync').onclick = async (e) => {
        const b = e.currentTarget; b.disabled = true; b.innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${L('Syncing… (a minute)', 'جارٍ المزامنة… (دقيقة)')}`;
        try { const r = await Auth.api('POST', `/api/suppliers/${encodeURIComponent(s.id)}/sync`); toast(L(`${r.total} products · ${r.added} new · ${r.changed} price changes`, `${r.total} منتج · ${r.added} جديد · ${r.changed} تغيير سعر`)); }
        catch (er) { alert(er.message); }
        drop('supstats'); drop('cat'); H.render();
      };

      if (tab === 'buy') {
        const cost = (p) => unitCost(p, s);
        body.innerHTML = `
          <div class="card"><div class="card-h"><h3>${icon('orders')} ${L('For customer orders', 'لطلبات العملاء')}</h3><span class="faint">${L('Sold but not in stock', 'مباعة وغير متوفرة')}</span></div><div class="card-b" style="padding:8px 0 0">
          ${lines.length ? `<div class="table-wrap"><table class="t"><thead><tr><th style="width:34px"><input type="checkbox" id="selAll" checked aria-label="all"></th><th>${t('order')}</th><th>${t('product')}</th><th>${L('Supplier code', 'رمز المورد')}</th><th class="r">${t('qty')}</th>${seesCosts() ? `<th class="r">${L('Est. cost', 'التكلفة المقدرة')}</th>` : ''}<th></th></tr></thead><tbody>
            ${lines.map((l, i) => { const p = DB.product(l.it.pid) || {}; const src = sourceOf(p, s.id) || {}; return `<tr><td><input type="checkbox" class="bl" data-i="${i}" checked></td><td><a href="#" data-oid="${l.s.id}" class="strong">${esc(l.s.no)}</a><div class="faint">${esc(l.s.customerName)} · ${fDate(l.s.date)}</div></td><td>${esc(l.it.name)}</td><td>${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.sku || L('link', 'رابط'))} ↗</a>` : esc(src.sku || l.it.supSku || '—')}</td><td class="r num strong">${l.it.toBuy}</td>${seesCosts() ? `<td class="r">${money(cost(p) * l.it.toBuy)}</td>` : ''}<td class="r"><button class="btn sm ghost" data-move="${i}" title="${L('Buy from another supplier', 'الشراء من مورد آخر')}">${icon('refresh')}</button></td></tr>`; }).join('')}
          </tbody></table></div>` : `<div class="empty">${icon('check')} ${L('Nothing waiting — every customer order line is in stock or already ordered.', 'لا شيء بالانتظار — كل بنود طلبات العملاء متوفرة أو تم طلبها.')}</div>`}</div></div>
          <div class="card mt"><div class="card-h"><h3>${icon('inventory')} ${L('Restock (running low)', 'إعادة التخزين (قارب على النفاد)')}</h3><span class="faint">${t('reorder_how')}</span></div><div class="card-b" style="padding:8px 0 0">
          ${restock.length ? `<div class="table-wrap"><table class="t"><thead><tr><th style="width:34px"></th><th>${t('product')}</th><th class="r">${t('stock')}</th><th class="r">${t('per_week')}</th><th class="r">${t('qty')}</th>${seesCosts() ? `<th class="r">${L('Est. cost', 'التكلفة المقدرة')}</th>` : ''}</tr></thead><tbody>
            ${restock.map((r, i) => { const p = DB.product(r.pid); return `<tr><td><input type="checkbox" class="rl" data-i="${i}" aria-label="${esc(p.name)}"></td><td><b>${esc(p.name)}</b>${r.urgent ? ` <span class="pill s-cancelled">${t('urgent')}</span>` : ''}<div class="faint">${esc(r.sku || '')}</div></td><td class="r num">${r.stock}${r.on_order ? ` <span class="faint">+${r.on_order}</span>` : ''}</td><td class="r num">${r.per_week}</td><td class="r"><input class="input sm num rq" data-i="${i}" type="number" min="1" value="${r.suggest}" style="width:72px"></td>${seesCosts() ? `<td class="r">${money(cost(p) * r.suggest)}</td>` : ''}</tr>`; }).join('')}
          </tbody></table></div>` : `<div class="empty">${L('No product from this supplier is running low.', 'لا يوجد منتج من هذا المورد قارب على النفاد.')}</div>`}</div></div>
          ${edit && (lines.length || restock.length) ? `<div class="sticky-act"><span id="selInfo" class="muted"></span><button class="btn primary" id="mkPO">${icon('truck')}${L('Create supplier order', 'إنشاء طلب مورد')}</button></div>` : ''}`;
        const picked = () => {
          const out = [];
          $$('.bl', body).forEach(c => { if (c.checked) { const l = lines[+c.dataset.i]; out.push({ pid: l.it.pid, qty: l.it.toBuy, sale: l.s, line: l.it }); } });
          $$('.rl', body).forEach(c => { if (c.checked) { const r = restock[+c.dataset.i]; const q = Math.max(1, parseInt($(`.rq[data-i="${c.dataset.i}"]`, body).value, 10) || r.suggest); out.push({ pid: r.pid, qty: q }); } });
          return out;
        };
        const info = () => { if (!$('#selInfo')) return; const p = picked(); $('#selInfo').textContent = p.length ? `${p.reduce((a, x) => a + x.qty, 0)} ${L('items selected', 'قطعة محددة')}` + (seesCosts() ? ' · ≈ ' + moneyTxt(p.reduce((a, x) => a + x.qty * cost(DB.product(x.pid)), 0)) : '') : L('Select items', 'حدد القطع'); };
        body.addEventListener('change', info); info();
        if ($('#selAll')) $('#selAll').onchange = (e) => { $$('.bl', body).forEach(c => { c.checked = e.target.checked; }); info(); };
        $$('[data-oid]', body).forEach(a => a.onclick = (e) => { e.preventDefault(); H.orderModal(a.dataset.oid); });
        $$('[data-move]', body).forEach(b => b.onclick = () => {
          const l = lines[+b.dataset.move];
          modal({ title: L('Buy from another supplier', 'الشراء من مورد آخر'), body: `<div class="field"><label>${t('supplier')}</label><select class="input" id="mv_s">${D().suppliers.filter(x => x.active !== false).map(x => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`, footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="mv_ok">${t('save')}</button>`, onMount: (el, m) => { $('#mv_ok', el).onclick = () => { l.it.supplierId = $('#mv_s', el).value; DB.save(); m.close(); toast(t('saved')); H.render(); }; } });
        });
        if ($('#mkPO')) $('#mkPO').onclick = () => {
          const p = picked(); if (!p.length) return toast(L('Select items first', 'حدد القطع أولاً'));
          if (s.minOrder && seesCosts()) { const tot = p.reduce((a, x) => a + x.qty * cost(DB.product(x.pid)), 0); if (tot < s.minOrder && !confirm(L(`This supplier's minimum order is ${moneyTxt(s.minOrder)}. Create anyway?`, `الحد الأدنى للطلب من هذا المورد ${moneyTxt(s.minOrder)}. هل تريد الإنشاء رغم ذلك؟`))) return; }
          const po = createPO(s, p);
          toast(`${po.no} · ${t('saved')}`); state.supTab = 'orders'; H.render();
          const live = D().purchases.find(x => x.id === po.id); if (live) sendPOModal(live);
        };
      }

      if (tab === 'orders') {
        body.innerHTML = open.length ? open.sort((a, b) => b.date - a.date).map(po => poCard(po, true)).join('') : `<div class="card"><div class="empty">${L('No open supplier orders.', 'لا توجد طلبات موردين مفتوحة.')}</div></div>`;
        bindPO(body);
      }

      if (tab === 'history') {
        const done = all.filter(p => p.status === 'received');
        const lead = done.filter(p => p.receivedAt).map(p => (p.receivedAt - p.date) / 864e5);
        const byMonth = {}; all.filter(p => p.status !== 'cancelled').forEach(p => { const k = new Date(p.date).toISOString().slice(0, 7); byMonth[k] = (byMonth[k] || 0) + (p.total || 0); });
        const months = Object.keys(byMonth).sort().slice(-12);
        body.innerHTML = `
          <div class="grid g-kpi">
            ${kpi('truck', 'tone-info', L('Orders', 'الطلبات'), `<span class="num">${all.length}</span>`, `<span>${done.length} ${t('st_received').toLowerCase()}</span>`)}
            ${seesCosts() ? kpi('wallet', 'tone-brand', L('Total bought', 'إجمالي المشتريات'), H.big(all.filter(p => p.status !== 'cancelled').reduce((a, p) => a + (p.total || 0), 0)), '') : ''}
            ${kpi('clock', 'tone-warn', L('Avg. delivery', 'متوسط التوصيل'), `<span class="num">${lead.length ? (lead.reduce((a, b) => a + b, 0) / lead.length).toFixed(1) : '—'}</span>`, `<span>${L('days', 'يوم')}</span>`)}
            ${kpi('orders', 'tone-violet', L('Customer orders served', 'طلبات عملاء خُدمت'), `<span class="num">${new Set(all.flatMap(p => p.items.flatMap(i => (i.forSales || []).map(f => f.id)))).size}</span>`, '')}
          </div>
          ${seesCosts() && months.length > 1 ? `<div class="card mt"><div class="card-h"><h3>${L('Bought per month', 'المشتريات شهرياً')}</h3></div><div class="card-b"><div style="height:200px"><canvas id="supChart"></canvas></div></div></div>` : ''}
          <div class="card mt"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap">${all.length ? `<table class="t"><thead><tr><th>PO</th><th>${t('date')}</th><th>${t('items')}</th>${seesCosts() ? `<th class="r">${t('total')}</th>` : ''}<th>${t('status')}</th><th>${L('Received', 'الاستلام')}</th></tr></thead><tbody>
            ${all.map(po => `<tr data-po="${po.id}" class="click"><td class="strong">${esc(po.no)}</td><td class="muted">${fDate(po.date)}</td><td class="muted">${po.items.map(i => i.qty + '× ' + esc((DB.product(i.pid) || {}).name || '')).join(', ')}</td>${seesCosts() ? `<td class="r">${money(po.total)}</td>` : ''}<td>${statusPill(po.status)}</td><td class="muted">${po.receivedAt ? fDate(po.receivedAt) : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div></div>`;
        if ($('#supChart')) chart($('#supChart'), { type: 'bar', data: { labels: months, datasets: [{ data: months.map(k => r3(byMonth[k])), backgroundColor: cssVar('--brand'), borderRadius: 6 }] }, options: { scales: { y: { beginAtZero: true } } } });
        $$('[data-po]', body).forEach(tr => tr.onclick = () => { const po = D().purchases.find(p => p.id === tr.dataset.po); if (po) poModal(po); });
      }

      if (tab === 'products') {
        const look = online() && prods.length && can('suppliers') ? load('lookup:' + s.id, () => Auth.api('POST', '/api/catalog/lookup', { refs: prods.map(p => ({ supplierId: s.id, sku: sourceOf(p, s.id).sku })).filter(r => r.sku) })) : null;
        const latest = {}; ((look && look.data && look.data.items) || []).forEach(i => { latest[i.sku] = i; });
        body.innerHTML = `<div class="card"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap">${prods.length ? `<table class="t"><thead><tr><th>${t('product')}</th><th>${L('Supplier code', 'رمز المورد')}</th>${seesCosts() ? `<th class="r">${L('Supplier price', 'سعر المورد')}</th><th class="r">${L('Landed cost', 'التكلفة الواصلة')}</th><th class="r">${L('My cost', 'تكلفتي')}</th>` : ''}<th class="r">${L('My price', 'سعري')}</th><th class="r">${t('stock')}</th><th></th></tr></thead><tbody>
          ${prods.map(p => { const src = sourceOf(p, s.id); const lt = latest[src.sku]; const moved = lt && lt.price != null && src.price && Math.abs(lt.price - src.price) > 0.001; return `<tr><td><b>${esc(p.name)}</b>${src.preferred || (p.sources || []).length === 1 ? ` <span class="pill plain s-delivered">${L('Preferred', 'المفضل')}</span>` : ''}${lt && lt.available === false ? ` <span class="pill s-cancelled">${L('Out of stock at supplier', 'غير متوفر لدى المورد')}</span>` : ''}</td><td>${src.url ? `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.sku || L('link', 'رابط'))} ↗</a>` : esc(src.sku || '—')}</td>${seesCosts() ? `<td class="r">${src.price ? curTxt(src.price, s.currency) : '—'}${moved ? `<div class="${lt.price > src.price ? 'bad-t' : 'ok-t'}" style="font-size:12px">${L('now', 'الآن')} ${curTxt(lt.price, s.currency)}</div>` : ''}</td><td class="r">${src.price ? money(landed(s, moved ? lt.price : src.price)) : '—'}</td><td class="r">${money(p.cost)}</td>` : ''}<td class="r strong">${money(p.price)}</td><td class="r num">${p.stock}</td><td class="r"><button class="btn sm" data-src="${p.id}">${icon('edit')}</button></td></tr>`; }).join('')}
          </tbody></table>` : `<div class="empty">${L('No products linked to this supplier yet. Use "Find products" to add some.', 'لا توجد منتجات مرتبطة بهذا المورد بعد. استخدم "ابحث عن منتجات" لإضافتها.')}</div>`}</div></div></div>`;
        $$('[data-src]', body).forEach(b => b.onclick = () => { const p = DB.product(b.dataset.src); const src = sourceOf(p, s.id); const lt = latest[src.sku]; sourceModal({ supplierId: s.id, sku: src.sku, url: src.url, title: src.title || p.name, price: lt && lt.price != null ? lt.price : src.price, currency: s.currency, available: lt ? lt.available : src.available }, p); });
      }

      if (tab === 'how') {
        const canEdit = can('suppliers', 'request');
        const f = (k, lbl, type, extra) => `<div class="field ${extra || ''}"><label>${lbl}</label><input class="input" id="sf_${k}" type="${type || 'text'}" value="${esc(s[k] == null ? '' : s[k])}" ${canEdit ? '' : 'disabled'}${type === 'number' ? ' step="any"' : ''}></div>`;
        body.innerHTML = `<div class="grid g-21">
          <div class="card"><div class="card-h"><h3>${icon('file')} ${t('how_to_buy')}</h3></div><div class="card-b">
            <div class="form-grid">${f('name', t('supplier'))}${f('website', L('Website', 'الموقع'), 'url')}
              ${f('contact', L('Contact person', 'الشخص المسؤول'))}${f('whatsapp', 'WhatsApp')}${f('phone', t('phone'))}${f('email', t('email'), 'email')}
              <div class="field full"><label>${L('How to order (steps, account, delivery, pick-up…)', 'طريقة الطلب (الخطوات، الحساب، التوصيل، الاستلام…)')}</label><textarea class="input" id="sf_howToOrder" rows="4" ${canEdit ? '' : 'disabled'}>${esc(s.howToOrder)}</textarea></div>
              ${f('paymentTerms', L('Payment terms', 'شروط الدفع'))}${f('leadDays', L('Delivery time (days)', 'مدة التوصيل (أيام)'), 'number')}
              <div class="field full"><label>${L('Notes', 'ملاحظات')}</label><textarea class="input" id="sf_notes" rows="2" ${canEdit ? '' : 'disabled'}>${esc(s.notes)}</textarea></div></div></div></div>
          <div><div class="card"><div class="card-h"><h3>${icon('wallet')} ${L('Costs & pricing', 'التكلفة والتسعير')}</h3></div><div class="card-b">
            <div class="form-grid">
              <div class="field"><label>${L('Catalog', 'الكتالوج')}</label><select class="input" id="sf_platform" ${canEdit ? '' : 'disabled'}>${Object.keys(PLAT).map(k => `<option value="${k}" ${s.platform === k ? 'selected' : ''}>${PLAT[k]}</option>`).join('')}</select></div>
              <div class="field"><label>${L('Currency', 'العملة')}</label><select class="input" id="sf_currency" ${canEdit ? '' : 'disabled'}>${Object.keys(FX).map(c => `<option ${s.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
              ${f('fxRate', L('Rate to OMR (empty = standard)', 'سعر الصرف إلى ر.ع (فارغ = القياسي)'), 'number')}${f('addVatPct', L('Add VAT to listed prices (%)', 'إضافة ضريبة على الأسعار المعروضة (%)'), 'number')}
              ${f('shippingPct', L('Shipping, customs & handling (%)', 'الشحن والجمارك والمناولة (%)'), 'number')}${f('fixedFee', L('Fixed cost per item (OMR)', 'تكلفة ثابتة لكل قطعة (ر.ع)'), 'number')}
              ${f('defaultMarkup', L('Default margin on cost (%)', 'هامش الربح الافتراضي على التكلفة (%)'), 'number')}${f('roundTo', L('Round selling prices up to (OMR)', 'تقريب سعر البيع إلى (ر.ع)'), 'number')}
              ${f('minOrder', L('Minimum order (OMR)', 'الحد الأدنى للطلب (ر.ع)'), 'number')}
              <div class="field"><label class="check"><input type="checkbox" id="sf_active" ${s.active !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> ${L('Active supplier', 'مورد نشط')}</label></div></div>
            <p class="faint" style="font-size:12.5px">${L('Example', 'مثال')}: 1,000 ${esc(s.currency)} → ${L('landed cost', 'التكلفة الواصلة')} <b>${moneyTxt(landed(s, 1000))}</b> → ${L('selling price', 'سعر البيع')} <b>${moneyTxt(sellPrice(landed(s, 1000), s.defaultMarkup, s.roundTo))}</b></p>
          </div></div>
          ${canEdit ? `<div class="actions mt"><button class="btn primary" id="sfSave">${icon('check')}${t('save')}</button>${online() && can('suppliers', 'edit') ? `<button class="btn" id="sfDetect">${icon('search')}${L('Detect catalog type', 'اكتشاف نوع الكتالوج')}</button>` : ''}<button class="btn ghost danger" id="sfDel">${icon('trash')}${t('delete')}</button></div>` : ''}</div></div>`;
        if ($('#sfSave')) $('#sfSave').onclick = () => {
          const live = DB.supplier(s.id); const g = (k) => $('#sf_' + k).value.trim(); const n = (k) => Math.max(0, parseFloat(g(k)) || 0);
          const web = g('website');
          if (web && !/^https:\/\/[^\s"'<>]+$/.test(web)) return alert(L('The website must start with https://', 'يجب أن يبدأ الموقع بـ https://'));
          Object.assign(live, { name: g('name') || live.name, website: web, contact: g('contact'), whatsapp: g('whatsapp').replace(/[^\d+]/g, ''), phone: g('phone'), email: g('email'), howToOrder: $('#sf_howToOrder').value.trim(), paymentTerms: g('paymentTerms'), leadDays: n('leadDays'), notes: $('#sf_notes').value.trim(), platform: $('#sf_platform').value, currency: $('#sf_currency').value, fxRate: n('fxRate'), addVatPct: n('addVatPct'), shippingPct: n('shippingPct'), fixedFee: n('fixedFee'), defaultMarkup: n('defaultMarkup'), roundTo: n('roundTo'), minOrder: n('minOrder'), active: $('#sf_active').checked });
          DB.save(); toast(t('saved')); H.render();
        };
        if ($('#sfDetect')) $('#sfDetect').onclick = async (e) => {
          const web = $('#sf_website').value.trim(); if (!web) return;
          e.currentTarget.disabled = true;
          try { const r = await Auth.api('POST', '/api/suppliers/detect', { url: web }); $('#sf_platform').value = r.platform; alert(r.note); } catch (er) { alert(er.message); }
          e.currentTarget.disabled = false;
        };
        if ($('#sfDel')) $('#sfDel').onclick = () => {
          if (open.length || lines.length) return alert(L('This supplier has open orders or lines to buy. Switch it to inactive instead.', 'لدى هذا المورد طلبات مفتوحة أو بنود للشراء. اجعله غير نشط بدلاً من ذلك.'));
          confirmBox(L(`Delete ${s.name}? Past supplier orders keep their history; product links to this supplier are removed.`, `حذف ${s.name}؟ تبقى طلبات المورد السابقة في السجل وتُزال روابط المنتجات بهذا المورد.`), () => {
            D().suppliers = D().suppliers.filter(x => x.id !== s.id);
            D().products.forEach(p => { if (p.sources) p.sources = p.sources.filter(x => x.supplierId !== s.id); });
            DB.save(); location.hash = '#/suppliers';
          });
        };
      }
    }
    function poCard(po, actions) {
      const s = sup(DB.supplier(po.supplierId));
      const edit = can('purchases', 'request');
      return `<div class="card po-card"><div class="card-h"><h3>${esc(po.no)} <span class="faint" style="font-weight:500">· ${fDate(po.date)}${po.createdByName ? ' · ' + esc(po.createdByName) : ''}</span></h3>${statusPill(po.status)}${po.sentAt ? ` <span class="pill plain">${L('Sent', 'أُرسل')} ${ago(po.sentAt)}</span>` : ''}</div><div class="card-b">
        <ul class="po-lines">${po.items.map(i => { const p = DB.product(i.pid) || {}; return `<li><b class="num">${i.qty}×</b><div class="grow"><div>${esc(p.name || i.pid)}</div><div class="faint">${i.supSku ? esc(i.supSku) + ' · ' : ''}${(i.forSales || []).map(f => `<a href="#" data-oid="${f.id}">${esc(f.no)}</a> (${f.qty})`).join(', ') || L('for stock', 'للمخزون')}</div></div>${i.url ? `<a class="btn sm ghost" href="${esc(i.url)}" target="_blank" rel="noopener" title="${L('Open on supplier website', 'فتح في موقع المورد')}">${icon('external')}</a>` : ''}${seesCosts() ? `<span class="num">${money(i.qty * i.cost)}</span>` : ''}</li>`; }).join('')}</ul>
        ${seesCosts() ? `<div class="ln big" style="display:flex;justify-content:space-between;margin-top:8px"><span>${t('total')}</span>${money(po.total)}</div>` : ''}
        ${actions && po.status === 'ordered' && edit ? `<div class="actions mt"><button class="btn" data-send="${po.id}">${icon('send')}${L('Send to supplier', 'إرسال للمورد')}</button><button class="btn primary" data-recv="${po.id}">${icon('check')}${t('receive')}</button><button class="btn ghost danger" data-cancel="${po.id}">${L('Cancel', 'إلغاء')}</button></div>` : ''}
        ${s.howToOrder && actions && po.status === 'ordered' ? `<p class="faint" style="font-size:12.5px;margin:10px 0 0">${icon('file')} ${esc(s.howToOrder)}</p>` : ''}
      </div></div>`;
    }
    function bindPO(root) {
      const po = (id) => D().purchases.find(p => p.id === id);
      $$('[data-send]', root).forEach(b => b.onclick = () => sendPOModal(po(b.dataset.send)));
      $$('[data-recv]', root).forEach(b => b.onclick = () => receivePO(po(b.dataset.recv)));
      $$('[data-cancel]', root).forEach(b => b.onclick = () => cancelPO(po(b.dataset.cancel)));
      $$('[data-oid]', root).forEach(a => a.onclick = (e) => { e.preventDefault(); H.orderModal(a.dataset.oid); });
    }
    function poModal(po) {
      const m = modal({ title: `${esc(po.no)} · ${esc(supName(po.supplierId))}`, body: poCard(po, true), wide: true, footer: `<button class="btn" data-close>${t('close')}</button>` });
      bindPO(m.el); m.el.addEventListener('click', (e) => { if (e.target.closest('[data-send],[data-recv],[data-cancel],[data-oid]')) m.close(); }, true);
    }
    H.poModal = poModal;

    function supplierForm() {
      modal({
        title: L('Add supplier', 'إضافة مورد'),
        body: `<div class="form-grid"><div class="field full"><label>${t('supplier')}</label><input class="input" id="ns_n"></div>
          <div class="field full"><label>${L('Website (https://…)', 'الموقع (https://…)')}</label><div class="actions"><input class="input" id="ns_w" dir="ltr" placeholder="https://" style="flex:1">${online() ? `<button class="btn" id="ns_d" type="button">${L('Check', 'فحص')}</button>` : ''}</div><p class="faint" id="ns_note" style="font-size:12.5px;margin:4px 0 0"></p></div>
          <div class="field"><label>${L('Catalog', 'الكتالوج')}</label><select class="input" id="ns_p">${Object.keys(PLAT).map(k => `<option value="${k}" ${k === 'manual' ? 'selected' : ''}>${PLAT[k]}</option>`).join('')}</select></div>
          <div class="field"><label>${L('Currency', 'العملة')}</label><select class="input" id="ns_c">${Object.keys(FX).map(c => `<option ${c === 'AED' ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>WhatsApp</label><input class="input" id="ns_wa" dir="ltr"></div><div class="field"><label>${t('phone')}</label><input class="input" id="ns_ph" dir="ltr"></div></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="ns_s">${t('save')}</button>`,
        onMount: (el, m) => {
          if ($('#ns_d', el)) $('#ns_d', el).onclick = async () => { const w = $('#ns_w', el).value.trim(); if (!w) return; $('#ns_note', el).textContent = '…'; try { const r = await Auth.api('POST', '/api/suppliers/detect', { url: w }); $('#ns_p', el).value = r.platform; $('#ns_note', el).textContent = r.note; } catch (e) { $('#ns_note', el).textContent = e.message; } };
          $('#ns_s', el).onclick = () => {
            const n = $('#ns_n', el).value.trim(), w = $('#ns_w', el).value.trim(); if (!n) return $('#ns_n', el).focus();
            if (w && !/^https:\/\/[^\s"'<>]+$/.test(w)) return alert(L('The website must start with https://', 'يجب أن يبدأ الموقع بـ https://'));
            const s = sup({ id: DB.uid('s'), name: n, website: w, platform: $('#ns_p', el).value, currency: $('#ns_c', el).value, whatsapp: $('#ns_wa', el).value.replace(/[^\d+]/g, ''), phone: $('#ns_ph', el).value.trim(), country: '' });
            D().suppliers.push(s); DB.save(); m.close(); toast(t('saved')); location.hash = '#/suppliers/' + s.id;
          };
        }
      });
    }

    // =====================================================
    // SOURCING: supplier catalogues → my products
    // =====================================================
    VIEWS.sourcing = function (v) {
      const tab = state.srcTab || (online() ? 'search' : 'mine');
      const auto = D().suppliers.filter(s => ['shopify', 'magento'].includes(s.platform) && s.active !== false);
      const mine = D().products.filter(p => (p.sources || []).length);
      v.innerHTML = `
        <div class="page-head"><div><h2>${t('sourcing')}</h2><p>${L('Pick products from your suppliers, set your margin and selling price, and watch their prices.', 'اختر منتجات من الموردين، وحدد هامش ربحك وسعر البيع، وراقب أسعارهم.')}</p></div><div class="actions">${can('inventory', 'request') ? `<button class="btn" id="srcManual">${icon('link')}${L('Add from a link', 'إضافة من رابط')}</button>` : ''}</div></div>
        <div class="tabs" role="tablist">${[['search', L('Search catalogs', 'البحث في الكتالوجات')], ['mine', L('My sourced products', 'منتجاتي من الموردين'), mine.length], ['changes', L('Price changes', 'تغيّر الأسعار')]].map(([k, l, n]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n ? ` <span class="count">${n}</span>` : ''}</button>`).join('')}</div>
        <div id="srcBody" class="mt"></div>`;
      $$('[data-tab]', v).forEach(b => b.onclick = () => { state.srcTab = b.dataset.tab; H.render(); });
      if ($('#srcManual')) $('#srcManual').onclick = () => sourceModal(null, null);
      const body = $('#srcBody');
      if (!online() && tab !== 'mine') { body.innerHTML = `<div class="notice">${icon('alert')}<div>${L('Searching the suppliers\' full catalogs needs the online server (it copies their product lists every night). You can still add products from a link.', 'البحث في كتالوجات الموردين الكاملة يحتاج الخادم (ينسخ قوائم منتجاتهم كل ليلة). يمكنك إضافة منتجات من رابط.')}</div></div>`; return; }
      if (tab === 'search') {
        if (!auto.length) { body.innerHTML = `<div class="notice">${icon('factory')}<div>${L('No supplier with an automatic catalog yet. Add AM Wrangler or Offroad Zone in Suppliers, then sync.', 'لا يوجد مورد بكتالوج تلقائي بعد. أضف AM Wrangler أو Offroad Zone في الموردين ثم زامن.')} <a href="#/suppliers">${t('suppliers')} →</a></div></div>`; return; }
        const q = state.srcQ || '', sid = state.srcSup || '', av = state.srcAvail ? '1' : '', pg = state.srcPage || 1;
        const key = `cat:${q}|${sid}|${av}|${pg}`;
        const res = load(key, () => Auth.api('GET', `/api/catalog?${new URLSearchParams({ q, supplier: sid, avail: av, page: pg, size: 24 })}`), 120000);
        body.innerHTML = `<form class="src-bar" id="srcForm"><input class="input" id="srcQ" placeholder="${L('Search: part name, number, brand, vehicle… e.g. "JL bumper", "Bilstein 5100"', 'ابحث: اسم القطعة، الرقم، الماركة، السيارة… مثل "JL bumper"')}" value="${esc(q)}">
            <select class="input" id="srcSup"><option value="">${L('All suppliers', 'كل الموردين')}</option>${auto.map(s => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
            <label class="check"><input type="checkbox" id="srcAv" ${av ? 'checked' : ''}> ${L('In stock', 'متوفر')}</label><button class="btn primary" type="submit">${icon('search')}</button></form>
          <div id="srcRes">${res.err ? errBox(res.err) : !res.data ? spinner : resultsHtml(res.data)}</div>`;
        $('#srcForm').onsubmit = (e) => { e.preventDefault(); state.srcQ = $('#srcQ').value.trim(); state.srcSup = $('#srcSup').value; state.srcAvail = $('#srcAv').checked; state.srcPage = 1; H.render(); };
        $('#srcSup').onchange = $('#srcAv').onchange = () => $('#srcForm').requestSubmit();
        if (res.data) bindResults(body, res.data.items);
        $$('[data-pg]', body).forEach(b => b.onclick = () => { state.srcPage = +b.dataset.pg; H.render(); scrollTo(0, 0); });
      }
      if (tab === 'mine') {
        const look = online() && mine.length && can('suppliers') ? load('mine-lookup', () => Auth.api('POST', '/api/catalog/lookup', { refs: mine.flatMap(p => p.sources.filter(x => x.sku).map(x => ({ supplierId: x.supplierId, sku: x.sku }))) }), 120000) : null;
        const latest = {}; ((look && look.data && look.data.items) || []).forEach(i => { latest[i.supplierId + '|' + i.sku] = i; });
        const rows = mine.map(p => {
          const src = DB.preferredSource(p) || p.sources[0]; const s = sup(DB.supplier(src.supplierId));
          const lt = latest[src.supplierId + '|' + src.sku];
          const nowPrice = lt && lt.price != null ? lt.price : src.price;
          const newCost = nowPrice ? landed(s, nowPrice) : null;
          const marg = p.price && p.cost ? (p.price - p.cost) / p.price * 100 : null;
          const newMarg = p.price && newCost ? (p.price - newCost) / p.price * 100 : null;
          return { p, src, s, lt, nowPrice, newCost, marg, newMarg, moved: lt && src.price && lt.price != null && Math.abs(lt.price - src.price) > 0.001 };
        }).sort((a, b) => (b.moved - a.moved) || a.p.name.localeCompare(b.p.name));
        const flagged = rows.filter(r => r.moved || (r.lt && r.lt.available === false));
        body.innerHTML = `${flagged.length ? `<div class="notice">${icon('alert')}<div>${L(`${flagged.length} product(s) changed at the supplier (price or stock). Review the highlighted rows.`, `${flagged.length} منتج تغيّر لدى المورد (السعر أو التوفر). راجع الصفوف المميزة.`)}</div></div>` : ''}
          <div class="card mt"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap">${rows.length ? `<table class="t"><thead><tr><th>${t('product')}</th><th>${t('supplier')}</th>${seesCosts() ? `<th class="r">${L('Supplier price', 'سعر المورد')}</th><th class="r">${L('Cost', 'التكلفة')}</th>` : ''}<th class="r">${L('My price', 'سعري')}</th>${seesCosts() ? `<th class="r">${L('Margin', 'الهامش')}</th>` : ''}<th></th></tr></thead><tbody>
            ${rows.map(r => `<tr class="${r.moved || (r.lt && r.lt.available === false) ? 'hl' : ''}"><td><b>${esc(r.p.name)}</b><div class="faint">${esc(r.src.sku || '')}${(r.p.sources || []).length > 1 ? ` · +${r.p.sources.length - 1} ${L('more suppliers', 'موردين آخرين')}` : ''}</div></td><td><a href="#/suppliers/${esc(r.s.id)}">${esc(r.s.name)}</a>${r.lt && r.lt.available === false ? `<div class="bad-t" style="font-size:12px">${L('out of stock there', 'غير متوفر لديه')}</div>` : ''}</td>
              ${seesCosts() ? `<td class="r">${r.src.price ? curTxt(r.src.price, r.s.currency) : '—'}${r.moved ? `<div class="${r.lt.price > r.src.price ? 'bad-t' : 'ok-t'}" style="font-size:12px">→ ${curTxt(r.lt.price, r.s.currency)}</div>` : ''}</td><td class="r">${money(r.p.cost)}${r.moved ? `<div class="faint" style="font-size:12px">→ ${moneyTxt(r.newCost)}</div>` : ''}</td>` : ''}
              <td class="r strong">${money(r.p.price)}</td>${seesCosts() ? `<td class="r">${r.marg != null ? H.pct(r.marg) : '—'}${r.moved && r.newMarg != null ? `<div class="${r.newMarg < r.marg ? 'bad-t' : 'ok-t'}" style="font-size:12px">→ ${H.pct(r.newMarg)}</div>` : ''}</td>` : ''}
              <td class="r"><button class="btn sm ${r.moved ? 'primary' : ''}" data-edit="${r.p.id}">${r.moved ? L('Review', 'مراجعة') : icon('edit')}</button></td></tr>`).join('')}
          </tbody></table>` : `<div class="empty">${L('No products linked to a supplier yet. Search the catalogs or add one from a link.', 'لا توجد منتجات مرتبطة بمورد بعد. ابحث في الكتالوجات أو أضف من رابط.')}</div>`}</div></div></div>`;
        $$('[data-edit]', body).forEach(b => b.onclick = () => { const r = rows.find(x => x.p.id === b.dataset.edit); sourceModal({ supplierId: r.src.supplierId, sku: r.src.sku, url: r.src.url, title: r.src.title || r.p.name, price: r.nowPrice, currency: r.s.currency, available: r.lt ? r.lt.available : r.src.available }, r.p); });
      }
      if (tab === 'changes') {
        const res = load('cat:changes', () => Auth.api('GET', '/api/catalog?changed=1&size=60'), 120000);
        const mineKeys = new Set(mine.flatMap(p => p.sources.map(x => x.supplierId + '|' + x.sku)));
        body.innerHTML = res.err ? errBox(res.err) : !res.data ? spinner : `<p class="faint">${L('Supplier price changes found by the nightly sync, newest first. Products you sell are marked.', 'تغييرات أسعار الموردين التي وجدتها المزامنة الليلية، الأحدث أولاً. المنتجات التي تبيعها مميزة.')}</p>
          <div class="card"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap">${res.data.items.length ? `<table class="t"><thead><tr><th>${t('product')}</th><th>${t('supplier')}</th><th class="r">${L('Before', 'قبل')}</th><th class="r">${L('Now', 'الآن')}</th><th class="r">%</th><th>${t('date')}</th></tr></thead><tbody>
            ${res.data.items.map(i => { const d = i.prevPrice ? (i.price - i.prevPrice) / i.prevPrice * 100 : 0; const my = mineKeys.has(i.supplierId + '|' + i.sku); return `<tr class="${my ? 'hl' : ''}"><td>${my ? `<span class="pill s-delivered">${L('I sell this', 'أبيعه')}</span> ` : ''}<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a><div class="faint">${esc(i.sku)}</div></td><td>${esc(supName(i.supplierId))}</td><td class="r">${i.prevPrice != null ? curTxt(i.prevPrice, i.currency) : '—'}</td><td class="r strong">${i.price != null ? curTxt(i.price, i.currency) : '—'}</td><td class="r ${d > 0 ? 'bad-t' : 'ok-t'}">${i.prevPrice ? (d > 0 ? '+' : '') + d.toFixed(1) + '%' : ''}</td><td class="muted">${i.priceChangedAt ? fDate(i.priceChangedAt) : ''}</td></tr>`; }).join('')}
          </tbody></table>` : `<div class="empty">${L('No price changes yet. They appear after the second sync.', 'لا توجد تغييرات بعد. تظهر بعد المزامنة الثانية.')}</div>`}</div></div></div>`;
      }
    };
    function resultsHtml(d) {
      if (!d.items.length) return `<div class="empty">${t('no_results')}</div>`;
      const pages = Math.ceil(d.total / d.size);
      return `<p class="faint" style="font-size:12.5px">${d.total} ${L('products', 'منتج')}</p><div class="src-grid">${d.items.map((i, k) => {
        const s = sup(DB.supplier(i.supplierId)); const has = D().products.find(p => sourceOf(p, i.supplierId) && sourceOf(p, i.supplierId).sku === i.sku);
        const cheaper = (i.also || []).filter(a => a.price != null && i.price != null && landed(DB.supplier(a.supplierId), a.price) < landed(s, i.price) - 0.001);
        return `<div class="card src-card">
          <div class="src-img">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icon('image')}</div>
          <div class="src-b"><div class="src-sup">${esc(s.name)} · ${esc(i.sku)}</div><a class="src-t" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
            <div class="src-p">${i.price != null ? `<b>${curTxt(i.price, i.currency)}</b>${i.compareAt ? ` <s class="faint">${fmt(i.compareAt, 2)}</s>` : ''}<span class="faint"> → ${L('cost', 'تكلفة')} ${moneyTxt(landed(s, i.price))}</span>` : `<span class="faint">${L('Price hidden (no cost permission)', 'السعر مخفي (بدون صلاحية التكلفة)')}</span>`}</div>
            <div class="src-tags">${i.available ? `<span class="pill s-delivered">${L('In stock', 'متوفر')}</span>` : `<span class="pill s-cancelled">${L('Out of stock', 'غير متوفر')}</span>`}${i.vendor ? `<span class="pill plain">${esc(i.vendor)}</span>` : ''}${(i.also || []).length ? `<span class="pill plain ${cheaper.length ? 's-new' : ''}" title="${esc(i.also.map(a => supName(a.supplierId) + (a.price != null ? ' ' + curTxt(a.price, a.currency) : '')).join(' · '))}">${cheaper.length ? L('Cheaper at ', 'أرخص لدى ') + esc(supName(cheaper[0].supplierId)) : L('Also at ', 'متوفر أيضاً لدى ') + esc(supName(i.also[0].supplierId))}</span>` : ''}</div>
            ${can('inventory', 'request') ? `<button class="btn sm ${has ? '' : 'primary'} block" data-add="${k}">${has ? icon('check') + L('In my products · edit', 'ضمن منتجاتي · تعديل') : icon('plus') + L('Add to my products', 'أضف إلى منتجاتي')}</button>` : ''}</div></div>`;
      }).join('')}</div>${pages > 1 ? `<div class="pager">${Array.from({ length: Math.min(pages, 12) }, (_, n) => n + 1).map(n => `<button class="btn sm ${n === d.page ? 'primary' : ''}" data-pg="${n}">${n}</button>`).join('')}${pages > 12 ? `<span class="faint">… ${pages}</span>` : ''}</div>` : ''}`;
    }
    function bindResults(root, items) {
      $$('[data-add]', root).forEach(b => b.onclick = () => {
        const i = items[+b.dataset.add];
        const p = D().products.find(x => sourceOf(x, i.supplierId) && sourceOf(x, i.supplierId).sku === i.sku);
        sourceModal(i, p || null);
      });
    }

    // Add / edit a product sourced from a supplier: cost from the supplier price, then margin ↔ selling price.
    function sourceModal(item, product) {
      const manual = !item;
      item = item || { supplierId: (D().suppliers.find(s => s.platform === 'manual' && s.active !== false) || D().suppliers[0] || {}).id, sku: '', url: '', title: '', price: null, currency: 'AED', available: true };
      const p = product;
      const sources = D().suppliers.filter(s => s.active !== false);
      const costs = seesCosts();
      modal({
        title: p ? `${esc(p.name)}` : L('Add to my products', 'أضف إلى منتجاتي'), wide: true,
        body: `<div class="grid g-2" style="gap:18px">
          <div>
            <h4 class="sub-h">${icon('factory')} ${L('From the supplier', 'من المورد')}</h4>
            <div class="form-grid">
              <div class="field"><label>${t('supplier')}</label><select class="input" id="sm_sup" ${manual ? '' : 'disabled'}>${sources.map(s => `<option value="${s.id}" ${s.id === item.supplierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
              <div class="field"><label>${L('Supplier code / SKU', 'رمز المورد')}</label><input class="input" id="sm_sku" dir="ltr" value="${esc(item.sku || '')}" ${manual ? '' : 'readonly'}></div>
              <div class="field full"><label>${L('Product link on supplier website', 'رابط المنتج في موقع المورد')}</label><input class="input" id="sm_url" dir="ltr" placeholder="https://" value="${esc(item.url || '')}" ${manual ? '' : 'readonly'}></div>
              ${costs ? `<div class="field"><label>${L('Supplier price', 'سعر المورد')} (<span id="sm_cur">${esc(sup(DB.supplier(item.supplierId)).currency)}</span>)</label><input class="input num" id="sm_sp" type="number" step="0.01" min="0" value="${item.price != null ? item.price : ''}"></div>
              <div class="field"><label>${L('Landed cost (OMR)', 'التكلفة الواصلة (ر.ع)')}</label><div class="input calc" id="sm_lc">—</div></div>
              <p class="faint full" id="sm_how" style="font-size:12px;margin:0"></p>` : ''}
              ${item.available === false ? `<div class="notice full">${icon('alert')}<div>${L('Out of stock at this supplier right now.', 'غير متوفر لدى هذا المورد حالياً.')}</div></div>` : ''}
            </div>
          </div>
          <div>
            <h4 class="sub-h">${icon('tag')} ${L('In my shop', 'في متجري')}</h4>
            <div class="form-grid">
              ${p ? '' : `<div class="field full"><label>${L('Add as', 'إضافة كـ')}</label><div class="seg" id="sm_mode"><button type="button" data-k="new" class="on">${L('New product', 'منتج جديد')}</button><button type="button" data-k="link">${L('Link to a product I have', 'ربط بمنتج موجود')}</button></div></div>
              <div class="field full hide" id="sm_linkf"><label>${t('product')}</label><select class="input" id="sm_link">${D().products.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => `<option value="${x.id}">${esc(x.name)}${x.partNumber ? ' · ' + esc(x.partNumber) : ''}</option>`).join('')}</select></div>`}
              <div class="field full newf"><label>${t('product')} (EN)</label><input class="input" id="sm_name" value="${esc(p ? p.name : item.title || '')}" ${p ? 'disabled' : ''}></div>
              ${p ? '' : `<div class="field newf"><label>${t('category')}</label><select class="input" id="sm_cat">${D().categories.map(c => `<option value="${c.id}">${esc(c[I18N.lang] || c.en)}</option>`).join('')}</select></div>
              <div class="field newf"><label>${t('brand')}</label><input class="input" id="sm_brand" value="${esc(item.vendor || '')}"></div>
              <div class="field newf"><label>${t('part_no')}</label><input class="input" id="sm_pn" dir="ltr" value="${esc(item.sku || '')}"></div>`}
              ${costs ? `<div class="field"><label>${L('Margin on cost (%)', 'الهامش على التكلفة (%)')}</label><input class="input num" id="sm_mk" type="number" step="1" min="0"></div>` : ''}
              <div class="field"><label>${L('Selling price (OMR, before VAT)', 'سعر البيع (ر.ع قبل الضريبة)')}</label><input class="input num" id="sm_pr" type="number" step="0.001" min="0" value="${p ? p.price : ''}"></div>
              ${costs ? `<p class="full" id="sm_profit" style="margin:0;font-size:13px"></p>` : ''}
              <div class="field full newf"><label class="check"><input type="checkbox" id="sm_show" ${p ? (p.showPrice ? 'checked' : '') : 'checked'}> ${t('show_price')}</label></div>
              ${p ? `<div class="field full"><label class="check"><input type="checkbox" id="sm_pref" ${(DB.preferredSource(p) || {}).supplierId === item.supplierId ? 'checked' : ''}> ${L('Buy from this supplier by default', 'الشراء من هذا المورد افتراضياً')}</label></div>` : ''}
            </div>
          </div></div>`,
        footer: `${p && (p.sources || []).some(x => x.supplierId === item.supplierId) ? `<button class="btn ghost danger" id="sm_unlink" style="margin-inline-end:auto">${L('Remove supplier link', 'إزالة الربط بالمورد')}</button>` : ''}<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="sm_save">${icon('check')}${t('save')}</button>`,
        onMount: (el, m) => {
          const S = () => sup(DB.supplier($('#sm_sup', el).value));
          let mode = 'new';
          const lc = () => { const sp = costs ? parseFloat($('#sm_sp', el).value) : NaN; return isFinite(sp) && sp > 0 ? landed(S(), sp) : (p ? +p.cost || 0 : 0); };
          const upd = (from) => {
            if (!costs) return;
            const s = S(); $('#sm_cur', el).textContent = s.currency;
            const c = lc(); $('#sm_lc', el).textContent = c ? moneyTxt(c) : '—';
            $('#sm_how', el).textContent = `× ${fxOf(s)} ${s.currency}→OMR` + (s.addVatPct ? ` · +${s.addVatPct}% VAT` : '') + (s.shippingPct ? ` · +${s.shippingPct}% ${L('shipping/customs', 'شحن/جمارك')}` : '') + (s.fixedFee ? ` · +${s.fixedFee} OMR` : '') + ` — ${L('change in the supplier\'s "How to buy"', 'غيّرها في "طريقة الشراء" للمورد')}`;
            if (from === 'mk' || from === 'init-new') { const mk = parseFloat($('#sm_mk', el).value); if (c && isFinite(mk)) $('#sm_pr', el).value = sellPrice(c, mk, s.roundTo); }
            if (from === 'pr' || from === 'sp' || from === 'init-edit') { const pr = parseFloat($('#sm_pr', el).value); if (c && pr) $('#sm_mk', el).value = Math.round((pr / c - 1) * 1000) / 10; }
            const pr = parseFloat($('#sm_pr', el).value) || 0;
            $('#sm_profit', el).innerHTML = c && pr ? `${L('Profit per item', 'الربح لكل قطعة')} <b class="${pr - c < 0 ? 'bad-t' : 'ok-t'}">${moneyTxt(pr - c)}</b> · ${L('margin of price', 'من سعر البيع')} ${H.pct((pr - c) / pr * 100)}` : '';
          };
          if (costs) {
            const s = S();
            if (p && p.price) { upd('init-edit'); if (p.marginPct != null && !isFinite(parseFloat($('#sm_mk', el).value))) $('#sm_mk', el).value = p.marginPct; }
            else { $('#sm_mk', el).value = s.defaultMarkup; upd('init-new'); }
            $('#sm_sp', el).oninput = () => upd($('#sm_mk', el).value !== '' ? 'mk' : 'sp');
            $('#sm_mk', el).oninput = () => upd('mk');
            $('#sm_pr', el).oninput = () => upd('pr');
            $('#sm_sup', el).onchange = () => upd('mk');
          }
          $$('#sm_mode button', el).forEach(b => b.onclick = () => { mode = b.dataset.k; $$('#sm_mode button', el).forEach(x => x.classList.toggle('on', x === b)); $$('.newf', el).forEach(x => x.classList.toggle('hide', mode === 'link')); $('#sm_linkf', el).classList.toggle('hide', mode !== 'link'); });
          if ($('#sm_unlink', el)) $('#sm_unlink', el).onclick = () => { p.sources = p.sources.filter(x => x.supplierId !== item.supplierId); DB.save(); m.close(); toast(t('saved')); H.render(); };
          $('#sm_save', el).onclick = () => {
            const sid = $('#sm_sup', el).value, s = sup(DB.supplier(sid));
            const sku = $('#sm_sku', el).value.trim(), url = $('#sm_url', el).value.trim();
            if (url && !/^https:\/\/[^\s"'<>]+$/.test(url)) return alert(L('The link must start with https://', 'يجب أن يبدأ الرابط بـ https://'));
            if (!sku && !url) return alert(L('Enter the supplier code or the product link.', 'أدخل رمز المورد أو رابط المنتج.'));
            const sp = costs ? parseFloat($('#sm_sp', el).value) : NaN;
            const price = r3(parseFloat($('#sm_pr', el).value) || 0);
            const src = { supplierId: sid, sku: sku || url, url, title: item.title || '', price: isFinite(sp) && sp > 0 ? sp : (item.price || null), currency: s.currency, available: item.available !== false, checkedAt: Date.now() };
            const cost = costs && src.price ? landed(s, src.price) : null;
            const mk = costs ? parseFloat($('#sm_mk', el).value) : NaN;
            let target = p;
            if (!target && mode === 'link') target = DB.product($('#sm_link', el).value);
            if (target) {
              target.sources = (target.sources || []).filter(x => x.supplierId !== sid);
              const pref = $('#sm_pref', el) ? $('#sm_pref', el).checked : !target.sources.length;
              if (pref) target.sources.forEach(x => { x.preferred = false; });
              target.sources.push(Object.assign(src, { preferred: pref }));
              if (price) target.price = price;
              if (cost != null && pref) target.cost = cost;
              if (isFinite(mk)) target.marginPct = mk;
              if ($('#sm_show', el)) target.showPrice = $('#sm_show', el).checked;
            } else {
              const name = $('#sm_name', el).value.trim(); if (!name) return $('#sm_name', el).focus();
              if (!price) return alert(L('Enter the selling price.', 'أدخل سعر البيع.'));
              const pn = $('#sm_pn', el).value.trim();
              target = { id: DB.uid('p'), name, nameAr: '', partNumber: pn, sku: pn || 'SKU-' + Date.now().toString(36).toUpperCase(), slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + Date.now().toString(36).slice(-4), brand: $('#sm_brand', el).value.trim(), category: $('#sm_cat', el).value, cost: cost || 0, price, stock: 0, reorder: 0, location: '', fitment: '', vehicles: [], active: true, online: true, showPrice: $('#sm_show', el).checked, image: '', oldPrice: 0, description: '', descriptionAr: '', featured: false, sources: [Object.assign(src, { preferred: true })], marginPct: isFinite(mk) ? mk : null, priceMode: 'margin', created: Date.now() };
              D().products.push(target);
            }
            DB.save(); m.close(); toast(t('saved')); drop('mine-lookup'); drop('lookup:'); H.render();
          };
        }
      });
    }
    H.sourceModal = sourceModal;

    // =====================================================
    // TEAM (online only)
    // =====================================================
    const MODS = [
      ['dashboard', 'dashboard', L('Home screen and to-do list', 'الشاشة الرئيسية وقائمة المهام')],
      ['pos', 'pos', L('Sell in the shop (till)', 'البيع في المحل (نقطة البيع)')],
      ['orders', 'orders', L('Online orders: confirm, ship, deliver, cancel', 'الطلبات الإلكترونية: تأكيد، شحن، تسليم، إلغاء')],
      ['quotes', 'file', L('Price quotes for customers', 'عروض الأسعار للعملاء')],
      ['customers', 'customers', L('Customer list and details', 'قائمة العملاء وتفاصيلهم')],
      ['inventory', 'inventory', L('Products and stock counts', 'المنتجات وكميات المخزون')],
      ['pricing', 'tag', L('Selling prices and product costs', 'أسعار البيع وتكاليف المنتجات')],
      ['suppliers', 'factory', L('Suppliers, their catalogs and what to buy', 'الموردون وكتالوجاتهم وما يجب شراؤه')],
      ['purchases', 'purchases', L('Supplier orders and receiving stock', 'طلبات الموردين واستلام البضاعة')],
      ['qpay', 'card', L('Qpay instalment payments', 'دفعات Qpay بالتقسيط')],
      ['finance', 'finance', L('Expenses, profit and money', 'المصروفات والأرباح والأموال')],
      ['reports', 'reports', L('Sales reports', 'تقارير المبيعات')],
      ['whatsapp', 'whatsapp', L('WhatsApp messages and campaigns', 'رسائل وحملات واتساب')],
      ['ai', 'sparkle', L('AI advisor and AI writing', 'مستشار الذكاء الاصطناعي والكتابة')],
      ['settings', 'settings', L('Shop settings and website publishing', 'إعدادات المتجر ونشر الموقع')],
      ['team', 'users', L('See team performance and activity', 'رؤية أداء الفريق ونشاطه')]
    ];
    const LV = [['none', L('No access', 'بدون')], ['view', L('View', 'عرض')], ['request', L('Ask approval', 'بموافقة')], ['edit', L('Edit', 'تعديل')], ['full', L('Full', 'كامل')]];
    const LV_HELP = L('View: can look only · Ask approval: changes wait for you to approve · Edit: changes directly, but deleting, cancelling and refunds wait for you · Full: everything, including deleting.', 'عرض: مشاهدة فقط · بموافقة: التغييرات تنتظر موافقتك · تعديل: يغيّر مباشرة لكن الحذف والإلغاء والاسترجاع ينتظر موافقتك · كامل: كل شيء بما في ذلك الحذف.');
    const PRESET_NAMES = { cashier: L('Cashier', 'كاشير'), sales: L('Sales', 'مبيعات'), storekeeper: L('Store keeper', 'أمين مخزن'), manager: L('Manager', 'مدير') };
    const modLabel = (m) => (m === 'pricing' ? L('Prices & costs', 'الأسعار والتكاليف') : t(m === 'ai' ? 'advisor' : m) || m);
    function presetOf(perms, presets) {
      for (const [k, p] of Object.entries(presets || {})) { if (MODS.every(([m]) => (p[m] || 'none') === (perms[m] || 'none')) && !!p.costs === !!perms.costs && (+p.maxDiscount || 0) === (+perms.maxDiscount || 0)) return PRESET_NAMES[k]; }
      return L('Custom', 'مخصص');
    }

    VIEWS.team = function (v) {
      if (!online()) { v.innerHTML = `<div class="page-head"><div><h2>${t('team')}</h2></div></div><div class="notice">${icon('users')}<div>${L('Employee accounts need the online server. Ask your developer to deploy it and set its address in assets/js/config.js.', 'حسابات الموظفين تحتاج الخادم. اطلب من المطوّر تشغيله ووضع عنوانه في assets/js/config.js.')}</div></div>`; return; }
      const tab = state.teamTab || 'members';
      v.innerHTML = `<div class="page-head"><div><h2>${t('team')}</h2><p>${L('Accounts, permissions, performance and who did what.', 'الحسابات والصلاحيات والأداء ومن فعل ماذا.')}</p></div><div class="actions">${isOwner() ? `<button class="btn primary" id="tmAdd">${icon('plus')}${L('Add employee', 'إضافة موظف')}</button>` : ''}</div></div>
        <div class="tabs" role="tablist">${[['members', L('Members', 'الأعضاء')], ['perf', L('Performance', 'الأداء')], ['activity', L('Activity', 'النشاط')]].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tmBody" class="mt"></div>`;
      $$('[data-tab]', v).forEach(b => b.onclick = () => { state.teamTab = b.dataset.tab; H.render(); });
      const status = load('status', () => Auth.api('GET', '/api/status'), 600000);
      if ($('#tmAdd')) $('#tmAdd').onclick = () => userModal(null, (status.data || {}).presets);
      const body = $('#tmBody');
      if (tab === 'members') {
        const res = load('users', () => Auth.api('GET', '/api/users'));
        if (res.err) { body.innerHTML = errBox(res.err); return; }
        if (!res.data) { body.innerHTML = spinner; return; }
        const presets = (status.data || {}).presets;
        body.innerHTML = `<div class="card"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap"><table class="t"><thead><tr><th>${L('Name', 'الاسم')}</th><th>${L('Role', 'الدور')}</th><th>${L('Access', 'الصلاحيات')}</th><th>${L('Last seen', 'آخر ظهور')}</th><th></th></tr></thead><tbody>
          ${res.data.users.map(u => { const n = MODS.filter(([m]) => u.perms[m] && u.perms[m] !== 'none').length; return `<tr class="${u.active ? '' : 'off'}"><td><div class="who"><span class="avatar sm">${esc(u.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(u.name)}</b><div class="faint">@${esc(u.username)}${u.phone ? ' · ' + esc(u.phone) : ''}</div></div></div></td>
            <td>${u.role === 'owner' ? `<span class="pill s-delivered">${L('Owner', 'المالك')}</span>` : `<span class="pill plain">${presetOf(u.perms, presets)}</span>`}${u.active ? '' : ` <span class="pill s-cancelled">${L('Switched off', 'موقوف')}</span>`}</td>
            <td class="muted">${u.role === 'owner' ? L('Everything', 'كل شيء') : `${n} ${L('sections', 'أقسام')}${u.perms.costs ? ' · ' + L('sees costs', 'يرى التكلفة') : ''}${u.perms.maxDiscount ? ` · ${L('discount up to', 'خصم حتى')} ${u.perms.maxDiscount}%` : ''}`}</td>
            <td class="muted">${ago(u.lastSeen)}</td>
            <td class="r">${isOwner() && u.role !== 'owner' ? `<button class="btn sm" data-edit="${u.id}">${icon('edit')}${L('Edit', 'تعديل')}</button>` : ''}</td></tr>`; }).join('')}
          </tbody></table></div></div></div>
          <p class="faint" style="font-size:12.5px">${LV_HELP}</p>`;
        $$('[data-edit]', body).forEach(b => b.onclick = () => userModal(res.data.users.find(u => u.id === b.dataset.edit), presets));
      }
      if (tab === 'perf') {
        const days = state.teamDays || 30;
        const res = load('stats:' + days, () => Auth.api('GET', '/api/team/stats?days=' + days));
        body.innerHTML = `<div class="seg" id="tmDays">${[7, 30, 90].map(d => `<button data-k="${d}" class="${d === days ? 'on' : ''}">${d} ${L('days', 'يوم')}</button>`).join('')}</div><div id="tmPerf" class="mt">${res.err ? errBox(res.err) : !res.data ? spinner : ''}</div>`;
        H.bindSeg('tmDays', k => { state.teamDays = +k; H.render(); });
        if (res.data) {
          const us = res.data.users.filter(u => u.active || u.sales || u.orders);
          const money2 = us.some(u => u.revenue != null);
          $('#tmPerf').innerHTML = `${money2 ? `<div class="card"><div class="card-h"><h3>${L('Sales by person', 'المبيعات حسب الشخص')}</h3></div><div class="card-b"><div style="height:${Math.max(140, us.length * 42)}px"><canvas id="tmChart"></canvas></div></div></div>` : ''}
            <div class="card mt"><div class="card-b" style="padding:8px 0 0"><div class="table-wrap"><table class="t"><thead><tr><th>${L('Name', 'الاسم')}</th><th class="r">${L('Shop sales', 'مبيعات المحل')}</th><th class="r">${L('Online orders', 'طلبات إلكترونية')}</th><th class="r">${L('Order updates', 'تحديثات الطلبات')}</th>${money2 ? `<th class="r">${L('Sales value', 'قيمة المبيعات')}</th><th class="r">${t('discount')}</th>` : ''}<th class="r">${t('quotes')}</th><th class="r">${L('Supplier orders', 'طلبات موردين')}</th><th class="r">${L('Requests', 'طلبات موافقة')}</th><th class="r">${L('Actions', 'إجراءات')}</th><th>${L('Last seen', 'آخر ظهور')}</th></tr></thead><tbody>
              ${us.map(u => `<tr><td><b>${esc(u.name)}</b>${u.role === 'owner' ? ` <span class="faint">(${L('owner', 'المالك')})</span>` : ''}</td><td class="r num">${u.sales}</td><td class="r num">${u.orders}</td><td class="r num">${u.handled}</td>${money2 ? `<td class="r strong">${money(u.revenue || 0)}</td><td class="r">${money(u.discount || 0)}</td>` : ''}<td class="r num">${u.quotes}${u.quotesWon ? ` <span class="faint">(${u.quotesWon} ${L('won', 'ناجح')})</span>` : ''}</td><td class="r num">${u.purchases}</td><td class="r num">${u.requests}${u.requests ? ` <span class="faint">(${u.approved}✓ ${u.rejected}✗)</span>` : ''}</td><td class="r num">${u.actions}</td><td class="muted">${ago(u.lastSeen)}</td></tr>`).join('')}
            </tbody></table></div></div></div>`;
          if (money2 && $('#tmChart')) chart($('#tmChart'), { type: 'bar', data: { labels: us.map(u => u.name), datasets: [{ data: us.map(u => r3(u.revenue || 0)), backgroundColor: cssVar('--brand'), borderRadius: 6 }] }, options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } } });
        }
      }
      if (tab === 'activity') {
        const users = load('users', () => Auth.api('GET', '/api/users'));
        const who = state.actUser || '', mod = state.actMod || '';
        const res = load(`act:${who}|${mod}|${state.actLimit || 100}`, () => Auth.api('GET', `/api/activity?${new URLSearchParams({ user: who, module: mod, limit: state.actLimit || 100 })}`), 15000);
        body.innerHTML = `<div class="src-bar"><select class="input" id="acU"><option value="">${L('Everyone', 'الجميع')}</option>${((users.data || {}).users || []).map(u => `<option value="${u.id}" ${u.id === who ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
          <select class="input" id="acM"><option value="">${L('All sections', 'كل الأقسام')}</option>${MODS.map(([m]) => `<option value="${m}" ${m === mod ? 'selected' : ''}>${esc(modLabel(m))}</option>`).join('')}</select></div>
          <div class="card mt"><div class="card-b">${res.err ? errBox(res.err) : !res.data ? spinner : res.data.items.length ? `<ul class="feed">${res.data.items.map(a => `<li class="k-${esc(a.kind)}"><span class="feed-ic">${icon({ change: 'edit', request: 'inbox', approve: 'check', reject: 'x', login: 'lock', sync: 'refresh', team: 'users', ai: 'sparkle', withdraw: 'x', import: 'upload' }[a.kind] || 'activity')}</span><div class="grow"><b>${esc(a.name)}</b> ${esc(a.summary)}<div class="faint">${fDT(a.at)}${a.module ? ' · ' + esc(modLabel(a.module)) : ''}</div></div></li>`).join('')}</ul>${res.data.items.length >= (state.actLimit || 100) ? `<div class="more-row"><button class="btn" id="acMore">${t('show_more')}</button></div>` : ''}` : `<div class="empty">${t('no_results')}</div>`}</div></div>`;
        $('#acU').onchange = () => { state.actUser = $('#acU').value; H.render(); };
        $('#acM').onchange = () => { state.actMod = $('#acM').value; H.render(); };
        if ($('#acMore')) $('#acMore').onclick = () => { state.actLimit = Math.min(300, (state.actLimit || 100) + 100); H.render(); };
      }
    };

    function userModal(u, presets) {
      const isNew = !u;
      const perms = Object.assign({}, (u && u.perms) || (presets && presets.cashier) || {});
      modal({
        title: isNew ? L('Add employee', 'إضافة موظف') : esc(u.name), wide: true,
        body: `<div class="form-grid">
            <div class="field"><label>${L('Name', 'الاسم')}</label><input class="input" id="um_name" value="${esc(u ? u.name : '')}"></div>
            <div class="field"><label>${L('User name (to sign in)', 'اسم المستخدم (للدخول)')}</label><input class="input" id="um_user" dir="ltr" autocapitalize="none" autocomplete="off" value="${esc(u ? u.username : '')}" ${isNew ? '' : 'disabled'}></div>
            <div class="field"><label>${t('phone')}</label><input class="input" id="um_phone" dir="ltr" value="${esc(u ? u.phone : '')}"></div>
            <div class="field"><label>${isNew ? L('Password', 'كلمة المرور') : L('New password (leave empty to keep)', 'كلمة مرور جديدة (اتركها فارغة للإبقاء)')}</label><div class="actions"><input class="input" id="um_pw" type="text" autocomplete="new-password" dir="ltr" style="flex:1"><button class="btn sm" type="button" id="um_gen">${L('Generate', 'توليد')}</button></div></div>
          </div>
          <h4 class="sub-h mt">${icon('shield')} ${L('Permissions', 'الصلاحيات')}</h4>
          <div class="actions" style="flex-wrap:wrap">${Object.keys(presets || {}).map(k => `<button type="button" class="chip" data-preset="${k}">${esc(PRESET_NAMES[k] || k)}</button>`).join('')}<button type="button" class="chip" data-preset="none">${L('Clear all', 'مسح الكل')}</button></div>
          <div class="table-wrap mt"><table class="t perm-t"><thead><tr><th>${L('Section', 'القسم')}</th>${LV.map(([k, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead><tbody>
            ${MODS.map(([m, ic, desc]) => `<tr><td><div class="who">${icon(ic)}<div><b>${esc(modLabel(m))}</b><div class="faint">${esc(desc)}</div></div></div></td>${LV.map(([k, l]) => `<td class="c" data-label="${esc(l)}"><input type="radio" name="pm_${m}" value="${k}" ${(perms[m] || 'none') === k ? 'checked' : ''} aria-label="${esc(modLabel(m) + ': ' + l)}" ${m === 'team' && ['request', 'edit', 'full'].includes(k) ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
          <p class="faint" style="font-size:12.5px">${LV_HELP} ${L('Only you (the owner) can add or change accounts.', 'أنت فقط (المالك) من يضيف الحسابات أو يغيّرها.')}</p>
          <div class="form-grid mt">
            <div class="field"><label class="check"><input type="checkbox" id="um_costs" ${perms.costs ? 'checked' : ''}> ${L('Can see costs, supplier prices and profit', 'يرى التكاليف وأسعار الموردين والأرباح')}</label></div>
            <div class="field"><label class="check"><input type="checkbox" id="um_export" ${perms.export ? 'checked' : ''}> ${L('Can download data (CSV / backup)', 'يمكنه تنزيل البيانات (CSV / نسخة احتياطية)')}</label></div>
            <div class="field"><label>${L('Highest discount allowed at the till / on orders (%)', 'أعلى خصم مسموح في البيع (%)')}</label><input class="input num" id="um_disc" type="number" min="0" max="100" value="${+perms.maxDiscount || 0}"></div>
          </div>`,
        footer: `${isNew ? '' : `<div class="actions" style="margin-inline-end:auto"><button class="btn ghost ${u.active ? 'danger' : ''}" id="um_toggle">${u.active ? L('Switch off account', 'إيقاف الحساب') : L('Switch on account', 'تفعيل الحساب')}</button><button class="btn ghost" id="um_out">${icon('logout')}${L('Sign out everywhere', 'تسجيل الخروج من كل الأجهزة')}</button></div>`}<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="um_save">${icon('check')}${t('save')}</button>`,
        onMount: (el, m) => {
          const read = () => { const p = {}; MODS.forEach(([mm]) => { const r = $(`input[name="pm_${mm}"]:checked`, el); p[mm] = r ? r.value : 'none'; }); p.costs = $('#um_costs', el).checked; p.export = $('#um_export', el).checked; p.maxDiscount = Math.max(0, Math.min(100, +$('#um_disc', el).value || 0)); return p; };
          const apply = (p) => { MODS.forEach(([mm]) => { const r = $(`input[name="pm_${mm}"][value="${(p[mm] || 'none')}"]`, el); if (r && !r.disabled) r.checked = true; else { const n = $(`input[name="pm_${mm}"][value="none"]`, el); if (n) n.checked = true; } }); $('#um_costs', el).checked = !!p.costs; $('#um_export', el).checked = !!p.export; $('#um_disc', el).value = +p.maxDiscount || 0; };
          $$('[data-preset]', el).forEach(b => b.onclick = () => apply(b.dataset.preset === 'none' ? {} : presets[b.dataset.preset]));
          $('#um_gen', el).onclick = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(12)); $('#um_pw', el).value = Array.from(r, x => a[x % a.length]).join('').replace(/^(.{4})(.{4})/, '$1-$2-'); };
          if ($('#um_toggle', el)) $('#um_toggle', el).onclick = async () => { try { await Auth.api('PUT', '/api/users/' + u.id, { active: !u.active }); m.close(); toast(t('saved')); drop('users'); H.render(); } catch (e) { alert(e.message); } };
          if ($('#um_out', el)) $('#um_out', el).onclick = async () => { try { await Auth.api('POST', `/api/users/${u.id}/signout`); toast(L('Signed out on all devices', 'تم تسجيل الخروج من كل الأجهزة')); } catch (e) { alert(e.message); } };
          $('#um_save', el).onclick = async (e) => {
            const pw = $('#um_pw', el).value;
            const bodyx = { name: $('#um_name', el).value.trim(), phone: $('#um_phone', el).value.trim(), perms: read() };
            if (!bodyx.name) return $('#um_name', el).focus();
            if (isNew) { bodyx.username = $('#um_user', el).value.trim(); bodyx.password = pw; if (!pw) return alert(L('Enter a password, or press Generate.', 'أدخل كلمة مرور أو اضغط توليد.')); }
            else if (pw) bodyx.password = pw;
            e.currentTarget.disabled = true;
            try {
              await Auth.api(isNew ? 'POST' : 'PUT', isNew ? '/api/users' : '/api/users/' + u.id, bodyx);
              m.close(); drop('users'); H.render();
              if (pw) modal({ title: L('Give these to the employee', 'أعطِ هذه البيانات للموظف'), body: `<p>${L('Share in person or by private message. They can change the password after signing in (Settings → Security).', 'شاركها شخصياً أو برسالة خاصة. يمكنه تغيير كلمة المرور بعد الدخول (الإعدادات ← الأمان).')}</p><dl class="kv"><dt>${L('Address', 'العنوان')}</dt><dd dir="ltr">${esc(location.origin + location.pathname)}</dd><dt>${L('User name', 'اسم المستخدم')}</dt><dd dir="ltr"><b>${esc(isNew ? bodyx.username.toLowerCase() : u.username)}</b></dd><dt>${L('Password', 'كلمة المرور')}</dt><dd dir="ltr"><b>${esc(pw)}</b></dd></dl>`, footer: `<button class="btn primary" data-close>${t('close')}</button>` });
              else toast(t('saved'));
            } catch (er) { e.currentTarget.disabled = false; alert(er.message); }
          };
        }
      });
    }

    // =====================================================
    // APPROVALS (online only)
    // =====================================================
    const show = (x) => { if (x == null || x === '') return '—'; if (typeof x === 'number') return fmt(x, Number.isInteger(x) ? 0 : 3); if (typeof x === 'boolean') return x ? '✓' : '✗'; if (typeof x === 'string') return x.length > 80 ? x.slice(0, 80) + '…' : x; if (Array.isArray(x)) return x.length + ' ' + L('items', 'عناصر'); return '{…}'; };
    const COL = { sales: L('Order', 'طلب'), products: t('product'), quotes: L('Quote', 'عرض سعر'), purchases: L('Supplier order', 'طلب مورد'), customers: t('customer'), suppliers: t('supplier'), expenses: L('Expense', 'مصروف'), meta: t('settings') };
    VIEWS.approvals = function (v) {
      if (!online()) { v.innerHTML = `<div class="notice">${icon('inbox')}<div>${L('Approvals need the online server.', 'الموافقات تحتاج الخادم.')}</div></div>`; return; }
      const own = isOwner(); const tab = state.apTab || 'pending';
      const res = load('ap:' + tab, () => Auth.api('GET', `/api/approvals?status=${tab === 'pending' ? 'pending' : 'all'}`), 10000);
      v.innerHTML = `<div class="page-head"><div><h2>${t('approvals')}</h2><p>${own ? L('Changes your employees asked for. Nothing is applied until you approve.', 'تغييرات طلبها موظفوك. لا يُطبّق شيء حتى توافق.') : L('Changes you asked for, and the owner\'s answers.', 'التغييرات التي طلبتها وردود المالك.')}</p></div></div>
        <div class="tabs" role="tablist">${[['pending', L('Waiting', 'بالانتظار'), Auth.inbox().pending], ['all', L('History', 'السجل')]].map(([k, l, n]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n ? ` <span class="count">${n}</span>` : ''}</button>`).join('')}</div>
        <div id="apBody" class="mt">${res.err ? errBox(res.err) : !res.data ? spinner : ''}</div>`;
      $$('[data-tab]', v).forEach(b => b.onclick = () => { state.apTab = b.dataset.tab; drop('ap:'); H.render(); });
      if (!res.data) return;
      const items = tab === 'all' ? res.data.items.filter(a => a.status !== 'pending') : res.data.items;
      $('#apBody').innerHTML = items.length ? items.map(a => `<div class="card ap-card"><div class="card-h"><div class="who"><span class="avatar sm">${esc((a.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(a.name || '')}</b><div class="faint">${fDT(a.at)}${a.module ? ' · ' + esc(modLabel(a.module)) : ''}</div></div></div>${a.status === 'pending' ? `<span class="pill s-new">${L('Waiting', 'بالانتظار')}</span>` : `<span class="pill ${a.status === 'approved' ? 's-delivered' : 's-cancelled'}">${{ approved: L('Approved', 'موافق عليه'), rejected: L('Rejected', 'مرفوض'), withdrawn: L('Withdrawn', 'مسحوب') }[a.status]}</span>`}</div>
        <div class="card-b"><p class="ap-sum">${esc(a.summary)}</p>
          ${(a.changes || []).map(c => `<div class="ap-ch"><div class="faint">${esc(COL[c.col] || c.col)} · <b>${esc(c.label)}</b> · ${{ create: L('new', 'جديد'), update: L('change', 'تعديل'), delete: L('delete', 'حذف') }[c.op]}</div>
            ${c.diff && c.diff.length ? `<table class="t diff"><tbody>${c.diff.map(d => `<tr><td class="muted">${esc(d.field)}</td><td><s class="faint">${esc(show(d.from))}</s></td><td>→</td><td class="strong">${esc(show(d.to))}</td></tr>`).join('')}</tbody></table>` : ''}
            ${c.after ? `<div class="faint" style="font-size:12.5px">${['name', 'no', 'customerName', 'total', 'price', 'amount', 'desc'].filter(k => c.after[k] != null).map(k => `${k}: <b>${esc(show(c.after[k]))}</b>`).join(' · ')}</div>` : ''}</div>`).join('')}
          ${a.note ? `<p class="faint">${L('Note', 'ملاحظة')}: ${esc(a.note)}${a.decidedBy ? ' — ' + esc(a.decidedBy) : ''}</p>` : a.decidedAt ? `<p class="faint">${esc(a.decidedBy || '')} · ${fDT(a.decidedAt)}</p>` : ''}
          ${a.status === 'pending' ? `<div class="actions mt">${own ? `<button class="btn primary" data-ok="${a.id}">${icon('check')}${L('Approve', 'موافقة')}</button><button class="btn danger" data-no="${a.id}">${icon('x')}${L('Reject', 'رفض')}</button>` : `<button class="btn ghost" data-wd="${a.id}">${L('Withdraw', 'سحب الطلب')}</button>`}</div>` : ''}
        </div></div>`).join('') : `<div class="card"><div class="empty">${icon('check')} ${tab === 'pending' ? L('Nothing waiting.', 'لا شيء بالانتظار.') : t('no_results')}</div></div>`;
      const act = async (b, path, body) => { b.disabled = true; try { await Auth.api('POST', path, body || {}); toast(t('saved')); drop('ap:'); await Auth.refresh(); H.render(); } catch (e) { b.disabled = false; alert(e.message); drop('ap:'); H.render(); } };
      $$('[data-ok]', v).forEach(b => b.onclick = () => act(b, `/api/approvals/${b.dataset.ok}/approve`));
      $$('[data-no]', v).forEach(b => b.onclick = () => { const note = prompt(L('Reason (optional, the employee will see it):', 'السبب (اختياري، سيراه الموظف):')); if (note === null) return; act(b, `/api/approvals/${b.dataset.no}/reject`, { note }); });
      $$('[data-wd]', v).forEach(b => b.onclick = () => act(b, `/api/approvals/${b.dataset.wd}/withdraw`));
    };

    // =====================================================
    // menu: new screens, and only what each person may see
    // =====================================================
    const at = (id) => ROUTES.findIndex(r => r.id === id);
    ROUTES.splice(at('purchases') + 1, 0,
      { id: 'suppliers', icon: 'factory', grp: 'grp_stock', badge: () => (can('suppliers') || can('purchases') ? buyLines().length : 0), tone: 'warn' },
      { id: 'sourcing', icon: 'link', grp: 'grp_stock' });
    if (online()) ROUTES.splice(at('settings'), 0,
      { id: 'team', icon: 'users', grp: 'grp_set' },
      { id: 'approvals', icon: 'inbox', grp: 'grp_set', badge: () => Auth.inbox().pending, tone: 'warn' });

    if (online()) {
      const NEED = { dashboard: ['dashboard'], pos: ['pos'], orders: ['orders'], quotes: ['quotes'], customers: ['customers'], inventory: ['inventory', 'pricing'], purchases: ['purchases'], suppliers: ['suppliers', 'purchases'], sourcing: ['pricing', 'suppliers', 'purchases'], qpay: ['qpay'], finance: ['finance'], reports: ['reports'], whatsapp: ['whatsapp'], advisor: ['ai'], team: ['team'] };
      const LVL = ['none', 'view', 'request', 'edit', 'full'];
      const best = (id) => (NEED[id] || []).reduce((a, m) => Math.max(a, LVL.indexOf(Auth.level(m))), -1);
      for (let i = ROUTES.length - 1; i >= 0; i--) { const id = ROUTES[i].id; if (NEED[id] && best(id) < 1) ROUTES.splice(i, 1); }
      for (let i = TABS.length - 1; i >= 0; i--) if (!ROUTES.some(r => r.id === TABS[i][0])) TABS.splice(i, 1);
      // a short note on screens where this person can only look, or needs approval
      Object.keys(NEED).forEach(id => {
        const orig = VIEWS[id]; if (!orig) return;
        VIEWS[id] = function (v) {
          orig(v);
          const b = best(id); if (Auth.isOwner() || b >= 3) return;
          const msg = b === 1 ? L('View only — you can look here but changes will not be saved.', 'عرض فقط — يمكنك المشاهدة لكن التغييرات لن تُحفظ.') : L('Changes you make here are sent to the owner for approval first.', 'التغييرات هنا تُرسل إلى المالك للموافقة أولاً.');
          v.insertAdjacentHTML('afterbegin', `<div class="perm-banner ${b === 1 ? 'ro' : 'rq'}">${icon(b === 1 ? 'eye' : 'inbox')}<span>${msg}</span></div>`);
          v.classList.toggle('view-ro', b === 1);
        };
      });
      // discount limit: checked here first (the server checks again)
      const createSale = DB.createSale;
      DB.createSale = function (o) {
        if (!Auth.isOwner()) {
          let list = 0, sub = 0;
          (o.items || []).forEach(it => { const p = DB.product(it.pid) || {}; const lp = +p.price || 0; const pr = it.price != null ? +it.price : lp; list += it.qty * (lp > 0 ? lp : pr); sub += it.qty * pr; });
          const pct = list ? (Math.max(0, list - sub) + (+o.discount || 0)) / list * 100 : 0;
          const max = +(Auth.me().perms.maxDiscount || 0);
          if (pct > max + 0.001) {
            const msg = L(`Discount ${pct.toFixed(1)}% is above your limit of ${max}%. Ask the owner.`, `الخصم ${pct.toFixed(1)}% أعلى من حدك ${max}%. اطلب من المالك.`);
            const el = document.createElement('div'); el.className = 'toast bad'; el.setAttribute('role', 'alert'); el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
            throw new Error(msg);
          }
        }
        return createSale.apply(this, arguments);
      };
      // hide costs and profit from people without the costs permission
      const dash = VIEWS.dashboard;
      if (dash) VIEWS.dashboard = function (v) { dash(v); if (!Auth.seesCosts()) $$('.kpi', v).forEach(k => { const txt = k.textContent; if (txt.includes(t('gross_profit')) || txt.includes(t('stock_value'))) k.remove(); }); };
      // Settings: account card, and only what each person may change
      const set = VIEWS.settings;
      VIEWS.settings = function (v) {
        set(v);
        const me = Auth.me();
        const cardHtml = `<div class="card" id="set-me"><div class="card-h"><h3>${icon('users')} ${L('My account', 'حسابي')}</h3><span class="pill ${me.role === 'owner' ? 's-delivered' : 'plain'}">${me.role === 'owner' ? L('Owner', 'المالك') : L('Employee', 'موظف')}</span></div><div class="card-b"><dl class="kv"><dt>${L('Name', 'الاسم')}</dt><dd>${esc(me.name)}</dd><dt>${L('User name', 'اسم المستخدم')}</dt><dd dir="ltr">@${esc(me.username)}</dd><dt>${L('Data', 'البيانات')}</dt><dd>${L('Shared online with your team', 'مشتركة عبر الإنترنت مع فريقك')}</dd></dl></div></div>`;
        const grid = $('.grid.g-21', v); if (grid) grid.insertAdjacentHTML('beforebegin', cardHtml + '<div class="mt"></div>');
        const note = $('#secCard .card-b > p', v); if (note) note.textContent = L('You sign in with your own user name and password. Every change is checked on the server against your permissions and recorded in the activity log.', 'تدخل باسم المستخدم وكلمة المرور الخاصة بك. يُفحص كل تغيير على الخادم حسب صلاحياتك ويُسجّل في سجل النشاط.');
        const un = $('#sec_pw input[name="username"]', v); if (un) un.value = me.username;
        ['#st_erase'].forEach(s => { const e = $(s, v); if (e) e.remove(); });
        // the website's AI parts assistant can use this server (the Claude key saved here)
        const ae = $('#st_aiEndpoint', v);
        if (ae && Auth.isOwner()) {
          const url = Auth.API + '/api/assistant';
          ae.insertAdjacentHTML('afterend', `<button type="button" class="btn sm mt" id="st_aiUse">${icon('sparkle')}${L('Use the Business Hub server', 'استخدم خادم النظام')}</button>`);
          $('#st_aiUse', v).onclick = () => { ae.value = url; toast(L('Press Save, then Publish the website', 'اضغط حفظ ثم انشر الموقع')); };
        }
        if (!Auth.isOwner()) {
          ['#set-ai', '#set-data', '#set-pub'].forEach(s => { const e = $(s, v); if (e) (e.closest('.card') || e).remove(); });
          $$('[data-jump="set-ai"],[data-jump="set-data"],[data-jump="set-pub"]', v).forEach(e => e.remove());
          if (!Auth.can('settings', 'request')) { const sv = $('#st_save', v); if (sv) sv.remove(); $$('#set-biz input', v).forEach(i => { i.disabled = true; }); $$('#sec_auto, #sec_away', v).forEach(i => { i.disabled = true; }); }
          if (!Auth.can('settings', 'view')) { const b = $('#set-biz', v); if (b) b.remove(); $$('[data-jump="set-biz"]', v).forEach(e => e.remove()); }
        }
      };
    }
  });
})();
