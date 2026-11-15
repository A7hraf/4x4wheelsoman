/* ============================================================
   4x4 Wheels Oman – Point of Sale + Customers
   ============================================================ */
(function () {
  'use strict';
  I18N.add('en', {
    pos_today: 'Today', transactions: 'Transactions', avg_ticket: 'Avg. ticket', cash_drawer: 'Cash in drawer', held: 'Held sales', recent_sales: 'Today\'s sales', top_today: 'Top item today',
    pos_search: 'Search or scan part number…', set_price: 'Set price', no_stock: 'out of stock', sell_anyway: 'Not in stock — sell anyway?', cust_search: 'Search customer by name, phone or vehicle…', new_customer: 'New customer', add_as_new: 'Add "{q}" as new customer',
    walk_in_sale: 'Walk-in customer', change_cust: 'Change', history: 'History', visits: 'Visits', last_visit: 'Last visit', since: 'Customer since', phone_or_name: 'Enter a name or phone number', phone_exists: 'This phone belongs to {n} — selected.',
    amount_received: 'Amount received', change_due: 'Change', exact: 'Exact', hold: 'Hold', resume: 'Resume', held_empty: 'No held sales', pay_method: 'Payment', checkout: 'Checkout', cart_n: 'Cart', unit_price: 'Unit price', line_total: 'Line total', remove: 'Remove',
    discount_pct: '%', discount_amt: 'OMR', refund: 'Return / refund', refund_items: 'Items to return', refund_reason: 'Reason', refund_done: 'Return saved — stock updated', st_refunded: 'Refunded', returned: 'Returned', refundable: 'Return qty',
    edit_customer: 'Edit customer', delete_customer: 'Delete customer', whatsapp_msg: 'WhatsApp', new_sale_for: 'New sale', purchases: 'Purchases', products_bought: 'Products bought', quotes_tab: 'Quotes', messages_tab: 'Messages', balance_due: 'Unpaid', notes: 'Notes',
    f_all: 'All', f_retail: 'Retail', f_workshop: 'Workshops', f_unpaid: 'Unpaid', f_inactive: 'Inactive 60d+', search_cust: 'Search name, phone, vehicle, product or order no.', repeat_rate: 'Repeat customers', export_csv: 'Export CSV', no_history: 'No purchases yet', saved_cust: 'Customer saved', price_needed: 'Enter the price for {p}', keyboard_hint: 'Tip: scan a barcode or type a part number and press Enter'
  });
  I18N.add('ar', {
    pos_today: 'اليوم', transactions: 'عدد العمليات', avg_ticket: 'متوسط الفاتورة', cash_drawer: 'النقد في الدرج', held: 'مبيعات معلّقة', recent_sales: 'مبيعات اليوم', top_today: 'الأكثر مبيعاً اليوم',
    pos_search: 'ابحث أو امسح رقم القطعة…', set_price: 'حدد السعر', no_stock: 'غير متوفر', sell_anyway: 'غير متوفر في المخزون — هل تبيعه رغم ذلك؟', cust_search: 'ابحث عن عميل بالاسم أو الهاتف أو السيارة…', new_customer: 'عميل جديد', add_as_new: 'أضف "{q}" كعميل جديد',
    walk_in_sale: 'عميل مباشر', change_cust: 'تغيير', history: 'السجل', visits: 'الزيارات', last_visit: 'آخر زيارة', since: 'عميل منذ', phone_or_name: 'أدخل الاسم أو رقم الهاتف', phone_exists: 'هذا الرقم يخص {n} — تم اختياره.',
    amount_received: 'المبلغ المستلم', change_due: 'الباقي', exact: 'المبلغ نفسه', hold: 'تعليق', resume: 'استئناف', held_empty: 'لا توجد مبيعات معلّقة', pay_method: 'الدفع', checkout: 'إتمام البيع', cart_n: 'السلة', unit_price: 'سعر الوحدة', line_total: 'الإجمالي', remove: 'حذف',
    discount_pct: '%', discount_amt: 'ر.ع', refund: 'إرجاع / استرداد', refund_items: 'القطع المرتجعة', refund_reason: 'السبب', refund_done: 'تم حفظ الإرجاع — تم تحديث المخزون', st_refunded: 'مسترد', returned: 'مرتجع', refundable: 'كمية الإرجاع',
    edit_customer: 'تعديل العميل', delete_customer: 'حذف العميل', whatsapp_msg: 'واتساب', new_sale_for: 'بيع جديد', purchases: 'المشتريات', products_bought: 'القطع المشتراة', quotes_tab: 'عروض الأسعار', messages_tab: 'الرسائل', balance_due: 'غير مدفوع', notes: 'ملاحظات',
    f_all: 'الكل', f_retail: 'أفراد', f_workshop: 'ورش', f_unpaid: 'غير مدفوع', f_inactive: 'غير نشط 60 يوماً+', search_cust: 'ابحث بالاسم أو الهاتف أو السيارة أو القطعة أو رقم الطلب', repeat_rate: 'عملاء متكررون', export_csv: 'تصدير CSV', no_history: 'لا توجد مشتريات بعد', saved_cust: 'تم حفظ العميل', price_needed: 'أدخل سعر {p}', keyboard_hint: 'تلميح: امسح الباركود أو اكتب رقم القطعة واضغط Enter'
  });

  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS) {
    const { D, $, $$, esc, fmt, money, moneyTxt, fDate, fDT, modal, toast, confirmBox, download, csv, kpi, statusPill, payLabel } = H;
    const t = (k, v) => { let x = H.t(k); if (v) Object.keys(v).forEach(n => { x = x.split('{' + n + '}').join(v[n]); }); return x; };
    const cur = () => D().settings.currency || 'OMR';
    const S = H.state;
    const DAY = DB.DAY;
    const sod = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const digits = (s) => String(s || '').replace(/\D/g, '');
    const vehName = (id) => { const v = DB.vehicle(id); return v ? `${v.make} ${v.en}` : ''; };
    const initials = (n) => esc(String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
    D().held = D().held || [];

    // ---------- customer helpers ----------
    function custStats(c) {
      const all = D().sales.filter(x => x.customerId === c.id);
      const s = all.filter(DB.countsAsRevenue);
      return { n: s.length, spent: s.reduce((a, x) => a + x.total, 0), last: s.reduce((a, x) => Math.max(a, x.date), 0), unpaid: s.filter(x => x.paid === false).reduce((a, x) => a + x.total, 0), orders: all };
    }
    function custMatches(c, q) {
      if (!q) return true;
      const d = digits(q);
      if (d.length >= 3 && digits(c.phone).includes(d)) return true;
      return (c.name + ' ' + c.city + ' ' + vehName(c.vehicle)).toLowerCase().includes(q.toLowerCase());
    }
    // Find by phone (last 8 digits) — prevents duplicates
    const byPhone = (ph) => { const d = digits(ph).slice(-8); return d.length >= 7 ? D().customers.find(c => digits(c.phone).slice(-8) === d) : null; };
    function customerForm(c, onSaved) {
      const isNew = !c; c = c || { name: '', phone: '', city: 'Muscat', type: 'retail', vehicle: '', optIn: true, notes: '' };
      modal({
        title: isNew ? t('new_customer') : t('edit_customer'),
        body: `<div class="form-grid"><div class="field full"><label>${t('customer_name')}</label><input class="input" id="cf_n" value="${esc(c.name)}" autocomplete="off"></div>
          <div class="field"><label>${t('phone')}</label><input class="input" id="cf_p" dir="ltr" inputmode="tel" value="${esc(c.phone)}" placeholder="+968 9XXX XXXX"></div>
          <div class="field"><label>${t('city')}</label><select class="input" id="cf_c">${DB.GOVERNORATES.map(g => `<option ${c.city === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label>${t('vehicle')}</label><select class="input" id="cf_v"><option value="">—</option>${(D().vehicles || []).map(v => `<option value="${v.id}" ${c.vehicle === v.id ? 'selected' : ''}>${esc(v.make)} ${esc(v.en)}</option>`).join('')}</select></div>
          <div class="field"><label>${t('type')}</label><select class="input" id="cf_t"><option value="retail">${t('retail')}</option><option value="workshop" ${c.type === 'workshop' ? 'selected' : ''}>${t('workshop')}</option></select></div>
          <div class="field full"><label>${t('notes')}</label><input class="input" id="cf_no" value="${esc(c.notes || '')}"></div>
          <div class="field full"><label class="check"><input type="checkbox" id="cf_o" ${c.optIn !== false ? 'checked' : ''}> ${t('opt_in')}</label></div></div><div class="err-line" id="cf_err"></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="cf_s">${icon('check')}${t('save')}</button>`,
        onMount: (el, m) => {
          const save = () => {
            const name = $('#cf_n', el).value.trim(), phone = $('#cf_p', el).value.trim();
            if (!name && !phone) { $('#cf_err', el).textContent = t('phone_or_name'); $('#cf_n', el).focus(); return; }
            const dup = phone && byPhone(phone);
            if (dup && dup !== c) { m.close(); toast(t('phone_exists', { n: dup.name })); if (onSaved) onSaved(dup); return; }
            Object.assign(c, { name: name || phone, phone, city: $('#cf_c', el).value, vehicle: $('#cf_v', el).value, type: $('#cf_t', el).value, notes: $('#cf_no', el).value.trim(), optIn: $('#cf_o', el).checked });
            if (isNew) { c.id = DB.uid('c'); c.created = Date.now(); D().customers.push(c); }
            // keep the name on past orders in sync
            D().sales.forEach(s => { if (s.customerId === c.id) { s.customerName = c.name; s.phone = c.phone; } });
            DB.save(); m.close(); toast(t('saved_cust')); if (onSaved) onSaved(c); else H.render();
          };
          $('#cf_s', el).onclick = save;
          $$('input', el).forEach(i => i.onkeydown = (e) => { if (e.key === 'Enter') save(); });
          if (isNew && c.name && /^\+?\d[\d\s]{5,}$/.test(c.name)) { $('#cf_p', el).value = c.name; $('#cf_n', el).value = ''; $('#cf_n', el).focus(); }
        }
      });
    }

    // ======================================================
    // POINT OF SALE
    // ======================================================
    const warned = new Set();
    Object.assign(S, { cart: S.cart || [], posCust: S.posCust || '', posPay: S.posPay || 'cash', posDisc: S.posDisc || 0, posDiscType: S.posDiscType || 'amt', posCash: '', posQ: S.posQ || '', posCat: S.posCat || 'all', posSheet: false });
    VIEWS.pos = function (v) {
      const today = D().sales.filter(s => s.channel === 'shop' && s.date >= sod() && DB.countsAsRevenue(s));
      const tTot = today.reduce((a, s) => a + s.total, 0);
      const cash = today.filter(s => s.payment === 'cash').reduce((a, s) => a + s.total, 0);
      const agg = {}; today.forEach(s => s.items.forEach(i => { agg[i.name] = (agg[i.name] || 0) + i.qty; }));
      const top = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
      v.innerHTML = `
        <div class="pos-stats">
          <div><span>${t('pos_today')}</span><b>${moneyTxt(tTot, tTot >= 1000 ? 0 : 3)}</b></div>
          <div><span>${t('transactions')}</span><b class="num">${today.length}</b></div>
          <div><span>${t('avg_ticket')}</span><b>${moneyTxt(today.length ? tTot / today.length : 0, 0)}</b></div>
          <div><span>${t('cash_drawer')}</span><b>${moneyTxt(cash, 0)}</b></div>
          <div class="hide-sm"><span>${t('top_today')}</span><b class="ell">${top ? esc(top[0]) + ' ×' + top[1] : '—'}</b></div>
          <div class="pos-stats-act"><button class="btn sm" id="posRecent">${icon('orders')}${t('recent_sales')}</button><button class="btn sm" id="posHeld">${icon('clock')}${t('held')}${D().held.length ? ` <span class="badge-n">${D().held.length}</span>` : ''}</button></div>
        </div>
        <div class="pos2">
          <section class="pos-left">
            <div class="pos-search">${icon('search')}<input class="input" id="pq" placeholder="${t('pos_search')}" value="${esc(S.posQ)}" autocomplete="off" enterkeyhint="search"></div>
            <div class="pos-cats" id="pcats"><button data-c="all" class="${S.posCat === 'all' ? 'on' : ''}">${t('all_categories')}</button>${D().categories.map(c => `<button data-c="${c.id}" class="${S.posCat === c.id ? 'on' : ''}">${H.catName(c.id)}</button>`).join('')}</div>
            <div class="pos-grid" id="pgrid"></div>
          </section>
          <aside class="pos-cart ${S.posSheet ? 'open' : ''}" id="cart"></aside>
          <button class="pos-bar" id="posBar"></button>
        </div>`;
      const grid = $('#pgrid'), cartEl = $('#cart');
      const lineOf = (pid) => S.cart.find(c => c.pid === pid);

      const drawGrid = () => {
        const q = S.posQ.trim().toLowerCase();
        const list = D().products.filter(p => p.active !== false && (S.posCat === 'all' || p.category === S.posCat) && (!q || [p.name, p.nameAr, p.sku, p.partNumber, p.brand, p.fitment].join(' ').toLowerCase().includes(q)));
        grid.innerHTML = list.slice(0, 120).map(p => {
          const inCart = (lineOf(p.id) || {}).qty || 0;
          const left = (p.stock || 0) - inCart;
          return `<button class="pcard ${inCart ? 'incart' : ''}" data-pid="${p.id}">${inCart ? `<span class="pc-q">${inCart}</span>` : ''}<div class="art">${productArt(p, { fit: 'contain' })}</div>
            <div class="nm">${esc(p.name)}</div><div class="faint pn">${esc(p.partNumber || p.sku || '')}</div>
            <div class="row"><span class="pr num">${p.price > 0 ? fmt(p.price) : `<em class="setp">${t('set_price')}</em>`}</span><span class="stk ${left <= 0 ? 'out' : left <= (p.reorder || 0) ? 'low' : ''}">${left <= 0 ? t('no_stock') : left}</span></div></button>`;
        }).join('') || `<div class="empty">${t('no_results')}</div>`;
        $$('.pcard', grid).forEach(b => b.onclick = () => addToCart(b.dataset.pid));
      };
      const askPrice = (p, l, cb) => modal({
        title: t('price_needed', { p: esc(p.name) }),
        body: `<div class="field"><label>${t('unit_price')} (${cur()})</label><input class="input num big-in" id="ap_v" type="number" inputmode="decimal" min="0" step="0.001" value="${l.price || ''}"></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="ap_s">${t('save')}</button>`,
        onMount: (el, m) => { const go = () => { const val = parseFloat($('#ap_v', el).value); if (!(val > 0)) { $('#ap_v', el).focus(); return; } l.price = DB.r3(val); m.close(); cb(); }; $('#ap_s', el).onclick = go; $('#ap_v', el).onkeydown = (e) => { if (e.key === 'Enter') go(); }; }
      });
      const addToCart = (pid, viaScan) => {
        const p = DB.product(pid); if (!p) return;
        let l = lineOf(pid);
        const inCart = l ? l.qty : 0;
        const proceed = () => {
          if (l) l.qty++; else { l = { pid, qty: 1, price: p.price || 0 }; S.cart.push(l); }
          if (!(l.price > 0)) askPrice(p, l, redraw); else redraw();
          if (viaScan) toast(p.name);
        };
        // warn once per product when selling beyond recorded stock (stock may not be tracked yet)
        if ((p.stock || 0) - inCart <= 0 && !warned.has(pid)) confirmBox(t('sell_anyway'), () => { warned.add(pid); proceed(); }, 'OK'); else proceed();
      };
      const totals = () => {
        const sub = S.cart.reduce((a, l) => a + l.qty * (l.price || 0), 0);
        const disc = Math.min(sub, S.posDiscType === 'pct' ? sub * Math.min(100, S.posDisc || 0) / 100 : (S.posDisc || 0));
        const vat = (sub - disc) * (D().settings.vat || 0) / 100;
        return { sub, disc: DB.r3(disc), vat, tot: DB.r3(sub - disc + vat), n: S.cart.reduce((a, l) => a + l.qty, 0) };
      };
      const custBox = () => {
        const c = S.posCust && DB.customer(S.posCust);
        if (c) {
          const st = custStats(c);
          return `<div class="cust-card"><div class="avatar">${initials(c.name)}</div><div class="grow"><b>${esc(c.name)}</b><div class="faint" dir="ltr" style="text-align:start">${esc(c.phone || '')}</div>${c.vehicle ? `<span class="chip">${esc(vehName(c.vehicle))}</span>` : ''}
            <div class="cust-mini"><span>${t('visits')} <b>${st.n}</b></span><span>${t('total_spent')} <b>${moneyTxt(st.spent, 0)}</b></span>${st.unpaid ? `<span class="neg-val">${t('balance_due')} <b>${moneyTxt(st.unpaid, 0)}</b></span>` : ''}</div></div>
            <div class="cust-act"><button class="btn sm ghost" id="pcHist" title="${t('history')}">${icon('clock')}</button><button class="btn sm ghost" id="pcX" title="${t('change_cust')}">${icon('x')}</button></div></div>`;
        }
        return `<div class="cust-pick"><div class="pos-search">${icon('customers')}<input class="input" id="pcq" placeholder="${t('cust_search')}" autocomplete="off"></div><button class="btn sm" id="pcNew" title="${t('new_customer')}">${icon('plus')}<span class="hide-xs">${t('new_customer')}</span></button><div class="cust-res hide" id="pcRes"></div></div>`;
      };
      const drawCart = () => {
        const T = totals();
        const pays = ['cash', 'card', 'transfer', 'qpay'];
        const recv = parseFloat(S.posCash);
        cartEl.innerHTML = `
          <div class="cart-h"><h3>${icon('cart')} ${t('new_sale')}${T.n ? ` <span class="faint">· ${T.n}</span>` : ''}</h3><div class="actions">${S.cart.length ? `<button class="btn sm ghost" id="cHold">${icon('clock')}${t('hold')}</button><button class="btn sm ghost danger" id="cclr">${icon('trash')}</button>` : ''}<button class="btn sm ghost sheet-x" id="cClose">${icon('x')}</button></div></div>
          <div class="cart-cust">${custBox()}</div>
          <div class="cart-lines">${S.cart.length ? S.cart.map((l, i) => { const p = DB.product(l.pid) || { name: '?' }; return `<div class="cl ${l.price > 0 ? '' : 'needp'}">
              <div class="cl-nm">${esc(p.name)}<div class="faint">${esc(p.partNumber || p.sku || '')}</div></div>
              <div class="cl-ctl"><div class="qty"><button data-dec="${i}" aria-label="-">${icon('minus')}</button><input class="num" data-q="${i}" inputmode="numeric" value="${l.qty}" aria-label="${t('qty')}"><button data-inc="${i}" aria-label="+">${icon('plus')}</button></div>
                <label class="cl-price">${cur()}<input class="num" data-pp="${i}" type="number" inputmode="decimal" min="0" step="0.001" value="${l.price || ''}" placeholder="${t('set_price')}"></label>
                <b class="num cl-tot">${fmt((l.price || 0) * l.qty)}</b><button class="icon-btn sm-ib" data-rm="${i}" aria-label="${t('remove')}">${icon('trash')}</button></div></div>`; }).join('') : `<div class="empty">${icon('cart')}<p>${t('cart_empty')}</p><p class="faint" style="font-size:12px">${t('keyboard_hint')}</p></div>`}</div>
          <div class="cart-foot">
            <div class="ln"><span>${t('subtotal')}</span>${money(T.sub)}</div>
            <div class="ln"><span>${t('discount')}</span><span class="disc-in"><input class="num" id="pdisc" type="number" inputmode="decimal" min="0" step="0.5" value="${S.posDisc || ''}" placeholder="0"><span class="seg mini" id="pdt"><button data-k="amt" class="${S.posDiscType === 'amt' ? 'on' : ''}">${cur()}</button><button data-k="pct" class="${S.posDiscType === 'pct' ? 'on' : ''}">%</button></span>${T.disc ? `<b class="num neg-val">−${fmt(T.disc)}</b>` : ''}</span></div>
            <div class="ln"><span>${t('vat')} (${D().settings.vat}%)</span>${money(T.vat)}</div>
            <div class="ln big"><span>${t('grand_total')}</span>${money(T.tot)}</div>
            <div class="pay-opts four">${pays.map(p => `<button data-pay="${p}" class="${S.posPay === p ? 'on' : ''}">${p === 'qpay' ? 'Qpay' : t(p)}</button>`).join('')}</div>
            ${S.posPay === 'cash' && S.cart.length ? `<div class="cash-box"><label>${t('amount_received')}<input class="num" id="pcash" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(S.posCash)}" placeholder="${fmt(T.tot)}"></label>
              <div class="quick">${[[t('exact'), T.tot], ...[5, 10, 20, 50, 100].map(n => Math.ceil(T.tot / n) * n).filter((x, i, a) => x > T.tot && a.indexOf(x) === i).slice(0, 3).map(x => [x, x])].map(([l, val]) => `<button data-cash="${val}">${typeof l === 'number' ? l : l}</button>`).join('')}</div>
              ${recv > 0 ? `<div class="ln change ${recv < T.tot ? 'short' : ''}"><span>${t('change_due')}</span><b class="num">${fmt(recv - T.tot)}</b></div>` : ''}</div>` : ''}
            ${S.posPay === 'qpay' && T.tot > D().settings.qpay.limit ? `<div class="notice" style="background:var(--bad-bg);color:var(--bad);margin-top:8px">${icon('alert')}<div>${t('over_limit')}</div></div>` : ''}
            <button class="btn primary lg block" id="pcharge" ${S.cart.length ? '' : 'disabled'}>${icon('check')}${t('charge')} ${moneyTxt(T.tot)}</button>
          </div>`;
        const bar = $('#posBar');
        bar.innerHTML = `<span>${icon('cart')} ${t('cart_n')} · ${T.n}</span><b>${moneyTxt(T.tot)}</b><span class="go">${t('checkout')} ${icon('arrowRight')}</span>`;
        bar.classList.toggle('empty', !S.cart.length);
        bindCart();
      };
      const redraw = () => { drawGrid(); drawCart(); };
      const bindCart = () => {
        const c = cartEl;
        $$('[data-inc]', c).forEach(b => b.onclick = () => { const l = S.cart[+b.dataset.inc]; addToCart(l.pid); });
        $$('[data-dec]', c).forEach(b => b.onclick = () => { const l = S.cart[+b.dataset.dec]; l.qty--; if (l.qty <= 0) S.cart.splice(+b.dataset.dec, 1); redraw(); });
        $$('[data-q]', c).forEach(i => i.onchange = () => { const l = S.cart[+i.dataset.q]; const q = parseInt(i.value, 10); if (q > 0) l.qty = q; else S.cart.splice(+i.dataset.q, 1); redraw(); });
        $$('[data-rm]', c).forEach(b => b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); redraw(); });
        $$('[data-pp]', c).forEach(i => i.onchange = () => { S.cart[+i.dataset.pp].price = Math.max(0, DB.r3(parseFloat(i.value) || 0)); drawCart(); });
        $$('[data-pay]', c).forEach(b => b.onclick = () => { S.posPay = b.dataset.pay; S.posCash = ''; drawCart(); });
        $$('[data-cash]', c).forEach(b => b.onclick = () => { S.posCash = b.dataset.cash; drawCart(); });
        $$('#pdt button', c).forEach(b => b.onclick = () => { S.posDiscType = b.dataset.k; drawCart(); });
        $('#pdisc', c).onchange = (e) => { S.posDisc = Math.max(0, parseFloat(e.target.value) || 0); drawCart(); };
        if ($('#pcash', c)) $('#pcash', c).oninput = H.debounce((e) => { S.posCash = e.target.value; drawCart(); const i = $('#pcash'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 500);
        if ($('#cclr', c)) $('#cclr', c).onclick = () => confirmBox(t('clear') + '?', () => { S.cart = []; S.posDisc = 0; S.posCash = ''; S.posCust = ''; redraw(); });
        if ($('#cHold', c)) $('#cHold', c).onclick = () => { D().held.push({ id: DB.uid('h'), at: Date.now(), cart: S.cart, cust: S.posCust, disc: S.posDisc, discType: S.posDiscType }); DB.save(); S.cart = []; S.posDisc = 0; S.posCust = ''; toast(t('hold') + ' ✓'); H.render(); };
        $('#cClose', c).onclick = () => { S.posSheet = false; cartEl.classList.remove('open'); };
        // customer picker
        const q = $('#pcq', c), res = $('#pcRes', c);
        if (q) {
          q.oninput = () => {
            const s = q.value.trim();
            if (!s) { res.classList.add('hide'); return; }
            const list = D().customers.filter(x => custMatches(x, s)).slice(0, 8);
            res.innerHTML = list.map(x => `<button data-cs="${x.id}"><span class="avatar">${initials(x.name)}</span><span><b>${esc(x.name)}</b><small dir="ltr">${esc(x.phone || '')}${x.vehicle ? ' · ' + esc(vehName(x.vehicle)) : ''}</small></span></button>`).join('') + `<button class="add-new" data-new="1">${icon('plus')}${t('add_as_new', { q: esc(s) })}</button>`;
            res.classList.remove('hide');
            $$('[data-cs]', res).forEach(b => b.onmousedown = (e) => { e.preventDefault(); S.posCust = b.dataset.cs; drawCart(); });
            $('[data-new]', res).onmousedown = (e) => { e.preventDefault(); const nc = { name: s }; customerForm(null, (cu) => { S.posCust = cu.id; drawCart(); }); setTimeout(() => { const n = $('#cf_n'); const p = $('#cf_p'); if (/^\+?\d[\d\s]{5,}$/.test(s)) { p.value = s; n.focus(); } else { n.value = nc.name; p.focus(); } }, 30); };
          };
          q.onkeydown = (e) => { if (e.key === 'Enter') { const f = $('[data-cs]', res); if (f) { S.posCust = f.dataset.cs; drawCart(); } } };
          q.onblur = () => setTimeout(() => res.classList.add('hide'), 150);
          $('#pcNew', c).onclick = () => customerForm(null, (cu) => { S.posCust = cu.id; drawCart(); });
        }
        if ($('#pcX', c)) $('#pcX', c).onclick = () => { S.posCust = ''; drawCart(); };
        if ($('#pcHist', c)) $('#pcHist', c).onclick = () => customerModal(S.posCust);
        $('#pcharge', c).onclick = charge;
      };
      const charge = () => {
        if (!S.cart.length) return;
        const need = S.cart.find(l => !(l.price > 0));
        if (need) { const p = DB.product(need.pid); askPrice(p, need, drawCart); return; }
        const T = totals();
        if (S.posPay === 'cash' && parseFloat(S.posCash) > 0 && parseFloat(S.posCash) < T.tot) { toast(t('change_due') + ': ' + fmt(parseFloat(S.posCash) - T.tot)); $('#pcash').focus(); return; }
        const recv = parseFloat(S.posCash) || 0;
        const sale = DB.createSale({ channel: 'shop', source: 'pos', customerId: S.posCust || null, payment: S.posPay, discount: T.disc, items: S.cart.map(l => ({ pid: l.pid, qty: l.qty, price: l.price })) });
        if (S.posPay === 'cash' && recv >= sale.total) { sale.cashReceived = DB.r3(recv); sale.change = DB.r3(recv - sale.total); DB.save(); }
        S.cart = []; S.posDisc = 0; S.posCust = ''; S.posCash = ''; S.posSheet = false;
        H.render();
        toast(`${t('sale_done')} · ${sale.no}`);
        H.receiptModal(sale);
      };
      drawGrid(); drawCart();
      $$('#pcats button', v).forEach(b => b.onclick = () => { S.posCat = b.dataset.c; $$('#pcats button', v).forEach(x => x.classList.toggle('on', x === b)); drawGrid(); });
      const pq = $('#pq');
      pq.oninput = () => { S.posQ = pq.value; drawGrid(); };
      pq.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        const s = pq.value.trim().toLowerCase(); if (!s) return;
        const exact = D().products.find(p => [p.partNumber, p.sku].filter(Boolean).some(x => x.toLowerCase() === s));
        const one = D().products.filter(p => p.active !== false && [p.name, p.sku, p.partNumber, p.brand].join(' ').toLowerCase().includes(s));
        const hit = exact || (one.length === 1 ? one[0] : null);
        if (hit) { addToCart(hit.id, true); pq.value = ''; S.posQ = ''; drawGrid(); }
      };
      if (matchMedia('(min-width: 861px)').matches) pq.focus();
      $('#posBar').onclick = () => { S.posSheet = true; cartEl.classList.add('open'); };
      $('#posRecent').onclick = recentModal;
      $('#posHeld').onclick = heldModal;
    };
    function heldModal() {
      const list = D().held;
      modal({
        title: t('held'),
        body: list.length ? `<ul class="mini-list">${list.map(h => { const c = h.cust && DB.customer(h.cust); const tot = h.cart.reduce((a, l) => a + l.qty * (l.price || 0), 0); return `<li><div class="grow"><b>${c ? esc(c.name) : t('walk_in_sale')}</b><div class="faint" style="font-size:12px">${fDT(h.at)} · ${h.cart.reduce((a, l) => a + l.qty, 0)} ${t('items').toLowerCase()} · ${moneyTxt(tot)}</div></div><button class="btn sm primary" data-res="${h.id}">${t('resume')}</button><button class="btn sm ghost danger" data-del="${h.id}">${icon('trash')}</button></li>`; }).join('')}</ul>` : `<div class="empty">${t('held_empty')}</div>`,
        onMount: (el, m) => {
          $$('[data-res]', el).forEach(b => b.onclick = () => { const h = list.find(x => x.id === b.dataset.res); if (S.cart.length) D().held.push({ id: DB.uid('h'), at: Date.now(), cart: S.cart, cust: S.posCust, disc: S.posDisc, discType: S.posDiscType }); Object.assign(S, { cart: h.cart, posCust: h.cust || '', posDisc: h.disc || 0, posDiscType: h.discType || 'amt' }); D().held = D().held.filter(x => x !== h); DB.save(); m.close(); H.render(); });
          $$('[data-del]', el).forEach(b => b.onclick = () => { D().held = D().held.filter(x => x.id !== b.dataset.del); DB.save(); m.close(); heldModal(); });
        }
      });
    }
    function recentModal() {
      const list = D().sales.filter(s => s.channel === 'shop' && s.date >= sod()).sort((a, b) => b.date - a.date);
      modal({
        title: t('recent_sales'), wide: true,
        body: list.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${t('order')}</th><th>${t('date')}</th><th>${t('customer')}</th><th>${t('payment')}</th><th class="r">${t('total')}</th><th>${t('status')}</th><th></th></tr></thead><tbody>
          ${list.map(s => `<tr><td class="strong">${esc(s.no)}</td><td class="muted">${new Date(s.date).toLocaleTimeString(I18N.lang === 'ar' ? 'ar-OM' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</td><td>${esc(s.customerName)}</td><td>${payLabel(s.payment)}</td><td class="r strong">${money(s.total)}</td><td>${statusPill(s.status)}</td>
            <td class="r" style="white-space:nowrap"><button class="btn sm" data-rc="${s.id}">${icon('printer')}</button> ${s.phone ? `<button class="btn sm wa" data-wa="${s.id}">${H.WA}</button>` : ''} ${s.status !== 'refunded' ? `<button class="btn sm ghost" data-rf="${s.id}">${t('refund')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${t('no_results')}</div>`,
        onMount: (el, m) => {
          const S_ = (id) => D().sales.find(s => s.id === id);
          $$('[data-rc]', el).forEach(b => b.onclick = () => { m.close(); H.receiptModal(S_(b.dataset.rc)); });
          $$('[data-wa]', el).forEach(b => b.onclick = () => H.sendBill(S_(b.dataset.wa)));
          $$('[data-rf]', el).forEach(b => b.onclick = () => { m.close(); refundModal(S_(b.dataset.rf)); });
        }
      });
    }
    // ---------- returns / refunds (full or partial) ----------
    function refundModal(s) {
      modal({
        title: `${t('refund')} · ${esc(s.no)}`,
        body: `<div class="table-wrap"><table class="t"><thead><tr><th>${t('product')}</th><th class="r">${t('qty')}</th><th class="r" style="width:110px">${t('refundable')}</th></tr></thead><tbody>
          ${s.items.map((i, k) => `<tr><td>${esc(i.name)}<div class="faint" style="font-size:12px">${fmt(i.price)}</div></td><td class="r num">${i.qty}</td><td class="r"><input class="input num" type="number" min="0" max="${i.qty}" value="${i.qty}" data-rq="${k}" style="width:80px"></td></tr>`).join('')}</tbody></table></div>
          <div class="field mt"><label>${t('refund_reason')}</label><input class="input" id="rf_r" placeholder="Wrong fitment / damaged / changed mind"></div><div class="totals mt" id="rf_t" style="border-radius:10px"></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn danger" id="rf_go">${icon('refresh')}${t('refund')}</button>`,
        onMount: (el, m) => {
          const qtys = () => $$('[data-rq]', el).map(i => Math.max(0, Math.min(+i.max, parseInt(i.value, 10) || 0)));
          const upd = () => { const q = qtys(); const sub = s.items.reduce((a, i, k) => a + q[k] * i.price, 0); const ratio = s.subtotal ? (s.subtotal - s.discount) / s.subtotal : 1; const amt = sub * ratio * (1 + (D().settings.vat || 0) / 100); $('#rf_t', el).innerHTML = `<div class="ln big"><span>${t('refund')}</span>${money(amt)}</div>`; };
          $$('[data-rq]', el).forEach(i => i.oninput = upd); upd();
          $('#rf_go', el).onclick = () => { const q = qtys(); if (!q.some(Boolean)) return; DB.returnItems(s.id, q, $('#rf_r', el).value.trim()); m.close(); toast(t('refund_done')); H.render(); };
        }
      });
    }

    // ======================================================
    // CUSTOMERS
    // ======================================================
    let cFilter = 'all';
    VIEWS.customers = function (v) {
      const q = (S.custQ || '').trim();
      const ql = q.toLowerCase();
      const rows = D().customers.map(c => Object.assign({ c }, custStats(c)));
      const now = Date.now();
      let list = rows.filter(x => {
        if (cFilter === 'retail' && x.c.type !== 'retail') return false;
        if (cFilter === 'workshop' && x.c.type !== 'workshop') return false;
        if (cFilter === 'unpaid' && !x.unpaid) return false;
        if (cFilter === 'inactive' && !(x.n && now - x.last > 60 * DAY)) return false;
        if (!q) return true;
        if (custMatches(x.c, q)) return true;
        // search inside purchase history: order numbers and product names / part numbers
        return x.orders.some(s => s.no.toLowerCase().includes(ql) || s.items.some(i => (i.name + ' ' + (i.sku || '')).toLowerCase().includes(ql)));
      }).sort((a, b) => b.spent - a.spent);
      const totSpent = rows.reduce((a, s) => a + s.spent, 0);
      v.innerHTML = `
        <div class="page-head"><div><h2>${t('customers')}</h2><p>${D().customers.length} ${t('customers').toLowerCase()}</p></div><div class="actions"><button class="btn" id="cexp">${icon('download')}${t('export_csv')}</button><button class="btn primary" id="cadd">${icon('plus')}${t('add_customer')}</button></div></div>
        <div class="grid g-kpi">
          ${kpi('customers', 'tone-brand', t('customers'), `<span class="num">${rows.length}</span>`, `<span>${rows.filter(x => x.c.type === 'workshop').length} ${t('workshop')}</span>`)}
          ${kpi('finance', 'tone-ok', t('total_spent'), H.big(totSpent), `<span>${t('avg_order')} ${moneyTxt(totSpent / Math.max(1, rows.reduce((a, s) => a + s.n, 0)), 0)}</span>`)}
          ${kpi('star', 'tone-violet', t('repeat_rate'), `<span class="num">${rows.filter(s => s.n > 1).length}</span>`, `<span>${H.pct(rows.filter(s => s.n > 1).length / Math.max(1, rows.length) * 100)}</span>`)}
          ${kpi('alert', 'tone-warn', t('balance_due'), H.big(rows.reduce((a, s) => a + s.unpaid, 0)), `<span>${rows.filter(s => s.unpaid).length} ${t('customers').toLowerCase()}</span>`)}
        </div>
        <div class="card mt"><div class="toolbar"><div class="search-in" style="max-width:420px">${icon('search')}<input class="input" id="cq" placeholder="${t('search_cust')}" value="${esc(q)}"></div>
          <div class="seg" id="cflt">${['all', 'retail', 'workshop', 'unpaid', 'inactive'].map(k => `<button data-k="${k}" class="${cFilter === k ? 'on' : ''}">${t('f_' + k)}</button>`).join('')}</div><span class="faint" style="margin-inline-start:auto">${list.length}</span></div>
          <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>${t('customer')}</th><th>${t('phone')}</th><th>${t('vehicle')}</th><th class="r">${t('visits')}</th><th class="r">${t('total_spent')}</th><th>${t('last_visit')}</th></tr></thead><tbody>
            ${list.slice(0, 300).map(x => `<tr class="click" data-cid="${x.c.id}"><td><div class="cell-prod" style="min-width:0"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(x.c.name)}</div><div><b>${esc(x.c.name)}</b><div class="faint" style="font-size:12px">${esc(x.c.city || '')} · ${t(x.c.type || 'retail')}${x.c.optIn === false ? ' · 🔕' : ''}</div></div></div></td>
              <td class="muted" dir="ltr" style="text-align:start">${esc(x.c.phone || '—')}</td><td>${x.c.vehicle ? `<span class="chip">${esc(vehName(x.c.vehicle))}</span>` : '<span class="faint">—</span>'}</td><td class="r num">${x.n}</td>
              <td class="r strong">${money(x.spent)}${x.unpaid ? `<div class="neg-val" style="font-size:12px">${t('balance_due')} ${fmt(x.unpaid)}</div>` : ''}</td><td class="muted">${x.last ? fDate(x.last) : '—'}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div>`;
      const cq = $('#cq'); cq.oninput = H.debounce(() => { S.custQ = cq.value; H.render(); const e = $('#cq'); e.focus(); e.setSelectionRange(e.value.length, e.value.length); }, 300);
      H.bindSeg('cflt', k => { cFilter = k; H.render(); });
      $$('[data-cid]', v).forEach(tr => tr.onclick = () => customerModal(tr.dataset.cid));
      $('#cadd').onclick = () => customerForm(null);
      $('#cexp').onclick = () => {
        const out = [['Name', 'Phone', 'City', 'Type', 'Vehicle', 'Opt-in', 'Orders', 'Total spent', 'Unpaid', 'Last purchase']];
        rows.forEach(x => out.push([x.c.name, x.c.phone, x.c.city, x.c.type, vehName(x.c.vehicle), x.c.optIn === false ? 'no' : 'yes', x.n, fmt(x.spent), fmt(x.unpaid), x.last ? new Date(x.last).toISOString().slice(0, 10) : '']));
        download(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csv(out), 'text/csv');
      };
    };
    let cTab = 'purchases';
    function customerModal(id) {
      const c = DB.customer(id); if (!c) return;
      const st = custStats(c);
      const orders = st.orders.slice().sort((a, b) => b.date - a.date);
      const prodAgg = {}; orders.filter(DB.countsAsRevenue).forEach(s => s.items.forEach(i => { const a = prodAgg[i.name] || (prodAgg[i.name] = { name: i.name, sku: i.sku, qty: 0, amt: 0, last: 0 }); a.qty += i.qty; a.amt += i.qty * i.price; a.last = Math.max(a.last, s.date); }));
      const quotes = (D().quotes || []).filter(q => q.customerId === id);
      const msgs = (D().waLog || []).filter(l => digits(l.to).slice(-8) === digits(c.phone).slice(-8) && digits(c.phone));
      const tabs = [['purchases', t('purchases') + ` (${orders.length})`], ['products', t('products_bought')], ['quotes', t('quotes_tab') + ` (${quotes.length})`], ['messages', t('messages_tab') + ` (${msgs.length})`]];
      const body = () => {
        if (cTab === 'products') return Object.values(prodAgg).length ? `<table class="t"><thead><tr><th>${t('product')}</th><th class="r">${t('qty')}</th><th class="r">${t('total')}</th><th>${t('last_visit')}</th></tr></thead><tbody>${Object.values(prodAgg).sort((a, b) => b.amt - a.amt).map(a => `<tr><td>${esc(a.name)}<div class="faint" style="font-size:12px">${esc(a.sku || '')}</div></td><td class="r num">${a.qty}</td><td class="r">${money(a.amt)}</td><td class="muted">${fDate(a.last)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_history')}</div>`;
        if (cTab === 'quotes') return quotes.length ? `<table class="t"><tbody>${quotes.map(q => `<tr><td class="strong">${esc(q.no)}</td><td class="muted">${fDate(q.date)}</td><td>${q.items.map(i => i.qty + '× ' + esc(i.name)).join('<br>')}</td><td>${esc(t('st_' + q.status))}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`;
        if (cTab === 'messages') return msgs.length ? `<table class="t"><tbody>${msgs.map(l => `<tr><td class="muted">${fDT(l.date)}</td><td><span class="chip">${esc(l.type)}</span></td><td class="muted" style="white-space:pre-wrap">${esc(l.text)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`;
        return orders.length ? orders.map(s => `<details class="ohist"><summary><span class="strong">${esc(s.no)}</span><span class="muted">${fDate(s.date)}</span><span>${H.srcLabel(s.source)}</span><span>${statusPill(s.status)}</span>${s.paid === false ? `<span class="pill s-processing">${t('unpaid')}</span>` : ''}<b class="num" style="margin-inline-start:auto">${money(s.total)}</b></summary>
            <table class="t"><tbody>${s.items.map(i => `<tr><td>${esc(i.name)}<div class="faint" style="font-size:12px">${esc(i.sku || '')}</div></td><td class="r num">${i.qty} × ${fmt(i.price)}</td><td class="r">${money(i.qty * i.price)}</td></tr>`).join('')}</tbody></table>
            <div class="actions" style="padding:8px 0"><button class="btn sm" data-oid="${s.id}">${t('details')}</button></div></details>`).join('') : `<div class="empty">${t('no_history')}</div>`;
      };
      modal({
        title: esc(c.name), wide: true,
        body: `<div class="cprof"><div class="avatar big-av">${initials(c.name)}</div><div class="grow"><div class="muted" dir="ltr" style="text-align:start">${esc(c.phone || '—')}</div><div>${esc(c.city || '')} · ${t(c.type || 'retail')}${c.vehicle ? ` · <span class="chip">${esc(vehName(c.vehicle))}</span>` : ''}${c.optIn === false ? ' · 🔕' : ''}</div>${c.notes ? `<div class="faint" style="font-size:13px">${esc(c.notes)}</div>` : ''}<div class="faint" style="font-size:12px">${t('since')} ${fDate(c.created || Date.now())}</div></div></div>
          <div class="grid g-kpi" style="margin:14px 0">${kpi('orders', 'tone-info', t('visits'), `<span class="num">${st.n}</span>`, '')}${kpi('finance', 'tone-ok', t('total_spent'), H.big(st.spent), '')}${kpi('reports', 'tone-violet', t('avg_ticket'), H.big(st.n ? st.spent / st.n : 0), '')}${kpi('alert', st.unpaid ? 'tone-bad' : 'tone-ok', t('balance_due'), H.big(st.unpaid), st.last ? `<span>${t('last_visit')} ${fDate(st.last)}</span>` : '')}</div>
          <div class="tabs" id="ctabs">${tabs.map(([k, l]) => `<button data-k="${k}" class="${cTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="cbody" class="table-wrap"></div>`,
        footer: `<button class="btn ghost danger" id="cdel" style="margin-inline-end:auto">${icon('trash')}</button><button class="btn" id="cedit">${icon('edit')}${t('edit')}</button>${c.phone ? `<button class="btn wa" id="cwa">${H.WA}${t('whatsapp_msg')}</button>` : ''}<button class="btn primary" id="csale">${icon('pos')}${t('new_sale_for')}</button>`,
        onMount: (el, m) => {
          const drawBody = () => { $('#cbody', el).innerHTML = body(); $$('[data-oid]', el).forEach(b => b.onclick = () => { m.close(); H.orderModal(b.dataset.oid); }); };
          drawBody();
          $$('#ctabs button', el).forEach(b => b.onclick = () => { cTab = b.dataset.k; $$('#ctabs button', el).forEach(x => x.classList.toggle('on', x === b)); drawBody(); });
          $('#cedit', el).onclick = () => { m.close(); customerForm(c, () => { H.render(); customerModal(c.id); }); };
          if ($('#cwa', el)) $('#cwa', el).onclick = () => H.openWA(c.phone, `${I18N.lang === 'ar' ? 'مرحباً' : 'Hello'} ${c.name.split(' ')[0]}, `, { type: 'direct', ref: c.name });
          $('#csale', el).onclick = () => { m.close(); S.posCust = c.id; location.hash = '#/pos'; };
          $('#cdel', el).onclick = () => { m.close(); confirmBox(t('confirm_delete'), () => { D().customers = D().customers.filter(x => x !== c); D().sales.forEach(s => { if (s.customerId === c.id) s.customerId = null; }); DB.save(); H.render(); }); };
        }
      });
    }
    Object.assign(H, { customerModal, customerForm, refundModal, custStats });
  });
})();
