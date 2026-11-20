// Permissions: every section of the dashboard has a level per employee.
//   none    – hidden
//   view    – can see, cannot change
//   request – can prepare changes; each change waits for the owner's approval
//   edit    – can change directly; deleting, cancelling and refunding wait for approval
//   full    – can change and delete directly
// Extra switches: costs (see costs & profit), export (download data), maxDiscount (% at the till).
// The owner can do everything. Rules are enforced here, on the server; the dashboard only mirrors them.

export const LEVELS = ['none', 'view', 'request', 'edit', 'full'];
export const MODULES = ['dashboard', 'pos', 'orders', 'quotes', 'customers', 'inventory', 'pricing', 'suppliers', 'purchases', 'qpay', 'finance', 'reports', 'whatsapp', 'ai', 'settings', 'team'];
const rank = (l) => Math.max(0, LEVELS.indexOf(l));

// Ready-made roles the owner can start from and then adjust.
export const PRESETS = {
  cashier: { dashboard: 'view', pos: 'edit', orders: 'view', quotes: 'view', customers: 'edit', inventory: 'view', qpay: 'view', costs: false, export: false, maxDiscount: 5 },
  sales: { dashboard: 'view', pos: 'edit', orders: 'edit', quotes: 'edit', customers: 'edit', inventory: 'view', qpay: 'edit', whatsapp: 'request', ai: 'view', costs: false, export: false, maxDiscount: 10 },
  storekeeper: { dashboard: 'view', orders: 'view', inventory: 'edit', suppliers: 'edit', purchases: 'edit', pricing: 'request', costs: true, export: false, maxDiscount: 0 },
  manager: { dashboard: 'view', pos: 'full', orders: 'full', quotes: 'full', customers: 'full', inventory: 'full', pricing: 'edit', suppliers: 'full', purchases: 'full', qpay: 'full', finance: 'view', reports: 'view', whatsapp: 'edit', ai: 'view', settings: 'view', team: 'view', costs: true, export: true, maxDiscount: 20 }
};

export function normalizePerms(p) {
  const out = { costs: !!(p && p.costs), export: !!(p && p.export), maxDiscount: Math.max(0, Math.min(100, Number(p && p.maxDiscount) || 0)) };
  MODULES.forEach(m => { const v = p && p[m]; out[m] = LEVELS.includes(v) ? v : 'none'; });
  return out;
}
export const isOwner = (u) => u && u.role === 'owner';
export function level(u, m) { if (isOwner(u)) return 'full'; return (u && u.perms && u.perms[m]) || 'none'; }
export const atLeast = (u, m, l) => rank(level(u, m)) >= rank(l);
export const anyAtLeast = (u, mods, l) => mods.some(m => atLeast(u, m, l));
export const seesCosts = (u) => isOwner(u) || !!(u.perms && u.perms.costs) || atLeast(u, 'finance', 'view');

// ---------- what each stored collection belongs to ----------
const CATALOG = ['pos', 'orders', 'quotes', 'inventory', 'pricing', 'purchases', 'suppliers', 'reports', 'ai', 'whatsapp', 'dashboard'];
const READ = {
  products: CATALOG, categories: CATALOG, vehicles: CATALOG,
  customers: ['customers', 'pos', 'orders', 'quotes', 'qpay', 'whatsapp'],
  sales: ['orders', 'pos', 'qpay', 'reports', 'finance', 'customers', 'ai', 'dashboard', 'purchases', 'suppliers'],
  quotes: ['quotes', 'orders', 'dashboard'],
  purchases: ['purchases', 'suppliers', 'finance'],
  suppliers: ['suppliers', 'purchases', 'pricing'],
  expenses: ['finance', 'reports'],
  moves: ['inventory', 'purchases'],
  campaigns: ['whatsapp'], waLog: ['whatsapp'],
  held: ['pos']
};
export function canRead(u, col, id) {
  if (isOwner(u)) return true;
  if (col === 'meta') return true; // settings, makes, brands (secrets are never stored here)
  const mods = READ[col] || ['settings'];
  return anyAtLeast(u, mods, 'view');
}

// Remove costs/profit from data for people who may not see them.
const COST_FIELDS = ['cost', 'marginPct', 'landed'];
export function redact(u, col, row) {
  if (!row || seesCosts(u)) return row;
  const r = JSON.parse(JSON.stringify(row));
  if (col === 'products') { COST_FIELDS.forEach(f => delete r[f]); if (Array.isArray(r.sources)) r.sources = r.sources.map(s => ({ supplierId: s.supplierId, sku: s.sku, url: s.url, available: s.available, preferred: s.preferred })); }
  if (col === 'sales' && Array.isArray(r.items)) r.items.forEach(it => { delete it.cost; });
  if (col === 'purchases') { delete r.total; (r.items || []).forEach(it => { delete it.cost; delete it.supCost; }); }
  if (col === 'meta' && row && row.id === 'settings') return r;
  return r;
}

// ---------- what a change needs ----------
const SIDE = ['pos', 'orders', 'quotes', 'inventory', 'purchases', 'suppliers', 'qpay'];
const PRICE_FIELDS = ['price', 'cost', 'oldPrice', 'showPrice', 'marginPct', 'priceMode', 'sources'];
const changedKeys = (before, after) => { const ks = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]); return [...ks].filter(k => JSON.stringify((before || {})[k]) !== JSON.stringify((after || {})[k])); };

// returns { anyOf: [modules], op: 'create'|'update'|'delete', sensitive: bool, label }
export function classify(col, id, before, after) {
  const op = !before ? 'create' : after == null ? 'delete' : 'update';
  const keys = op === 'update' ? changedKeys(before, after) : [];
  const only = (list) => keys.length > 0 && keys.every(k => list.includes(k));
  const r = (anyOf, extra) => Object.assign({ anyOf, op, sensitive: false }, extra || {});
  switch (col) {
    case 'products': {
      if (op === 'update' && only(['stock', 'updated'])) return r(['inventory', ...SIDE], { side: true });
      if (op === 'update' && only([...PRICE_FIELDS, 'updated'])) return r(['pricing']);
      if (op === 'update' && keys.some(k => PRICE_FIELDS.includes(k))) return r(['inventory'], { also: ['pricing'] });
      return r(['inventory']);
    }
    case 'moves': return r(['inventory', ...SIDE], { side: true });
    case 'waLog': return r(['whatsapp', 'orders', 'quotes', 'qpay', 'pos'], { side: true });
    case 'held': return r(['pos'], { side: true });
    case 'customers': return op === 'create' ? r(['customers', 'pos', 'orders', 'quotes'], { side: true }) : r(['customers']);
    case 'sales': {
      const x = after || before;
      if (op === 'create') return r(x.channel === 'shop' ? ['pos', 'orders'] : x.quoteId ? ['orders', 'quotes'] : ['orders']);
      if (op === 'delete') return r(['orders']);
      const cancelling = ['cancelled', 'refunded'].includes(after.status) && !['cancelled', 'refunded'].includes(before.status);
      const returning = (after.returns || []).length > (before.returns || []).length;
      if (only(['qpay', 'paid'])) return r(['qpay', 'orders']);
      return r(['orders'], { sensitive: cancelling || returning });
    }
    case 'quotes': return r(['quotes']);
    case 'purchases': return r(['purchases', 'suppliers']);
    case 'suppliers': return r(['suppliers']);
    case 'expenses': return (after || before).category === 'inventory' && (after || before).ref ? r(['finance', 'purchases'], { side: true }) : r(['finance']);
    case 'campaigns': return r(['whatsapp']);
    case 'categories': case 'vehicles': return r(['inventory']);
    case 'meta': return id === 'settings' || id === 'demo' ? r(['settings']) : r(['inventory']);
    default: return r(['settings']);
  }
}

// allow | approve | deny for one change
export function verdict(u, c) {
  if (isOwner(u)) return 'allow';
  const best = Math.max(...c.anyOf.map(m => rank(level(u, m))));
  if (c.also && !c.also.some(m => atLeast(u, m, 'edit'))) {
    if (!c.also.some(m => atLeast(u, m, 'request'))) return 'deny';
    if (best >= rank('request')) return 'approve';
  }
  if (best <= rank('view')) return 'deny';
  if (best === rank('request')) return c.side ? 'allow' : 'approve';
  if (best === rank('edit')) return (c.op === 'delete' || c.sensitive) && !c.side ? 'approve' : 'allow';
  return 'allow';
}
