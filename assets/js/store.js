/* ============================================================
   Storefront – customer-facing online shop
   Orders are written to the same data store the admin dashboard reads.
   ============================================================ */
(function () {
  'use strict';
  DB.load();
  const D = () => DB.data;
  const LKEY = 'bh_store_lang', CKEY = 'bh_cart';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  let lang = store.get(LKEY, null) || D().settings.lang || 'en';
  I18N.set(lang);

  const TX = {
    en: {
      home: 'Home', shop: 'Shop all', offers: 'Offers', contact: 'Contact', search: 'Search wheels, tyres, brands…', cart: 'Your cart',
      free_over: 'Free delivery on orders over', fitting: 'Professional fitting in Muscat', all_gov: 'Delivery to all governorates',
      hero_eyebrow: 'Genuine brands · Warranty · Fitting', shop_now: 'Shop now', see_offers: 'See offers',
      finder: 'Find parts for your vehicle', finder_sub: 'Choose your vehicle and category', vehicle: 'Vehicle', any_vehicle: 'Any vehicle', category: 'Category', all_cats: 'All categories', find: 'Show parts',
      st_products: 'Products', st_brands: 'Brands', st_cust: 'Governorates served',
      cats: 'Shop by category', cats_sub: 'Everything you need for the trail', items: 'items', view_all: 'View all',
      offers_t: 'Hot offers', offers_sub: 'Limited-time prices while stock lasts', featured: 'Featured gear', featured_sub: 'Hand-picked by our off-road team',
      why: 'Why shop with us', f1: 'Genuine brands', f1d: 'Authorised parts with full manufacturer warranty.', f2: 'Expert fitting', f2d: 'Our workshop installs everything you buy.',
      f3: 'Fast delivery', f3d: 'Muscat next day, other governorates in 2–3 days.', f4: 'Secure payment', f4d: 'Card, bank transfer or cash on delivery.',
      wa_t: 'Prefer to order on WhatsApp?', wa_d: 'Send us your cart or ask about fitment — we reply fast.', wa_btn: 'Chat on WhatsApp',
      brands: 'Brands we carry', add: 'Add to cart', added: 'Added to cart', out: 'Out of stock', in_stock: 'In stock', low: 'Only {n} left', sale: 'Sale',
      price_ex: 'Prices exclude 5% VAT', qty: 'Quantity', order_wa: 'Order on WhatsApp', fitment: 'Fitment', brand: 'Brand', sku: 'SKU',
      related: 'You may also like', description: 'Description', specs: 'Specifications', perk1: 'Free fitting on wheels & tyres in Muscat', perk2: 'Delivered in 1–3 days', perk3: '7-day easy returns',
      empty_cart: 'Your cart is empty.', continue: 'Continue shopping', subtotal: 'Subtotal', vat: 'VAT', shipping: 'Delivery', total: 'Total', checkout: 'Checkout', send_wa: 'Send order via WhatsApp',
      free: 'Free', away_free: 'Add {x} more for free delivery', got_free: 'You get free delivery!', remove: 'Remove',
      details: 'Delivery details', name: 'Full name', phone: 'Mobile number', gov: 'Governorate', address: 'Area, street, house / building', note: 'Notes (optional)',
      payment: 'Payment method', cod: 'Cash on delivery', cod_d: 'Pay when your order arrives', card: 'Card on delivery', card_d: 'Pay by card to the driver', transfer: 'Bank transfer', transfer_d: 'We send bank details on WhatsApp',
      place: 'Place order', summary: 'Order summary', required: 'Required', bad_phone: 'Enter a valid mobile number',
      thanks: 'Thank you! Your order is confirmed', thanks_d: 'Order number {no}. We will call you to confirm delivery time.', confirm_wa: 'Confirm on WhatsApp', results: 'results', sort: 'Sort', s_pop: 'Featured', s_lo: 'Price: low to high', s_hi: 'Price: high to low', s_new: 'Name',
      only_stock: 'In stock only', on_sale: 'On sale', admin: 'Admin', rights: 'All rights reserved.', quick: 'Quick links', help: 'Customer care', hours: 'Sat–Thu 9:00–21:00',
      wa_hello: 'Hello {shop}, I would like to order:', wa_total: 'Total (incl. VAT)', wa_name: 'Name', wa_area: 'Area', wa_ask: 'Hello {shop}, I have a question about'
    },
    ar: {
      home: 'الرئيسية', shop: 'كل المنتجات', offers: 'العروض', contact: 'تواصل معنا', search: 'ابحث عن جنوط، إطارات، ماركات…', cart: 'سلة التسوق',
      free_over: 'توصيل مجاني للطلبات فوق', fitting: 'تركيب احترافي في مسقط', all_gov: 'توصيل لجميع المحافظات',
      hero_eyebrow: 'ماركات أصلية · ضمان · تركيب', shop_now: 'تسوق الآن', see_offers: 'شاهد العروض',
      finder: 'ابحث عن قطع سيارتك', finder_sub: 'اختر السيارة والفئة', vehicle: 'السيارة', any_vehicle: 'أي سيارة', category: 'الفئة', all_cats: 'كل الفئات', find: 'عرض القطع',
      st_products: 'منتج', st_brands: 'ماركة', st_cust: 'محافظة نخدمها',
      cats: 'تسوق حسب الفئة', cats_sub: 'كل ما تحتاجه للطرق الوعرة', items: 'منتج', view_all: 'عرض الكل',
      offers_t: 'عروض مميزة', offers_sub: 'أسعار لفترة محدودة حتى نفاد الكمية', featured: 'منتجات مختارة', featured_sub: 'اختارها فريقنا بعناية',
      why: 'لماذا تتسوق معنا', f1: 'ماركات أصلية', f1d: 'قطع معتمدة مع ضمان الوكيل.', f2: 'تركيب احترافي', f2d: 'ورشتنا تركّب كل ما تشتريه.',
      f3: 'توصيل سريع', f3d: 'مسقط في اليوم التالي وباقي المحافظات خلال 2–3 أيام.', f4: 'دفع آمن', f4d: 'بطاقة، تحويل بنكي أو الدفع عند الاستلام.',
      wa_t: 'تفضل الطلب عبر واتساب؟', wa_d: 'أرسل لنا سلتك أو استفسر عن التوافق — نرد بسرعة.', wa_btn: 'تواصل عبر واتساب',
      brands: 'الماركات المتوفرة', add: 'أضف إلى السلة', added: 'تمت الإضافة إلى السلة', out: 'نفدت الكمية', in_stock: 'متوفر', low: 'متبقي {n} فقط', sale: 'خصم',
      price_ex: 'الأسعار لا تشمل ضريبة 5%', qty: 'الكمية', order_wa: 'اطلب عبر واتساب', fitment: 'التوافق', brand: 'الماركة', sku: 'الرمز',
      related: 'قد يعجبك أيضًا', description: 'الوصف', specs: 'المواصفات', perk1: 'تركيب مجاني للجنوط والإطارات في مسقط', perk2: 'التوصيل خلال 1–3 أيام', perk3: 'إرجاع سهل خلال 7 أيام',
      empty_cart: 'سلتك فارغة.', continue: 'متابعة التسوق', subtotal: 'المجموع الفرعي', vat: 'الضريبة', shipping: 'التوصيل', total: 'الإجمالي', checkout: 'إتمام الطلب', send_wa: 'أرسل الطلب عبر واتساب',
      free: 'مجاني', away_free: 'أضف {x} للحصول على توصيل مجاني', got_free: 'حصلت على توصيل مجاني!', remove: 'حذف',
      details: 'بيانات التوصيل', name: 'الاسم الكامل', phone: 'رقم الهاتف', gov: 'المحافظة', address: 'المنطقة، الشارع، المنزل / المبنى', note: 'ملاحظات (اختياري)',
      payment: 'طريقة الدفع', cod: 'الدفع عند الاستلام', cod_d: 'ادفع عند وصول طلبك', card: 'بطاقة عند الاستلام', card_d: 'ادفع بالبطاقة للمندوب', transfer: 'تحويل بنكي', transfer_d: 'نرسل بيانات الحساب عبر واتساب',
      place: 'تأكيد الطلب', summary: 'ملخص الطلب', required: 'مطلوب', bad_phone: 'أدخل رقم هاتف صحيح',
      thanks: 'شكرًا لك! تم تأكيد طلبك', thanks_d: 'رقم الطلب {no}. سنتصل بك لتأكيد موعد التوصيل.', confirm_wa: 'أكّد عبر واتساب', results: 'نتيجة', sort: 'ترتيب', s_pop: 'المميزة', s_lo: 'السعر: من الأقل', s_hi: 'السعر: من الأعلى', s_new: 'الاسم',
      only_stock: 'المتوفر فقط', on_sale: 'عليه خصم', admin: 'الإدارة', rights: 'جميع الحقوق محفوظة.', quick: 'روابط سريعة', help: 'خدمة العملاء', hours: 'السبت–الخميس 9:00–21:00',
      wa_hello: 'مرحبًا {shop}، أرغب في طلب:', wa_total: 'الإجمالي (شامل الضريبة)', wa_name: 'الاسم', wa_area: 'المنطقة', wa_ask: 'مرحبًا {shop}، لدي استفسار عن'
    }
  };
  const t = (k, vars) => { let s = (TX[lang] && TX[lang][k]) || TX.en[k] || k; if (vars) Object.keys(vars).forEach(v => s = s.replace('{' + v + '}', vars[v])); return s; };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => D().settings;
  const cur = () => S().currency || 'OMR';
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const priceHTML = (p) => `<div class="price"><b class="num"><span class="cur">${cur()}</span>${fmt(p.price)}</b>${p.oldPrice > p.price ? `<s class="num">${fmt(p.oldPrice)}</s>` : ''}</div>`;
  const catName = (id) => { const c = D().categories.find(x => x.id === id); return c ? (c[lang] || c.en) : id; };
  const visible = () => D().products.filter(p => p.active !== false && p.online !== false);
  const prod = (id) => D().products.find(p => p.id === id);
  const waNum = () => String(S().whatsapp || S().phone || '').replace(/[^\d]/g, '');
  const WA_ICON = '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.6-5.6C5.2 10 10 5.3 16 5.3S26.8 10 26.8 15.8 22 26.4 16 26.4Zm5.9-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z"/></svg>';
  const VEHICLES = ['Land Cruiser', 'Hilux', 'Patrol', 'Prado', 'FJ', 'Fortuner'];

  // ---------- cart ----------
  let cart = store.get(CKEY, []).filter(l => prod(l.pid));
  const saveCart = () => { store.set(CKEY, cart); drawCartCount(); };
  const cartQty = () => cart.reduce((a, l) => a + l.qty, 0);
  function addToCart(pid, qty) {
    const p = prod(pid); if (!p || p.stock <= 0) return;
    const l = cart.find(x => x.pid === pid);
    if (l) l.qty = Math.min(p.stock, l.qty + (qty || 1)); else cart.push({ pid, qty: Math.min(p.stock, qty || 1) });
    saveCart(); toast(t('added')); bump();
  }
  function totals() {
    const sub = cart.reduce((a, l) => a + l.qty * prod(l.pid).price, 0);
    const ship = !cart.length ? 0 : sub >= (S().freeShipOver || Infinity) ? 0 : Number(S().shipping || 0);
    const vat = sub * (Number(S().vat) || 0) / 100;
    return { sub, ship, vat, total: sub + vat + ship };
  }
  function bump() { const b = $('.cart-btn'); if (b && b.animate) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300 }); }
  function toast(msg) { $$('.toast').forEach(x => x.remove()); const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = icon('check') + esc(msg); document.body.appendChild(el); setTimeout(() => el.remove(), 1800); }

  function waLink(text) { return `https://wa.me/${waNum()}?text=${encodeURIComponent(text)}`; }
  function cartWAText(extra) {
    const tt = totals();
    let s = t('wa_hello', { shop: S().name }) + '\n\n';
    cart.forEach(l => { const p = prod(l.pid); s += `• ${l.qty} × ${p.name} (${p.sku}) — ${cur()} ${fmt(p.price * l.qty)}\n`; });
    s += `\n${t('subtotal')}: ${cur()} ${fmt(tt.sub)}\n${t('vat')}: ${cur()} ${fmt(tt.vat)}\n${t('shipping')}: ${tt.ship ? cur() + ' ' + fmt(tt.ship) : t('free')}\n*${t('wa_total')}: ${cur()} ${fmt(tt.total)}*`;
    if (extra) s += '\n\n' + extra;
    return s;
  }

  // ---------- layout ----------
  function shell(content) {
    const s = S();
    const brands = Array.from(new Set(visible().map(p => p.brand))).slice(0, 12);
    return `
      <div class="announce"><div class="wrap"><span>🚚 ${t('free_over')} <b>${cur()} ${fmt(s.freeShipOver || 0).replace(/\.000$/, '')}</b> <span class="msg2">· ${t('fitting')} · ${t('all_gov')}</span></span><button id="langBtn">${lang === 'ar' ? 'English' : 'العربية'}</button></div></div>
      <header class="hdr"><div class="wrap">
        <button class="x burger" id="burger" aria-label="Menu">${icon('menu')}</button>
        <a class="brand" href="#/"><span class="mk">4x4</span><span>${esc(s.name)}<small>${esc(s.tagline || '')}</small></span></a>
        <nav class="nav">${[['', 'home'], ['shop', 'shop'], ['offers', 'offers']].map(([h, k]) => `<a href="#/${h}" class="${route.name === (h || 'home') ? 'on' : ''}">${t(k)}</a>`).join('')}<a href="#contact">${t('contact')}</a></nav>
        <form class="hsearch desk" id="hs">${icon('search')}<input name="q" placeholder="${t('search')}" value="${esc(route.q.q || '')}" aria-label="${t('search')}"></form>
        <button class="cart-btn" id="cartBtn" aria-label="${t('cart')}">${icon('cart')}<span class="n" id="cartN">${cartQty()}</span></button>
      </div></header>
      <main>${content}</main>
      <footer class="foot" id="contact"><div class="wrap"><div class="cols">
        <div><a class="brand" href="#/" style="color:#fff"><span class="mk">4x4</span><span>${esc(s.name)}</span></a><p style="margin-top:14px;max-width:320px">${esc(s.heroText || '')}</p></div>
        <div><h4>${t('quick')}</h4><a href="#/shop">${t('shop')}</a><a href="#/offers">${t('offers')}</a>${D().categories.slice(0, 4).map(c => `<a href="#/shop?c=${c.id}">${catName(c.id)}</a>`).join('')}</div>
        <div><h4>${t('help')}</h4><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a><a href="${waLink(t('wa_hello', { shop: s.name }))}" target="_blank" rel="noopener">WhatsApp</a><a href="mailto:${esc(s.email)}">${esc(s.email)}</a><span>${t('hours')}</span></div>
        <div><h4>${t('contact')}</h4><span>${esc(s.address)}</span><p style="margin-top:12px">${t('brands')}: ${brands.slice(0, 6).map(esc).join(', ')}…</p></div>
      </div><div class="bottom"><span>© ${new Date().getFullYear()} ${esc(s.name)}. ${t('rights')}</span><a href="index.html">${t('admin')} ↗</a></div></div></footer>
      <a class="fab" href="${waLink(t('wa_hello', { shop: s.name }))}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_ICON}</a>`;
  }
  function drawCartCount() { const n = $('#cartN'); if (n) n.textContent = cartQty(); }

  function card(p) {
    const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `<article class="card"><a class="img" href="#/p/${p.id}">${productArt(p)}<div class="badges">${off ? `<span class="badge">-${off}%</span>` : ''}${p.stock <= 0 ? `<span class="badge out">${t('out')}</span>` : p.stock <= 3 ? `<span class="badge dark">${t('low', { n: p.stock })}</span>` : ''}</div></a>
      <div class="body"><span class="br">${esc(p.brand)}</span><a class="nm" href="#/p/${p.id}">${esc(p.name)}</a><span class="ft">${esc(p.fitment)}</span>
        <div class="row">${priceHTML(p)}<button class="add" data-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''} aria-label="${t('add')}">${icon('plus')}</button></div></div></article>`;
  }

  // ---------- pages ----------
  function pageHome() {
    const v = visible(), s = S();
    const offers = v.filter(p => p.oldPrice > p.price).slice(0, 8);
    const feat = v.filter(p => p.featured).slice(0, 8);
    const brands = Array.from(new Set(v.map(p => p.brand)));
    return `
      <section class="hero"><div class="wrap">
        <div><span class="eyebrow">${icon('shield')} ${t('hero_eyebrow')}</span>
          <h1>${lang === 'ar' ? 'مجهّز لأصعب الطرق في عُمان' : esc(s.heroTitle)}</h1>
          <p>${lang === 'ar' ? 'جنوط، إطارات، أنظمة تعليق، إضاءة ومعدات سحب من أفضل الماركات — تركيب في مسقط وتوصيل لجميع المحافظات.' : esc(s.heroText)}</p>
          <div class="cta"><a class="btn primary" href="#/shop">${t('shop_now')} ${icon('arrowRight')}</a><a class="btn" href="#/offers">${icon('tag')}${t('see_offers')}</a></div>
          <div class="stats"><div><b>${v.length}+</b><span>${t('st_products')}</span></div><div><b>${brands.length}</b><span>${t('st_brands')}</span></div><div><b>${DB.GOVERNORATES.length}</b><span>${t('st_cust')}</span></div></div>
        </div>
        <form class="finder" id="finder"><h3>${t('finder')}</h3><p style="color:#c3c8d0">${t('finder_sub')}</p>
          <select name="f" aria-label="${t('vehicle')}"><option value="">${t('any_vehicle')}</option>${VEHICLES.map(x => `<option>${x}</option>`).join('')}</select>
          <select name="c" aria-label="${t('category')}"><option value="">${t('all_cats')}</option>${D().categories.map(c => `<option value="${c.id}">${catName(c.id)}</option>`).join('')}</select>
          <button class="btn primary block" type="submit">${icon('search')}${t('find')}</button></form>
      </div></section>
      <section class="sec"><div class="wrap"><div class="sec-h"><div><h2>${t('cats')}</h2><p>${t('cats_sub')}</p></div><a href="#/shop">${t('view_all')} ${icon('arrowRight')}</a></div>
        <div class="cats">${D().categories.map(c => { const n = v.filter(p => p.category === c.id); return `<a class="cat" href="#/shop?c=${c.id}"><div class="art">${productArt(n[0] || { category: c.id })}</div><div class="lbl"><b>${catName(c.id)}</b><span>${n.length} ${t('items')}</span></div></a>`; }).join('')}</div></div></section>
      ${offers.length ? `<section class="sec alt"><div class="wrap"><div class="sec-h"><div><h2>🔥 ${t('offers_t')}</h2><p>${t('offers_sub')}</p></div><a href="#/offers">${t('view_all')} ${icon('arrowRight')}</a></div><div class="grid">${offers.map(card).join('')}</div></div></section>` : ''}
      <section class="sec"><div class="wrap"><div class="sec-h"><div><h2>${t('featured')}</h2><p>${t('featured_sub')}</p></div><a href="#/shop">${t('view_all')} ${icon('arrowRight')}</a></div><div class="grid">${feat.map(card).join('')}</div></div></section>
      <section class="sec alt"><div class="wrap"><div class="sec-h"><div><h2>${t('why')}</h2></div></div>
        <div class="feats">${[['shield', 'f1'], ['settings', 'f2'], ['truck', 'f3'], ['wallet', 'f4']].map(([i, k]) => `<div class="feat"><div class="i">${icon(i)}</div><b>${t(k)}</b><p>${t(k + 'd')}</p></div>`).join('')}</div></div></section>
      <section class="sec"><div class="wrap"><div class="sec-h" style="justify-content:center;text-align:center"><div><h2>${t('brands')}</h2></div></div><div class="brands">${brands.map(b => `<a href="#/shop?b=${encodeURIComponent(b)}"><span>${esc(b)}</span></a>`).join('')}</div>
        <div class="wa-band" style="margin-top:44px"><div><h3>${t('wa_t')}</h3><p>${t('wa_d')}</p></div><a class="btn" href="${waLink(t('wa_hello', { shop: s.name }))}" target="_blank" rel="noopener">${WA_ICON.replace('<svg', '<svg class="ic"')}${t('wa_btn')}</a></div></div></section>`;
  }

  function pageShop(offersOnly) {
    const q = route.q;
    let list = visible();
    if (offersOnly || q.sale) list = list.filter(p => p.oldPrice > p.price);
    if (q.c) list = list.filter(p => p.category === q.c);
    if (q.b) list = list.filter(p => p.brand === q.b);
    if (q.f) list = list.filter(p => p.fitment.toLowerCase().includes(q.f.toLowerCase()) || p.fitment === 'Universal');
    if (q.stock) list = list.filter(p => p.stock > 0);
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter(p => (p.name + ' ' + p.brand + ' ' + p.sku + ' ' + p.fitment + ' ' + catName(p.category)).toLowerCase().includes(s)); }
    const sort = q.s || 'pop';
    list.sort(sort === 'lo' ? (a, b) => a.price - b.price : sort === 'hi' ? (a, b) => b.price - a.price : sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (b.featured - a.featured) || (b.stock > 0) - (a.stock > 0));
    const all = visible();
    const title = offersOnly ? t('offers_t') : q.c ? catName(q.c) : q.b ? q.b : q.q ? `“${esc(q.q)}”` : t('shop');
    const link = (patch) => '#/' + (offersOnly ? 'offers' : 'shop') + qs(Object.assign({}, q, patch));
    return `<div class="wrap"><div class="crumbs"><a href="#/">${t('home')}</a> / ${title}</div>
      <div class="shop">
        <aside class="filters">
          <div class="mob"><button class="${!q.c ? 'on' : ''}" data-go="${link({ c: '' })}">${t('all_cats')}</button>${D().categories.map(c => `<button class="${q.c === c.id ? 'on' : ''}" data-go="${link({ c: c.id })}">${catName(c.id)}</button>`).join('')}</div>
          <div class="grp"><h4>${t('category')}</h4><label><input type="radio" name="c" ${!q.c ? 'checked' : ''} data-go="${link({ c: '' })}">${t('all_cats')}<span class="c">${all.length}</span></label>
            ${D().categories.map(c => `<label><input type="radio" name="c" ${q.c === c.id ? 'checked' : ''} data-go="${link({ c: c.id })}">${catName(c.id)}<span class="c">${all.filter(p => p.category === c.id).length}</span></label>`).join('')}</div>
          <div class="grp"><h4>${t('vehicle')}</h4><label><input type="radio" name="f" ${!q.f ? 'checked' : ''} data-go="${link({ f: '' })}">${t('any_vehicle')}</label>${VEHICLES.map(x => `<label><input type="radio" name="f" ${q.f === x ? 'checked' : ''} data-go="${link({ f: x })}">${x}</label>`).join('')}</div>
          <div class="grp"><h4>${t('brand')}</h4><label><input type="radio" name="b" ${!q.b ? 'checked' : ''} data-go="${link({ b: '' })}">${t('all_cats').split(' ')[0]}</label>${Array.from(new Set(all.map(p => p.brand))).sort().map(b => `<label><input type="radio" name="b" ${q.b === b ? 'checked' : ''} data-go="${link({ b })}">${esc(b)}</label>`).join('')}</div>
          <div class="grp"><label><input type="checkbox" ${q.stock ? 'checked' : ''} data-go="${link({ stock: q.stock ? '' : '1' })}">${t('only_stock')}</label>${offersOnly ? '' : `<label><input type="checkbox" ${q.sale ? 'checked' : ''} data-go="${link({ sale: q.sale ? '' : '1' })}">${t('on_sale')}</label>`}</div>
        </aside>
        <div><div class="shop-top"><div><h1>${title}</h1><span style="color:var(--text-3)">${list.length} ${t('results')}</span></div>
          <form class="hsearch" id="ss" style="max-width:260px;margin:0"><input name="q" placeholder="${t('search')}" value="${esc(q.q || '')}" aria-label="${t('search')}">${icon('search')}</form>
          <select class="select" id="sort" aria-label="${t('sort')}">${[['pop', 's_pop'], ['lo', 's_lo'], ['hi', 's_hi'], ['name', 's_new']].map(([k, l]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${t(l)}</option>`).join('')}</select></div>
          ${list.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${list.map(card).join('')}</div>` : `<div class="empty">${icon('search')}<p>${t('results')}: 0</p><a class="btn" href="#/shop">${t('view_all')}</a></div>`}
        </div></div></div>`;
  }

  function pageProduct(id) {
    const p = prod(id);
    if (!p || p.active === false) return `<div class="wrap empty"><p>404</p><a class="btn" href="#/shop">${t('shop')}</a></div>`;
    const related = visible().filter(x => x.category === p.category && x.id !== p.id).slice(0, 4);
    const st = p.stock <= 0 ? ['out', t('out')] : p.stock <= 3 ? ['low', t('low', { n: p.stock })] : ['ok', t('in_stock')];
    const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `<div class="wrap"><div class="crumbs"><a href="#/">${t('home')}</a> / <a href="#/shop?c=${p.category}">${catName(p.category)}</a> / ${esc(p.name)}</div>
      <div class="pdp">
        <div class="gal">${productArt(p, { fit: 'contain' })}${off ? `<div class="badges" style="position:absolute;top:16px;inset-inline-start:16px"><span class="badge" style="font-size:14px">-${off}% ${t('sale')}</span></div>` : ''}</div>
        <div>
          <span class="br" style="font-weight:800;color:var(--brand)">${esc(p.brand)}</span>
          <h1>${esc(p.name)}</h1>
          ${priceHTML(p)}<div class="vat">${t('price_ex')}</div>
          <p style="margin:14px 0 0"><span class="stock ${st[0]}">${st[1]}</span></p>
          <div class="buy">
            <div class="qty"><button data-q="-1" aria-label="-">${icon('minus')}</button><span id="pq" class="num">1</span><button data-q="1" aria-label="+">${icon('plus')}</button></div>
            <button class="btn primary" id="padd" ${p.stock <= 0 ? 'disabled' : ''}>${icon('cart')}${t('add')}</button>
            <a class="btn wa" id="pwa" href="#" target="_blank" rel="noopener">${WA_ICON.replace('<svg', '<svg class="ic"')}${t('order_wa')}</a>
          </div>
          <h3 style="margin:24px 0 8px">${t('description')}</h3><p style="color:var(--text-2);margin:0">${esc(p.description || '')}</p>
          <div class="specs"><div><span>${t('brand')}</span><b>${esc(p.brand)}</b></div><div><span>${t('category')}</span><b>${catName(p.category)}</b></div><div><span>${t('fitment')}</span><b>${esc(p.fitment)}</b></div><div><span>${t('sku')}</span><b>${esc(p.sku)}</b></div></div>
          <div class="perks"><div>${icon('settings')}${t('perk1')}</div><div>${icon('truck')}${t('perk2')}</div><div>${icon('refresh')}${t('perk3')}</div></div>
        </div>
      </div>
      ${related.length ? `<section class="sec" style="padding-top:0"><div class="sec-h"><h2>${t('related')}</h2></div><div class="grid">${related.map(card).join('')}</div></section>` : ''}</div>`;
  }

  function pageCheckout() {
    if (!cart.length) return `<div class="wrap thanks"><div class="ok" style="background:var(--bg-2);color:var(--text-3)">${icon('cart')}</div><h2>${t('empty_cart')}</h2><a class="btn primary" href="#/shop">${t('continue')}</a></div>`;
    const tt = totals();
    const pay = ['cod', 'card', 'transfer'];
    return `<div class="wrap"><div class="crumbs"><a href="#/">${t('home')}</a> / ${t('checkout')}</div>
      <form class="co" id="coForm" novalidate>
        <div class="panel"><h2>${t('details')}</h2>
          <div class="fg">
            <div class="f full"><label for="c_name">${t('name')}</label><input id="c_name" name="name" autocomplete="name" required></div>
            <div class="f"><label for="c_phone">${t('phone')}</label><input id="c_phone" name="phone" type="tel" autocomplete="tel" placeholder="+968 9XXX XXXX" required></div>
            <div class="f"><label for="c_gov">${t('gov')}</label><select id="c_gov" name="gov">${DB.GOVERNORATES.map(g => `<option>${g}</option>`).join('')}</select></div>
            <div class="f full"><label for="c_addr">${t('address')}</label><input id="c_addr" name="addr" autocomplete="street-address" required></div>
            <div class="f full"><label for="c_note">${t('note')}</label><textarea id="c_note" name="note"></textarea></div>
          </div>
          <h2 style="margin-top:26px">${t('payment')}</h2>
          <div class="pays">${pay.map((k, i) => `<label class="pay ${i === 0 ? 'on' : ''}"><input type="radio" name="pay" value="${k}" ${i === 0 ? 'checked' : ''}><div><b>${t(k)}</b><small>${t(k + '_d')}</small></div></label>`).join('')}</div>
        </div>
        <div class="panel" style="position:sticky;top:92px"><h2>${t('summary')}</h2>
          ${cart.map(l => { const p = prod(l.pid); return `<div class="mini"><div class="th">${productArt(p)}<span class="q">${l.qty}</span></div><div style="flex:1;font-size:14px;font-weight:600">${esc(p.name)}</div><b class="num">${fmt(p.price * l.qty)}</b></div>`; }).join('')}
          <div style="border-top:1px solid var(--border);margin:12px 0;padding-top:12px;display:grid;gap:6px">
            <div class="sum"><span>${t('subtotal')}</span><span class="num">${cur()} ${fmt(tt.sub)}</span></div>
            <div class="sum"><span>${t('vat')} (${S().vat}%)</span><span class="num">${cur()} ${fmt(tt.vat)}</span></div>
            <div class="sum"><span>${t('shipping')}</span><span class="num">${tt.ship ? cur() + ' ' + fmt(tt.ship) : t('free')}</span></div>
            <div class="sum tot"><span>${t('total')}</span><span class="num">${cur()} ${fmt(tt.total)}</span></div>
          </div>
          <button class="btn primary block" type="submit">${icon('check')}${t('place')}</button>
          <button class="btn wa block" type="button" id="coWa" style="margin-top:10px">${WA_ICON.replace('<svg', '<svg class="ic"')}${t('send_wa')}</button>
        </div>
      </form></div>`;
  }

  function pageThanks(no) {
    const o = D().sales.find(s => s.no === no);
    const msg = o ? `${t('wa_hello', { shop: S().name })}\n${o.no} — ${cur()} ${fmt(o.total)}` : '';
    return `<div class="wrap thanks"><div class="ok">${icon('check')}</div><h1 style="letter-spacing:-.02em">${t('thanks')}</h1><p style="color:var(--text-2);font-size:17px">${t('thanks_d', { no: `<b>${esc(no)}</b>` })}</p>
      ${o ? `<div class="panel" style="text-align:start;margin:24px 0">${o.items.map(it => `<div class="sum" style="padding:4px 0"><span>${it.qty} × ${esc(it.name)}</span><span class="num">${fmt(it.qty * it.price)}</span></div>`).join('')}<div class="sum tot" style="border-top:1px solid var(--border);margin-top:8px;padding-top:10px"><span>${t('total')}</span><span class="num">${cur()} ${fmt(o.total)}</span></div></div>` : ''}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn wa" href="${waLink(msg)}" target="_blank" rel="noopener">${WA_ICON.replace('<svg', '<svg class="ic"')}${t('confirm_wa')}</a><a class="btn" href="#/shop">${t('continue')}</a></div></div>`;
  }

  // ---------- cart drawer ----------
  function openCart() {
    closeCart();
    const ov = document.createElement('div'); ov.className = 'ovl'; ov.id = 'ovl';
    const dr = document.createElement('aside'); dr.className = 'drawer'; dr.id = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', t('cart'));
    document.body.append(ov, dr); ov.onclick = closeCart;
    drawDrawer();
  }
  function closeCart() { ['#ovl', '#drawer'].forEach(s => { const e = $(s); if (e) e.remove(); }); }
  function drawDrawer() {
    const dr = $('#drawer'); if (!dr) return;
    const tt = totals(), freeAt = Number(S().freeShipOver || 0);
    dr.innerHTML = `<div class="drawer-h"><h3>${t('cart')} (${cartQty()})</h3><button class="x" id="dclose" aria-label="close">${icon('x')}</button></div>
      <div class="drawer-b">${cart.length ? `${freeAt ? `<div class="freebar" style="padding:14px 0">${tt.sub >= freeAt ? '✓ ' + t('got_free') : t('away_free', { x: cur() + ' ' + fmt(freeAt - tt.sub) })}<div class="bar"><span style="width:${Math.min(100, tt.sub / freeAt * 100)}%"></span></div></div>` : ''}
        ${cart.map(l => { const p = prod(l.pid); return `<div class="line"><a class="th" href="#/p/${p.id}">${productArt(p)}</a><div><div class="nm">${esc(p.name)}</div><div style="color:var(--text-3);font-size:13px">${esc(p.brand)} · ${cur()} ${fmt(p.price)}</div>
          <div class="ctrl"><div class="qty"><button data-dq="${p.id}" data-d="-1" aria-label="-">${icon('minus')}</button><span class="num">${l.qty}</span><button data-dq="${p.id}" data-d="1" aria-label="+">${icon('plus')}</button></div><b class="num">${fmt(p.price * l.qty)}</b></div>
          <button class="rm" data-rm="${p.id}">${t('remove')}</button></div></div>`; }).join('')}`
        : `<div class="empty">${icon('cart')}<p>${t('empty_cart')}</p><button class="btn" id="dcont">${t('continue')}</button></div>`}</div>
      ${cart.length ? `<div class="drawer-f"><div class="sum"><span>${t('subtotal')}</span><span class="num">${cur()} ${fmt(tt.sub)}</span></div><div class="sum"><span>${t('vat')} (${S().vat}%)</span><span class="num">${cur()} ${fmt(tt.vat)}</span></div><div class="sum"><span>${t('shipping')}</span><span class="num">${tt.ship ? cur() + ' ' + fmt(tt.ship) : t('free')}</span></div><div class="sum tot"><span>${t('total')}</span><span class="num">${cur()} ${fmt(tt.total)}</span></div>
        <a class="btn primary block" href="#/checkout" id="dco">${t('checkout')} ${icon('arrowRight')}</a><a class="btn wa block" target="_blank" rel="noopener" id="dwa" href="${waLink(cartWAText())}">${WA_ICON.replace('<svg', '<svg class="ic"')}${t('send_wa')}</a></div>` : ''}`;
    $('#dclose').onclick = closeCart;
    if ($('#dcont')) $('#dcont').onclick = closeCart;
    if ($('#dco')) $('#dco').onclick = closeCart;
    if ($('#dwa')) $('#dwa').onclick = () => { recordWhatsAppOrder(); };
    $$('[data-dq]', dr).forEach(b => b.onclick = () => { const l = cart.find(x => x.pid === b.dataset.dq); const p = prod(l.pid); l.qty = Math.max(0, Math.min(p.stock, l.qty + +b.dataset.d)); if (!l.qty) cart = cart.filter(x => x !== l); saveCart(); drawDrawer(); });
    $$('[data-rm]', dr).forEach(b => b.onclick = () => { cart = cart.filter(x => x.pid !== b.dataset.rm); saveCart(); drawDrawer(); });
  }
  // A WhatsApp order is also logged in the admin as a "new" order (source: WhatsApp) so nothing is missed.
  function recordWhatsAppOrder(info) {
    if (!cart.length) return null;
    info = info || {};
    const c = info.name ? DB.findOrCreateCustomer(info.name, info.phone, info.gov) : null;
    const o = DB.createSale({ channel: 'online', source: 'whatsapp', customerId: c ? c.id : null, customerName: c ? '' : 'WhatsApp customer', city: info.gov || '', address: info.addr || '', payment: info.pay || 'cod', shippingFee: totals().ship, note: (info.note || '') + ' [sent via WhatsApp]', items: cart.map(l => ({ pid: l.pid, qty: l.qty })) });
    cart = []; saveCart(); setTimeout(() => { closeCart(); if (route.name === 'checkout') location.hash = '#/thanks/' + o.no; }, 300);
    return o;
  }

  // ---------- router ----------
  let route = { name: 'home', arg: '', q: {} };
  function qs(o) { const p = Object.keys(o).filter(k => o[k]).map(k => k + '=' + encodeURIComponent(o[k])).join('&'); return p ? '?' + p : ''; }
  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, query] = h.split('?');
    const parts = path.split('/');
    const q = {}; (query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); q[k] = decodeURIComponent(v || ''); });
    route = { name: parts[0] || 'home', arg: decodeURIComponent(parts[1] || ''), q };
  }
  function render() {
    if (location.hash === '#contact') return;
    parse();
    let body;
    switch (route.name) {
      case 'shop': body = pageShop(false); break;
      case 'offers': body = pageShop(true); break;
      case 'p': body = pageProduct(route.arg); break;
      case 'checkout': body = pageCheckout(); break;
      case 'thanks': body = pageThanks(route.arg); break;
      case 'cart': body = pageHome(); setTimeout(openCart, 0); break;
      default: body = pageHome();
    }
    $('#root').innerHTML = shell(body);
    const p = route.name === 'p' ? prod(route.arg) : null;
    document.title = (p ? p.name + ' · ' : '') + S().name;
    bind(p);
    window.scrollTo(0, 0);
  }
  function bind(p) {
    $('#langBtn').onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set(LKEY, lang); I18N.set(lang); render(); };
    $('#cartBtn').onclick = openCart;
    $('#burger').onclick = () => {
      const m = document.createElement('div'); m.className = 'mnav';
      m.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b class="brand"><span class="mk">4x4</span>${esc(S().name)}</b><button class="x" aria-label="close">${icon('x')}</button></div>
        <form class="hsearch" style="max-width:none;margin:8px 0" id="ms">${icon('search')}<input name="q" placeholder="${t('search')}"></form>
        <a href="#/">${t('home')}</a><a href="#/shop">${t('shop')}</a><a href="#/offers">${t('offers')}</a>${D().categories.map(c => `<a href="#/shop?c=${c.id}" style="font-size:15px;font-weight:600;color:var(--text-2)">${catName(c.id)}</a>`).join('')}<a href="#contact">${t('contact')}</a>`;
      document.body.appendChild(m);
      m.onclick = (e) => { if (e.target.closest('a') || e.target.closest('.x')) m.remove(); };
      $('#ms', m).onsubmit = (e) => { e.preventDefault(); m.remove(); location.hash = '#/shop' + qs({ q: e.target.q.value.trim() }); };
    };
    const hs = $('#hs'); if (hs) hs.onsubmit = (e) => { e.preventDefault(); location.hash = '#/shop' + qs({ q: e.target.q.value.trim() }); };
    const ss = $('#ss'); if (ss) ss.onsubmit = (e) => { e.preventDefault(); location.hash = '#/' + (route.name === 'offers' ? 'offers' : 'shop') + qs(Object.assign({}, route.q, { q: e.target.q.value.trim() })); };
    const so = $('#sort'); if (so) so.onchange = (e) => { location.hash = '#/' + route.name + qs(Object.assign({}, route.q, { s: e.target.value })); };
    const fd = $('#finder'); if (fd) fd.onsubmit = (e) => { e.preventDefault(); location.hash = '#/shop' + qs({ f: e.target.f.value, c: e.target.c.value }); };
    $$('[data-go]').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'change' : 'click', () => { location.hash = el.dataset.go; }));
    $$('[data-add]').forEach(b => b.onclick = (e) => { e.preventDefault(); addToCart(b.dataset.add, 1); });
    if (p) {
      let q = 1;
      const upd = () => { $('#pq').textContent = q; $('#pwa').href = waLink(`${t('wa_hello', { shop: S().name })}\n• ${q} × ${p.name} (${p.sku}) — ${cur()} ${fmt(p.price * q)}`); };
      $$('[data-q]').forEach(b => b.onclick = () => { q = Math.max(1, Math.min(Math.max(1, p.stock), q + +b.dataset.q)); upd(); });
      $('#padd').onclick = () => addToCart(p.id, q);
      upd();
    }
    const form = $('#coForm');
    if (form) {
      $$('.pay', form).forEach(l => l.onclick = () => { $$('.pay', form).forEach(x => x.classList.toggle('on', x === l)); });
      const read = () => ({ name: $('#c_name').value.trim(), phone: $('#c_phone').value.trim(), gov: $('#c_gov').value, addr: $('#c_addr').value.trim(), note: $('#c_note').value.trim(), pay: (form.querySelector('[name=pay]:checked') || {}).value || 'cod' });
      const validate = (d) => {
        $$('.err', form).forEach(e => e.remove());
        const errs = [];
        if (!d.name) errs.push(['c_name', t('required')]);
        if (d.phone.replace(/\D/g, '').length < 8) errs.push(['c_phone', t('bad_phone')]);
        if (!d.addr) errs.push(['c_addr', t('required')]);
        errs.forEach(([id, m]) => { const el = $('#' + id); el.insertAdjacentHTML('afterend', `<div class="err">${m}</div>`); });
        if (errs.length) $('#' + errs[0][0]).focus();
        return !errs.length;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        const d = read(); if (!validate(d)) return;
        const c = DB.findOrCreateCustomer(d.name, d.phone, d.gov);
        const o = DB.createSale({ channel: 'online', source: 'website', customerId: c.id, city: d.gov, address: d.addr, payment: d.pay, shippingFee: totals().ship, note: d.note, items: cart.map(l => ({ pid: l.pid, qty: l.qty })) });
        cart = []; saveCart();
        location.hash = '#/thanks/' + o.no;
      };
      $('#coWa').onclick = () => {
        const d = read(); if (!validate(d)) return;
        const text = cartWAText(`${t('wa_name')}: ${d.name}\n${t('phone')}: ${d.phone}\n${t('wa_area')}: ${d.gov} — ${d.addr}\n${t('payment')}: ${t(d.pay)}${d.note ? '\n' + d.note : ''}`);
        window.open(waLink(text), '_blank', 'noopener');
        recordWhatsAppOrder(d);
      };
    }
  }

  window.addEventListener('hashchange', () => { closeCart(); render(); });
  window.addEventListener('db:change', (e) => { if (e.detail && e.detail.external) { cart = cart.filter(l => prod(l.pid)); if (!$('#drawer') && route.name !== 'checkout') render(); } });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); const m = $('.mnav'); if (m) m.remove(); } });
  render();
})();
