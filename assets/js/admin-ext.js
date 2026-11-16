/* ============================================================
   4x4 Wheels Oman – admin extensions
   WhatsApp (bills, notifications, campaigns, templates), Quotes, Qpay, website publishing
   ============================================================ */
(function () {
  'use strict';
  I18N.add('en', {
    quotes_sub: 'Parts priced on request: build a quote, send it on WhatsApp, then convert it to an order.', quotes: 'Quotes', whatsapp: 'WhatsApp', qpay: 'Qpay', send_bill: 'Send bill', notify: 'Notify customer', mark_paid: 'Mark paid', paid: 'Paid', unpaid: 'Unpaid', qpay_pay: 'Qpay',
    qp_pending: 'To request', qp_requested: 'Requested', qp_approved: 'Approved', qp_settled: 'Settled', qp_declined: 'Declined',
    show_price: 'Show price on website', fits_vehicles: 'Fits vehicles', part_no: 'Part number', enter_prices: 'Enter a price for every item', vehicle: 'Vehicle', opt_in: 'Agreed to receive offers on WhatsApp',
    site_url: 'Website address', show_stock: 'Show "In stock" on the website', qp_limit: 'Qpay order limit', qp_fee: 'Qpay merchant fee', qp_merchant: 'Qpay merchant ID', qp_link: 'Qpay link for customers',
    preview_store: 'Preview website', start_fresh: 'Start fresh (remove demo data)', start_fresh_help: 'Removes demo orders, customers, quotes and expenses, and clears demo prices/stock. Your catalog and settings stay.',
    publish: 'Publish to website', publish_sub: 'Push product, price and setting changes to the live website (GitHub Pages).', gh_token: 'GitHub access token', gh_help: 'Create a fine-grained token at github.com → Settings → Developer settings, with "Contents: Read and write" on this repository only. It is stored only in this browser.',
    publish_now: 'Publish now', download_catalog: 'Download catalog file', publishing: 'Publishing…', published: 'Published! The website updates in about 1 minute.', no_token: 'Add a GitHub token first, or download the file and upload it to assets/js/ in your repository.',
    new_quote: 'New quote', import_wa: 'Paste from WhatsApp', quote_no: 'Quote', st_sent: 'Sent', st_accepted: 'Accepted', st_converted: 'Converted', st_lost: 'Lost', send_quote: 'Send quote', convert: 'Convert to order', mark_lost: 'Mark lost', pipeline_value: 'Open pipeline', conversion: 'Conversion', paste_here: 'Paste the customer\'s WhatsApp message (sent from the website quote list)', parse: 'Read message', parsed: '{n} items found', wants_qpay: 'Customer wants Qpay installments',
    wa_note: 'Messages open in WhatsApp (or WhatsApp Business) with the text ready — you just press Send. Only message customers who agreed to receive offers.',
    campaigns: 'Campaigns', new_campaign: 'New campaign', templates: 'Message templates', msg_log: 'Message log', audience: 'Audience', all_optin: 'All customers who opted in', by_vehicle: 'Owners of a vehicle', by_gov: 'Customers in a governorate', by_cat: 'Bought from a category', inactive: 'No purchase in 60+ days', workshops: 'Workshops / B2B', recipients: 'Recipients', message: 'Message', products_in_msg: 'Products to include (links to your website)', preview: 'Preview', create_send: 'Create & start sending', send_next: 'Send next', sent_n: '{a} of {b} sent', campaign_name: 'Campaign name', done: 'Done',
    opted_in: 'Opted-in customers', sent_30: 'Messages sent (30 days)', bills_sent: 'Bills sent', placeholders: 'Placeholders', reset_tpl: 'Reset to default', tpl_bill: 'Bill / invoice', tpl_confirmed: 'Order confirmed', tpl_ready: 'Ready for pickup', tpl_shipped: 'Shipped', tpl_delivered: 'Delivered + review', tpl_reminder: 'Payment reminder', tpl_quote: 'Quote', tpl_qpay: 'Qpay request', open_wa: 'Open WhatsApp', template: 'Template', no_phone: 'This customer has no phone number.',
    qp_title: 'Qpay installments', qp_sub: 'Customers pay in up to 4 interest-free payments. You send the Qpay request, the customer approves in the Qpay app, and Qpay settles the full amount to you.', send_request: 'Send request', approved: 'Approved', settled: 'Settled', declined: 'Declined', to_request: 'To request', awaiting: 'Awaiting customer', awaiting_settle: 'Awaiting settlement', settled_month: 'Settled this month', over_limit: 'Over Qpay limit', qp_ref: 'Qpay reference', schedule: 'Customer schedule', when_ships: 'When it ships', month_n: 'Month {n}', qp_how: 'How to send a Qpay request', qp_how1: 'Open the Qpay merchant app/portal and create a payment request for the order total and the customer\'s mobile number.', qp_how2: 'Click "Send request" here to message the customer on WhatsApp and mark it Requested.', qp_how3: 'When the customer approves in the Qpay app, mark it Approved. When the money reaches your account, mark it Settled.', net_after_fee: 'Net after fee'
  });
  I18N.add('ar', {
    quotes_sub: 'للقطع التي سعرها عند الطلب: جهّز العرض، أرسله على واتساب، ثم حوّله إلى طلب.', quotes: 'عروض الأسعار', whatsapp: 'واتساب', qpay: 'Qpay', send_bill: 'إرسال الفاتورة', notify: 'إشعار العميل', mark_paid: 'تحديد كمدفوع', paid: 'مدفوع', unpaid: 'غير مدفوع', qpay_pay: 'Qpay',
    qp_pending: 'بانتظار الإرسال', qp_requested: 'تم الطلب', qp_approved: 'تمت الموافقة', qp_settled: 'تمت التسوية', qp_declined: 'مرفوض',
    show_price: 'إظهار السعر في الموقع', fits_vehicles: 'السيارات المتوافقة', part_no: 'رقم القطعة', enter_prices: 'أدخل سعراً لكل قطعة', vehicle: 'السيارة', opt_in: 'موافق على استلام العروض عبر واتساب',
    site_url: 'عنوان الموقع', show_stock: 'إظهار "متوفر" في الموقع', qp_limit: 'حد طلب Qpay', qp_fee: 'رسوم Qpay على التاجر', qp_merchant: 'رقم تاجر Qpay', qp_link: 'رابط Qpay للعملاء',
    preview_store: 'معاينة الموقع', start_fresh: 'ابدأ من جديد (حذف البيانات التجريبية)', start_fresh_help: 'يحذف الطلبات والعملاء وعروض الأسعار والمصروفات التجريبية، ويمسح الأسعار والمخزون التجريبي. يبقى الكتالوج والإعدادات.',
    publish: 'النشر على الموقع', publish_sub: 'انشر تغييرات المنتجات والأسعار والإعدادات على الموقع المباشر (GitHub Pages).', gh_token: 'رمز وصول GitHub', gh_help: 'أنشئ رمزاً من github.com ← Settings ← Developer settings بصلاحية "Contents: Read and write" على هذا المستودع فقط. يُحفظ في هذا المتصفح فقط.',
    publish_now: 'انشر الآن', download_catalog: 'تنزيل ملف الكتالوج', publishing: 'جارٍ النشر…', published: 'تم النشر! سيتحدث الموقع خلال دقيقة تقريباً.', no_token: 'أضف رمز GitHub أولاً، أو نزّل الملف وارفعه إلى assets/js/ في المستودع.',
    new_quote: 'عرض سعر جديد', import_wa: 'لصق من واتساب', quote_no: 'عرض السعر', st_sent: 'مُرسل', st_accepted: 'مقبول', st_converted: 'تم التحويل', st_lost: 'خسارة', send_quote: 'إرسال العرض', convert: 'تحويل إلى طلب', mark_lost: 'تحديد كخسارة', pipeline_value: 'قيمة العروض المفتوحة', conversion: 'نسبة التحويل', paste_here: 'الصق رسالة العميل من واتساب (المرسلة من قائمة عرض السعر في الموقع)', parse: 'قراءة الرسالة', parsed: 'تم العثور على {n} قطعة', wants_qpay: 'العميل يريد التقسيط مع Qpay',
    wa_note: 'تُفتح الرسائل في واتساب (أو واتساب للأعمال) والنص جاهز — فقط اضغط إرسال. راسل فقط العملاء الموافقين على استلام العروض.',
    campaigns: 'الحملات', new_campaign: 'حملة جديدة', templates: 'قوالب الرسائل', msg_log: 'سجل الرسائل', audience: 'الجمهور', all_optin: 'كل العملاء الموافقين', by_vehicle: 'ملاك سيارة معينة', by_gov: 'عملاء محافظة', by_cat: 'اشتروا من فئة', inactive: 'لم يشتروا منذ 60 يوماً', workshops: 'الورش / الشركات', recipients: 'المستلمون', message: 'الرسالة', products_in_msg: 'منتجات تضاف للرسالة (روابط لموقعك)', preview: 'معاينة', create_send: 'إنشاء وبدء الإرسال', send_next: 'إرسال التالي', sent_n: 'تم إرسال {a} من {b}', campaign_name: 'اسم الحملة', done: 'تم',
    opted_in: 'عملاء موافقون', sent_30: 'رسائل مرسلة (30 يوماً)', bills_sent: 'فواتير مرسلة', placeholders: 'المتغيرات', reset_tpl: 'استعادة الافتراضي', tpl_bill: 'الفاتورة', tpl_confirmed: 'تأكيد الطلب', tpl_ready: 'جاهز للاستلام', tpl_shipped: 'تم الشحن', tpl_delivered: 'تم التسليم + تقييم', tpl_reminder: 'تذكير بالدفع', tpl_quote: 'عرض سعر', tpl_qpay: 'طلب Qpay', open_wa: 'فتح واتساب', template: 'القالب', no_phone: 'لا يوجد رقم هاتف لهذا العميل.',
    qp_title: 'التقسيط مع Qpay', qp_sub: 'يدفع العميل حتى 4 دفعات بدون فوائد. ترسل طلب Qpay، ويوافق العميل في التطبيق، وتحوّل Qpay المبلغ كاملاً إليك.', send_request: 'إرسال الطلب', approved: 'موافق عليه', settled: 'تمت التسوية', declined: 'مرفوض', to_request: 'بانتظار الطلب', awaiting: 'بانتظار العميل', awaiting_settle: 'بانتظار التسوية', settled_month: 'تمت تسويته هذا الشهر', over_limit: 'يتجاوز حد Qpay', qp_ref: 'مرجع Qpay', schedule: 'جدول دفعات العميل', when_ships: 'عند الشحن', month_n: 'الشهر {n}', qp_how: 'كيف ترسل طلب Qpay', qp_how1: 'افتح تطبيق/بوابة تاجر Qpay وأنشئ طلب دفع بقيمة الطلب ورقم هاتف العميل.', qp_how2: 'اضغط "إرسال الطلب" هنا لمراسلة العميل على واتساب وتحديده كمطلوب.', qp_how3: 'عند موافقة العميل حدده "موافق عليه"، وعند وصول المبلغ لحسابك حدده "تمت التسوية".', net_after_fee: 'الصافي بعد الرسوم'
  });

  const WA_SVG = '<svg class="ic" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.6-5.6C5.2 10 10 5.3 16 5.3S26.8 10 26.8 15.8 22 26.4 16 26.4Zm5.9-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z"/></svg>';

  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS) {
    const { D, $, $$, esc, fmt, money, moneyTxt, fDate, fDT, modal, toast, confirmBox, download, kpi, statusPill } = H;
    const t = (k, v) => { let x = H.t(k); if (v) Object.keys(v).forEach(n => { x = x.split('{' + n + '}').join(v[n]); }); return x; };
    const S = () => D().settings;
    const cur = () => S().currency || 'OMR';
    const phoneDigits = (ph) => { let d = String(ph || '').replace(/\D/g, ''); if (d.length === 8) d = '968' + d; if (d.startsWith('00')) d = d.slice(2); return d; };
    const waLink = (ph, text) => `https://api.whatsapp.com/send?phone=${phoneDigits(ph)}&text=${encodeURIComponent(text)}`;
    const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    const siteUrl = () => S().siteUrl || (location.origin + location.pathname.replace(/[^/]*$/, ''));
    const openWA = (ph, text, log) => { if (!phoneDigits(ph)) { toast(t('no_phone')); return false; } window.open(waLink(ph, text), '_blank', 'noopener'); if (log) DB.logWA(Object.assign({ to: ph, text: text.slice(0, 400) }, log)); return true; };
    const qpayTone = (st) => ({ pending: 'processing', requested: 'new', approved: 'shipped', settled: 'delivered', declined: 'cancelled' }[st] || 'new');

    // ---------- bill links (self-contained invoice page) ----------
    function b64url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function billLink(s) {
      const st = S();
      const data = { n: s.no, d: s.date, c: s.customerName, p: s.phone, it: s.items.map(i => [i.name, i.sku || '', i.qty, i.price]), s: s.subtotal, ds: s.discount, v: s.vat, vr: st.vat, sh: s.shippingFee || 0, t: s.total, pm: s.payment, pd: s.paid !== false, cu: cur(), b: { n: st.name, a: st.address, ph: st.phone, w: st.whatsapp, cr: st.cr }, q: s.payment === 'qpay' ? (st.qpay.payLink || '') : '' };
      return siteUrl() + 'bill.html#' + b64url(JSON.stringify(data));
    }
    const vars = (s, extra) => Object.assign({ name: (s.customerName || '').split(' ')[0] || '', order: s.no, total: `${cur()} ${fmt(s.total)}`, quarter: `${cur()} ${fmt(s.total / 4)}`, amount: `${cur()} ${fmt(s.total)}`, shop: S().name, maps: S().maps || '', phone: s.phone || '', link: billLink(s), site: siteUrl() }, extra || {});
    function sendBill(s) {
      if (!s.phone) { toast(t('no_phone')); return; }
      openWA(s.phone, fill(S().templates.bill, vars(s)), { type: 'bill', ref: s.no });
      s.billSent = Date.now(); DB.save();
    }
    function notifyModal(s, status) {
      const map = { processing: 'confirmed', new: 'confirmed', shipped: 'shipped', delivered: 'delivered', completed: 'bill' };
      let key = map[status || s.status] || 'confirmed';
      if (s.paid === false) key = status ? key : 'reminder';
      const keys = ['confirmed', 'ready', 'shipped', 'delivered', 'reminder', 'bill', 'qpay'];
      modal({
        title: `${t('notify')} · ${esc(s.customerName)}`,
        body: `<div class="field"><label>${t('template')}</label><select class="input" id="n_k">${keys.map(k => `<option value="${k}" ${k === key ? 'selected' : ''}>${t('tpl_' + k)}</option>`).join('')}</select></div>
          <div class="field mt"><label>${t('message')} → <span dir="ltr">${esc(s.phone || '—')}</span></label><textarea class="input" id="n_t" rows="7"></textarea></div><p class="faint" style="font-size:12.5px;margin:8px 0 0">${t('wa_note')}</p>`,
        footer: `<button class="btn" data-close>${t('close')}</button><button class="btn wa" id="n_go">${WA_SVG}${t('open_wa')}</button>`,
        onMount: (el, m) => {
          const upd = () => { $('#n_t', el).value = fill(S().templates[$('#n_k', el).value], vars(s)); };
          $('#n_k', el).onchange = upd; upd();
          $('#n_go', el).onclick = () => { if (openWA(s.phone, $('#n_t', el).value, { type: $('#n_k', el).value, ref: s.no })) m.close(); };
        }
      });
    }

    // ---------- publishing ----------
    // The GitHub token is kept inside the encrypted admin database (auth.js), not in plain localStorage.
    const getToken = () => (D().secrets || {}).ghToken || '';
    const setToken = (v) => { D().secrets.ghToken = (v || '').trim(); DB.save(); };
    function buildCatalog(imagePaths) {
      const st = S(), base = window.CATALOG || {};
      const cats = (base.categories || []).map(c => Object.assign({}, c, (D().categories.find(x => x.id === c.id) || {})));
      D().categories.forEach(c => { if (!cats.find(x => x.id === c.id)) cats.push(Object.assign({ descEn: '', descAr: '', image: '' }, c)); });
      const products = D().products.filter(p => p.active !== false).map(p => ({
        id: p.id, slug: p.slug, sku: p.sku, partNumber: p.partNumber || '', name: p.name, nameAr: p.nameAr || '', brand: p.brand || '', category: p.category,
        description: p.description || '', descriptionAr: p.descriptionAr || '', bullets: p.bullets || [], bulletsAr: p.bulletsAr || [], fitment: p.fitment || '', fitmentAr: p.fitmentAr || '',
        vehicles: p.vehicles || [], allMakes: p.allMakes || [], image: (imagePaths && imagePaths[p.id]) || p.image || '', featured: !!p.featured, online: p.online !== false,
        price: p.showPrice ? (p.price || 0) : 0, oldPrice: p.showPrice ? (p.oldPrice || 0) : 0, stock: st.showStock ? (p.stock || 0) : 0
      }));
      const brands = (base.brands || []).slice();
      products.forEach(p => { if (p.brand && !brands.find(b => b.name === p.brand)) brands.push({ id: p.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: p.brand, label: p.brand.toUpperCase(), about: '' }); });
      return {
        settings: { name: st.name, whatsapp: st.whatsapp, phone: st.phone, instagram: st.instagram, maps: st.maps, address: st.address, addressAr: st.addressAr, qpayLimit: st.qpay.limit, currency: st.currency, since: st.since, rating: st.rating, followers: st.followers, showStock: !!st.showStock, cr: st.cr || '', qpayLink: /^https:\/\//.test(st.qpay.payLink || '') ? st.qpay.payLink : '', aiEndpoint: /^https:\/\//.test(st.aiEndpoint || '') ? st.aiEndpoint : '' },
        categories: cats, makes: base.makes || D().makes || [], vehicles: base.vehicles || D().vehicles || [], brands, products, publishedAt: new Date().toISOString()
      };
    }
    // "Preview website": the store reads this public copy (no costs, no customers) instead of the encrypted database
    function writePreview() { try { localStorage.setItem('x4w_preview', JSON.stringify({ at: Date.now(), products: buildCatalog().products })); } catch (e) { } }
    const catalogJS = (cat) => '/* Catalog published from the admin dashboard on ' + new Date().toISOString() + ' */\nwindow.CATALOG = ' + JSON.stringify(cat) + ';\n';
    async function gh(path, contentB64, message) {
      const g = S().github, tok = getToken();
      const url = `https://api.github.com/repos/${g.owner}/${g.repo}/contents/${path}`;
      const hdr = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      let sha;
      const r0 = await fetch(url + '?ref=' + encodeURIComponent(g.branch), { headers: hdr });
      if (r0.status === 200) sha = (await r0.json()).sha;
      else if (r0.status === 401 || r0.status === 403) throw new Error('GitHub rejected the token (' + r0.status + '). Check it has Contents: Read and write on ' + g.owner + '/' + g.repo + '.');
      const r = await fetch(url, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr), body: JSON.stringify({ message, content: contentB64, branch: g.branch, sha }) });
      if (!r.ok) { let m = r.status + ''; try { m += ' ' + (await r.json()).message; } catch (e) { } throw new Error('GitHub: ' + m); }
    }
    async function publish(statusEl) {
      if (!getToken()) { statusEl.textContent = t('no_token'); return; }
      statusEl.innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${t('publishing')}`;
      try {
        const paths = {};
        for (const p of D().products) {
          if (p.image && p.image.startsWith('data:')) {
            const path = `assets/img/products/${p.slug || p.id}.jpg`;
            await gh(path, p.image.split(',')[1], 'Product photo: ' + p.name);
            paths[p.id] = path; p.image = path;
          }
        }
        const cat = buildCatalog(paths);
        await gh('assets/js/catalog.js', btoa(unescape(encodeURIComponent(catalogJS(cat)))), 'Publish catalog from admin (' + cat.products.length + ' products)');
        S().lastPublished = Date.now(); DB.save();
        statusEl.innerHTML = `<span class="pos-val">✓ ${t('published')}</span> <a href="${esc(siteUrl())}" target="_blank" rel="noopener" style="text-decoration:underline">${esc(siteUrl())}</a>`;
      } catch (e) { statusEl.innerHTML = `<span class="neg-val">⚠️ ${esc(e.message || e)}</span>`; }
    }
    function publishCard() {
      const g = S().github, tok = getToken();
      return `<div class="card mt"><div class="card-h"><h3>${icon('external')} ${t('publish')}</h3>${S().lastPublished ? `<span class="faint" style="font-size:12px">${fDT(S().lastPublished)}</span>` : ''}</div><div class="card-b">
        <p class="muted" style="margin:0 0 10px">${t('publish_sub')}</p>
        <div class="form-grid"><div class="field"><label>Owner / repo</label><input class="input" id="gh_repo" value="${esc(g.owner + '/' + g.repo)}"></div><div class="field"><label>Branch</label><input class="input" id="gh_branch" value="${esc(g.branch)}"></div>
          <div class="field full"><label>${t('gh_token')}</label><input class="input" id="gh_tok" type="password" autocomplete="off" placeholder="${tok ? '•••••••• ' + esc(tok.slice(-4)) : 'github_pat_…'}"></div></div>
        <p class="faint" style="font-size:12.5px;margin:6px 0 0">${t('gh_help')}</p>
        <div class="actions mt"><button class="btn primary" id="gh_pub">${icon('upload')}${t('publish_now')}</button><button class="btn" id="gh_dl">${icon('download')}${t('download_catalog')}</button>${tok ? `<button class="btn ghost danger" id="gh_rm">${t('remove_key')}</button>` : ''}</div><div id="gh_st" class="muted" style="margin-top:10px;font-size:13px"></div></div></div>`;
    }
    function bindPublish(v) {
      // only "owner/repo" with GitHub's allowed characters, so the token can't be sent to another API path
      const saveCfg = () => { const parts = ($('#gh_repo', v).value || '').trim().split('/').map(x => x.trim()); const [o, r] = parts; if (parts.length === 2 && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(o) && /^[A-Za-z0-9._-]{1,100}$/.test(r) && !/^\.+$/.test(r)) Object.assign(S().github, { owner: o, repo: r }); const br = $('#gh_branch', v).value.trim(); S().github.branch = /^[A-Za-z0-9._\/-]{1,100}$/.test(br) && !br.includes('..') ? br : 'main'; const tk = $('#gh_tok', v).value.trim(); if (tk) setToken(tk); DB.save(); };
      $('#gh_pub', v).onclick = () => { saveCfg(); publish($('#gh_st', v)); };
      $('#gh_dl', v).onclick = () => download('catalog.js', catalogJS(buildCatalog()), 'text/javascript');
      if ($('#gh_rm', v)) $('#gh_rm', v).onclick = () => { setToken(''); H.render(); };
    }
    Object.assign(H, { WA: WA_SVG, waLink, fill, sendBill, notifyModal, billLink, qpayTone, publishCard, bindPublish, openWA, writePreview });

    // ======================================================
    // QUOTES
    // ======================================================
    const QST = ['new', 'sent', 'accepted', 'converted', 'lost'];
    const qTotal = (q) => q.items.reduce((a, i) => a + i.qty * (i.price || 0), 0);
    const qCust = (q) => DB.customer(q.customerId) || { name: q.customerName || '—', phone: q.phone || '' };
    let qTab = 'open';
    VIEWS.quotes = function (v) {
      const all = D().quotes.slice().sort((a, b) => b.date - a.date);
      const list = qTab === 'open' ? all.filter(q => ['new', 'sent', 'accepted'].includes(q.status)) : qTab === 'all' ? all : all.filter(q => q.status === qTab);
      const open = all.filter(q => ['new', 'sent', 'accepted'].includes(q.status));
      const closed = all.filter(q => ['converted', 'lost'].includes(q.status));
      const vat = (S().vat || 0) / 100;
      v.innerHTML = `
        <div class="page-head"><div><h2>${t('quotes')}</h2><p>${t('quotes_sub')}</p></div>
          <div class="actions"><button class="btn wa" id="qimp">${WA_SVG}${t('import_wa')}</button><button class="btn primary" id="qnew">${icon('plus')}${t('new_quote')}</button></div></div>
        <div class="grid g-kpi">
          ${kpi('file', 'tone-info', t('st_new'), `<span class="num">${all.filter(q => q.status === 'new').length}</span>`, '')}
          ${kpi('send', 'tone-violet', t('st_sent'), `<span class="num">${all.filter(q => q.status === 'sent').length}</span>`, '')}
          ${kpi('finance', 'tone-brand', t('pipeline_value'), H.big(open.reduce((a, q) => a + qTotal(q) * (1 + vat), 0)), '')}
          ${kpi('check', 'tone-ok', t('conversion'), `<span class="num">${closed.length ? Math.round(closed.filter(q => q.status === 'converted').length / closed.length * 100) : 0}%</span>`, `<span>${closed.filter(q => q.status === 'converted').length} / ${closed.length}</span>`)}
        </div>
        <div class="card mt"><div class="toolbar"><div class="seg" id="qtab">${[['open', t('st_new') + ' + ' + t('st_sent')], ['all', t('all')], ['converted', t('st_converted')], ['lost', t('st_lost')]].map(([k, l]) => `<button data-k="${k}" class="${qTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="faint" style="margin-inline-start:auto">${list.length}</span></div>
          <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>${t('quote_no')}</th><th>${t('date')}</th><th>${t('customer')}</th><th>${t('vehicle')}</th><th>${t('items')}</th><th class="r">${t('total')}</th><th>${t('status')}</th></tr></thead><tbody>
            ${list.map(q => { const c = qCust(q); return `<tr class="click" data-qid="${q.id}"><td class="strong">${esc(q.no)}${q.qpay ? ' <span class="chip">Qpay</span>' : ''}</td><td class="muted">${fDT(q.date)}</td><td>${esc(c.name)}<div class="faint" style="font-size:12px" dir="ltr">${esc(c.phone || '')}</div></td><td class="muted">${esc(q.vehicle || '—')}</td><td class="muted">${q.items.map(i => i.qty + '× ' + esc(i.name)).join('<br>')}</td><td class="r strong">${qTotal(q) ? money(qTotal(q) * (1 + vat)) : '—'}</td><td>${statusPill(q.status === 'new' ? 'new' : q.status === 'sent' ? 'processing' : q.status === 'accepted' ? 'shipped' : q.status === 'converted' ? 'delivered' : 'cancelled').replace(/>[^<]*<\/span>$/, '>' + t('st_' + q.status) + '</span>')}</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div>`;
      H.bindSeg('qtab', k => { qTab = k; H.render(); });
      $$('[data-qid]', v).forEach(tr => tr.onclick = () => quoteModal(D().quotes.find(q => q.id === tr.dataset.qid)));
      $('#qnew', v).onclick = () => quoteModal(null);
      $('#qimp', v).onclick = importModal;
    };
    function quoteModal(q, prefill) {
      const isNew = !q;
      q = q || Object.assign({ id: DB.uid('q'), no: DB.nextNo('Q-', 1000), date: Date.now(), customerId: null, vehicle: '', status: 'new', qpay: false, note: '', source: 'whatsapp', items: [] }, prefill || {});
      const c = qCust(q);
      const lines = q.items.map(i => ({ pid: i.pid, qty: i.qty, val: i.price || (DB.product(i.pid) || {}).price || 0 }));
      modal({
        title: `${t('quote_no')} ${esc(q.no)}`, wide: true,
        body: `<div class="form-grid"><div class="field"><label>${t('customer_name')}</label><input class="input" id="q_n" value="${esc(c.name === '—' ? '' : c.name)}"></div><div class="field"><label>${t('phone')}</label><input class="input" id="q_p" dir="ltr" value="${esc(c.phone || '')}" placeholder="+968"></div>
          <div class="field"><label>${t('vehicle')}</label><input class="input" id="q_v" value="${esc(q.vehicle || '')}" placeholder="Toyota Land Cruiser 300 2024"></div><div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="q_q" ${q.qpay ? 'checked' : ''}> ${t('wants_qpay')}</label></div>
          <div class="field full"><label>${t('items')}</label><div id="q_lines"></div></div><div class="field full"><label>${t('note')}</label><input class="input" id="q_note" value="${esc(q.note || '')}"></div>${q.message ? `<div class="field full"><details><summary class="faint" style="cursor:pointer;font-size:12.5px">${I18N.lang === 'ar' ? 'رسالة العميل الأصلية' : 'Original customer message'}</summary><pre class="wa-bubble" style="white-space:pre-wrap;margin:6px 0 0;font:inherit">${esc(q.message)}</pre></details></div>` : ''}</div>
          <div class="totals mt" id="q_tot" style="border-radius:10px"></div>`,
        footer: `${!isNew ? `<button class="btn ghost danger" id="q_del" style="margin-inline-end:auto">${icon('trash')}</button><button class="btn" id="q_lost">${t('mark_lost')}</button>` : '<span style="margin-inline-end:auto"></span>'}<button class="btn" id="q_save">${t('save')}</button><button class="btn wa" id="q_send">${WA_SVG}${t('send_quote')}</button><button class="btn primary" id="q_conv">${icon('check')}${t('convert')}</button>`,
        onMount: (el, m) => {
          const host = $('#q_lines', el);
          const vat = (S().vat || 0) / 100;
          const upd = () => { const sub = lines.reduce((a, l) => a + l.qty * l.val, 0); $('#q_tot', el).innerHTML = `<div class="ln"><span>${t('subtotal')}</span>${money(sub)}</div><div class="ln"><span>${t('vat')} ${S().vat}%</span>${money(sub * vat)}</div><div class="ln big"><span>${t('total')}</span>${money(sub * (1 + vat))}</div><div class="ln"><span>Qpay 4×</span>${money(sub * (1 + vat) / 4)}</div>`; };
          H.linesEditor(host, lines, 'sale'); host.addEventListener('change', upd); upd();
          const collect = () => {
            const name = $('#q_n', el).value.trim(), ph = $('#q_p', el).value.trim();
            if (name || ph) { const cu = DB.findOrCreateCustomer(name || 'WhatsApp customer', ph); if (name && cu.name !== name && /customer/i.test(cu.name)) cu.name = name; q.customerId = cu.id; }
            q.vehicle = $('#q_v', el).value.trim(); q.qpay = $('#q_q', el).checked; q.note = $('#q_note', el).value.trim();
            q.items = lines.map(l => { const p = DB.product(l.pid); return { pid: l.pid, name: p.name, sku: p.partNumber || p.sku, qty: l.qty, price: l.val }; });
            if (isNew && !D().quotes.includes(q)) D().quotes.push(q);
            DB.save();
          };
          $('#q_save', el).onclick = () => { collect(); m.close(); toast(t('saved')); H.render(); };
          $('#q_send', el).onclick = () => {
            collect(); const cu = qCust(q); if (!cu.phone) { toast(t('no_phone')); return; }
            const tot = qTotal(q) * (1 + vat);
            const items = q.items.map(i => `• ${i.qty} × ${i.name}${i.sku ? ' [' + i.sku + ']' : ''} — ${cur()} ${fmt(i.price * i.qty)}`).join('\n');
            openWA(cu.phone, fill(S().templates.quote, { name: (cu.name || '').split(' ')[0], shop: S().name, items, total: `${cur()} ${fmt(tot)} (incl. VAT)`, quarter: `${cur()} ${fmt(tot / 4)}` }), { type: 'quote', ref: q.no });
            if (q.status === 'new') q.status = 'sent'; q.sentAt = Date.now(); DB.save(); m.close(); H.render();
          };
          $('#q_conv', el).onclick = () => {
            collect(); if (!q.items.length) return;
            if (q.items.some(i => !(i.price > 0))) { toast(t('enter_prices')); return; }
            const pay = q.qpay ? 'qpay' : 'transfer';
            const s = DB.createSale({ channel: 'online', source: q.source || 'whatsapp', customerId: q.customerId, payment: pay, quoteId: q.id, note: [q.vehicle, q.note].filter(Boolean).join(' · '), items: q.items.map(i => ({ pid: i.pid, qty: i.qty, price: i.price })) });
            q.status = 'converted'; q.saleId = s.id; DB.save(); m.close(); toast(`${s.no} · ${t('saved')}`); H.render(); H.orderModal(s.id);
          };
          if ($('#q_lost', el)) $('#q_lost', el).onclick = () => { q.status = 'lost'; DB.save(); m.close(); H.render(); };
          if ($('#q_del', el)) $('#q_del', el).onclick = () => { m.close(); confirmBox(t('confirm_delete'), () => { D().quotes = D().quotes.filter(x => x !== q); DB.save(); H.render(); }); };
        }
      });
    }
    // Parse the message the website sends ("• 2 × Name [PART]" lines, Vehicle:, Name:, Qpay, Ref:)
    function parseWA(text) {
      const out = { items: [], vehicle: '', name: '', qpay: /qpay/i.test(text), ref: '' };
      const P = D().products;
      text.split(/\r?\n/).forEach(line => {
        const l = line.trim();
        let m = l.match(/^[•\-*·]?\s*(\d+)\s*[×xX*]\s*(.+?)\s*(?:\[([^\]]+)\])?\s*(?:—.*)?$/);
        if (m && !/^(vehicle|السيارة|name|الاسم|ref)/i.test(l)) {
          const qty = +m[1], nm = m[2].trim(), pn = (m[3] || '').trim();
          const p = (pn && P.find(x => (x.partNumber || x.sku) === pn)) || P.find(x => x.name === nm || x.nameAr === nm) || P.find(x => nm.length > 6 && (x.name.toLowerCase().includes(nm.toLowerCase()) || nm.toLowerCase().includes(x.name.toLowerCase())));
          if (p) out.items.push({ pid: p.id, name: p.name, sku: p.partNumber || p.sku, qty, price: p.price || 0 });
          return;
        }
        if ((m = l.match(/^(?:Vehicle|السيارة)\s*:\s*(.+)$/i))) out.vehicle = m[1].trim();
        if ((m = l.match(/^(?:Name|الاسم)\s*:\s*(.+)$/i))) out.name = m[1].trim();
        if ((m = l.match(/^Ref\s*:\s*(\S+)/i))) out.ref = m[1];
      });
      return out;
    }
    const matcher = window.Match ? Match.create({ products: () => D().products.filter(p => p.active !== false), vehicles: D().vehicles || [], makes: D().makes || [], categories: D().categories, brands: D().brands || [] }) : null;
    function importModal() {
      modal({
        title: t('import_wa'), wide: true,
        body: `<div class="field"><label>${t('paste_here')}</label><textarea class="input" id="im_t" rows="9" placeholder="• 1 × Old Man Emu BP-51 Suspension Kit (Land Cruiser 300) [EKBP00173]&#10;Vehicle: Toyota Land Cruiser 300 2023&#10;&#10;— or any message, e.g. —&#10;salam, need lift kit + 4 tyres for my patrol 2021&#10;ابي طقم رفع وكفرات للاندكروزر 300"></textarea></div><div class="form-grid mt"><div class="field"><label>${t('phone')}</label><input class="input" id="im_p" dir="ltr" placeholder="+968"></div></div><div id="im_r" class="muted" style="margin-top:8px"></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn" id="im_ai" title="${AI.getKey() ? '' : esc(H.t('no_key'))}">${icon('sparkle')}${H.t('ai_read')}</button><button class="btn primary" id="im_go">${t('parse')}</button>`,
        onMount: (el, m) => {
          const open = (r, how) => {
            const msg = $('#im_t', el).value.trim();
            if (!r.items.length) { $('#im_r', el).innerHTML = esc(t('parsed', { n: 0 })) + (r.unmatched && r.unmatched.length ? `<br>${esc(r.unmatched.join(' · '))}` : ''); return; }
            m.close();
            const ph = $('#im_p', el).value.trim();
            const cu = (r.name || ph) ? DB.findOrCreateCustomer(r.name || 'WhatsApp customer', ph) : null;
            const missing = (r.unmatched || []).length ? 'Not in catalog: ' + r.unmatched.join('; ') : '';
            quoteModal(null, { items: r.items, vehicle: r.vehicle, qpay: r.qpay, customerId: cu ? cu.id : null, note: [r.ref ? 'Ref ' + r.ref : '', missing].filter(Boolean).join(' · '), message: msg.slice(0, 2000) });
            toast(t('parsed', { n: r.items.length }) + (how ? ' · ' + how : ''));
          };
          $('#im_go', el).onclick = () => {
            const txt = $('#im_t', el).value;
            let r = parseWA(txt);
            // not the website's format? understand it as a normal customer message
            if (!r.items.length && matcher) r = matcher.parseQuote(txt);
            open(r);
          };
          $('#im_ai', el).onclick = async () => {
            if (!AI.getKey()) { toast(H.t('no_key')); return; }
            const txt = $('#im_t', el).value.trim(); if (!txt) return;
            const btn = $('#im_ai', el); btn.disabled = true; $('#im_r', el).innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${H.t('ai_reading')}`;
            try {
              const a = await AI.quoteFromText(txt);
              open({ items: a.items, vehicle: a.vehicle, qpay: a.wants_qpay, name: a.customer_name, unmatched: a.not_in_catalog }, 'AI');
            } catch (e) { $('#im_r', el).textContent = '⚠️ ' + AI.explainError(e, I18N.lang); }
            btn.disabled = false;
          };
        }
      });
    }

    // ======================================================
    // QPAY
    // ======================================================
    let qpTab = 'pending';
    VIEWS.qpay = function (v) {
      const st = S().qpay;
      const all = D().sales.filter(s => s.payment === 'qpay' && s.status !== 'cancelled' || (s.qpay && s.qpay.status === 'declined')).filter(s => s.qpay).sort((a, b) => b.date - a.date);
      const by = (k) => all.filter(s => s.qpay.status === k);
      const mStart = new Date(); mStart.setDate(1); mStart.setHours(0, 0, 0, 0);
      const settledM = by('settled').filter(s => (s.qpay.settledAt || s.date) >= mStart.getTime());
      const settledAmt = settledM.reduce((a, s) => a + s.total, 0);
      const list = by(qpTab);
      v.innerHTML = `
        <div class="page-head"><div><h2>${icon('card')} ${t('qp_title')}</h2><p>${t('qp_sub')}</p></div><div class="actions"><a class="btn" href="https://qpay.om/" target="_blank" rel="noopener">${icon('external')}qpay.om</a></div></div>
        <div class="grid g-kpi">
          ${kpi('alert', 'tone-warn', t('to_request'), `<span class="num">${by('pending').length}</span>`, `<span>${moneyTxt(by('pending').reduce((a, s) => a + s.total, 0), 0)}</span>`)}
          ${kpi('send', 'tone-info', t('awaiting'), `<span class="num">${by('requested').length}</span>`, `<span>${moneyTxt(by('requested').reduce((a, s) => a + s.total, 0), 0)}</span>`)}
          ${kpi('clock', 'tone-violet', t('awaiting_settle'), `<span class="num">${by('approved').length}</span>`, `<span>${moneyTxt(by('approved').reduce((a, s) => a + s.total, 0), 0)}</span>`)}
          ${kpi('check', 'tone-ok', t('settled_month'), H.big(settledAmt), `<span>${t('net_after_fee')} ${moneyTxt(settledAmt * (1 - (st.feePct || 0) / 100), 0)}</span>`)}
        </div>
        <div class="grid g-21 mt">
          <div class="card"><div class="toolbar"><div class="seg" id="qptab">${['pending', 'requested', 'approved', 'settled', 'declined'].map(k => `<button data-k="${k}" class="${qpTab === k ? 'on' : ''}">${t('qp_' + k)} <span class="faint">${by(k).length}</span></button>`).join('')}</div></div>
            <div class="table-wrap">${list.length ? `<table class="t"><thead><tr><th>${t('order')}</th><th>${t('customer')}</th><th class="r">${t('total')}</th><th class="r">4×</th><th>${t('status')}</th><th></th></tr></thead><tbody>
              ${list.map(s => `<tr><td class="strong click" data-oid="${s.id}" style="cursor:pointer">${esc(s.no)}<div class="faint" style="font-size:12px">${fDate(s.date)}</div></td><td>${esc(s.customerName)}<div class="faint" style="font-size:12px" dir="ltr">${esc(s.phone || '')}</div></td>
                <td class="r strong">${money(s.total)}${s.total > st.limit ? `<div><span class="pill s-cancelled" style="font-size:11px">${t('over_limit')}</span></div>` : ''}</td><td class="r muted">${money(s.total / (st.installments || 4))}</td>
                <td><span class="pill s-${qpayTone(s.qpay.status)}">${t('qp_' + s.qpay.status)}</span>${s.qpay.ref ? `<div class="faint" style="font-size:12px">${esc(s.qpay.ref)}</div>` : ''}</td>
                <td class="r" style="white-space:nowrap">${s.qpay.status === 'pending' ? `<button class="btn sm wa" data-req="${s.id}">${WA_SVG}${t('send_request')}</button>` : ''}${s.qpay.status === 'requested' ? `<button class="btn sm" data-qa="approved" data-id="${s.id}">${t('approved')}</button> <button class="btn sm ghost danger" data-qa="declined" data-id="${s.id}">${t('declined')}</button>` : ''}${s.qpay.status === 'approved' ? `<button class="btn sm primary" data-qa="settled" data-id="${s.id}">${t('settled')}</button>` : ''}${s.qpay.status === 'declined' ? `<button class="btn sm" data-qa="pending" data-id="${s.id}">${icon('refresh')}</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">${t('no_results')}</div>`}</div></div>
          <div class="card"><div class="card-h"><h3>${t('qp_how')}</h3></div><div class="card-b"><ol class="ol-steps"><li>${t('qp_how1')}</li><li>${t('qp_how2')}</li><li>${t('qp_how3')}</li></ol>
            <div class="stat-line"><span>${t('qp_limit')}</span><b>${moneyTxt(st.limit, 0)}</b></div><div class="stat-line"><span>${t('qp_fee')}</span><b>${st.feePct || 0}%</b></div>${st.merchantId ? `<div class="stat-line"><span>${t('qp_merchant')}</span><b>${esc(st.merchantId)}</b></div>` : ''}<a class="btn sm mt" href="#/settings">${icon('settings')}${t('settings')}</a></div></div>
        </div>`;
      H.bindSeg('qptab', k => { qpTab = k; H.render(); });
      $$('[data-oid]', v).forEach(e => e.onclick = () => H.orderModal(e.dataset.oid));
      $$('[data-qa]', v).forEach(b => b.onclick = () => { DB.setQpay(b.dataset.id, b.dataset.qa); toast(t('saved')); H.render(); });
      $$('[data-req]', v).forEach(b => b.onclick = () => requestModal(D().sales.find(s => s.id === b.dataset.req)));
    };
    function requestModal(s) {
      const st = S().qpay, n = st.installments || 4;
      const labels = [t('when_ships')].concat(Array.from({ length: n - 1 }, (_, i) => t('month_n', { n: i + 1 })));
      modal({
        title: `Qpay · ${esc(s.no)}`,
        body: `<dl class="kv"><dt>${t('customer')}</dt><dd>${esc(s.customerName)}</dd><dt>${t('phone')}</dt><dd dir="ltr">${esc(s.phone || '—')}</dd><dt>${t('total')}</dt><dd>${money(s.total)}</dd></dl>
          ${s.total > st.limit ? `<div class="notice mt" style="background:var(--bad-bg);color:var(--bad)">${icon('alert')}<div>${t('over_limit')} (${moneyTxt(st.limit, 0)})</div></div>` : ''}
          <h4 style="margin:16px 0 8px">${t('schedule')}</h4><div class="inst-grid">${labels.map(l => `<div><small>${l}</small><b class="num">${fmt(s.total / n)}</b></div>`).join('')}</div>
          <div class="field mt"><label>${t('qp_ref')}</label><input class="input" id="qp_ref" value="${esc(s.qpay.ref || '')}" placeholder="QP…"></div>
          <div class="field mt"><label>${t('message')}</label><textarea class="input" id="qp_msg" rows="5">${esc(fill(S().templates.qpay, vars(s, { link: st.payLink || '' })))}</textarea></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn" id="qp_only">${t('qp_requested')}</button><button class="btn wa" id="qp_go">${WA_SVG}${t('send_request')}</button>`,
        onMount: (el, m) => {
          $('#qp_only', el).onclick = () => { DB.setQpay(s.id, 'requested', $('#qp_ref', el).value.trim()); m.close(); H.render(); };
          $('#qp_go', el).onclick = () => { if (openWA(s.phone, $('#qp_msg', el).value, { type: 'qpay', ref: s.no })) { DB.setQpay(s.id, 'requested', $('#qp_ref', el).value.trim()); m.close(); H.render(); } };
        }
      });
    }

    // ======================================================
    // WHATSAPP – campaigns, templates, log
    // ======================================================
    let waTab = 'campaigns';
    VIEWS.whatsapp = function (v) {
      const cs = D().customers, log = D().waLog || [];
      const since = Date.now() - 30 * DB.DAY;
      v.innerHTML = `
        <div class="page-head"><div><h2>${WA_SVG} ${t('whatsapp')}</h2><p>${t('wa_note')}</p></div><div class="actions"><button class="btn primary" id="wa_new">${icon('megaphone')}${t('new_campaign')}</button></div></div>
        <div class="grid g-kpi">
          ${kpi('customers', 'tone-ok', t('opted_in'), `<span class="num">${cs.filter(c => c.optIn !== false && c.phone).length}</span>`, `<span>/ ${cs.length}</span>`)}
          ${kpi('send', 'tone-info', t('sent_30'), `<span class="num">${log.filter(l => l.date >= since).length}</span>`, '')}
          ${kpi('megaphone', 'tone-brand', t('campaigns'), `<span class="num">${D().campaigns.length}</span>`, '')}
          ${kpi('file', 'tone-violet', t('bills_sent'), `<span class="num">${log.filter(l => l.type === 'bill').length}</span>`, '')}
        </div>
        <div class="tabs mt" id="watabs">${[['campaigns', t('campaigns')], ['templates', t('templates')], ['log', t('msg_log')]].map(([k, l]) => `<button data-k="${k}" class="${waTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div id="wabody"></div>`;
      $$('#watabs button', v).forEach(b => b.onclick = () => { waTab = b.dataset.k; H.render(); });
      $('#wa_new', v).onclick = campaignModal;
      const body = $('#wabody', v);
      if (waTab === 'campaigns') {
        const list = D().campaigns.slice().sort((a, b) => b.date - a.date);
        body.innerHTML = `<div class="card">${list.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${t('campaign_name')}</th><th>${t('date')}</th><th>${t('audience')}</th><th>${t('recipients')}</th><th></th></tr></thead><tbody>
          ${list.map(c => { const sent = c.recipients.filter(r => r.sent).length; return `<tr><td class="strong">${esc(c.name)}</td><td class="muted">${fDate(c.date)}</td><td class="muted">${esc(c.audienceLabel)}</td><td><div class="bar" style="width:140px"><span style="width:${sent / Math.max(1, c.recipients.length) * 100}%"></span></div><span class="faint" style="font-size:12px">${t('sent_n', { a: sent, b: c.recipients.length })}</span></td><td class="r"><button class="btn sm ${sent < c.recipients.length ? 'wa' : ''}" data-run="${c.id}">${sent < c.recipients.length ? WA_SVG + t('send_next') : t('done')}</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="empty">${icon('megaphone', 'big')}<p>${t('new_campaign')}</p><button class="btn primary" id="wa_new2">${icon('plus')}${t('new_campaign')}</button></div>`}</div>`;
        $$('[data-run]', body).forEach(b => b.onclick = () => runCampaign(D().campaigns.find(c => c.id === b.dataset.run)));
        if ($('#wa_new2', body)) $('#wa_new2', body).onclick = campaignModal;
      } else if (waTab === 'templates') {
        const T = S().templates, keys = Object.keys(DB.DEFAULT_TEMPLATES);
        body.innerHTML = `<div class="card"><div class="card-b"><p class="muted" style="margin:0 0 14px">${t('placeholders')}: <code>{name}</code> <code>{order}</code> <code>{total}</code> <code>{quarter}</code> <code>{amount}</code> <code>{link}</code> <code>{shop}</code> <code>{maps}</code> <code>{phone}</code> <code>{items}</code></p>
          <div class="form-grid">${keys.map(k => `<div class="field"><label>${t('tpl_' + k)}</label><textarea class="input" rows="5" data-tpl="${k}">${esc(T[k])}</textarea></div>`).join('')}</div>
          <div class="actions mt"><button class="btn primary" id="tpl_save">${icon('check')}${t('save')}</button><button class="btn" id="tpl_reset">${icon('refresh')}${t('reset_tpl')}</button></div></div></div>`;
        $('#tpl_save', body).onclick = () => { $$('[data-tpl]', body).forEach(x => T[x.dataset.tpl] = x.value); DB.save(); toast(t('saved')); };
        $('#tpl_reset', body).onclick = () => confirmBox(t('reset_tpl') + '?', () => { S().templates = Object.assign({}, DB.DEFAULT_TEMPLATES); DB.save(); H.render(); });
      } else {
        body.innerHTML = `<div class="card">${log.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>${t('date')}</th><th>${t('phone')}</th><th>${t('type')}</th><th>${t('order')}</th><th>${t('message')}</th></tr></thead><tbody>
          ${log.slice(0, 200).map(l => `<tr><td class="muted">${fDT(l.date)}</td><td dir="ltr">${esc(l.to)}</td><td><span class="chip">${esc(t('tpl_' + l.type) !== 'tpl_' + l.type ? t('tpl_' + l.type) : l.type)}</span></td><td>${esc(l.ref || '')}</td><td class="muted" style="max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.text)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${t('no_results')}</div>`}</div>`;
      }
    };
    function audience(kind, val) {
      const cs = D().customers.filter(c => c.optIn !== false && c.phone);
      const lastBuy = (c) => D().sales.filter(s => s.customerId === c.id).reduce((a, s) => Math.max(a, s.date), 0);
      if (kind === 'vehicle') return cs.filter(c => c.vehicle === val);
      if (kind === 'gov') return cs.filter(c => c.city === val);
      if (kind === 'workshop') return cs.filter(c => c.type === 'workshop');
      if (kind === 'cat') return cs.filter(c => D().sales.some(s => s.customerId === c.id && s.items.some(i => (DB.product(i.pid) || {}).category === val)));
      if (kind === 'inactive') return cs.filter(c => Date.now() - lastBuy(c) > 60 * DB.DAY);
      return cs;
    }
    function campaignModal() {
      const vehicles = D().vehicles || [];
      const prods = D().products.filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name));
      const lang = I18N.lang;
      const defMsg = lang === 'ar' ? 'مرحباً {name} 👋\nوصلتنا قطع جديدة تناسب سيارتك في {shop}! اطلب السعر على واتساب، وقسّطها على 4 دفعات بدون فوائد مع Qpay.' : 'Hi {name} 👋\nNew stock just landed at {shop} that fits your 4x4! Reply for a price — and pay in 4 interest-free installments with Qpay.';
      modal({
        title: t('new_campaign'), wide: true,
        body: `<div class="form-grid"><div class="field full"><label>${t('campaign_name')}</label><input class="input" id="cp_n" value="${lang === 'ar' ? 'عرض جديد' : 'New arrivals'} – ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}"></div>
          <div class="field"><label>${t('audience')}</label><select class="input" id="cp_a"><option value="all">${t('all_optin')}</option><option value="vehicle">${t('by_vehicle')}</option><option value="gov">${t('by_gov')}</option><option value="cat">${t('by_cat')}</option><option value="workshop">${t('workshops')}</option><option value="inactive">${t('inactive')}</option></select></div>
          <div class="field"><label>&nbsp;</label><select class="input hide" id="cp_av"></select></div>
          <div class="field full"><label>${t('products_in_msg')}</label><select class="input" id="cp_p" multiple size="5">${prods.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
          <div class="field full"><label style="display:flex;justify-content:space-between;align-items:center">${t('message')}<button class="btn sm" type="button" id="cp_ai" title="${AI.getKey() ? '' : esc(H.t('no_key'))}">${icon('sparkle')}${H.t('ai_write')}</button></label><textarea class="input" id="cp_m" rows="5">${esc(defMsg)}</textarea></div></div>
          <div class="grid g-2 mt" style="align-items:start"><div><label class="faint" style="font-size:12.5px">${t('preview')}</label><div class="wa-bubble" id="cp_prev"></div></div><div><label class="faint" style="font-size:12.5px">${t('recipients')}: <b id="cp_cnt"></b></label><div id="cp_list" class="faint" style="font-size:13px;max-height:180px;overflow:auto"></div></div></div>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn wa" id="cp_go">${WA_SVG}${t('create_send')}</button>`,
        onMount: (el, m) => {
          const av = $('#cp_av', el);
          const fillAv = () => {
            const k = $('#cp_a', el).value;
            const opts = k === 'vehicle' ? vehicles.map(x => [x.id, x.make + ' ' + x.en]) : k === 'gov' ? DB.GOVERNORATES.map(g => [g, g]) : k === 'cat' ? D().categories.map(c => [c.id, H.catName(c.id)]) : null;
            av.classList.toggle('hide', !opts); av.innerHTML = opts ? opts.map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('') : '';
          };
          const build = (c) => {
            const picked = $$('#cp_p option:checked', el).map(o => DB.product(o.value));
            let txt = fill($('#cp_m', el).value, { name: (c ? c.name : 'Ahmed').split(' ')[0], shop: S().name, site: siteUrl() });
            if (picked.length) txt += '\n\n' + picked.map(p => `• ${(lang === 'ar' && p.nameAr) || p.name}\n  ${siteUrl()}#/p/${p.slug}`).join('\n');
            return txt;
          };
          const upd = () => {
            const rec = audience($('#cp_a', el).value, av.value);
            $('#cp_cnt', el).textContent = rec.length;
            $('#cp_list', el).innerHTML = rec.slice(0, 40).map(c => `${esc(c.name)} <span dir="ltr">${esc(c.phone)}</span>`).join('<br>') + (rec.length > 40 ? '<br>…' : '');
            $('#cp_prev', el).textContent = build(rec[0]);
          };
          $('#cp_a', el).onchange = () => { fillAv(); upd(); }; av.onchange = upd; $('#cp_m', el).oninput = upd; $('#cp_p', el).onchange = upd;
          $('#cp_ai', el).onclick = async () => {
            if (!AI.getKey()) { toast(H.t('no_key')); return; }
            const btn = $('#cp_ai', el); btn.disabled = true; btn.innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${H.t('ai_writing')}`;
            try {
              const aud = $('#cp_a', el).selectedOptions[0].textContent + (av.classList.contains('hide') ? '' : ': ' + av.selectedOptions[0].textContent);
              $('#cp_m', el).value = await AI.campaignCopy({ audience: aud, products: $$('#cp_p option:checked', el).map(o => DB.product(o.value)).filter(Boolean), lang });
              upd();
            } catch (e) { toast('⚠️ ' + AI.explainError(e, I18N.lang)); }
            btn.disabled = false; btn.innerHTML = `${icon('sparkle')}${H.t('ai_write')}`;
          };
          fillAv(); upd();
          $('#cp_go', el).onclick = () => {
            const k = $('#cp_a', el).value, rec = audience(k, av.value);
            if (!rec.length) return;
            const lbl = $('#cp_a', el).selectedOptions[0].textContent + (av.classList.contains('hide') ? '' : ': ' + av.selectedOptions[0].textContent);
            const c = { id: DB.uid('cp'), name: $('#cp_n', el).value.trim() || 'Campaign', date: Date.now(), audienceLabel: lbl, message: $('#cp_m', el).value, productIds: $$('#cp_p option:checked', el).map(o => o.value), recipients: rec.map(x => ({ cid: x.id, sent: false, text: build(x) })) };
            D().campaigns.push(c); DB.save(); m.close(); waTab = 'campaigns'; H.render(); runCampaign(c);
          };
        }
      });
    }
    function runCampaign(c) {
      modal({
        title: `${t('campaigns')} · ${esc(c.name)}`, wide: true,
        body: `<div id="rc_head"></div><div class="table-wrap mt" style="max-height:52vh;overflow:auto"><table class="t"><tbody id="rc_list"></tbody></table></div>`,
        footer: `<button class="btn" data-close>${t('close')}</button><button class="btn wa" id="rc_next">${WA_SVG}${t('send_next')}</button>`,
        onMount: (el) => {
          const draw = () => {
            const sent = c.recipients.filter(r => r.sent).length;
            $('#rc_head', el).innerHTML = `<div class="bar" style="height:10px"><span style="width:${sent / c.recipients.length * 100}%;background:#25d366"></span></div><p class="muted" style="margin:6px 0 0">${t('sent_n', { a: sent, b: c.recipients.length })}</p>`;
            $('#rc_list', el).innerHTML = c.recipients.map((r, i) => { const cu = DB.customer(r.cid) || {}; return `<tr><td>${r.sent ? '✅' : '⏳'}</td><td class="strong">${esc(cu.name || '—')}</td><td dir="ltr" class="muted">${esc(cu.phone || '')}</td><td class="r"><button class="btn sm ${r.sent ? '' : 'wa'}" data-i="${i}">${r.sent ? icon('refresh') : WA_SVG + t('open_wa')}</button></td></tr>`; }).join('');
            $$('[data-i]', el).forEach(b => b.onclick = () => sendOne(+b.dataset.i));
            $('#rc_next', el).disabled = sent >= c.recipients.length;
          };
          const sendOne = (i) => { const r = c.recipients[i], cu = DB.customer(r.cid); if (cu && openWA(cu.phone, r.text, { type: 'campaign', ref: c.name })) { r.sent = true; r.at = Date.now(); DB.save(); draw(); } };
          $('#rc_next', el).onclick = () => { const i = c.recipients.findIndex(r => !r.sent); if (i > -1) sendOne(i); };
          draw();
        }
      });
    }
  });
})();
