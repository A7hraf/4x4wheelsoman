/* ============================================================
   4x4 Wheels Oman – parts matching engine (works offline, no API key)
   Understands free text in English and Arabic (Gulf spelling):
   vehicle + year, part type, brand, budget, quantities and common questions.
   Used by the store's parts assistant and by the admin "paste from WhatsApp" quote builder.
   ============================================================ */
(function (global) {
  'use strict';

  // ---- text normalisation (Arabic letter variants, digits, punctuation) ----
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ْـ]/g, '') // tashkeel + tatweel
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d))
      .replace(/[×✕✖]/g, ' x ')
      .replace(/[^\p{L}\p{N}\s.&-]/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  const words = (s) => norm(s).split(' ').filter(Boolean);
  // Arabic attaches "the/for/and/with" to the word (الكفرات، للباترول، وكفرات، بالرمل): strip them for matching
  const AR_PRE = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ل', 'ب', 'ف'];
  const stripAr = (w) => { if (!/^[\u0600-\u06FF]/.test(w)) return w; for (const pre of AR_PRE) if (w.startsWith(pre) && w.length - pre.length >= 3) return w.slice(pre.length); return w; };
  const stem = (t) => t.split(' ').map(stripAr).join(' ');

  // ---- vehicle aliases (on top of the catalog's own English/Arabic names) ----
  const VEH_ALIAS = {
    'land-cruiser-300': ['lc300', 'lc 300', '300 series', 'land cruiser 300', 'landcruiser 300', 'لاندكروزر 300', 'لاند كروزر 300', 'لكزس lx600', 'lx600', 'gr sport', 'جي ار سبورت'],
    'land-cruiser-200': ['lc200', 'lc 200', '200 series', 'land cruiser 200', 'landcruiser 200', 'لاندكروزر 200', 'لاند كروزر 200', 'lx570', 'lx 570'],
    'land-cruiser-70': ['lc70', 'lc79', 'lc76', 'lc78', 'lc 70', 'lc 79', '70 series', '79 series', 'land cruiser 70', 'land cruiser 79', 'land cruiser 76', 'شاص', 'شاصي', 'ربع', 'بيك اب لاندكروزر', 'لاندكروزر 79', 'لاندكروزر 70', 'لاندكروزر 76'],
    '4runner': ['4runner', '4 runner', 'forerunner', 'فور رنر', 'فوررنر', 'فورنر'],
    'prado': ['prado', 'برادو'],
    'hilux': ['hilux', 'هايلكس', 'هايلوكس', 'revo', 'ريفو'],
    'fj-cruiser': ['fj', 'fj cruiser', 'اف جي', 'إف جي'],
    'patrol-y62': ['y62', 'patrol y62', 'نيسان باترول y62', 'باترول y62', 'باترول 62', 'nismo', 'نيسمو'],
    'patrol-y61': ['y61', 'patrol y61', 'باترول y61', 'باترول 61', 'سفاري', 'safari', 'super safari', 'سوبر سفاري'],
    'navara': ['navara', 'نافارا'],
    'f-150': ['f150', 'f-150', 'f 150', 'raptor', 'رابتر', 'اف 150'],
    'ranger': ['ranger', 'رينجر', 'رنجر', 'ranger raptor'],
    'bronco': ['bronco', 'برونكو'],
    'sierra': ['sierra', 'سييرا', 'سيرا', 'at4', 'denali', 'دينالي'],
    'yukon': ['yukon', 'يوكن', 'يوكون'],
    'silverado': ['silverado', 'سلفرادو', 'سيلفرادو', 'zr2'],
    'tahoe': ['tahoe', 'تاهو'],
    'wrangler-jl': ['wrangler', 'jl', 'رانجلر', 'رانقلر', 'جيب رانجلر', 'rubicon', 'روبيكون'],
    'gladiator': ['gladiator', 'جلادياتور', 'قلادياتور', 'jt']
  };
  // ambiguous names resolved by year
  const VEH_FAMILY = [
    { re: /(^|\s)(land ?cruiser|landcruiser|لاند ?كروزر|لاندكروزر|لاندكروز|لاندكروس)(\s|$)/, pick: (y) => (y && y >= 2022 ? 'land-cruiser-300' : y && y >= 2008 ? 'land-cruiser-200' : y && y < 2008 ? 'land-cruiser-70' : '') },
    { re: /(^|\s)(patrol|باترول|بترول|نيسان باترول)(\s|$)/, pick: (y) => (y && y < 2010 ? 'patrol-y61' : 'patrol-y62') },
    { re: /(^|\s)(jeep|جيب)(\s|$)/, pick: () => 'wrangler-jl' }
  ];
  const MAKE_ALIAS = { toyota: ['toyota', 'تويوتا'], nissan: ['nissan', 'نيسان'], ford: ['ford', 'فورد'], gmc: ['gmc', 'جمس', 'جي ام سي'], chevrolet: ['chevrolet', 'chevy', 'شفروليه', 'شيفروليه', 'شفر'], jeep: ['jeep', 'جيب'] };

  // ---- part types ----
  const CAT_WORDS = {
    suspension: ['suspension', 'lift', 'lift kit', 'leveling', 'levelling', 'shock', 'shocks', 'coilover', 'coilovers', 'coil', 'strut', 'bp51', 'bp-51', 'damper', 'رفع', 'رفعه', 'طقم رفع', 'تعليق', 'مساعدات', 'مساعد', 'مسعدات', 'شوك', 'شوكات', 'سسبنشن', 'كويل', 'يايات', 'ياي', 'نوابض'],
    'wheels-tires': ['wheel', 'wheels', 'rim', 'rims', 'tyre', 'tyres', 'tire', 'tires', 'beadlock', 'alloy', 'جنط', 'جنوط', 'رنج', 'رنجات', 'كفر', 'كفرات', 'تاير', 'تواير', 'اطار', 'اطارات', 'ويلات'],
    lighting: ['light', 'lights', 'lighting', 'led', 'lightbar', 'light bar', 'pod', 'pods', 'fog', 'spot', 'اضاءه', 'اضاءات', 'ليت', 'ليتات', 'كشاف', 'كشافات', 'لمبه', 'لمبات', 'ضوء', 'اضواء', 'بار'],
    power: ['battery', 'power station', 'power', 'jump starter', 'jump start', 'booster', 'compressor', 'inflator', 'dash cam', 'dashcam', 'camera', 'بطاريه', 'باور', 'محطه طاقه', 'طاقه', 'كمبروسر', 'منفاخ', 'نفاخ', 'تشغيل', 'اشتراك', 'كاميرا'],
    recovery: ['recovery', 'shackle', 'soft shackle', 'strap', 'snatch', 'rope', 'deflator', 'deflate', 'tow', 'hitch', 'ring', 'stuck', 'sand', 'سحب', 'حبل', 'حبال', 'شكل', 'شنكل', 'قلاب', 'تنفيس', 'منفس', 'تغريز', 'غرز', 'تطعيس', 'رمل'],
    performance: ['intake', 'air intake', 'cold air', 'exhaust', 'cat back', 'catback', 'filter', 'air filter', 'snorkel', 'performance', 'horsepower', 'hp', 'سحب هواء', 'هواء', 'فلتر', 'اكزوز', 'شكمان', 'عادم', 'صوت', 'قوه', 'سنوركل'],
    drivetrain: ['gear', 'gears', 'ring and pinion', 'pinion', 'locker', 'diff', 'differential', 'axle', 'ratio', 'تروس', 'ترس', 'قفل', 'دفرنس', 'ديفرنس', 'دفرنسيال', 'نسبه'],
    'side-steps': ['side step', 'side steps', 'running board', 'running boards', 'power step', 'powerstep', 'step', 'steps', 'دواسه', 'دواسات', 'دعاسه', 'دعاسات', 'سلم', 'دركسيون جانبي', 'عتبه'],
    tops: ['soft top', 'top', 'roof', 'trektop', 'سقف', 'سقف قماش', 'تنده', 'غطاء']
  };

  const INTENTS = {
    hours: ['open', 'hours', 'opening', 'close', 'closing', 'timing', 'time', 'today', 'friday', 'متي', 'دوام', 'الدوام', 'ساعات', 'مفتوح', 'مفتوحين', 'تفتحون', 'تسكرون', 'الجمعه', 'اوقات'],
    location: ['where', 'location', 'address', 'map', 'maps', 'directions', 'shop location', 'وين', 'فين', 'موقع', 'الموقع', 'العنوان', 'عنوان', 'مكانكم', 'لوكيشن', 'المعبيله'],
    qpay: ['qpay', 'installment', 'installments', 'instalment', 'pay later', 'pay in 4', 'split', 'monthly', 'تقسيط', 'اقساط', 'قسط', 'كيو باي', 'دفعات'],
    delivery: ['delivery', 'deliver', 'shipping', 'ship', 'courier', 'salalah', 'sohar', 'nizwa', 'توصيل', 'توصلون', 'شحن', 'ترسلون', 'صلاله', 'صحار', 'نزوى'],
    install: ['install', 'installation', 'fitting', 'fit it', 'workshop', 'garage', 'تركيب', 'تركبون', 'ورشه', 'كراج'],
    warranty: ['warranty', 'guarantee', 'original', 'genuine', 'fake', 'ضمان', 'كفاله', 'اصلي', 'وكاله', 'تقليد'],
    human: ['human', 'person', 'agent', 'staff', 'call', 'phone', 'whatsapp', 'talk', 'موظف', 'اكلم', 'اتصال', 'رقم', 'واتساب', 'واتس'],
    greet: ['hi', 'hello', 'hey', 'salam', 'salaam', 'السلام', 'سلام', 'مرحبا', 'هلا', 'اهلا', 'مساء', 'صباح'],
    thanks: ['thanks', 'thank you', 'thx', 'شكرا', 'مشكور', 'يعطيك', 'تسلم'],
    price: ['price', 'cost', 'how much', 'rate', 'كم', 'سعر', 'السعر', 'بكم', 'قيمه', 'اسعار'],
    fit: ['fit', 'fits', 'compatible', 'work with', 'suit', 'يناسب', 'تناسب', 'يركب', 'تركب', 'ينفع', 'متوافق']
  };

  const hasPhrase = (txt, ph) => {
    const n = norm(ph);
    if (!n) return false;
    if (/^[a-z0-9 .&-]+$/.test(n)) return new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(txt);
    const a = ' ' + txt + ' ', b = ' ' + stem(txt) + ' ', ns = stem(n);
    return a.includes(' ' + n + ' ') || b.includes(' ' + ns + ' ') || (n.length >= 5 && txt.includes(n));
  };

  function create(catalog) {
    const C = catalog || global.CATALOG || { products: [], vehicles: [], makes: [], categories: [], brands: [] };
    const products = () => (typeof C.products === 'function' ? C.products() : C.products) || [];
    const vehicles = C.vehicles || [];
    const vehById = (id) => vehicles.find(v => v.id === id);

    // index product text once (re-built lazily if the product list changes)
    let idxFor = null, idx = [];
    function index() {
      const list = products();
      if (idxFor === list && idx.length === list.length) return idx;
      idxFor = list;
      idx = list.map(p => ({ p, txt: norm([p.name, p.nameAr, p.brand, p.partNumber, p.sku, p.fitment, p.fitmentAr, p.category].join(' ')), name: norm(p.name + ' ' + (p.nameAr || '')), pn: norm(p.partNumber || p.sku || '') }));
      return idx;
    }

    function findYear(t) { const m = t.match(/\b(19[6-9]\d|20[0-4]\d)\b/); return m ? +m[1] : null; }
    function findVehicle(text) {
      const t = norm(text), year = findYear(t);
      let best = null, bestLen = 0;
      const consider = (id, ph) => { if (hasPhrase(t, ph) && ph.length > bestLen) { best = id; bestLen = ph.length; } };
      vehicles.forEach(v => { consider(v.id, v.en); if (v.ar) consider(v.id, v.ar); consider(v.id, v.make + ' ' + v.en); });
      Object.keys(VEH_ALIAS).forEach(id => VEH_ALIAS[id].forEach(ph => consider(id, ph)));
      if (!best) for (const f of VEH_FAMILY) { if (f.re.test(t) || f.re.test(stem(t))) { const id = f.pick(year); if (id) { best = id; break; } } }
      let make = '';
      if (best) make = (vehById(best) || {}).make || '';
      else Object.keys(MAKE_ALIAS).forEach(m => { if (MAKE_ALIAS[m].some(ph => hasPhrase(t, ph))) make = ({ gmc: 'GMC' })[m] || m[0].toUpperCase() + m.slice(1); });
      return { id: best && vehById(best) ? best : (best && !vehicles.length ? best : null), make, year };
    }
    function findCategories(text) {
      const t = norm(text), out = [];
      Object.keys(CAT_WORDS).forEach(c => { const hits = CAT_WORDS[c].filter(w => hasPhrase(t, w)); if (hits.length) out.push({ id: c, w: hits.reduce((a, h) => a + h.length, 0) }); });
      return out.sort((a, b) => b.w - a.w).map(x => x.id);
    }
    function findBrand(text) {
      const t = norm(text);
      const names = [...new Set(products().map(p => p.brand).filter(Boolean))];
      const extra = { 'Old Man Emu': ['ome', 'old man emu', 'اولد مان'], 'Fox': ['fox', 'فوكس'], 'King Shocks': ['king', 'كينج', 'كنج'], 'Baja Designs': ['baja', 'باجا'], 'K&N': ['k&n', 'kn', 'كي اند ان'], 'Tough Dog': ['tough dog', 'toughdog', 'تف دوق'] };
      return names.find(b => hasPhrase(t, b) || (extra[b] || []).some(x => hasPhrase(t, x))) || '';
    }
    function findBudget(text) {
      const t = norm(text);
      const m = t.match(/(?:under|below|less than|max|maximum|up to|budget|within|اقل من|تحت|حدود|ميزانيه|ما يتجاوز|لا يزيد عن)\s*(?:omr|ro|rial|ريال|ر ع)?\s*(\d{2,5})/);
      return m ? +m[1] : null;
    }
    function intents(text) {
      const t = norm(text);
      return Object.keys(INTENTS).filter(k => INTENTS[k].some(w => hasPhrase(t, w)));
    }
    function fitOf(p, vid, make) {
      const uni = /universal/i.test(p.fitment || '') || (!(p.vehicles || []).length && !(p.allMakes || []).length);
      if (uni) return 'uni';
      if (vid && ((p.vehicles || []).includes(vid) || (p.allMakes || []).includes((vehById(vid) || {}).make))) return 'yes';
      if (!vid && make && ((p.allMakes || []).includes(make) || (p.vehicles || []).some(id => (vehById(id) || {}).make === make))) return 'make';
      return vid || make ? 'no' : 'ask';
    }

    // words customers use -> words in our product names
    const SYN = { rope: 'strap', 'tow rope': 'strap', 'snatch strap': 'strap', حبل: 'strap', حبال: 'strap', شكل: 'shackle', شنكل: 'shackle', تنفيس: 'deflator', منفس: 'deflator', منفاخ: 'compressor', كمبروسر: 'compressor', اشتراك: 'jump starter', بطاريه: 'jump starter', كاميرا: 'dash cam', عادم: 'exhaust', اكزوز: 'exhaust', شكمان: 'exhaust', فلتر: 'intake', كشاف: 'pod', ليت: 'light bar', 'light bar': 'light bar', بار: 'light bar', جنط: 'wheel', جنوط: 'wheel', رفع: 'lift', مساعدات: 'shocks', شوك: 'shocks' };
    const expand = (t) => { let extra = ''; Object.keys(SYN).forEach(k => { if (hasPhrase(t, k)) extra += ' ' + SYN[k]; }); return extra; };
    // Rank catalog products for a free-text request.
    function search(text, opts) {
      opts = opts || {};
      text = text + expand(norm(text));
      const t = norm(text), ws = words(text).filter(w => w.length > 1);
      const veh = opts.vehicle !== undefined ? { id: opts.vehicle, make: opts.make || '' } : findVehicle(text);
      const cats = opts.categories || findCategories(text);
      const brand = opts.brand !== undefined ? opts.brand : findBrand(text);
      const budget = opts.budget !== undefined ? opts.budget : findBudget(text);
      const res = [];
      index().forEach(({ p, txt, name, pn }) => {
        let s = 0;
        if (pn && pn.length > 3 && t.includes(pn)) s += 60;
        if (cats.length) { const ci = cats.indexOf(p.category); s += ci === 0 ? 24 : ci > 0 ? 14 : -30; }
        if (brand) s += p.brand === brand ? 18 : -8;
        ws.forEach(w => { if (w.length > 2 && name.includes(w)) s += 4; else if (w.length > 2 && txt.includes(w)) s += 1.5; });
        const fit = fitOf(p, veh.id, veh.make);
        if (fit === 'yes') s += 16; else if (fit === 'make') s += 8; else if (fit === 'uni') s += 3; else if (fit === 'no') s -= 40;
        if (budget && Number(p.price) > 0 && Number(p.price) > budget) s -= 25;
        if (p.featured) s += 1;
        if (s > 6) res.push({ p, score: s, fit });
      });
      res.sort((a, b) => b.score - a.score);
      return { results: res.slice(0, opts.limit || 6), vehicle: veh, categories: cats, brand, budget };
    }

    // Admin: turn a free-form customer message into quote lines.
    // Handles the website's own format ("• 2 × Name [PART]") and loose text
    // ("salam, need lift kit and 4 tyres for my patrol 2021").
    function parseQuote(text) {
      const all = String(text || '');
      const veh = findVehicle(all);
      const out = { items: [], vehicle: '', vehicleId: veh.id || '', name: '', qpay: /qpay|تقسيط|اقساط|installment/i.test(all), ref: '', unmatched: [] };
      const mName = all.match(/(?:^|\n)\s*(?:name|الاسم|اسمي|my name is)\s*[:：-]?\s*([^\n]{2,40})/i); if (mName) out.name = mName[1].trim();
      const mVeh = all.match(/(?:^|\n)\s*(?:vehicle|السياره|السيارة)\s*[:：]\s*([^\n]+)/i);
      out.vehicle = mVeh ? mVeh[1].trim() : veh.id ? [(vehById(veh.id) || {}).make, (vehById(veh.id) || {}).en, veh.year].filter(Boolean).join(' ') : '';
      const mRef = all.match(/\bRef\s*:\s*(\S+)/i); if (mRef) out.ref = mRef[1];
      const body = all.replace(/4\s*x\s*4\s*wheels(\s*oman)?/ig, ' ').replace(/(\d),(\d{3})/g, '$1$2');
      const segs = body.split(/\r?\n|[,،;؛.!?؟]\s|[,،;؛]|\band\b|\balso\b|\bplus\b|\bwith\b|(?:^|\s)و(?=\s*\d)|\s\+\s/i).map(s => (s || '').trim()).filter(Boolean)
        .flatMap(s => /[\u0600-\u06FF]/.test(s) ? s.split(/\s(?=و(?:[\u0600-\u06FF]{3,}))/).map(x => x.replace(/^و(?=[\u0600-\u06FF]{3,})/, '')) : [s]);
      const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, pair: 2, set: 1, واحد: 1, اثنين: 2, ثنتين: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5 };
      segs.forEach(seg => {
        if (/^(vehicle|السياره|السيارة|name|الاسم|ref|payment|الدفع)\s*[:：]/i.test(seg) || /[:：]\s*$/.test(seg) || /^(hi|hello|hey|salam|السلام|مرحبا)\b[^\d]*$/i.test(seg) && !findCategories(seg).length) return;
        const n = norm(seg);
        if (n.length < 3) return;
        let qty = 1, m;
        const pn = (seg.match(/\[([^\]]+)\]/) || [])[1];
        if ((m = n.match(/^(\d{1,3})\s*x\b/)) || (m = n.match(/\bx\s*(\d{1,3})\b/)) || (m = n.match(/\b(\d{1,2})\s*(?:pcs|pieces|pc|حبه|حبات|قطع|قطعه)\b/)) || (m = n.match(/^(\d{1,2})\s+(?=\D)/))) qty = +m[1];
        else { const w = Object.keys(NUMW).find(k => new RegExp('(^|\\s)' + k + '(\\s|$)').test(n)); if (w) qty = NUMW[w]; }
        let p = null;
        if (pn) p = products().find(x => (x.partNumber || x.sku) === pn.trim());
        if (!p) {
          const cats = findCategories(seg);
          if (!cats.length && !findBrand(seg) && !/\[|\d{4,}/.test(seg) && !index().some(e => words(seg).some(w => w.length > 3 && e.name.includes(w)))) { if (/\b(need|want|looking for|require)\b|ابي|ابغي|ابغى|احتاج|اريد|محتاج/.test(n)) out.unmatched.push(seg.replace(/^(i |we )?(also )?(need|want|am looking for|looking for)\s+/i, '')); return; }
          const r = search(seg, { vehicle: veh.id, make: veh.make, categories: cats.length ? cats : undefined, limit: 2 });
          const top = r.results[0];
          if (top && top.score >= 20 && top.fit !== 'no') p = top.p;
          else if (cats.length || findBrand(seg)) out.unmatched.push(seg);
        }
        if (p) {
          // tyres/wheels asked as a set default to 4 when no number given
          if (qty === 1 && p.category === 'wheels-tires' && /(tyres|tires|wheels|rims|كفرات|جنوط|تواير|رنجات)/.test(n) && !/\b1\b/.test(n)) qty = 4;
          const ex = out.items.find(i => i.pid === p.id);
          if (ex) ex.qty += qty; else out.items.push({ pid: p.id, name: p.name, sku: p.partNumber || p.sku, qty, price: p.price || 0 });
        }
      });
      return out;
    }

    return { norm, findVehicle, findCategories, findBrand, findBudget, intents, search, parseQuote, fitOf };
  }

  global.Match = { create, norm };
})(window);
