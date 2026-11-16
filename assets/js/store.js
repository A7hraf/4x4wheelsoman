/* ============================================================
   4x4 Wheels Oman – online store (customer site)
   Catalog comes from assets/js/catalog.js (published from the admin).
   Customers build a quote list and send it on WhatsApp; QPay for installments.
   ============================================================ */
(function () {
  'use strict';
  const C = window.CATALOG || { products: [], categories: [], vehicles: [], brands: [], makes: [] };
  const DEF = { name: '4x4 Wheels Oman', whatsapp: '96895152025', phone: '+968 9515 2025', instagram: '4x4wheels.om', maps: 'https://maps.app.goo.gl/DnrLbuokgZqgAH878', address: 'Al Maabela, Muscat, Oman', addressAr: 'المعبيلة، مسقط، عُمان', qpayLimit: 500, currency: 'OMR', since: 2019, rating: '5.0', followers: '20K+', showStock: false };
  const S = Object.assign({}, DEF, C.settings || {});
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };

  // Preview mode: the owner can see unpublished admin changes with ?preview
  let PRODUCTS = C.products;
  // (the admin writes a public copy of the catalog when you click "Preview website"; the admin database itself is encrypted)
  if (/[?&]preview\b/.test(location.search)) { const pv = store.get('x4w_preview', null) || store.get('x4w_db_v2', null); if (pv && Array.isArray(pv.products)) PRODUCTS = pv.products; }
  PRODUCTS = PRODUCTS.filter(p => p.active !== false && p.online !== false);

  let lang = store.get('x4w_lang', null) || (navigator.language || '').startsWith('ar') && 'ar' || 'en';
  const setDir = () => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; };
  setDir();

  const TX = {
    en: {
      skip: 'Skip to content', shop_all: 'Shop all', categories: 'Categories', vehicles: 'Vehicles', installments: 'Pay in installments', visit: 'Visit us', chat_wa: 'Chat on WhatsApp', quote: 'Your quote list',
      hero1: 'Built for', hero2: 'the dunes', tagline: '4x4 parts and upgrades in Muscat', lead: 'Lift kits, suspension, wheels, tyres and recovery gear for Land Cruisers, Patrols, Wranglers, Rangers and Sierras, from our shop in Al Maabela, Muscat.',
      shop_parts: 'Shop parts', pay4: 'Pay in 4 with Qpay', find_fit: 'Find parts that fit your 4x4', find_fit_sub: "Pick your vehicle and we'll show only parts that fit.", make: 'Make', model: 'Model', pick_make: 'Pick a make first', show_parts: 'Show parts',
      shop_by_vehicle: 'Shop by vehicle', building: 'What are you building?', browse_all: 'Browse all {n} parts', parts: '{n} parts', part1: '1 part',
      brands_we_carry: 'Brands we carry', brands_sub: "Genuine parts from the brands below. Can't see yours? Ask us and we'll source it.", popular: 'Popular upgrades',
      price_req: 'Price on request', universal: 'Universal fit',
      qp_title: 'Pay in installments with Qpay', qp_text: 'Split your order into up to 4 interest-free payments. For parts priced on request, we quote you on WhatsApp, then send a Qpay payment request to your phone and you pay in the Qpay app. Parts with a listed price can be paid with Qpay at checkout.',
      qp_btn: 'Pay in installments', qp_new: 'New to Qpay? Create an account', example: 'Example order', when_ships: 'When it ships', month: 'Month {n}', qp_note: '4 payments of {x}. No interest or fees. Plans shown at checkout depend on your Qpay limit.',
      not_sure: 'Not sure what fits?', not_sure_t: "Send us your vehicle's make, model and year on WhatsApp and we'll tell you which parts fit before you order. Or drop by and see the parts in person.",
      ask_wa: 'Ask on WhatsApp', directions: 'Get directions', insta: 'See builds on Instagram', on_google: 'on Google', rated: 'Rated by our customers', followers: 'followers', builds: 'Builds and new stock on Instagram', since: 'Since {y}', kitting: 'Kitting out 4x4s from Al Maabela',
      cant_find: "Can't find a part?", cant_find_t: "Send us your vehicle and what you need. We'll check stock or source it for you.",
      foot_about: 'Off-road parts, accessories and upgrades for 4x4s in Oman.', f_shop: 'Shop', f_explore: 'Explore', f_touch: 'Get in touch', hours_short: 'Sat to Thu, 5 PM to 12 AM. Closed Friday.', qbox: 'Pay in up to 4 interest-free installments with Qpay.',
      rights: 'All rights reserved.', brands_note: 'Brand names and logos belong to their owners. 4x4 Wheels Oman is an independent retailer.', terms: 'Terms of service', privacy: 'Privacy policy', home: 'Home', shop: 'Shop',
      all_parts: 'All parts', all_cats: 'All categories', search: 'Search by name or part number', any_vehicle: 'Vehicle', any_brand: 'Brand', sort: 'Sort', s_feat: 'Featured', s_name: 'Name A–Z', s_brand: 'Brand', s_lo: 'Price: low to high', results: '{n} parts', no_results: 'No parts match. Ask us on WhatsApp — we can source most parts.', clear: 'Clear filters',
      part_no: 'Part number', avail: 'Availability', ask_stock: 'Ask us for stock', in_stock: 'In stock', ask_price: 'Ask for the price on WhatsApp', add_quote: 'Add to quote', in_quote: 'In your quote list', added: 'Added to your quote list', view_list: 'View list',
      will_fit: 'Will it fit your vehicle?', pick_mm: 'Pick your make and model.', fits_yes: 'Fits your {v}', fits_no: "Not listed for the {v} — ask us, we may have a version that fits.", fits_ask: "Ask us to confirm fitment for the {v}.", fits_uni: 'Universal fit — works with most 4x4s.',
      perk1: 'Genuine brand parts', perk1d: 'Sourced for the brands we carry.', perk2: 'Fitment checked', perk2d: 'We confirm it fits before you pay.', perk3: 'Pickup in Al Maabela', perk3d: 'Or ask us about delivery.', perk4: 'Pay in 4 with Qpay', perk4d: 'Interest-free on orders up to {x} rial.',
      overview: 'Overview', specifications: 'Specifications', fitment: 'Fitment', about_brand: 'About the brand', how_order: 'How ordering works', brand: 'Brand', category: 'Category', fits: 'Fits', mfr: "Manufacturer's website", shop_all_brand: 'Shop all {b}',
      ho1: 'Ask us on WhatsApp, or add the part to your quote list.', ho2: 'We confirm stock, fitment and the price with you.', ho3: 'Pay as agreed, or in installments with Qpay.', ho4: 'Collect from our shop in Al Maabela, or arrange delivery.',
      more_from: 'More from {b}', more_in: 'More {c}',
      cat_title: 'Shop by category', cat_sub: 'Everything we stock, grouped by what you are building.',
      veh_title: 'Shop by vehicle', veh_sub: 'Pick your make and model to see only the parts that fit it. Not sure? Send us your model and year on WhatsApp and we will check fitment before you order.', all_make: 'All {m} parts', dont_see: "Don't see your part? Ask us.", dont_see_t: "We also supply winches, snorkels, diff lockers and tyres that aren't listed online yet. Send us your model and year on WhatsApp and we'll check fitment and price.",
      inst_sub: 'Split your order into up to 4 interest-free payments. No fees, no interest, and you confirm everything from your phone.', up4: 'Up to 4 payments', zero: '0% interest', nofees: 'No fees', get_app: 'Get the Qpay app',
      how: 'How it works', h1t: 'Get your price', h1d: 'For parts priced on request, we quote you on WhatsApp and send a Qpay payment request to your phone. Parts with a listed price go to Qpay at checkout.', h2t: 'Pick a plan', h2d: 'In the Qpay app or at checkout, choose from the plans you qualify for.', h3t: 'Confirm with a code', h3d: 'Qpay texts you a code. Enter it, then choose a debit card saved in your Qpay app.', h4t: 'Pay over time', h4d: 'The first payment is taken when your order ships, the rest monthly.',
      work_out: 'Work out your payments', need: 'What you need', need1: 'The Qpay app with an account in your name', need2: 'A debit card saved in the Qpay app', need3: 'Your Omani mobile number to receive the code', order_total: 'Order total', shown4: 'Shown as 4 equal payments. Qpay covers orders up to {x} rial; the plans offered at checkout depend on your Qpay limit.',
      questions: 'Questions', q1: 'Are there any fees or interest?', a1: "No. Qpay doesn't charge customers fees or interest for splitting a purchase.", q2: 'When is the first payment taken?', a2: 'When your order ships. The remaining payments are taken monthly.', q3: 'How much can I split?', a3: 'Orders up to {x} rial, depending on your Qpay limit.', q4: 'Which items can I pay for with Qpay?', a4: 'Any part we sell. For parts priced on request we send the Qpay request after confirming the price on WhatsApp.',
      ready: 'Ready to build?', ready_t: "Ask us on WhatsApp for a quote and we'll send the Qpay request straight to your phone.",
      visit_title: 'Visit us in Al Maabela', visit_sub: 'See the parts in person, bring your vehicle, or ask us anything on WhatsApp first.', wa_fast: 'The fastest way to reach us: send your vehicle and the part you need.', location: 'Location', open_maps: 'Open in Google Maps', ig_t: 'New stock and recent builds.', follow: 'Follow on Instagram',
      opening: 'Opening hours', sat_thu: 'Saturday to Thursday', h_time: '5 PM to 12 AM', friday: 'Friday', closed: 'Closed', open_now: 'Open now', closed_now: 'Closed now', before: 'Before you come', before_t: 'Message us on WhatsApp to check the part is in stock and fits your vehicle, so it\'s ready when you arrive.', b1: "Send your vehicle's make, model and year", b2: "Tell us the part or upgrade you're after", b3: 'We confirm stock and fitment before you drive over',
      q_intro: 'Add your vehicle and send the list on WhatsApp. We reply with price, stock and fitment before you pay anything.', q_empty: 'Your quote list is empty', q_empty_t: 'Pick a category or search by your vehicle to find parts.',
      your_vehicle: 'Your vehicle', year: 'Year', your_name: 'Your name', optional: 'optional', notes: 'Notes', want_qpay: 'I want to pay in installments with Qpay', send_list: 'Send list on WhatsApp', remove: 'Remove', items: 'Items', est_total: 'Listed prices total', on_req_n: '+ {n} priced on request', list_hint: 'Opens WhatsApp with your list ready to send. Nothing is charged now.',
      wa_hi_q: 'Hi 4x4 Wheels, please quote these parts:', wa_vehicle: 'Vehicle', wa_name: 'Name', wa_qpay: 'Payment: I would like to pay in installments with Qpay', wa_q_part: 'Hi 4x4 Wheels, what is the price of {p} (part {pn})?', wa_fit: 'Hi 4x4 Wheels, can you check what fits my vehicle? Make / model / year: ', wa_q: 'Hi 4x4 Wheels, I have a question about a part.', wa_cant: 'Hi 4x4 Wheels, I am looking for a part. My vehicle: ',
      terms_t: 'Terms of service', privacy_t: 'Privacy policy', legal_text: 'Prices are confirmed on WhatsApp before payment. Fitment is checked with you before you pay. Installment plans are provided by Qpay and subject to their approval. We only use your name, phone and vehicle details to answer your request and process your order; we never sell your data.', menu: 'Menu', close: 'Close'
    },
    ar: {
      skip: 'انتقل إلى المحتوى', shop_all: 'تسوّق كل القطع', categories: 'الفئات', vehicles: 'السيارات', installments: 'الدفع بالتقسيط', visit: 'زورونا', chat_wa: 'تواصل عبر واتساب', quote: 'قائمة عرض السعر',
      hero1: 'جهّزها', hero2: 'للرمال', tagline: 'قطع وتعديلات الدفع الرباعي في مسقط', lead: 'أطقم رفع ومساعدات وجنوط وكفرات ومعدات سحب للاندكروزر والباترول والرانجلر والرينجر والسييرا، من محلنا في المعبيلة بمسقط.',
      shop_parts: 'تسوّق القطع', pay4: 'قسّطها على 4 دفعات مع Qpay', find_fit: 'ابحث عن قطع تناسب سيارتك', find_fit_sub: 'اختر سيارتك وسنعرض لك القطع المناسبة لها فقط.', make: 'الماركة', model: 'الموديل', pick_make: 'اختر الماركة أولاً', show_parts: 'اعرض القطع',
      shop_by_vehicle: 'تسوّق حسب سيارتك', building: 'ماذا تجهّز لسيارتك؟', browse_all: 'تصفّح كل القطع ({n})', parts: '{n} قطع', part1: 'قطعة واحدة',
      brands_we_carry: 'العلامات التي نوفرها', brands_sub: 'قطع أصلية من العلامات التالية. لم تجد ما تبحث عنه؟ اسألنا وسنوفره لك.', popular: 'الأكثر طلباً',
      price_req: 'السعر عند الطلب', universal: 'تناسب جميع السيارات',
      qp_title: 'قسّط مشترياتك مع Qpay', qp_text: 'قسّم طلبك على 4 دفعات بدون فوائد. القطع التي سعرها عند الطلب نرسل لك سعرها عبر واتساب، ثم نرسل طلب دفع من Qpay إلى هاتفك فتدفع عبر تطبيق Qpay. أما القطع ذات السعر المحدد فتدفع ثمنها عبر Qpay عند الدفع.',
      qp_btn: 'الدفع بالتقسيط', qp_new: 'ليس لديك حساب في Qpay؟ أنشئ حساباً', example: 'مثال على طلب', when_ships: 'عند الشحن', month: 'الشهر {n}', qp_note: '4 دفعات قيمة كل منها {x}. بدون فوائد أو رسوم، والخطط المتاحة عند الدفع تعتمد على حدّك الائتماني في Qpay.',
      not_sure: 'لست متأكداً مما يناسب سيارتك؟', not_sure_t: 'أرسل لنا ماركة سيارتك وموديلها وسنة صنعها على واتساب، وسنخبرك بالقطع المناسبة قبل أن تطلب. أو زرنا وشاهد القطع بنفسك.',
      ask_wa: 'اسألنا على واتساب', directions: 'افتح الموقع في الخرائط', insta: 'شاهد أعمالنا على إنستغرام', on_google: 'على جوجل', rated: 'بتقييم عملائنا', followers: 'متابع', builds: 'أعمالنا والجديد على إنستغرام', since: 'منذ {y}', kitting: 'نجهّز سيارات الدفع الرباعي من المعبيلة',
      cant_find: 'لم تجد القطعة؟', cant_find_t: 'أرسل لنا نوع سيارتك وما تحتاجه، وسنتحقق من التوفّر أو نوفّرها لك.',
      foot_about: 'قطع وإكسسوارات وتعديلات لسيارات الدفع الرباعي في عُمان.', f_shop: 'تسوّق', f_explore: 'تصفّح', f_touch: 'تواصل معنا', hours_short: 'من السبت إلى الخميس، 5 مساءً حتى 12 منتصف الليل. الجمعة مغلق.', qbox: 'قسّط مشترياتك على 4 دفعات بدون فوائد مع Qpay.',
      rights: 'جميع الحقوق محفوظة.', brands_note: 'أسماء العلامات التجارية وشعاراتها ملك لأصحابها. 4x4 Wheels عُمان متجر مستقل.', terms: 'شروط الخدمة', privacy: 'سياسة الخصوصية', home: 'الرئيسية', shop: 'المتجر',
      all_parts: 'كل القطع', all_cats: 'كل الفئات', search: 'ابحث بالاسم أو رقم القطعة', any_vehicle: 'السيارة', any_brand: 'العلامة', sort: 'الترتيب', s_feat: 'المميزة', s_name: 'الاسم', s_brand: 'العلامة', s_lo: 'السعر: من الأقل', results: '{n} قطعة', no_results: 'لا توجد قطع مطابقة. اسألنا على واتساب — نستطيع توفير معظم القطع.', clear: 'مسح الفلاتر',
      part_no: 'رقم القطعة', avail: 'التوفر', ask_stock: 'اسألنا عن التوفر', in_stock: 'متوفر', ask_price: 'اسأل عن السعر عبر واتساب', add_quote: 'أضف إلى عرض السعر', in_quote: 'في قائمة عرض السعر', added: 'أضيفت إلى قائمة عرض السعر', view_list: 'عرض القائمة',
      will_fit: 'هل تناسب سيارتك؟', pick_mm: 'اختر الماركة والموديل.', fits_yes: 'تناسب {v}', fits_no: 'غير مدرجة لـ {v} — اسألنا، قد تتوفر نسخة مناسبة.', fits_ask: 'اسألنا لتأكيد التوافق مع {v}.', fits_uni: 'تناسب جميع السيارات تقريباً.',
      perk1: 'قطع أصلية', perk1d: 'من العلامات التي نوفرها.', perk2: 'نتأكد من التوافق', perk2d: 'نؤكد أنها تناسب سيارتك قبل الدفع.', perk3: 'الاستلام من المعبيلة', perk3d: 'أو اسألنا عن التوصيل.', perk4: 'قسّطها على 4 مع Qpay', perk4d: 'بدون فوائد للطلبات حتى {x} ريال.',
      overview: 'نظرة عامة', specifications: 'المواصفات', fitment: 'التوافق', about_brand: 'عن العلامة التجارية', how_order: 'كيف تطلب', brand: 'العلامة التجارية', category: 'الفئة', fits: 'تناسب', mfr: 'موقع الشركة المصنعة', shop_all_brand: 'كل منتجات {b}',
      ho1: 'اسألنا على واتساب، أو أضف القطعة إلى قائمة عرض السعر.', ho2: 'نؤكد معك التوفر والتوافق والسعر.', ho3: 'ادفع كما اتفقنا، أو بالتقسيط مع Qpay.', ho4: 'استلم من محلنا في المعبيلة، أو رتّب التوصيل.',
      more_from: 'المزيد من {b}', more_in: 'المزيد من {c}',
      cat_title: 'تسوّق حسب الفئة', cat_sub: 'كل ما نوفره، مرتّب حسب ما تجهّزه لسيارتك.',
      veh_title: 'تسوّق حسب السيارة', veh_sub: 'اختر الماركة والموديل لترى القطع المناسبة لسيارتك فقط. لست متأكداً؟ أرسل لنا الموديل والسنة على واتساب ونتأكد من التوافق قبل الطلب.', all_make: 'كل قطع {m}', dont_see: 'لا تجد القطعة التي تبحث عنها؟ اسألنا.', dont_see_t: 'نوفّر أيضاً ونشات وسنوركل وقفل دفرنس وكفرات غير معروضة في الموقع بعد. أرسل لنا الموديل والسنة على واتساب ونتأكد لك من التوافق والسعر.',
      inst_sub: 'قسّم طلبك على 4 دفعات بدون فوائد. بدون رسوم وبدون فوائد، وتؤكد كل شيء من هاتفك.', up4: 'حتى 4 دفعات', zero: 'بدون فوائد', nofees: 'بدون رسوم', get_app: 'حمّل تطبيق Qpay',
      how: 'كيف يعمل', h1t: 'احصل على السعر', h1d: 'القطع التي سعرها عند الطلب نرسل لك سعرها عبر واتساب، ثم نرسل طلب دفع من Qpay إلى هاتفك. والقطع ذات السعر المحدد تدفعها عبر Qpay عند الدفع.', h2t: 'اختر خطة', h2d: 'في تطبيق Qpay أو عند الدفع، اختر من الخطط المتاحة لك.', h3t: 'أكّد بالرمز', h3d: 'يصلك رمز من Qpay برسالة نصية. أدخله ثم اختر بطاقة خصم محفوظة في تطبيق Qpay.', h4t: 'ادفع على مراحل', h4d: 'تُخصم الدفعة الأولى عند شحن طلبك، والباقي شهرياً.',
      work_out: 'احسب دفعاتك', need: 'ما تحتاجه', need1: 'تطبيق Qpay وحساب باسمك', need2: 'بطاقة خصم محفوظة في تطبيق Qpay', need3: 'رقم هاتفك العُماني لاستلام الرمز', order_total: 'قيمة الطلب', shown4: 'معروضة كـ 4 دفعات متساوية. يغطي Qpay الطلبات حتى {x} ريال، والخطط المتاحة عند الدفع تعتمد على حدّك في Qpay.',
      questions: 'أسئلة شائعة', q1: 'هل توجد رسوم أو فوائد؟', a1: 'لا. لا تفرض Qpay على العملاء أي رسوم أو فوائد عند تقسيط المشتريات.', q2: 'متى تُخصم الدفعة الأولى؟', a2: 'عند شحن طلبك، والدفعات المتبقية شهرياً.', q3: 'ما المبلغ الذي يمكنني تقسيطه؟', a3: 'الطلبات حتى {x} ريال حسب حدّك في Qpay.', q4: 'ما القطع التي يمكنني دفعها عبر Qpay؟', a4: 'أي قطعة نبيعها. للقطع التي سعرها عند الطلب نرسل طلب Qpay بعد تأكيد السعر على واتساب.',
      ready: 'جاهز لتجهيز سيارتك؟', ready_t: 'اطلب السعر عبر واتساب، وسنرسل طلب الدفع من Qpay إلى هاتفك مباشرة.',
      visit_title: 'زورونا في المعبيلة', visit_sub: 'شاهد القطع بنفسك، أو أحضر سيارتك، أو اسألنا أولاً على واتساب.', wa_fast: 'أسرع طريقة للتواصل: أرسل نوع سيارتك والقطعة التي تحتاجها.', location: 'الموقع', open_maps: 'افتح في خرائط جوجل', ig_t: 'البضائع الجديدة وأحدث أعمالنا.', follow: 'تابعنا على إنستغرام',
      opening: 'ساعات العمل', sat_thu: 'السبت إلى الخميس', h_time: '5 مساءً حتى 12 منتصف الليل', friday: 'الجمعة', closed: 'مغلق', open_now: 'مفتوح الآن', closed_now: 'مغلق الآن', before: 'قبل أن تأتي', before_t: 'راسلنا على واتساب لنتأكد أن القطعة متوفرة وتناسب سيارتك، لتكون جاهزة عند وصولك.', b1: 'أرسل ماركة سيارتك وموديلها وسنة الصنع', b2: 'أخبرنا بالقطعة أو التعديل الذي تريده', b3: 'نؤكد التوفر والتوافق قبل أن تأتي',
      q_intro: 'أضف سيارتك وأرسل القائمة على واتساب. نرد عليك بالسعر والتوفر والتوافق قبل أن تدفع أي شيء.', q_empty: 'قائمة عرض السعر فارغة', q_empty_t: 'اختر فئة أو ابحث حسب سيارتك للعثور على القطع.',
      your_vehicle: 'سيارتك', year: 'السنة', your_name: 'اسمك', optional: 'اختياري', notes: 'ملاحظات', want_qpay: 'أرغب بالدفع بالتقسيط مع Qpay', send_list: 'أرسل القائمة على واتساب', remove: 'حذف', items: 'القطع', est_total: 'مجموع الأسعار المحددة', on_req_n: '+ {n} بسعر عند الطلب', list_hint: 'يفتح واتساب والقائمة جاهزة للإرسال. لن يتم خصم أي مبلغ الآن.',
      wa_hi_q: 'مرحباً 4x4 Wheels، أرجو تسعير هذه القطع:', wa_vehicle: 'السيارة', wa_name: 'الاسم', wa_qpay: 'الدفع: أرغب بالتقسيط مع Qpay', wa_q_part: 'مرحباً 4x4 Wheels، كم سعر {p} (رقم القطعة {pn})؟', wa_fit: 'مرحباً 4x4 Wheels، هل يمكنكم التأكد مما يناسب سيارتي؟ الماركة / الموديل / السنة: ', wa_q: 'مرحباً 4x4 Wheels، لدي سؤال عن قطعة.', wa_cant: 'مرحباً 4x4 Wheels، أبحث عن قطعة. سيارتي: ',
      terms_t: 'شروط الخدمة', privacy_t: 'سياسة الخصوصية', legal_text: 'نؤكد الأسعار عبر واتساب قبل الدفع، ونتحقق من التوافق معك قبل أن تدفع. خطط التقسيط مقدمة من Qpay وتخضع لموافقتها. نستخدم اسمك ورقمك وبيانات سيارتك فقط للرد على طلبك وتنفيذه، ولا نبيع بياناتك أبداً.', menu: 'القائمة', close: 'إغلاق'
    }
  };
  const t = (k, v) => { let s = (TX[lang] && TX[lang][k]) || TX.en[k] || k; if (v) Object.keys(v).forEach(x => { s = s.split('{' + x + '}').join(v[x]); }); return s; };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const RIAL = `<svg class="rial" viewBox="0 0 30 22" fill="currentColor" aria-label="OMR"><path d="M2 14h26l-2 3H4zM6 9h20l-2 3H8zM18 2l3 1-4 11h-3z"/></svg>`;
  const money = (n) => `${RIAL}<span class="num">${fmt(n)}</span>`;
  const WA = '<svg class="ic" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.6-5.6C5.2 10 10 5.3 16 5.3S26.8 10 26.8 15.8 22 26.4 16 26.4Zm5.9-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z"/></svg>';
  const wa = (text) => `https://api.whatsapp.com/send?phone=${String(S.whatsapp).replace(/\D/g, '')}${text ? '&text=' + encodeURIComponent(text) : ''}`;
  const L = (o, k) => (lang === 'ar' && o[k + 'Ar']) || o[k] || '';
  const catOf = (id) => C.categories.find(c => c.id === id) || { id, en: id, ar: id };
  const catName = (id) => { const c = catOf(id); return lang === 'ar' ? c.ar : c.en; };
  const veh = (id) => C.vehicles.find(v => v.id === id);
  const vehName = (v) => v ? (lang === 'ar' ? v.ar : v.en) : '';
  const makeName = (m) => { const x = C.makes.find(k => k.en === m); return x ? (lang === 'ar' ? x.ar : x.en) : m; };
  const brandOf = (name) => C.brands.find(b => b.name === name) || { name, label: (name || '').toUpperCase(), about: '' };
  const prodBy = (slug) => PRODUCTS.find(p => p.slug === slug);
  const partsN = (n) => n === 1 ? t('part1') : t('parts', { n });
  const fitsText = (p) => L(p, 'fitment') === 'Universal fit' || !p.fitment ? t('universal') : L(p, 'fitment');
  const isUniversal = (p) => /universal/i.test(p.fitment || '') || (!p.vehicles.length && !(p.allMakes || []).length);
  function fitsVehicle(p, vid) {
    if (isUniversal(p)) return 'uni';
    const v = veh(vid); if (!v) return 'ask';
    if ((p.vehicles || []).includes(vid) || (p.allMakes || []).includes(v.make)) return 'yes';
    return 'no';
  }
  const img = (p, cls) => p.image ? `<img src="${esc(p.image)}" alt="${esc(L(p, 'name'))}" loading="lazy" ${cls ? `class="${cls}"` : ''}>` : (window.productArt ? productArt(p) : '');
  const hasPrice = (p) => Number(p.price) > 0;

  // ---------- quote list ----------
  let quote = store.get('x4w_quote', []).filter(l => prodBy(l.slug));
  const saveQuote = () => { store.set('x4w_quote', quote); const n = $('#qN'); if (n) { n.textContent = qCount(); n.classList.toggle('hide', !qCount()); } };
  const qCount = () => quote.reduce((a, l) => a + l.qty, 0);
  function addQuote(slug, qty) {
    const l = quote.find(x => x.slug === slug);
    if (l) l.qty += qty || 1; else quote.push({ slug, qty: qty || 1 });
    saveQuote(); toast(`${t('added')} · <a href="#/quote">${t('view_list')}</a>`);
    $$(`[data-add="${slug}"]`).forEach(b => b.classList.add('in'));
  }
  function toast(html) { $$('.toast').forEach(x => x.remove()); const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = icon('check') + `<span>${html}</span>`; document.body.appendChild(el); setTimeout(() => el.remove(), 2600); }

  // ---------- shared chrome ----------
  function header(solid) {
    const nav = [['shop', 'shop_all'], ['categories', 'categories'], ['vehicles', 'vehicles'], ['installments', 'installments'], ['visit', 'visit']];
    return `<header class="hdr ${solid ? 'solid' : ''}"><div class="wrap">
      <button class="icon-btn burger" id="burger" aria-label="${t('menu')}">${icon('menu')}</button>
      <a class="logo" href="#/" aria-label="${esc(S.name)}"><img src="assets/img/site/logo-mark.png" alt="${esc(S.name)}"></a>
      <nav class="nav">${nav.map(([r, k]) => `<a href="#/${r}" class="${route.name === r ? 'on' : ''}">${t(k)}</a>`).join('')}</nav>
      <span class="sp"></span>
      <button class="lang" id="langBtn">${lang === 'ar' ? 'English' : 'العربية'}</button>
      <a class="btn red sm wa-top" href="${wa(t('wa_q'))}" target="_blank" rel="noopener">${WA}${t('chat_wa')}</a>
      <a class="icon-btn" href="#/quote" aria-label="${t('quote')}">${icon('cart')}<span class="n ${qCount() ? '' : 'hide'}" id="qN">${qCount()}</span></a>
    </div></header>`;
  }
  function footer() {
    const y = new Date().getFullYear();
    return `<section class="cant"><div class="wrap"><span class="i">${WA}</span><div><h3>${t('cant_find')}</h3><p>${t('cant_find_t')}</p></div><a class="btn red" href="${wa(t('wa_cant'))}" target="_blank" rel="noopener">${WA}${t('chat_wa')}</a></div></section>
      <footer class="foot"><div class="wrap"><div class="cols">
        <div><a class="logo" href="#/"><img src="assets/img/site/logo-mark.png" alt="${esc(S.name)}"></a><p>${t('foot_about')}</p>
          <div class="socials"><a href="https://www.instagram.com/${esc(S.instagram)}/" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a><a href="${wa()}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA}</a><a href="${esc(S.maps)}" target="_blank" rel="noopener" aria-label="Maps">${icon('pin')}</a></div></div>
        <div><h4>${t('f_shop')}</h4>${C.categories.map(c => `<a href="#/shop?c=${c.id}">${catName(c.id)}</a>`).join('')}<a href="#/vehicles">${t('shop_by_vehicle')}</a></div>
        <div><h4>${t('f_explore')}</h4><a href="#/shop">${t('shop_all')}</a><a href="#/categories">${t('categories')}</a><a href="#/installments">${t('installments')}</a><a href="#/visit">${t('visit')}</a><a href="#/quote">${t('quote')}</a></div>
        <div><h4>${t('f_touch')}</h4>
          <a class="ct" href="${wa()}" target="_blank" rel="noopener">${WA}<span dir="ltr">${esc(S.phone)}</span></a>
          <a class="ct" href="https://www.instagram.com/${esc(S.instagram)}/" target="_blank" rel="noopener">${icon('instagram')}<span>@${esc(S.instagram)}</span></a>
          <a class="ct" href="${esc(S.maps)}" target="_blank" rel="noopener">${icon('pin')}<span>${esc(lang === 'ar' ? S.addressAr : S.address)}</span></a>
          <span class="li ct">${icon('clock')}<span>${t('hours_short')}</span></span>
          <div class="qbox"><b>Qpay</b><p>${t('qbox')}</p></div></div>
      </div>
      <div class="legal"><div>© ${y} ${esc(S.name)}. ${t('rights')}<small>${t('brands_note')}</small></div><div class="lk"><a href="#/terms">${t('terms')}</a><a href="#/privacy">${t('privacy')}</a><button class="lang" data-lang>${lang === 'ar' ? 'English' : 'العربية'}</button></div></div></div></footer>`;
  }

  function card(p) {
    const inQ = quote.some(l => l.slug === p.slug);
    const off = hasPrice(p) && p.oldPrice > p.price;
    return `<article class="card"><a class="img" href="#/p/${p.slug}" style="position:relative">${img(p)}${off ? `<span class="sale">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ''}</a>
      <div class="bd"><span class="br">${esc(brandOf(p.brand).label || catName(p.category))}</span><a class="nm" href="#/p/${p.slug}">${esc(L(p, 'name'))}</a><span class="ft">${esc(fitsText(p))}</span>
        <div class="pr"><span>${hasPrice(p) ? `<b>${money(p.price)}</b>${off ? `<s>${fmt(p.oldPrice)}</s>` : ''}` : t('price_req')}</span><button class="add ${inQ ? 'in' : ''}" data-add="${p.slug}" aria-label="${t('add_quote')}">${icon(inQ ? 'check' : 'plus')}</button></div></div></article>`;
  }
  const crumbs = (items) => `<nav class="crumbs">${items.map((x, i) => i < items.length - 1 ? `<a href="${x[1]}">${esc(x[0])}</a><span class="sep">›</span>` : `<span>${esc(x[0])}</span>`).join('')}</nav>`;

  // ---------- pages ----------
  function finderHTML(id) {
    const mk = state.finderMake;
    const models = mk ? C.vehicles.filter(v => v.make === mk) : [];
    return `<div class="finder" id="${id}">
      <div class="fi"><img src="assets/img/site/fit-check.webp" alt=""><div><h3>${t('find_fit')}</h3><p>${t('find_fit_sub')}</p></div></div>
      <div style="display:flex;flex-direction:column;gap:10px;flex:1;min-width:280px">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="step"><b>1</b>${t('make')}</span><div class="pills">${C.makes.map(m => `<button class="pill ${mk === m.en ? 'on' : ''}" data-make="${m.en}">${lang === 'ar' ? m.ar : m.en}</button>`).join('')}</div></div>
        ${mk ? `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="step"><b>2</b>${t('model')}</span><div class="pills">${models.map(v => `<button class="pill ${state.finderModel === v.id ? 'on' : ''}" data-model="${v.id}">${vehName(v)}</button>`).join('')}</div></div>` : ''}
      </div>
      <a class="btn red go" href="#/shop${qs({ v: state.finderModel, mk: state.finderModel ? '' : mk })}">${t('show_parts')}</a></div>`;
  }
  function pageHome() {
    const cnt = (id) => PRODUCTS.filter(p => p.category === id).length;
    const layout = { suspension: 't-big', lighting: 't-tall', performance: 't-wide', tops: 't-3' };
    const brands = C.brands.map(b => ({ b, list: PRODUCTS.filter(p => p.brand === b.name) })).filter(x => x.list.length);
    const pop = PRODUCTS.filter(p => p.featured).slice(0, 6);
    const ex = 480;
    return `${header(false)}
      <section class="hero"><div class="wrap">
        <h1 class="chrome">${t('hero1')}<br>${t('hero2')}</h1>
        <div class="tag">${t('tagline')}</div><div class="redline"></div>
        <p class="lead">${t('lead')}</p>
        <div class="cta"><a class="btn red" href="#/shop">${t('shop_parts')}</a><a class="btn" href="#/installments">${t('pay4')}</a></div>
        ${finderHTML('finder')}
      </div></section>
      <section class="sec tight"><div class="wrap"><div class="label">${t('shop_by_vehicle')}</div>
        <div class="vehicles">${C.vehicles.filter(v => v.featured).map(v => `<a class="veh" href="#/shop?v=${v.id}"><img src="${v.image}" alt="" loading="lazy"><b>${vehName(v)}</b><span>${makeName(v.make)}</span></a>`).join('')}</div></div></section>
      <section class="sec divider"><div class="wrap"><div class="sec-h"><h2>${t('building')}</h2><a href="#/shop">${t('browse_all', { n: PRODUCTS.length })}</a></div>
        <div class="bento">${C.categories.map(c => `<a class="tile ${layout[c.id] || ''}" href="#/shop?c=${c.id}"><img src="${c.image}" alt="" loading="lazy"><div class="tx"><small>${partsN(cnt(c.id))}</small><h3>${catName(c.id)}</h3>${L(c, 'desc') && layout[c.id] && layout[c.id] !== 't-wide' && layout[c.id] !== 't-3' ? `<p>${esc(L(c, 'desc'))}</p>` : ''}</div></a>`).join('')}</div></div></section>
      <section class="sec brands-sec"><div class="wrap"><div class="sign"><h2>${t('brands_we_carry')}</h2><p>${t('brands_sub')}</p></div>
        <div class="brand-grid">${brands.map(x => `<a class="brand" href="#/shop?b=${encodeURIComponent(x.b.name)}"><b>${esc(x.b.label)}</b><img src="${esc(x.list[0].image)}" alt="" loading="lazy"><small>${partsN(x.list.length)}</small></a>`).join('')}</div></div></section>
      <section class="sec"><div class="wrap"><div class="sec-h"><h2>${t('popular')}</h2></div><div class="grid">${pop.map(card).join('')}</div></div></section>
      <section class="sec divider"><div class="wrap qp"><div><h2>${t('qp_title')}</h2><p>${t('qp_text')}</p><a class="btn red" href="#/installments">${t('qp_btn')}</a><a class="ul" href="https://qpay.om/" target="_blank" rel="noopener">${t('qp_new')}</a></div>
        <div class="plan"><div class="lbl">${t('example')}</div><div class="tot">${money(ex)}</div>
          <div class="inst">${[t('when_ships'), t('month', { n: 1 }), t('month', { n: 2 }), t('month', { n: 3 })].map(l => `<div><small>${l}</small><b class="num">${fmt(ex / 4)}</b></div>`).join('')}</div><div class="redline"></div>
          <div class="note">${t('qp_note', { x: `${fmt(ex / 4)}` })}</div></div></div></section>
      ${fitSection()}
      ${footer()}`;
  }
  function fitSection() {
    return `<section class="sec divider"><div class="wrap"><div class="fit"><div class="ph"><img src="assets/img/site/workshop.webp" alt="" loading="lazy"></div>
      <div><h2>${t('not_sure')}</h2><p>${t('not_sure_t')}</p><div class="loc">${icon('pin')}${esc(lang === 'ar' ? S.addressAr : S.address)}</div>
        <div class="cta"><a class="btn red sm" href="${wa(t('wa_fit'))}" target="_blank" rel="noopener">${WA}${t('ask_wa')}</a><a class="btn sm" href="${esc(S.maps)}" target="_blank" rel="noopener">${icon('pin')}${t('directions')}</a><a class="btn sm" href="https://www.instagram.com/${esc(S.instagram)}/" target="_blank" rel="noopener">${icon('instagram')}${t('insta')}</a></div></div></div>
      <div class="stats3"><a class="stat" href="${esc(S.maps)}" target="_blank" rel="noopener"><span class="i">${icon('star')}</span><div><b>${esc(S.rating)} ${t('on_google')}</b><span>${t('rated')}</span></div></a>
        <a class="stat" href="https://www.instagram.com/${esc(S.instagram)}/" target="_blank" rel="noopener"><span class="i">${icon('instagram')}</span><div><b>${esc(S.followers)} ${t('followers')}</b><span>${t('builds')}</span></div></a>
        <div class="stat"><span class="i">${icon('clock')}</span><div><b>${t('since', { y: S.since })}</b><span>${t('kitting')}</span></div></div></div></div></section>`;
  }

  function pageShop() {
    const q = route.q;
    let list = PRODUCTS.slice();
    if (q.c) list = list.filter(p => p.category === q.c);
    if (q.b) list = list.filter(p => p.brand === q.b);
    if (q.v) list = list.filter(p => fitsVehicle(p, q.v) !== 'no');
    if (q.mk) list = list.filter(p => isUniversal(p) || (p.allMakes || []).includes(q.mk) || p.vehicles.some(id => (veh(id) || {}).make === q.mk));
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter(p => [p.name, p.nameAr, p.brand, p.partNumber, p.sku, p.fitment, catName(p.category)].join(' ').toLowerCase().includes(s)); }
    const sort = q.s || 'feat';
    if (sort === 'name') list.sort((a, b) => L(a, 'name').localeCompare(L(b, 'name')));
    if (sort === 'brand') list.sort((a, b) => a.brand.localeCompare(b.brand));
    if (sort === 'lo') list.sort((a, b) => (a.price || 1e9) - (b.price || 1e9));
    const title = q.c ? catName(q.c) : q.b ? brandOf(q.b).label : q.v ? vehName(veh(q.v)) : q.mk ? makeName(q.mk) : t('all_parts');
    const link = (patch) => '#/shop' + qs(Object.assign({}, q, patch));
    const vlist = C.vehicles.filter(v => PRODUCTS.some(p => fitsVehicle(p, v.id) === 'yes'));
    return `${header(true)}
      <section class="shop-top"><div class="wrap" style="margin-top:-30px">${crumbs([[t('home'), '#/'], [t('shop'), '#/shop'], ...(title !== t('all_parts') ? [[title, '']] : [])])}
        <h1>${esc(title)}</h1>
        <div class="pills"><a class="pill ${!q.c ? 'on' : ''}" href="${link({ c: '' })}">${t('all_cats')} <span class="c">${PRODUCTS.length}</span></a>${C.categories.map(c => `<a class="pill ${q.c === c.id ? 'on' : ''}" href="${link({ c: c.id })}">${catName(c.id)}</a>`).join('')}</div></div></section>
      <section><div class="wrap">${list.length ? `<div class="grid g4">${list.map(card).join('')}</div>` : `<div class="empty"><p>${t('no_results')}</p><div class="cta" style="justify-content:center"><a class="btn red sm" href="${wa(t('wa_cant'))}" target="_blank" rel="noopener">${WA}${t('ask_wa')}</a><a class="btn sm" href="#/shop">${t('clear')}</a></div></div>`}</div>
        <div class="filterbar"><div class="wrap">
          <form class="search" id="sf">${icon('search')}<input class="field" name="q" placeholder="${t('search')}" value="${esc(q.q || '')}" aria-label="${t('search')}"></form>
          <select class="field" id="fv" aria-label="${t('any_vehicle')}"><option value="">${t('any_vehicle')}</option>${vlist.map(v => `<option value="${v.id}" ${q.v === v.id ? 'selected' : ''}>${makeName(v.make)} ${vehName(v)}</option>`).join('')}</select>
          <select class="field" id="fb" aria-label="${t('any_brand')}"><option value="">${t('any_brand')}</option>${C.brands.filter(b => PRODUCTS.some(p => p.brand === b.name)).map(b => `<option value="${esc(b.name)}" ${q.b === b.name ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <select class="field" id="fs" aria-label="${t('sort')}">${[['feat', 's_feat'], ['name', 's_name'], ['brand', 's_brand'], ['lo', 's_lo']].map(([k, l]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>
          ${(q.c || q.b || q.v || q.q || q.mk) ? `<a class="btn xs" href="#/shop">${t('clear')}</a>` : ''}
          <span class="count">${t('results', { n: list.length })}</span></div></div></section>
      <div style="height:40px"></div>${footer()}`;
  }

  function pageProduct(slug) {
    const p = prodBy(slug);
    if (!p) return `${header(true)}<div class="wrap empty" style="padding-top:160px"><h2>404</h2><p><a class="btn sm" href="#/shop">${t('shop_all')}</a></p></div>${footer()}`;
    const b = brandOf(p.brand), c = catOf(p.category);
    const more = PRODUCTS.filter(x => x.brand === p.brand && x.slug !== p.slug && p.brand).slice(0, 4);
    const moreC = PRODUCTS.filter(x => x.category === p.category && x.slug !== p.slug && !more.includes(x)).slice(0, 4);
    const fitV = (p.vehicles || []).map(veh).filter(Boolean);
    const stockOk = S.showStock && p.stock > 0;
    return `${header(true)}
      <div class="wrap" style="padding-top:26px">${crumbs([[t('home'), '#/'], [t('shop'), '#/shop'], [catName(p.category), '#/shop?c=' + p.category], [L(p, 'name'), '']])}
      <div class="pdp">
        <div class="gal" id="gal">${img(p)}<span class="bl">${esc(b.label || catName(p.category))}</span><span class="hz">Hover to zoom</span></div>
        <div>
          <div class="bt">${esc(b.label || catName(p.category))}</div><h1>${esc(L(p, 'name'))}</h1>${p.partNumber ? `<div class="pn">${t('part_no')}: ${esc(p.partNumber)}</div>` : ''}<div class="redline"></div>
          <div class="buybox">
            <div class="top"><span class="price">${hasPrice(p) ? `${money(p.price)}${p.oldPrice > p.price ? `<s>${fmt(p.oldPrice)}</s>` : ''}` : t('price_req')}</span><span class="avail ${stockOk ? 'ok' : ''}">${t('avail')}: ${stockOk ? t('in_stock') : t('ask_stock')}</span></div>
            <a class="btn red block" href="${wa(t('wa_q_part', { p: p.name, pn: p.partNumber || p.sku }))}" target="_blank" rel="noopener">${WA}${t('ask_price')}</a>
            <div class="qrow"><div class="qty"><button data-q="-1" aria-label="-">−</button><span id="pq">1</span><button data-q="1" aria-label="+">+</button></div><button class="btn" id="addQ">${quote.some(l => l.slug === p.slug) ? icon('check') + t('in_quote') : t('add_quote')}</button></div>
            <div class="fitbox"><b>${t('will_fit')}</b><p>${t('pick_mm')}</p><div id="fitPick"></div><div id="fitRes"></div></div>
          </div>
          <div class="perks">${[['shield', 'perk1'], ['wrench', 'perk2'], ['pin', 'perk3'], ['card', 'perk4']].map(([i, k]) => `<div class="perk"><span class="i">${icon(i)}</span><div><b>${t(k)}</b><span>${t(k + 'd', { x: S.qpayLimit })}</span></div></div>`).join('')}</div>
        </div>
      </div>
      <div class="pblocks">
        <div class="pb"><h2>${t('overview')}</h2><p>${esc(L(p, 'description'))}</p>${(L(p, 'bullets') || []).length ? `<ul class="ticks">${(lang === 'ar' && p.bulletsAr && p.bulletsAr.length ? p.bulletsAr : p.bullets).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
        <div class="pb"><h2>${t('specifications')}</h2><div class="specs">${p.brand ? `<div><span>${t('brand')}</span><b>${esc(p.brand)}</b></div>` : ''}${p.partNumber ? `<div><span>${t('part_no')}</span><b>${esc(p.partNumber)}</b></div>` : ''}<div><span>${t('category')}</span><b>${catName(p.category)}</b></div><div><span>${t('fits')}</span><b>${esc(fitsText(p))}</b></div></div></div>
        <div class="pb full"><h2>${t('fitment')}</h2>${fitV.length ? `<div class="fitchips">${fitV.map(v => `<a class="fitchip" href="#/shop?v=${v.id}"><img src="${v.image}" alt=""><b>${vehName(v)}</b><span>${makeName(v.make)}</span></a>`).join('')}</div>` : `<p>${esc(fitsText(p))}</p>`}</div>
        ${b.about ? `<div class="pb"><h2>${t('about_brand')}</h2><b class="h" style="display:block;margin-bottom:8px">${esc(b.label)}</b><p>${esc(b.about)}</p><a class="btn red xs" href="#/shop?b=${encodeURIComponent(p.brand)}">${t('shop_all_brand', { b: p.brand })}</a></div>` : ''}
        <div class="pb ${b.about ? '' : 'full'}"><h2>${t('how_order')}</h2><ol class="steps"><li>${t('ho1')}</li><li>${t('ho2')}</li><li>${t('ho3')}</li><li>${t('ho4')}</li></ol></div>
      </div>
      ${more.length ? `<section class="sec tight" style="padding-bottom:0"><div class="sec-h"><h2 style="font-size:28px">${t('more_from', { b: p.brand })}</h2></div><div class="grid g4">${more.map(card).join('')}</div></section>` : ''}
      ${moreC.length ? `<section class="sec tight"><div class="sec-h"><h2 style="font-size:28px">${t('more_in', { c: catName(p.category).toLowerCase() })}</h2></div><div class="grid g4">${moreC.map(card).join('')}</div></section>` : ''}
      </div>${footer()}`;
  }

  function pageCategories() {
    return `${header(true)}<section class="page-hero"><div class="wrap">${crumbs([[t('home'), '#/'], [t('categories'), '']])}<h1>${t('cat_title')}</h1><p>${t('cat_sub')}</p></div></section>
      <section class="sec tight"><div class="wrap"><div class="cat-list">${C.categories.map(c => `<a class="tile" href="#/shop?c=${c.id}"><img src="${c.image}" alt="" loading="lazy"><div class="tx"><small>${partsN(PRODUCTS.filter(p => p.category === c.id).length)}</small><h3>${catName(c.id)}</h3>${L(c, 'desc') ? `<p>${esc(L(c, 'desc'))}</p>` : ''}</div></a>`).join('')}</div></div></section>${footer()}`;
  }
  function pageVehicles() {
    return `${header(true)}<section class="page-hero"><div class="wrap">${crumbs([[t('home'), '#/'], [t('vehicles'), '']])}<h1>${t('veh_title')}</h1><p>${t('veh_sub')}</p></div></section>
      <section class="sec tight"><div class="wrap">${C.makes.map(m => `<div class="make-blk"><div class="mh"><h2>${lang === 'ar' ? m.ar : m.en}</h2><a href="#/shop?mk=${m.en}">${t('all_make', { m: lang === 'ar' ? m.ar : m.en })} →</a></div>
        <div class="vehicles all">${C.vehicles.filter(v => v.make === m.en).map(v => `<a class="veh" href="#/shop?v=${v.id}"><img src="${v.image}" alt="" loading="lazy"><b>${vehName(v)}</b><span>${makeName(v.make)}</span></a>`).join('')}</div></div>`).join('')}
        <div class="pb" style="text-align:center"><h2>${t('dont_see')}</h2><p style="max-width:640px;margin:0 auto 18px">${t('dont_see_t')}</p><a class="btn red sm" href="${wa(t('wa_fit'))}" target="_blank" rel="noopener">${WA}${t('ask_wa')}</a></div></div></section>${footer()}`;
  }
  function pageInstallments() {
    const v = state.calc;
    return `${header(true)}<section class="page-hero img"><div class="wrap">${crumbs([[t('home'), '#/'], [t('installments'), '']])}<h1>${t('qp_title')}</h1><div class="redline" style="margin-top:18px;width:120px"></div><p>${t('inst_sub')}</p>
        <div class="checks"><span>${t('up4')}</span><span>${t('zero')}</span><span>${t('nofees')}</span></div><div class="cta"><a class="btn red sm" href="#/shop">${t('shop_parts')}</a><a class="btn sm" href="https://qpay.om/" target="_blank" rel="noopener">${t('get_app')}</a></div></div></section>
      <section class="sec"><div class="wrap"><div class="sec-h"><h2>${t('how')}</h2></div><div class="how">${[['🛒', 'h1'], ['📱', 'h2'], ['🔐', 'h3'], ['📅', 'h4']].map(([e, k], i) => `<div><div class="em">${e}</div><div class="n">${i + 1}</div><b>${t(k + 't')}</b><p>${t(k + 'd')}</p></div>`).join('')}</div></div></section>
      <section class="sec divider"><div class="wrap qp"><div><h2 style="font-size:32px">${t('work_out')}</h2><h3 style="font-family:var(--bfont);font-size:16px;margin:24px 0 12px">${t('need')}</h3><div class="need"><div>📱 ${t('need1')}</div><div>💳 ${t('need2')}</div><div>🔢 ${t('need3')}</div></div></div>
        <div class="plan"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lbl">${t('order_total')}</span><span class="tot" style="margin:0" id="calcT">${money(v)}</span></div>
          <input type="range" class="slider" id="calc" min="20" max="${S.qpayLimit}" step="5" value="${v}" aria-label="${t('order_total')}"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3)"><span>20.000</span><span>${fmt(S.qpayLimit)}</span></div>
          <div class="inst" id="calcI" style="margin-top:18px"></div><div class="note">${t('shown4', { x: S.qpayLimit })}</div></div></div></section>
      <section class="sec divider"><div class="wrap"><h2 style="text-align:center;font-size:32px;margin-bottom:26px">${t('questions')}</h2><div class="faq">${[1, 2, 3, 4].map(i => `<details ${i === 1 ? 'open' : ''}><summary>${t('q' + i)}</summary><p>${t('a' + i, { x: S.qpayLimit })}</p></details>`).join('')}</div></div></section>
      <section class="sec divider page-hero img" style="padding:80px 0"><div class="wrap"><h2 style="font-size:34px">${t('ready')}</h2><p>${t('ready_t')}</p><div class="cta" style="margin-top:22px"><a class="btn red sm" href="#/shop">${t('shop_parts')}</a></div></div></section>${footer()}`;
  }
  function isOpen() { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Muscat' })); const h = d.getHours(); return d.getDay() !== 5 && h >= 17; }
  function pageVisit() {
    return `${header(true)}<section class="page-hero img"><div class="wrap">${crumbs([[t('home'), '#/'], [t('visit'), '']])}<h1>${t('visit_title')}</h1><p>${t('visit_sub')}</p></div></section>
      <section class="sec tight"><div class="wrap"><div class="vcards">
        <div class="vcard"><div class="i">${WA}</div><h3>WhatsApp</h3><p>${t('wa_fast')}</p><div dir="ltr" style="font-weight:600;margin-bottom:14px">${esc(S.phone)}</div><a class="btn red xs" href="${wa(t('wa_q'))}" target="_blank" rel="noopener">${t('chat_wa')}</a></div>
        <div class="vcard"><div class="i">${icon('pin')}</div><h3>${t('location')}</h3><p>${esc(lang === 'ar' ? S.addressAr : S.address)}</p><a class="btn xs" href="${esc(S.maps)}" target="_blank" rel="noopener">${t('open_maps')}</a></div>
        <div class="vcard"><div class="i">${icon('instagram')}</div><h3>Instagram</h3><p>${t('ig_t')}</p><div style="font-weight:600;margin-bottom:14px">@${esc(S.instagram)}</div><a class="btn xs" href="https://www.instagram.com/${esc(S.instagram)}/" target="_blank" rel="noopener">${t('follow')}</a></div></div>
        <div class="pblocks" style="margin-top:18px"><div class="pb"><h2>${t('opening')}</h2><div class="open-now ${isOpen() ? 'yes' : ''}">${isOpen() ? t('open_now') : t('closed_now')}</div><div class="hours"><div><span>${t('sat_thu')}</span><b>${t('h_time')}</b></div><div><span>${t('friday')}</span><b>${t('closed')}</b></div></div><a class="btn xs" style="margin-top:16px" href="${esc(S.maps)}" target="_blank" rel="noopener">${icon('pin')}${t('open_maps')}</a></div>
          <div class="pb"><h2>${t('before')}</h2><p>${t('before_t')}</p><ul class="ticks"><li>${t('b1')}</li><li>${t('b2')}</li><li>${t('b3')}</li></ul><a class="btn red xs" style="margin-top:12px" href="${wa(t('wa_fit'))}" target="_blank" rel="noopener">${WA}${t('chat_wa')}</a></div></div></div></section>
      ${fitSection()}${footer()}`;
  }
  function pageQuote() {
    const v = store.get('x4w_vehicle', {});
    const priced = quote.map(l => prodBy(l.slug)).filter(p => p && hasPrice(p));
    const total = quote.reduce((a, l) => { const p = prodBy(l.slug); return a + (p && hasPrice(p) ? p.price * l.qty : 0); }, 0);
    const onReq = quote.filter(l => { const p = prodBy(l.slug); return p && !hasPrice(p); }).length;
    return `${header(true)}<section class="page-hero" style="padding-bottom:40px"><div class="wrap">${crumbs([[t('home'), '#/'], [t('quote'), '']])}<h1>${t('quote')}</h1><p>${t('q_intro')}</p></div></section>
      <div class="wrap">${quote.length ? `<div class="quote" style="padding-top:30px">
        <div>${quote.map(l => { const p = prodBy(l.slug); return `<div class="qline"><a class="th" href="#/p/${p.slug}">${img(p)}</a><div><a class="nm" href="#/p/${p.slug}">${esc(L(p, 'name'))}</a><div class="meta">${esc(brandOf(p.brand).label)}${p.partNumber ? ' · ' + esc(p.partNumber) : ''} · ${hasPrice(p) ? money(p.price) : t('price_req')}</div><button class="rm" data-rm="${p.slug}">${t('remove')}</button></div>
          <div class="qty"><button data-dq="${p.slug}" data-d="-1" aria-label="-">−</button><span>${l.qty}</span><button data-dq="${p.slug}" data-d="1" aria-label="+">+</button></div></div>`; }).join('')}</div>
        <form class="panel" id="qform" novalidate><h2>${t('your_vehicle')}</h2>
          <div class="row2"><div class="f"><label for="q_make">${t('make')}</label><select class="field" id="q_make"><option value="">—</option>${C.makes.map(m => `<option value="${m.en}" ${v.make === m.en ? 'selected' : ''}>${lang === 'ar' ? m.ar : m.en}</option>`).join('')}<option value="Other" ${v.make === 'Other' ? 'selected' : ''}>Other</option></select></div>
            <div class="f"><label for="q_model">${t('model')}</label><select class="field" id="q_model"></select></div></div>
          <div class="row2"><div class="f"><label for="q_year">${t('year')}</label><input class="field" id="q_year" inputmode="numeric" maxlength="4" placeholder="2024" value="${esc(v.year || '')}"></div>
            <div class="f"><label for="q_name">${t('your_name')} <span style="opacity:.6">(${t('optional')})</span></label><input class="field" id="q_name" autocomplete="name" value="${esc(v.name || '')}"></div></div>
          <div class="f"><label for="q_note">${t('notes')} <span style="opacity:.6">(${t('optional')})</span></label><textarea class="field" id="q_note"></textarea></div>
          <label class="chk"><input type="checkbox" id="q_qpay" ${v.qpay ? 'checked' : ''}>${t('want_qpay')}</label>
          <div class="sum"><span>${t('items')}</span><span>${qCount()}</span></div>
          ${priced.length ? `<div class="sum"><span>${t('est_total')}</span><span>${money(total)}</span></div>` : ''}${onReq ? `<div class="sum"><span></span><span>${t('on_req_n', { n: onReq })}</span></div>` : ''}
          <button class="btn red block" type="submit" style="margin-top:12px">${WA}${t('send_list')}</button><div class="hint">${t('list_hint')}</div></form>
      </div>` : `<div class="empty" style="padding:80px 0 100px">${icon('cart')}<h2 style="margin:14px 0 6px">${t('q_empty')}</h2><p>${t('q_empty_t')}</p><div class="cta" style="justify-content:center;margin-top:18px"><a class="btn red sm" href="#/shop">${t('shop_parts')}</a><a class="btn sm" href="#/vehicles">${t('shop_by_vehicle')}</a></div></div>`}</div>${footer()}`;
  }
  function pageLegal(k) {
    return `${header(true)}<section class="page-hero"><div class="wrap">${crumbs([[t('home'), '#/'], [t(k + '_t'), '']])}<h1>${t(k + '_t')}</h1></div></section><section class="sec tight"><div class="wrap"><div class="pb"><p>${t('legal_text')}</p><p>${esc(S.name)} · ${esc(S.address)} · <span dir="ltr">${esc(S.phone)}</span></p></div></div></section>${footer()}`;
  }

  // ---------- router ----------
  const state = { finderMake: '', finderModel: '', calc: 400, fitMake: '', fitModel: '' };
  let route = { name: 'home', arg: '', q: {} };
  function qs(o) { const p = Object.keys(o).filter(k => o[k]).map(k => k + '=' + encodeURIComponent(o[k])).join('&'); return p ? '?' + p : ''; }
  function parse() {
    const h = location.hash.replace(/^#\/?/, ''); const [path, query] = h.split('?'); const parts = path.split('/');
    const q = {}; (query || '').split('&').filter(Boolean).forEach(kv => { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent((kv.slice(i + 1) || '').replace(/\+/g, ' ')); });
    route = { name: parts[0] || 'home', arg: decodeURIComponent(parts[1] || ''), q };
  }
  function render(keepScroll) {
    parse();
    const pages = { home: pageHome, shop: pageShop, p: () => pageProduct(route.arg), categories: pageCategories, vehicles: pageVehicles, installments: pageInstallments, visit: pageVisit, quote: pageQuote, terms: () => pageLegal('terms'), privacy: () => pageLegal('privacy') };
    $('#root').innerHTML = (pages[route.name] || pageHome)();
    const p = route.name === 'p' ? prodBy(route.arg) : null;
    document.title = p ? `${L(p, 'name')} | ${S.name}` : route.name === 'home' ? (lang === 'ar' ? 'قطع وتعديلات الدفع الرباعي في مسقط | 4x4 Wheels عُمان' : '4x4 Car Parts & Upgrades in Muscat | 4x4 Wheels Oman') : `${t({ shop: 'shop_all', categories: 'categories', vehicles: 'vehicles', installments: 'installments', visit: 'visit', quote: 'quote' }[route.name] || 'home')} | ${S.name}`;
    bind(p);
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function bindFinder() {
    $$('[data-make]').forEach(b => b.onclick = () => { state.finderMake = state.finderMake === b.dataset.make ? '' : b.dataset.make; state.finderModel = ''; refreshFinder(); });
    $$('[data-model]').forEach(b => b.onclick = () => { state.finderModel = b.dataset.model; refreshFinder(); });
  }
  function refreshFinder() { const f = $('#finder'); if (!f) return; f.outerHTML = finderHTML('finder'); bindFinder(); }

  function bind(p) {
    $$('#langBtn, [data-lang]').forEach(b => b.onclick = () => { lang = lang === 'ar' ? 'en' : 'ar'; store.set('x4w_lang', lang); setDir(); render(true); if (window.STORE && STORE.onLang) STORE.onLang(lang); });
    $('#burger').onclick = () => {
      const m = document.createElement('div'); m.className = 'mnav';
      m.innerHTML = `<div class="top"><img src="assets/img/site/logo-mark.png" alt=""><button class="icon-btn" aria-label="${t('close')}">${icon('x')}</button></div>
        ${[['', 'home'], ['shop', 'shop_all'], ['categories', 'categories'], ['vehicles', 'vehicles'], ['installments', 'installments'], ['visit', 'visit'], ['quote', 'quote']].map(([r, k]) => `<a class="l" href="#/${r}">${t(k)}</a>`).join('')}
        <a class="btn red" href="${wa(t('wa_q'))}" target="_blank" rel="noopener">${WA}${t('chat_wa')}</a><button class="btn" data-lang style="margin-top:10px">${lang === 'ar' ? 'English' : 'العربية'}</button>`;
      document.body.appendChild(m); document.body.style.overflow = 'hidden';
      const close = () => { m.remove(); document.body.style.overflow = ''; };
      m.onclick = (e) => { if (e.target.closest('a') || e.target.closest('.icon-btn')) close(); if (e.target.closest('[data-lang]')) { close(); lang = lang === 'ar' ? 'en' : 'ar'; store.set('x4w_lang', lang); setDir(); render(true); if (window.STORE && STORE.onLang) STORE.onLang(lang); } };
    };
    $$('[data-add]').forEach(b => b.onclick = (e) => { e.preventDefault(); addQuote(b.dataset.add, 1); b.innerHTML = icon('check'); });
    bindFinder();
    // shop filters
    const sf = $('#sf'); if (sf) sf.onsubmit = (e) => { e.preventDefault(); location.hash = '#/shop' + qs(Object.assign({}, route.q, { q: e.target.q.value.trim() })); };
    [['#fv', 'v'], ['#fb', 'b'], ['#fs', 's']].forEach(([id, k]) => { const el = $(id); if (el) el.onchange = () => { location.hash = '#/shop' + qs(Object.assign({}, route.q, { [k]: el.value, mk: k === 'v' ? '' : route.q.mk })); }; });
    // installments calculator
    const calc = $('#calc');
    if (calc) {
      const upd = () => { state.calc = +calc.value; $('#calcT').innerHTML = money(state.calc); $('#calcI').innerHTML = [t('when_ships'), t('month', { n: 1 }), t('month', { n: 2 }), t('month', { n: 3 })].map(l => `<div><small>${l}</small><b class="num">${fmt(state.calc / 4)}</b></div>`).join(''); };
      calc.oninput = upd; upd();
    }
    // product page
    if (p) {
      let q = 1;
      $$('[data-q]').forEach(b => b.onclick = () => { q = Math.max(1, q + +b.dataset.q); $('#pq').textContent = q; });
      $('#addQ').onclick = () => { addQuote(p.slug, q); $('#addQ').innerHTML = icon('check') + t('in_quote'); };
      const g = $('#gal');
      g.onmousemove = (e) => { const r = g.getBoundingClientRect(); g.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); g.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); g.classList.add('zoom'); };
      g.onmouseleave = () => g.classList.remove('zoom');
      const saved = store.get('x4w_vehicle', {});
      if (!state.fitMake && saved.make && saved.model) { state.fitMake = saved.make; state.fitModel = saved.model; }
      const drawFit = () => {
        const models = state.fitMake ? C.vehicles.filter(v => v.make === state.fitMake) : [];
        $('#fitPick').innerHTML = `<div class="pills">${C.makes.map(m => `<button class="pill ${state.fitMake === m.en ? 'on' : ''}" data-fm="${m.en}">${lang === 'ar' ? m.ar : m.en}</button>`).join('')}</div>${models.length ? `<div class="pills" style="margin-top:10px">${models.map(v => `<button class="pill ${state.fitModel === v.id ? 'on' : ''}" data-fmod="${v.id}">${vehName(v)}</button>`).join('')}</div>` : ''}`;
        let res = '';
        if (isUniversal(p)) res = `<div class="fitres yes">${icon('check')}${t('fits_uni')}</div>`;
        else if (state.fitModel) {
          const v = veh(state.fitModel), r = fitsVehicle(p, state.fitModel), nm = `${makeName(v.make)} ${vehName(v)}`;
          res = r === 'yes' ? `<div class="fitres yes">${icon('check')}${t('fits_yes', { v: nm })}</div>` : `<div class="fitres ${r === 'no' ? 'no' : 'ask'}">${icon('alert')}<span>${t(r === 'no' ? 'fits_no' : 'fits_ask', { v: nm })} <a style="text-decoration:underline" href="${wa(t('wa_fit') + nm + ' — ' + p.name)}" target="_blank" rel="noopener">${t('ask_wa')}</a></span></div>`;
        }
        $('#fitRes').innerHTML = res;
        $$('[data-fm]').forEach(b => b.onclick = () => { state.fitMake = b.dataset.fm; state.fitModel = ''; drawFit(); });
        $$('[data-fmod]').forEach(b => b.onclick = () => { state.fitModel = b.dataset.fmod; const vv = store.get('x4w_vehicle', {}); vv.make = state.fitMake; vv.model = state.fitModel; store.set('x4w_vehicle', vv); drawFit(); });
      };
      drawFit();
    }
    // quote page
    $$('[data-dq]').forEach(b => b.onclick = () => { const l = quote.find(x => x.slug === b.dataset.dq); l.qty = Math.max(0, l.qty + +b.dataset.d); if (!l.qty) quote = quote.filter(x => x !== l); saveQuote(); render(true); });
    $$('[data-rm]').forEach(b => b.onclick = () => { quote = quote.filter(x => x.slug !== b.dataset.rm); saveQuote(); render(true); });
    const qf = $('#qform');
    if (qf) {
      const mk = $('#q_make'), md = $('#q_model'), saved = store.get('x4w_vehicle', {});
      const fillModels = () => { const list = C.vehicles.filter(v => v.make === mk.value); md.innerHTML = `<option value="">—</option>${list.map(v => `<option value="${v.id}" ${saved.model === v.id ? 'selected' : ''}>${vehName(v)}</option>`).join('')}<option value="other">Other</option>`; };
      mk.onchange = fillModels; fillModels();
      qf.onsubmit = (e) => {
        e.preventDefault();
        const v = { make: mk.value, model: md.value, year: $('#q_year').value.trim(), name: $('#q_name').value.trim(), qpay: $('#q_qpay').checked };
        store.set('x4w_vehicle', v);
        const vv = veh(v.model);
        const ref = 'Q' + Date.now().toString(36).toUpperCase().slice(-5);
        let msg = t('wa_hi_q') + '\n\n';
        quote.forEach(l => { const p = prodBy(l.slug); msg += `• ${l.qty} × ${p.name}${p.partNumber ? ` [${p.partNumber}]` : ''}\n`; });
        const vehTxt = [v.make, vv ? vv.en : (v.model === 'other' ? '' : ''), v.year].filter(Boolean).join(' ');
        msg += `\n${t('wa_vehicle')}: ${vehTxt || '—'}`;
        if (v.name) msg += `\n${t('wa_name')}: ${v.name}`;
        if (v.qpay) msg += `\n${t('wa_qpay')}`;
        const note = $('#q_note').value.trim(); if (note) msg += `\n${note}`;
        msg += `\n\nRef: ${ref}`;
        window.open(wa(msg), '_blank', 'noopener');
      };
    }
  }

  // small API for the parts assistant (assets/js/assistant.js)
  window.STORE = {
    get lang() { return lang; }, S, C, products: () => PRODUCTS, t, esc, money, wa, img, veh, vehName, makeName, catName, hasPrice, L, prodBy,
    addQuote: (slug, qty) => { addQuote(slug, qty); if (route.name === 'quote') render(true); },
    inQuote: (slug) => quote.some(l => l.slug === slug),
    savedVehicle: () => store.get('x4w_vehicle', {}), saveVehicle: (v) => { const vv = store.get('x4w_vehicle', {}); Object.assign(vv, v); store.set('x4w_vehicle', vv); },
    onLang: null
  };
  window.addEventListener('hashchange', () => { const m = $('.mnav'); if (m) { m.remove(); document.body.style.overflow = ''; } render(); });
  render();
})();
