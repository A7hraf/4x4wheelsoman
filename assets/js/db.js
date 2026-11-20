/* ============================================================
   4x4 Wheels Oman – admin data layer (localStorage)
   Seeded from the real catalog (assets/js/catalog.js) + demo transactions.
   ============================================================ */
(function (global) {
  const KEY = 'x4w_db_v2';
  const DAY = 86400000;
  const CAT = global.CATALOG || { products: [], categories: [], vehicles: [], makes: [], brands: [] };

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const GOVERNORATES = ['Muscat', 'Batinah North', 'Batinah South', 'Dakhiliyah', 'Sharqiyah North', 'Sharqiyah South', 'Dhahirah', 'Buraimi', 'Al Wusta', 'Dhofar', 'Musandam'];

  // demo selling prices by category (owner replaces with real prices)
  const DEMO_PRICE = { suspension: [780, 2600], 'wheels-tires': [130, 290], lighting: [160, 620], power: [140, 690], recovery: [12, 95], performance: [190, 1150], drivetrain: [380, 420], 'side-steps': [620, 1150], tops: [880, 1650] };

  const DEFAULT_TEMPLATES = {
    bill: 'Hello {name}, thank you for shopping with {shop}!\nInvoice {order} — Total {total}\nView / download your bill: {link}',
    confirmed: 'Hello {name}, your order {order} is confirmed ✅\nTotal: {total}\nWe will message you when it is ready. — {shop}',
    ready: 'Hello {name}, good news! Your order {order} is ready for pickup at our shop in Al Maabela (Sat–Thu, 5 PM–12 AM). Location: {maps}',
    shipped: 'Hello {name}, your order {order} is on the way 🚚. Our driver will call you before delivery. — {shop}',
    delivered: 'Hello {name}, thank you for choosing {shop}! We hope you enjoy your upgrade. A quick Google review helps us a lot: {maps}',
    reminder: 'Hello {name}, a friendly reminder that {amount} is still due for order {order}. You can pay by transfer, card in the shop, or in installments with Qpay. — {shop}',
    quote: 'Hello {name}, here is your quote from {shop}:\n\n{items}\n\nTotal: {total}\nPay in full, or in 4 interest-free payments of {quarter} with Qpay. Reply "OK" to confirm.',
    qpay: 'Hello {name}, we have sent a Qpay payment request of {total} for order {order} to your mobile {phone}.\nOpen the Qpay app to choose your plan (up to 4 interest-free payments of {quarter}). {link}'
  };

  function buildSeed() {
    const rand = rng(20261113);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const now = Date.now();
    const products = CAT.products.map((p, i) => {
      const [lo, hi] = DEMO_PRICE[p.category] || [50, 300];
      const price = r3(Math.round((lo + rand() * (hi - lo)) / 5) * 5);
      return Object.assign({}, p, {
        price, cost: r3(price * (0.62 + rand() * 0.1)), oldPrice: 0, showPrice: false,
        stock: Math.floor(rand() * (p.category === 'recovery' ? 25 : 8)), reorder: p.category === 'recovery' ? 6 : 2,
        location: 'R' + (1 + (i % 6)) + '-' + String(1 + Math.floor(i / 6)).padStart(2, '0'), active: true, online: true
      });
    });
    const custSeed = [
      ['Ahmed Al Balushi', '+968 9123 4567', 'Muscat', 'retail', 'land-cruiser-300'], ['Salim Al Harthy', '+968 9234 5678', 'Dakhiliyah', 'retail', 'patrol-y62'],
      ['Khalid Al Rawahi', '+968 9345 6789', 'Batinah North', 'retail', 'wrangler-jl'], ['Desert Tracks Garage', '+968 2456 7890', 'Muscat', 'workshop', ''],
      ['Mohammed Al Lawati', '+968 9567 8901', 'Muscat', 'retail', '4runner'], ['Faisal Al Siyabi', '+968 9678 9012', 'Sharqiyah South', 'retail', 'hilux'],
      ['Al Wusta Off-Road Club', '+968 9789 0123', 'Al Wusta', 'workshop', ''], ['Yousuf Al Amri', '+968 9890 1234', 'Dhofar', 'retail', 'land-cruiser-200'],
      ['Hamad Al Kindi', '+968 9901 2345', 'Dhahirah', 'retail', 'bronco'], ['Nasser Al Maskari', '+968 9012 3456', 'Sharqiyah North', 'retail', 'ranger'],
      ['Sultan Al Busaidi', '+968 9111 2233', 'Muscat', 'retail', 'land-cruiser-300'], ['Overland Oman LLC', '+968 2444 5566', 'Batinah South', 'workshop', ''],
      ['Saeed Al Hinai', '+968 9222 3344', 'Batinah South', 'retail', 'patrol-y62'], ['Ali Al Jabri', '+968 9333 4455', 'Batinah North', 'retail', 'land-cruiser-70'],
      ['Majid Al Zadjali', '+968 9444 5566', 'Muscat', 'retail', 'gladiator'], ['Talal Al Ghafri', '+968 9555 6677', 'Dakhiliyah', 'retail', 'f-150']
    ];
    const customers = custSeed.map((c, i) => ({ id: 'c' + (i + 1), name: c[0], phone: c[1], city: c[2], type: c[3], vehicle: c[4], optIn: i % 5 !== 3, created: now - (150 - i * 6) * DAY }));
    const suppliers = [
      { id: 's1', name: 'ARB Middle East', country: 'UAE', phone: '+971 4 555 1200' }, { id: 's2', name: 'Fox / King Distribution GCC', country: 'UAE', phone: '+971 6 532 8800' },
      { id: 's3', name: 'Wheel Pros International', country: 'USA', phone: '+1 303 555 0144' }, { id: 's4', name: 'aFe / K&N Gulf', country: 'UAE', phone: '+971 4 321 0099' }
    ];
    const sales = [];
    const vatRate = 5;
    let shopNo = 1000, webNo = 5000;
    const hot = products.filter(p => ['recovery', 'wheels-tires', 'lighting', 'power', 'performance'].includes(p.category));
    for (let d = 89; d >= 0; d--) {
      const day = new Date(now - d * DAY); day.setHours(17, 0, 0, 0);
      if (day.getDay() === 5) continue; // closed Friday
      const growth = 1 + (89 - d) / 200;
      const nShop = Math.round((0.6 + rand() * 1.6) * growth);
      const nWeb = Math.round((0.4 + rand() * 1.3) * growth);
      for (let k = 0; k < nShop + nWeb; k++) {
        const online = k >= nShop;
        const items = [];
        const nItems = 1 + Math.floor(rand() * 2);
        for (let j = 0; j < nItems; j++) {
          const pr = rand() < 0.7 ? pick(hot) : pick(products);
          if (items.find(it => it.pid === pr.id)) continue;
          const qty = pr.category === 'wheels-tires' ? pick([4, 4, 5, 2]) : pr.category === 'recovery' ? pick([1, 1, 2]) : 1;
          items.push({ pid: pr.id, name: pr.name, sku: pr.sku, qty, price: pr.price, cost: pr.cost });
        }
        const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
        const discount = rand() < 0.25 ? r3(subtotal * pick([0.03, 0.05, 0.1])) : 0;
        const shippingFee = online && rand() < 0.4 ? pick([3, 5, 8]) : 0;
        const vat = r3((subtotal - discount) * vatRate / 100);
        const total = r3(subtotal - discount + vat + shippingFee);
        const date = Math.min(day.getTime() + Math.floor(rand() * 6.8 * 3600000), now - Math.floor(rand() * 3600000) - 60000);
        let status = 'completed';
        if (online) {
          if (d > 6) status = rand() < 0.05 ? 'cancelled' : 'delivered';
          else if (d > 2) status = pick(['shipped', 'delivered', 'delivered', 'processing']);
          else status = pick(['new', 'new', 'processing', 'shipped']);
        }
        const cust = rand() < 0.75 || online ? pick(customers) : null;
        let payment = online ? pick(['qpay', 'qpay', 'transfer', 'cod', 'card']) : pick(['cash', 'card', 'card', 'qpay']);
        if (payment === 'qpay' && total > 500) payment = 'transfer';
        const sale = {
          id: uid('o'), no: online ? 'WEB-' + (webNo++) : 'INV-' + (shopNo++), date, channel: online ? 'online' : 'shop',
          source: online ? pick(['whatsapp', 'whatsapp', 'whatsapp', 'website', 'instagram']) : 'pos',
          customerId: cust ? cust.id : null, customerName: cust ? cust.name : 'Walk-in customer', phone: cust ? cust.phone : '',
          items, subtotal: r3(subtotal), discount, vat, shippingFee, total, payment, status,
          city: online ? (cust ? cust.city : pick(GOVERNORATES)) : '', address: '', note: '', paid: true
        };
        if (payment === 'qpay') {
          const st = status === 'cancelled' ? 'declined' : d > 4 ? 'settled' : d > 1 ? 'approved' : 'requested';
          sale.qpay = { status: st, requestedAt: date, approvedAt: st !== 'requested' ? date + 3600000 : null, settledAt: st === 'settled' ? date + 3 * DAY : null, ref: 'QP' + Math.floor(100000 + rand() * 899999) };
          sale.paid = st === 'settled' || st === 'approved';
        }
        if (online && payment === 'transfer' && d < 3) sale.paid = false;
        sales.push(sale);
      }
    }
    sales.sort((a, b) => a.date - b.date);

    const expenses = [];
    const expDefs = [['rent', 'Shop & workshop rent – Al Maabela', 950], ['salaries', 'Staff salaries (4)', 2650], ['utilities', 'Electricity & water', 160], ['utilities', 'Internet & phone', 45], ['marketing', 'Instagram ads & content', 320], ['software', 'Website & tools', 35]];
    for (let m = 2; m >= 0; m--) {
      const dt = new Date(now); dt.setDate(1); dt.setMonth(dt.getMonth() - m); dt.setHours(10, 0, 0, 0);
      expDefs.forEach(e => { const t = dt.getTime() + (e[0] === 'salaries' ? 26 * DAY : 0); if (t < now) expenses.push({ id: uid('e'), date: t, category: e[0], desc: e[1], amount: r3(e[2] * (0.95 + rand() * 0.1)), method: 'transfer' }); });
    }
    for (let i = 0; i < 22; i++) expenses.push({ id: uid('e'), date: now - Math.floor(rand() * 88) * DAY, category: pick(['shipping', 'shipping', 'maintenance', 'marketing', 'other']), desc: pick(['Courier – Aramex', 'Courier – Oman Post', 'Workshop tools', 'Lift service', 'Fuel – pickup truck', 'Packaging', 'Photo shoot for Instagram']), amount: r3(8 + rand() * 110), method: pick(['cash', 'card', 'transfer']) });

    const P = (slug) => (products.find(p => p.slug === slug) || products[0]);
    const purchases = [
      { id: uid('po'), no: 'PO-301', date: now - 64 * DAY, supplierId: 's1', status: 'received', items: [{ pid: P('ome-bp51-lc300').id, qty: 2 }, { pid: P('ome-bp51-y62').id, qty: 2 }] },
      { id: uid('po'), no: 'PO-302', date: now - 33 * DAY, supplierId: 's3', status: 'received', items: [{ pid: P('kmc-km544-mesa').id, qty: 12 }] },
      { id: uid('po'), no: 'PO-303', date: now - 3 * DAY, supplierId: 's4', status: 'ordered', items: [{ pid: P('afe-momentum-gt-y62').id, qty: 3 }, { pid: P('kn-63-9040-lc200').id, qty: 3 }] }
    ];
    purchases.forEach(po => { po.items.forEach(it => it.cost = P(products.find(x => x.id === it.pid).slug).cost); po.total = r3(po.items.reduce((s, it) => s + it.qty * it.cost, 0)); });
    purchases.filter(p => p.status === 'received').forEach(p => expenses.push({ id: uid('e'), date: p.date, category: 'inventory', desc: 'Stock purchase ' + p.no, amount: p.total, method: 'transfer', ref: p.id }));

    const quotes = [
      { no: 'Q-1041', d: 0, c: 'c1', st: 'new', v: 'Toyota Land Cruiser 300 2024', items: [['fox-elite-lc300', 1], ['clearview-power-boards-lc300', 1]], qpay: true },
      { no: 'Q-1040', d: 1, c: 'c13', st: 'sent', v: 'Nissan Patrol Y62 2021', items: [['ome-bp51-y62', 1], ['afe-momentum-gt-y62', 1]] },
      { no: 'Q-1039', d: 2, c: 'c3', st: 'accepted', v: 'Jeep Wrangler JL 2022', items: [['bestop-trektop-jl-4door', 1]], qpay: true },
      { no: 'Q-1038', d: 5, c: 'c9', st: 'lost', v: 'Ford Bronco 2023', items: [['falcon-3-3-bronco', 1]] }
    ].map(q => ({ id: uid('q'), no: q.no, date: now - q.d * DAY - 3600000 * (2 + q.d), customerId: q.c, vehicle: q.v, status: q.st, qpay: !!q.qpay, note: '', source: 'whatsapp', items: q.items.map(([s, n]) => { const p = P(s); return { pid: p.id, name: p.name, sku: p.partNumber || p.sku, qty: n, price: p.price }; }) }));

    return {
      version: 2, created: now,
      settings: {
        name: '4x4 Wheels Oman', tagline: 'Off-road parts, accessories and upgrades', vat: vatRate, currency: 'OMR', phone: '+968 9515 2025', whatsapp: '96895152025', instagram: '4x4wheels.om',
        email: '', address: 'Al Maabela, Muscat, Oman', addressAr: 'المعبيلة، مسقط، عُمان', maps: 'https://maps.app.goo.gl/DnrLbuokgZqgAH878', cr: '', lang: 'en', theme: 'dark',
        siteUrl: 'https://a7hraf.github.io/4x4wheelsoman/', showStock: false, rating: '5.0', followers: '20K+', since: 2019,
        qpay: { enabled: true, limit: 500, installments: 4, feePct: 0, merchantId: '', payLink: 'https://qpay.om/' },
        templates: Object.assign({}, DEFAULT_TEMPLATES),
        github: { owner: 'A7hraf', repo: '4x4wheelsoman', branch: 'main' }
      },
      categories: CAT.categories.map(c => ({ id: c.id, en: c.en, ar: c.ar })), vehicles: CAT.vehicles, makes: CAT.makes, brands: CAT.brands,
      products, customers, suppliers, sales, expenses, purchases, moves: [], quotes, campaigns: [], waLog: [], demo: true
    };
  }

  // ---------- storage ----------
  // When the admin login is active (assets/js/auth.js), the whole database is kept
  // encrypted: Auth calls DB.init(data) after unlocking and sets DB.persist to a
  // function that encrypts and stores each save. Without Auth (old behaviour, tests,
  // the store's ?preview) the data falls back to plain localStorage.
  let db = null;
  let persist = null;
  function migrate(d) {
    d.quotes = d.quotes || []; d.held = d.held || []; d.campaigns = d.campaigns || []; d.waLog = d.waLog || [];
    d.secrets = Object.assign({ aiKey: '', ghToken: '' }, d.secrets || {});
    d.settings.templates = Object.assign({}, DEFAULT_TEMPLATES, d.settings.templates || {});
    d.settings.qpay = Object.assign({ enabled: true, limit: 500, installments: 4, feePct: 0, merchantId: '', payLink: 'https://qpay.om/' }, d.settings.qpay || {});
    d.settings.github = Object.assign({ owner: 'A7hraf', repo: '4x4wheelsoman', branch: 'main' }, d.settings.github || {});
    d.settings.leadDays = d.settings.leadDays || 14; d.settings.coverDays = d.settings.coverDays || 30;
    d.settings.autoLockMin = d.settings.autoLockMin || 15;
    if (d.settings.awayLockSec == null) d.settings.awayLockSec = 60;
    return d;
  }
  function load() {
    if (db) return db;
    try { const raw = localStorage.getItem(KEY); if (raw) { db = migrate(JSON.parse(raw)); return db; } } catch (e) { }
    db = migrate(buildSeed()); save(); return db;
  }
  // Auth hands over decrypted data (or null for a brand-new install)
  function init(data) { db = migrate(data || buildSeed()); return db; }
  function setPersist(fn) { persist = fn; }
  function uiPrefs() { try { localStorage.setItem('x4w_ui', JSON.stringify({ theme: db.settings.theme, lang: db.settings.lang })); } catch (e) { } }
  function save() {
    let ok = true;
    if (persist) { try { persist(JSON.stringify(db)); } catch (e) { ok = false; } }
    else { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { ok = false; } }
    uiPrefs();
    try { global.dispatchEvent(new CustomEvent('db:change')); } catch (e) { }
    return ok;
  }
  // replace data that changed in another tab (Auth decrypts it first)
  function replace(data) { db = migrate(data); try { global.dispatchEvent(new CustomEvent('db:change', { detail: { external: true } })); } catch (e) { } }
  const keepSecrets = (fn) => { const sec = db && db.secrets; fn(); if (sec) db.secrets = sec; };
  function reset() { keepSecrets(() => { db = migrate(buildSeed()); }); save(); return db; }
  // keep the catalog, settings and customers; remove demo transactions and demo numbers
  function startFresh() {
    db.sales = []; db.expenses = []; db.purchases = []; db.moves = []; db.quotes = []; db.campaigns = []; db.waLog = []; db.customers = []; db.held = [];
    db.products.forEach(p => { p.price = 0; p.cost = 0; p.stock = 0; p.oldPrice = 0; p.showPrice = false; });
    db.demo = false; save();
  }
  // backups never contain the API key or GitHub token
  function exportJSON() { const copy = Object.assign({}, db); delete copy.secrets; return JSON.stringify(copy, null, 2); }
  function importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || !Array.isArray(d.products) || !Array.isArray(d.sales) || !d.settings || typeof d.settings !== 'object') throw new Error('Invalid backup file');
    delete d.secrets;
    keepSecrets(() => { db = migrate(d); }); save(); return db;
  }
  global.addEventListener('storage', (e) => {
    if (persist) return; // encrypted mode: Auth handles cross-tab sync
    if (e.key === KEY && e.newValue) { try { replace(JSON.parse(e.newValue)); } catch (er) { } }
  });

  // ---------- domain helpers ----------
  const countsAsRevenue = (s) => s.status !== 'cancelled' && s.status !== 'refunded';
  const product = (id) => db.products.find(p => p.id === id);
  const customer = (id) => db.customers.find(c => c.id === id);
  const supplier = (id) => db.suppliers.find(s => s.id === id);
  const vehicle = (id) => (db.vehicles || []).find(v => v.id === id);

  // A product can be bought from several suppliers; the preferred one (or the first) is used for new orders.
  function preferredSource(p) {
    const list = (p && p.sources) || [];
    const active = list.filter(x => { const su = supplier(x.supplierId); return !su || su.active !== false; }); // unknown = not visible to this person
    return active.find(x => x.preferred) || active[0] || (p && p.supplierId ? { supplierId: p.supplierId } : null);
  }
  function nextNo(prefix, start) {
    let max = start;
    db.sales.concat(db.purchases, db.quotes || []).forEach(s => { if (s.no && s.no.startsWith(prefix)) { const n = parseInt(s.no.slice(prefix.length), 10); if (n > max) max = n; } });
    return prefix + (max + 1);
  }
  function adjustStock(pid, qty, type, ref, note) {
    const p = product(pid); if (!p) return;
    p.stock = Math.max(0, (p.stock || 0) + qty);
    db.moves.unshift({ id: uid('m'), date: Date.now(), pid, qty, type, ref: ref || '', note: note || '' });
    if (db.moves.length > 1500) db.moves.length = 1500;
  }
  function createSale(o) {
    const vatRate = Number(db.settings.vat) || 0;
    // For each line: which supplier it comes from, and how many are not in stock and must be bought.
    const items = o.items.map(it => {
      const p = product(it.pid); const src = preferredSource(p);
      const line = { pid: it.pid, name: p.name, sku: p.partNumber || p.sku, qty: it.qty, price: it.price != null ? r3(it.price) : p.price, cost: p.cost || 0 };
      const free = Math.max(0, p.stock || 0); if (it.qty > free) line.toBuy = it.qty - free;
      if (src) { line.supplierId = src.supplierId; if (src.sku) line.supSku = src.sku; }
      return line;
    });
    const subtotal = r3(items.reduce((s, it) => s + it.qty * it.price, 0));
    const discount = r3(Math.min(o.discount || 0, subtotal));
    const shippingFee = r3(o.shippingFee || 0);
    const vat = r3((subtotal - discount) * vatRate / 100);
    const total = r3(subtotal - discount + vat + shippingFee);
    const online = o.channel === 'online';
    const cust = o.customerId ? customer(o.customerId) : null;
    const sale = {
      id: uid('o'), no: online ? nextNo('WEB-', 5000) : nextNo('INV-', 1000), date: Date.now(),
      channel: online ? 'online' : 'shop', source: o.source || (online ? 'website' : 'pos'),
      customerId: cust ? cust.id : null, customerName: cust ? cust.name : (o.customerName || 'Walk-in customer'),
      phone: cust ? cust.phone : (o.phone || ''), items, subtotal, discount, vat, shippingFee, total,
      payment: o.payment || 'cash', status: online ? 'new' : 'completed', city: o.city || (cust ? cust.city : ''), address: o.address || '', note: o.note || '',
      paid: o.payment === 'qpay' ? false : (o.paid != null ? o.paid : !online), quoteId: o.quoteId || null
    };
    if (sale.payment === 'qpay') sale.qpay = { status: 'pending', requestedAt: null, approvedAt: null, settledAt: null, ref: '' };
    db.sales.push(sale);
    items.forEach(it => adjustStock(it.pid, -it.qty, 'sale', sale.no));
    save();
    return sale;
  }
  function setOrderStatus(id, status) {
    const s = db.sales.find(x => x.id === id); if (!s) return;
    if (status === 'cancelled' && s.status !== 'cancelled') s.items.forEach(it => adjustStock(it.pid, it.qty, 'return', s.no, 'Order cancelled'));
    if (s.status === 'cancelled' && status !== 'cancelled') s.items.forEach(it => adjustStock(it.pid, -it.qty, 'sale', s.no, 'Order re-opened'));
    s.status = status; save();
  }
  function setQpay(id, status, ref) {
    const s = db.sales.find(x => x.id === id); if (!s) return;
    s.qpay = s.qpay || {}; s.qpay.status = status; if (ref != null) s.qpay.ref = ref;
    const now = Date.now();
    if (status === 'requested') s.qpay.requestedAt = now;
    if (status === 'approved') { s.qpay.approvedAt = now; s.paid = true; }
    if (status === 'settled') { s.qpay.settledAt = now; s.paid = true; if (!s.qpay.approvedAt) s.qpay.approvedAt = now; }
    if (status === 'declined') s.paid = false;
    save();
  }
  function findOrCreateCustomer(name, phone, city, extra) {
    const clean = (phone || '').replace(/[^\d]/g, '');
    let c = clean && db.customers.find(x => (x.phone || '').replace(/[^\d]/g, '').endsWith(clean.slice(-8)));
    if (!c) { c = Object.assign({ id: uid('c'), name: name || 'Customer', phone: phone || '', city: city || '', type: 'retail', vehicle: '', optIn: true, created: Date.now() }, extra || {}); db.customers.push(c); }
    return c;
  }
  function receivePurchase(id) {
    const po = db.purchases.find(p => p.id === id); if (!po || po.status === 'received') return;
    po.status = 'received'; po.receivedAt = Date.now();
    po.items.forEach(it => {
      const p = product(it.pid); if (p) p.cost = it.cost; adjustStock(it.pid, it.qty, 'purchase', po.no);
      // items bought for customers who already paid/ordered go straight to them, not to the shelf
      (it.forSales || []).forEach(f => {
        const s = db.sales.find(x => x.id === f.id); if (!s) return;
        adjustStock(it.pid, -f.qty, 'sale', s.no, 'Arrived for customer order');
        s.items.forEach(li => { if (li.pid === it.pid && li.poId === po.id) li.arrived = Date.now(); });
      });
    });
    db.expenses.push({ id: uid('e'), date: Date.now(), category: 'inventory', desc: 'Stock purchase ' + po.no, amount: po.total, method: 'transfer', ref: po.id });
    save();
  }
  // Return items from a sale (full or partial): restock, reduce the sale, keep a log.
  // qtys = array of quantities to return, same order as sale.items
  function returnItems(id, qtys, reason) {
    const s = db.sales.find(x => x.id === id); if (!s) return;
    const vatRate = Number(db.settings.vat) || 0;
    const discRatio = s.subtotal ? s.discount / s.subtotal : 0;
    const back = [];
    s.items.forEach((it, k) => {
      const q = Math.max(0, Math.min(it.qty, qtys[k] || 0)); if (!q) return;
      it.qty -= q; back.push({ pid: it.pid, name: it.name, qty: q, price: it.price });
      adjustStock(it.pid, q, 'return', s.no, reason || 'Customer return');
    });
    if (!back.length) return;
    const before = s.total;
    s.items = s.items.filter(it => it.qty > 0);
    s.subtotal = r3(s.items.reduce((a, it) => a + it.qty * it.price, 0));
    s.discount = r3(s.subtotal * discRatio);
    s.vat = r3((s.subtotal - s.discount) * vatRate / 100);
    s.total = r3(s.subtotal - s.discount + s.vat + (s.items.length ? (s.shippingFee || 0) : 0));
    if (!s.items.length) { s.status = 'refunded'; s.shippingFee = 0; s.total = 0; }
    s.returns = (s.returns || []).concat({ date: Date.now(), items: back, amount: r3(before - s.total), reason: reason || '' });
    save();
  }
  function logWA(entry) { db.waLog.unshift(Object.assign({ id: uid('w'), date: Date.now() }, entry)); if (db.waLog.length > 800) db.waLog.length = 800; save(); }
  function netSales(s) { return s.subtotal - s.discount; }
  function cogs(s) { return s.items.reduce((a, it) => a + it.qty * (it.cost || 0), 0); }

  global.DB = {
    load, init, save, replace, setPersist, buildSeed, reset, startFresh, exportJSON, importJSON, uid, r3, DAY, GOVERNORATES, DEFAULT_TEMPLATES, KEY,
    get data() { return db; },
    product, customer, supplier, vehicle, createSale, setOrderStatus, setQpay, returnItems, adjustStock, receivePurchase, findOrCreateCustomer, logWA,
    countsAsRevenue, netSales, cogs, nextNo, preferredSource
  };
})(window);
