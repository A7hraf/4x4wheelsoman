/* ============================================================
   Business Hub – data layer (localStorage)
   Shared by the dashboard (admin.html) and storefront (index.html)
   ============================================================ */
(function (global) {
  const KEY = 'bh_db_v1';
  const DAY = 86400000;

  // ---------- deterministic random for seed data ----------
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

  // ---------- seed catalogue ----------
  const CATEGORIES = [
    { id: 'wheels', en: 'Wheels & Rims', ar: 'الجنوط' },
    { id: 'tyres', en: 'Tyres', ar: 'الإطارات' },
    { id: 'suspension', en: 'Suspension', ar: 'نظام التعليق' },
    { id: 'bumpers', en: 'Bumpers & Protection', ar: 'الصدامات والحماية' },
    { id: 'lighting', en: 'Lighting', ar: 'الإضاءة' },
    { id: 'recovery', en: 'Recovery Gear', ar: 'معدات السحب' },
    { id: 'roof', en: 'Roof Racks & Storage', ar: 'حوامل السقف' },
    { id: 'accessories', en: 'Accessories', ar: 'إكسسوارات' }
  ];

  const SEED_PRODUCTS = [
    ['WHL-FL-D538', 'Fuel Rebel D681 17x9 Matte Black', 'Fuel Off-Road', 'wheels', 62, 95, 48, 16, 'A1-01', 'Land Cruiser / Hilux'],
    ['WHL-MR-305', 'Method MR305 NV 17x8.5 Bronze', 'Method Race Wheels', 'wheels', 70, 110, 32, 16, 'A1-02', 'Land Cruiser 200/300'],
    ['WHL-KM-544', 'KMC KM544 Mesa 18x9 Satin Black', 'KMC', 'wheels', 58, 88, 12, 16, 'A1-03', 'Nissan Patrol Y62'],
    ['WHL-BR-BD', 'Black Rhino Arsenal 17x8.5 Sand', 'Black Rhino', 'wheels', 64, 99, 20, 8, 'A1-04', 'Toyota FJ / Prado'],
    ['TYR-BFG-KO2', 'BFGoodrich All-Terrain T/A KO2 285/70R17', 'BFGoodrich', 'tyres', 72, 108, 64, 24, 'B2-01', 'Universal'],
    ['TYR-BFG-KM3', 'BFGoodrich Mud-Terrain KM3 35x12.5R17', 'BFGoodrich', 'tyres', 95, 142, 18, 16, 'B2-02', 'Universal'],
    ['TYR-TOY-OPAT', 'Toyo Open Country A/T III 265/65R17', 'Toyo', 'tyres', 55, 84, 40, 20, 'B2-03', 'Universal'],
    ['TYR-MAX-RAZ', 'Maxxis Razr AT811 275/70R18', 'Maxxis', 'tyres', 58, 89, 9, 16, 'B2-04', 'Universal'],
    ['SUS-OME-LC200', 'Old Man Emu 2" Lift Kit – Land Cruiser 200', 'ARB Old Man Emu', 'suspension', 420, 640, 6, 3, 'C3-01', 'Land Cruiser 200'],
    ['SUS-ICON-S2', 'ICON Stage 2 Suspension – Hilux', 'ICON Vehicle Dynamics', 'suspension', 680, 990, 4, 2, 'C3-02', 'Hilux 2016+'],
    ['SUS-KNG-25', 'King 2.5 Coilovers (pair) – Patrol Y62', 'King Shocks', 'suspension', 890, 1290, 2, 2, 'C3-03', 'Nissan Patrol Y62'],
    ['SUS-BIL-5100', 'Bilstein 5100 Shock Absorber', 'Bilstein', 'suspension', 38, 62, 26, 10, 'C3-04', 'Universal'],
    ['BMP-ARB-SB', 'ARB Summit Front Bumper – Land Cruiser 300', 'ARB', 'bumpers', 610, 895, 3, 2, 'D4-01', 'Land Cruiser 300'],
    ['BMP-TJM-T13', 'TJM T13 Bull Bar – Hilux', 'TJM', 'bumpers', 450, 680, 1, 2, 'D4-02', 'Hilux 2021+'],
    ['BMP-RCK-SLD', 'Aluminium Rock Sliders (pair)', 'Rival 4x4', 'bumpers', 180, 275, 7, 3, 'D4-03', 'Land Cruiser 200'],
    ['BMP-SKID', 'Steel Under-Body Skid Plate Set', 'Rival 4x4', 'bumpers', 140, 215, 10, 4, 'D4-04', 'Hilux / Fortuner'],
    ['LGT-RIG-50', 'Rigid Industries 50" RDS Light Bar', 'Rigid Industries', 'lighting', 290, 445, 8, 4, 'E5-01', 'Universal'],
    ['LGT-BAJA-S2', 'Baja Designs Squadron Pro LED (pair)', 'Baja Designs', 'lighting', 120, 185, 15, 6, 'E5-02', 'Universal'],
    ['LGT-ROCK-8', 'RGB Rock Light Kit (8 pods)', 'Lazer', 'lighting', 35, 58, 30, 10, 'E5-03', 'Universal'],
    ['LGT-KC-30', 'KC HiLiTES 30" Pro6 Gravity Bar', 'KC HiLiTES', 'lighting', 210, 320, 5, 3, 'E5-04', 'Universal'],
    ['REC-WRN-ZEUS', 'Warn Zeus 10-S Winch 10,000 lb', 'Warn', 'recovery', 520, 780, 5, 2, 'F6-01', 'Universal'],
    ['REC-MAX-MKII', 'MAXTRAX MKII Recovery Boards (pair)', 'MAXTRAX', 'recovery', 72, 115, 22, 8, 'F6-02', 'Universal'],
    ['REC-ARB-CKMTA', 'ARB Twin Portable Air Compressor', 'ARB', 'recovery', 210, 320, 9, 4, 'F6-03', 'Universal'],
    ['REC-KIT-PRM', 'Premium Recovery Kit (straps, shackles, bag)', 'ARB', 'recovery', 48, 79, 18, 6, 'F6-04', 'Universal'],
    ['REC-DEF-TYR', 'Tyre Deflator Set (4 pcs)', 'Staun', 'recovery', 22, 38, 3, 10, 'F6-05', 'Universal'],
    ['ROF-RHN-PIO', 'Rhino-Rack Pioneer Platform 1528x1376', 'Rhino-Rack', 'roof', 380, 575, 6, 3, 'G7-01', 'Land Cruiser / Patrol'],
    ['ROF-FRT-SLM', 'Front Runner Slimline II Roof Rack', 'Front Runner', 'roof', 340, 520, 4, 2, 'G7-02', 'Hilux / Prado'],
    ['ROF-TENT-RTT', 'Roof Top Tent – 2 Person Hard Shell', 'iKamper', 'roof', 980, 1450, 2, 1, 'G7-03', 'Universal'],
    ['ROF-JRY-CAN', 'Jerry Can Holder + 20L Can', 'Front Runner', 'roof', 28, 45, 25, 8, 'G7-04', 'Universal'],
    ['ACC-SNK-LC', 'Safari Snorkel – Land Cruiser 70', 'Safari', 'accessories', 95, 148, 7, 3, 'H8-01', 'Land Cruiser 70'],
    ['ACC-FRG-60', 'Dometic CFX3 45L Fridge/Freezer', 'Dometic', 'accessories', 260, 395, 6, 3, 'H8-02', 'Universal'],
    ['ACC-GPS-CB', 'UHF CB Radio Kit with Antenna', 'GME', 'accessories', 85, 132, 11, 4, 'H8-03', 'Universal'],
    ['ACC-FLR-MAT', '3D Floor Mats Set', 'WeatherTech', 'accessories', 24, 42, 35, 10, 'H8-04', 'Land Cruiser 300'],
    ['ACC-AWN-270', '270° Side Awning', 'Rhino-Rack', 'accessories', 290, 440, 0, 2, 'H8-05', 'Universal']
  ];

  const SEED_CUSTOMERS = [
    ['Ahmed Al Balushi', '+968 9123 4567', 'Muscat', 'retail'],
    ['Salim Al Harthy', '+968 9234 5678', 'Nizwa', 'retail'],
    ['Khalid Al Rawahi', '+968 9345 6789', 'Sohar', 'retail'],
    ['Desert Tracks Workshop', '+968 2456 7890', 'Muscat', 'workshop'],
    ['Mohammed Al Lawati', '+968 9567 8901', 'Muscat', 'retail'],
    ['Faisal Al Siyabi', '+968 9678 9012', 'Sur', 'retail'],
    ['Al Wusta Off-Road Club', '+968 9789 0123', 'Duqm', 'workshop'],
    ['Yousuf Al Amri', '+968 9890 1234', 'Salalah', 'retail'],
    ['Hamad Al Kindi', '+968 9901 2345', 'Ibri', 'retail'],
    ['Nasser Al Maskari', '+968 9012 3456', 'Ibra', 'retail'],
    ['Sultan Al Busaidi', '+968 9111 2233', 'Muscat', 'retail'],
    ['Overland Oman LLC', '+968 2444 5566', 'Barka', 'workshop'],
    ['Saeed Al Hinai', '+968 9222 3344', 'Rustaq', 'retail'],
    ['Ali Al Jabri', '+968 9333 4455', 'Sohar', 'retail']
  ];

  const SEED_SUPPLIERS = [
    ['ARB Middle East', 'UAE', '+971 4 555 1200'],
    ['Gulf Tyre Trading', 'UAE', '+971 6 532 8800'],
    ['Wheel Pros International', 'USA', '+1 303 555 0144'],
    ['Overland Gear Distribution', 'Oman', '+968 2450 1188']
  ];

  const GOVERNORATES = ['Muscat', 'Batinah North', 'Batinah South', 'Dakhiliyah', 'Sharqiyah North', 'Sharqiyah South', 'Dhahirah', 'Buraimi', 'Al Wusta', 'Dhofar', 'Musandam'];

  const OFFERS = { 'TYR-BFG-KO2': 125, 'LGT-RIG-50': 520, 'REC-MAX-MKII': 135, 'ACC-FRG-60': 449, 'WHL-FL-D538': 110, 'REC-WRN-ZEUS': 860 };
  const FEATURED = ['WHL-MR-305', 'SUS-OME-LC200', 'BMP-ARB-SB', 'ROF-RHN-PIO', 'TYR-BFG-KM3', 'LGT-BAJA-S2', 'REC-ARB-CKMTA', 'ROF-TENT-RTT'];
  const BLURB = {
    wheels: 'Forged for the trail and built to carry heavy loads. Precision-machined with a durable finish that resists stone chips, sand and UAE/Oman summer heat.',
    tyres: 'Tough sidewalls, aggressive tread and excellent traction on sand, gravel and wadi rocks — while staying quiet and comfortable on the highway.',
    suspension: 'Improves ground clearance, load carrying and comfort on corrugated tracks. Tuned for heavy accessories and long desert trips.',
    bumpers: 'Heavy-duty protection engineered for your vehicle, compatible with winches, lights and airbags. Powder-coated for long life.',
    lighting: 'High-output LED lighting with excellent beam pattern for night driving in the desert and mountains. Waterproof and dust-proof (IP68).',
    recovery: 'Essential recovery gear to get you unstuck quickly and safely. Trusted by off-road clubs across Oman.',
    roof: 'Carry more gear with a strong, low-profile roof system. Aerodynamic design with plenty of mounting options for your adventure.',
    accessories: 'Practical upgrades for overlanding and daily driving, selected and tested by our team.'
  };
  const describe = (p) => BLURB[p[3]] + ' Fits: ' + p[9] + '.';

  function buildSeed() {
    const rand = rng(20261113);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const now = Date.now();

    const products = SEED_PRODUCTS.map((p, i) => ({
      id: 'p' + (i + 1), sku: p[0], name: p[1], brand: p[2], category: p[3],
      cost: p[4], price: p[5], stock: p[6], reorder: p[7], location: p[8], fitment: p[9],
      active: true, online: true, image: '',
      oldPrice: OFFERS[p[0]] || 0, featured: FEATURED.includes(p[0]),
      description: describe(p)
    }));
    const customers = SEED_CUSTOMERS.map((c, i) => ({
      id: 'c' + (i + 1), name: c[0], phone: c[1], city: c[2], type: c[3], created: now - (120 - i * 5) * DAY
    }));
    const suppliers = SEED_SUPPLIERS.map((s, i) => ({ id: 's' + (i + 1), name: s[0], country: s[1], phone: s[2] }));

    const sales = [];
    const vatRate = 5;
    let shopNo = 1000, webNo = 5000;
    for (let d = 89; d >= 0; d--) {
      const dayStart = new Date(now - d * DAY); dayStart.setHours(9, 0, 0, 0);
      const weekday = dayStart.getDay();
      const base = weekday === 5 ? 1 : weekday === 4 || weekday === 6 ? 5 : 3; // Fri quiet, Thu/Sat busy
      const growth = 1 + (89 - d) / 180;
      const nShop = Math.round((base + rand() * 3) * growth * 0.8);
      const nWeb = Math.round((1 + rand() * 3) * growth * 0.7);
      for (let k = 0; k < nShop + nWeb; k++) {
        const online = k >= nShop;
        const items = [];
        const nItems = 1 + Math.floor(rand() * (online ? 2 : 3));
        for (let j = 0; j < nItems; j++) {
          const pr = rand() < 0.55 ? pick(products.filter(x => ['tyres', 'wheels', 'lighting', 'recovery', 'accessories'].includes(x.category))) : pick(products);
          if (items.find(it => it.pid === pr.id)) continue;
          const qty = ['tyres', 'wheels'].includes(pr.category) ? pick([1, 2, 4, 4]) : 1;
          items.push({ pid: pr.id, name: pr.name, sku: pr.sku, qty, price: pr.price, cost: pr.cost });
        }
        const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
        const discount = rand() < 0.2 ? r3(subtotal * pick([0.05, 0.1])) : 0;
        const shippingFee = online ? pick([0, 2, 3, 5]) : 0;
        const vat = r3((subtotal - discount) * vatRate / 100);
        const total = r3(subtotal - discount + vat + shippingFee);
        const date = Math.min(dayStart.getTime() + Math.floor(rand() * 11 * 3600000), now - Math.floor(rand() * 5400000) - 60000);
        let status = 'completed';
        if (online) {
          if (d > 6) status = rand() < 0.06 ? 'cancelled' : 'delivered';
          else if (d > 2) status = pick(['shipped', 'delivered', 'delivered', 'processing']);
          else status = pick(['new', 'new', 'processing', 'shipped']);
        }
        const cust = rand() < 0.7 || online ? pick(customers) : null;
        sales.push({
          id: uid('o'), no: online ? 'WEB-' + (webNo++) : 'INV-' + (shopNo++), date, channel: online ? 'online' : 'shop',
          source: online ? pick(['website', 'website', 'instagram', 'whatsapp']) : 'pos',
          customerId: cust ? cust.id : null, customerName: cust ? cust.name : 'Walk-in customer',
          phone: cust ? cust.phone : '', items, subtotal, discount, vat, shippingFee, total,
          payment: online ? pick(['card', 'cod', 'transfer']) : pick(['cash', 'card', 'card']),
          status, city: online ? pick(GOVERNORATES) : '', address: online ? 'Way ' + (1000 + Math.floor(rand() * 8000)) + ', House ' + (1 + Math.floor(rand() * 90)) : '',
          note: ''
        });
      }
    }

    const expenses = [];
    const expDefs = [
      ['rent', 'Showroom & warehouse rent', 1450, 1],
      ['salaries', 'Staff salaries (6)', 3900, 1],
      ['utilities', 'Electricity & water', 210, 1],
      ['utilities', 'Internet & phone lines', 65, 1],
      ['marketing', 'Instagram & Google ads', 380, 1],
      ['software', 'Website hosting & payment gateway', 45, 1]
    ];
    for (let m = 2; m >= 0; m--) {
      const dt = new Date(now); dt.setDate(1); dt.setMonth(dt.getMonth() - m); dt.setHours(10, 0, 0, 0);
      expDefs.forEach(e => expenses.push({ id: uid('e'), date: dt.getTime() + (e[0] === 'salaries' ? 26 * DAY : 0), category: e[0], desc: e[1], amount: r3(e[2] * (0.95 + rand() * 0.1)), method: 'transfer' }));
    }
    for (let i = 0; i < 26; i++) {
      expenses.push({
        id: uid('e'), date: now - Math.floor(rand() * 88) * DAY,
        category: pick(['shipping', 'shipping', 'maintenance', 'marketing', 'other']),
        desc: pick(['Courier – Aramex', 'Courier – Oman Post', 'Workshop tools', 'Forklift service', 'Printed brochures', 'Fuel – delivery van', 'Packaging materials']),
        amount: r3(10 + rand() * 120), method: pick(['cash', 'card', 'transfer'])
      });
    }

    const purchases = [
      { id: uid('po'), no: 'PO-301', date: now - 70 * DAY, supplierId: 's2', status: 'received', items: [{ pid: 'p5', qty: 40, cost: 72 }, { pid: 'p7', qty: 30, cost: 55 }] },
      { id: uid('po'), no: 'PO-302', date: now - 41 * DAY, supplierId: 's3', status: 'received', items: [{ pid: 'p1', qty: 32, cost: 62 }, { pid: 'p2', qty: 24, cost: 70 }] },
      { id: uid('po'), no: 'PO-303', date: now - 12 * DAY, supplierId: 's1', status: 'received', items: [{ pid: 'p9', qty: 4, cost: 420 }, { pid: 'p23', qty: 6, cost: 210 }] },
      { id: uid('po'), no: 'PO-304', date: now - 2 * DAY, supplierId: 's1', status: 'ordered', items: [{ pid: 'p14', qty: 4, cost: 450 }, { pid: 'p34', qty: 6, cost: 290 }] }
    ];
    purchases.forEach(p => p.total = r3(p.items.reduce((s, it) => s + it.qty * it.cost, 0)));
    purchases.filter(p => p.status === 'received').forEach(p => expenses.push({
      id: uid('e'), date: p.date, category: 'inventory', desc: 'Stock purchase ' + p.no, amount: p.total, method: 'transfer', ref: p.id
    }));

    const moves = [];
    return {
      version: 1, created: now,
      settings: { name: 'Trailhead 4x4', tagline: 'Off-road parts & accessories', vat: vatRate, currency: 'OMR', phone: '+968 2400 0000', whatsapp: '96890000000', email: 'sales@example.com', address: 'Al Khuwair, Muscat, Oman', cr: '1234567', lang: 'en', theme: 'light', shipping: 2, freeShipOver: 100, heroTitle: 'Built for Oman\u2019s toughest trails', heroText: 'Wheels, tyres, suspension, lighting and recovery gear from the brands off-roaders trust — fitted in Muscat or delivered to every governorate.' },
      categories: CATEGORIES, products, customers, suppliers, sales, expenses, purchases, moves
    };
  }

  // ---------- storage ----------
  let db = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = JSON.parse(raw); return db; }
    } catch (e) { /* storage blocked */ }
    db = buildSeed();
    save();
    return db;
  }
  function save() {
    let ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { ok = false; }
    try { global.dispatchEvent(new CustomEvent('db:change')); } catch (e) { }
    return ok;
  }
  function reset() { db = buildSeed(); save(); return db; }
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error('Invalid backup file');
    db = d; save(); return db;
  }

  // keep tabs in sync (storefront ↔ dashboard)
  global.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) { try { db = JSON.parse(e.newValue); global.dispatchEvent(new CustomEvent('db:change', { detail: { external: true } })); } catch (er) { } }
  });

  // ---------- domain helpers ----------
  const countsAsRevenue = (s) => s.status !== 'cancelled';
  function product(id) { return db.products.find(p => p.id === id); }
  function customer(id) { return db.customers.find(c => c.id === id); }
  function supplier(id) { return db.suppliers.find(s => s.id === id); }

  function nextNo(prefix, start) {
    let max = start;
    db.sales.concat(db.purchases).forEach(s => {
      if (s.no && s.no.startsWith(prefix)) { const n = parseInt(s.no.slice(prefix.length), 10); if (n > max) max = n; }
    });
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
    const items = o.items.map(it => { const p = product(it.pid); return { pid: it.pid, name: p.name, sku: p.sku, qty: it.qty, price: it.price != null ? it.price : p.price, cost: p.cost }; });
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
      payment: o.payment || 'cash', status: online ? 'new' : 'completed', city: o.city || '', address: o.address || '', note: o.note || ''
    };
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

  function findOrCreateCustomer(name, phone, city) {
    const clean = (phone || '').replace(/\s/g, '');
    let c = clean && db.customers.find(x => x.phone.replace(/\s/g, '') === clean);
    if (!c) { c = { id: uid('c'), name, phone, city: city || '', type: 'retail', created: Date.now() }; db.customers.push(c); }
    return c;
  }

  function receivePurchase(id) {
    const po = db.purchases.find(p => p.id === id); if (!po || po.status === 'received') return;
    po.status = 'received'; po.receivedAt = Date.now();
    po.items.forEach(it => { const p = product(it.pid); if (p) p.cost = it.cost; adjustStock(it.pid, it.qty, 'purchase', po.no); });
    db.expenses.push({ id: uid('e'), date: Date.now(), category: 'inventory', desc: 'Stock purchase ' + po.no, amount: po.total, method: 'transfer', ref: po.id });
    save();
  }

  // revenue excl. VAT and shipping = net sales
  function netSales(s) { return s.subtotal - s.discount; }
  function cogs(s) { return s.items.reduce((a, it) => a + it.qty * it.cost, 0); }

  global.DB = {
    load, save, reset, exportJSON, importJSON, uid, r3, DAY, GOVERNORATES,
    get data() { return db; },
    product, customer, supplier, createSale, setOrderStatus, adjustStock, receivePurchase, findOrCreateCustomer,
    countsAsRevenue, netSales, cogs, nextNo
  };
})(window);
