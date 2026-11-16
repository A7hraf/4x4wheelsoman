// Unit tests for the offline parts-matching engine (assets/js/match.js), run in Node.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/catalog.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/match.js'), 'utf8'), sandbox);
const M = sandbox.window.Match.create(sandbox.window.CATALOG);

const veh = (q) => M.findVehicle(q).id;
test('vehicles: names, codes, Arabic spelling and year rules', () => {
  expect(veh('lift kit for my land cruiser 2023')).toBe('land-cruiser-300');
  expect(veh('land cruiser 2015')).toBe('land-cruiser-200');
  expect(veh('LC79 pickup')).toBe('land-cruiser-70');
  expect(veh('ابي طقم رفع للباترول 2021')).toBe('patrol-y62');
  expect(veh('باترول 2005')).toBe('patrol-y61');
  expect(veh('جنوط لسيارة شاص')).toBe('land-cruiser-70');
  expect(veh('كفرات للاندكروزر 300')).toBe('land-cruiser-300');
  expect(veh('my jeep')).toBe('wrangler-jl');
  expect(veh('f150 raptor')).toBe('f-150');
  expect(veh('٢٠٢٢ y62')).toBe('patrol-y62');
  expect(M.findVehicle('ابي شي لسيارتي ٢٠٢١').year).toBe(2021);
  expect(veh('recovery strap')).toBeNull();
});

test('part types, brands, budgets and questions', () => {
  expect(M.findCategories('ابي كفرات')).toEqual(['wheels-tires']);
  expect(M.findCategories('need shocks')[0]).toBe('suspension');
  expect(M.findCategories('اكزوز')).toEqual(['performance']);
  expect(M.findBrand('ome lift')).toBe('Old Man Emu');
  expect(M.findBudget('something under 500 omr')).toBe(500);
  expect(M.findBudget('اقل من 300 ريال')).toBe(300);
  expect(M.intents('are you open on friday?')).toContain('hours');
  expect(M.intents('وين موقعكم')).toContain('location');
  expect(M.intents('تقسيط؟')).toContain('qpay');
});

test('search never recommends parts that do not fit the vehicle', () => {
  for (const [q, must] of [['suspension for patrol y62', /Y62/], ['intake 4runner', /4Runner/], ['side steps lc300', /Land Cruiser 300/], ['soft top bronco', /Bronco/]]) {
    const r = M.search(q).results;
    expect(r.length, q).toBeGreaterThan(0);
    for (const x of r.filter(x => x.fit === 'yes')) expect(x.p.fitment + ' ' + x.p.name, q).toMatch(must);
    expect(r.some(x => x.fit === 'no'), q).toBe(false);
  }
  expect(M.search('EKBP00173').results[0].p.partNumber).toBe('EKBP00173');
});

test('free-text quote parsing (English, Arabic, website format)', () => {
  const a = M.parseQuote('salam, I need a lift kit and 4 tyres for my patrol 2021, also a light bar. can I pay with qpay?');
  expect(a.vehicle).toBe('Nissan Patrol Y62 2021');
  expect(a.qpay).toBe(true);
  expect(a.items.map(i => i.qty + ' ' + i.name)).toEqual([expect.stringMatching(/^1 .*Patrol Y62/), expect.stringMatching(/^4 /), expect.stringMatching(/^1 .*Light Bar/)]);
  const b = M.parseQuote('السلام عليكم ابي طقم رفع وكفرات للاندكروزر 300 موديل 2024 و 2 حبل سحب');
  expect(b.items).toHaveLength(3);
  expect(b.items[1].qty).toBe(4);
  expect(b.items[2].qty).toBe(2);
  const c = M.parseQuote('Hi 4x4 Wheels, please quote these parts:\n\n• 1 × Old Man Emu BP-51 Suspension Kit (Land Cruiser 300) [EKBP00173]\n• 2 × Saber Soft Shackle 15,000 kg\n\nVehicle: Toyota Land Cruiser 300 2023\nName: Ahmed\n\nRef: QABC12');
  expect(c.items.map(i => [i.qty, i.sku])).toEqual([[1, 'EKBP00173'], [2, expect.any(String)]]);
  expect(c).toMatchObject({ name: 'Ahmed', vehicle: 'Toyota Land Cruiser 300 2023', ref: 'QABC12' });
  // nothing invented from small talk
  expect(M.parseQuote('hello, how are you?').items).toHaveLength(0);
});
