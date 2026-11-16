/* ============================================================
   4x4 Wheels Oman – parts assistant for customers (store)
   • Works with no server and no API key: understands the vehicle, part type, brand,
     budget and common questions (hours, location, Qpay, delivery…) in English and Arabic,
     and answers from the published catalog with "Add to quote" buttons.
   • Optional: if the owner sets an "AI assistant URL" in Admin → Settings (a small
     proxy such as worker/assistant-proxy.js that holds the Claude API key), answers come
     from Claude, grounded in the same catalog. If that service is down, it falls back
     to the built-in engine automatically.
   • Never asks for or stores personal data; the hand-off to a person is WhatsApp.
   ============================================================ */
(function () {
  'use strict';
  const ST = window.STORE; if (!ST || !window.Match) return;
  const M = Match.create({ products: ST.products, vehicles: ST.C.vehicles || [], makes: ST.C.makes || [], categories: ST.C.categories || [], brands: ST.C.brands || [] });
  const esc = ST.esc, S = ST.S;
  const AI_URL = /^https:\/\/[^\s"'<>]+$/.test(S.aiEndpoint || '') ? S.aiEndpoint : '';
  const MAX_LEN = 500;

  const TX = {
    en: {
      open: 'Parts assistant', title: 'Parts assistant', sub: 'Tell me your vehicle and what you need.', ph: 'e.g. lift kit for my Land Cruiser 300', send: 'Send', close: 'Close',
      hello: "Hi! I can help you find parts that fit your 4x4. Which vehicle do you drive, and what are you looking for?",
      chips: ['Lift kit for my Land Cruiser 300', 'Tyres for Patrol Y62', 'Recovery gear for the sand', 'Pay in installments?', 'Opening hours'],
      found: 'Here is what fits{v}:', found_any: 'Here are some options:', fits: 'Fits your {v}', uni: 'Universal fit', check: 'Ask us to confirm fit', make_fit: 'Fits {m} models',
      none_for: "I couldn't find {c} for the {v} in our online catalog. We can often source it — ask us on WhatsApp.", none: "I couldn't find that in our online catalog. We can often source parts that aren't listed — ask us on WhatsApp.",
      which_part: 'Great, a {v}. What are you looking for?', which_veh: 'Which vehicle is it for? The right {c} depends on the model.', pick_make: 'Pick your make:', pick_model: 'And the model?',
      view: 'View', add: 'Add to quote', added: 'Added', req: 'Price on request', more: 'See all {n} results',
      ask_person: 'Ask a person on WhatsApp', wa_intro: 'Hi 4x4 Wheels, I was using the parts assistant on your website.', wa_q: 'My question', wa_v: 'My vehicle',
      hours: 'We are open Saturday to Thursday, 5 PM to 12 AM, and closed on Friday. {now}', open_now: "We're open right now.", closed_now: "We're closed right now.",
      location: 'Our shop is in Al Maabela, Muscat. Message us on WhatsApp before you come so we can have the part ready.', map: 'Open in Google Maps',
      qpay: 'You can split your order into up to 4 interest-free payments with Qpay (orders up to {x} rial). For parts priced on request, we confirm the price on WhatsApp and send the Qpay request to your phone.', qpay_more: 'How Qpay works',
      delivery: 'You can collect from our shop in Al Maabela, or ask us on WhatsApp about delivery to your area in Oman.',
      install: 'Ask us on WhatsApp about fitting — tell us your vehicle and the part and we will arrange it or recommend a workshop.',
      warranty: 'We sell genuine parts from the brands we carry, and we confirm fitment with you before you pay.',
      price: 'Prices are shown where listed. For parts marked "Price on request", add them to your quote list and send it on WhatsApp — we reply with price, stock and fitment before you pay.',
      thanks: "You're welcome! Anything else for your build?", human: 'Sure — tap below to chat with our team on WhatsApp.',
      err: "Sorry, something went wrong. Try again, or ask us on WhatsApp.", ai_note: 'AI answers can be wrong — we confirm price, stock and fitment on WhatsApp before you pay.'
    },
    ar: {
      open: 'مساعد القطع', title: 'مساعد القطع', sub: 'أخبرني بسيارتك وما تحتاجه.', ph: 'مثال: طقم رفع للاندكروزر 300', send: 'إرسال', close: 'إغلاق',
      hello: 'مرحباً! أساعدك تلقى القطع المناسبة لسيارتك. وش سيارتك، ووش تدور عليه؟',
      chips: ['طقم رفع للاندكروزر 300', 'كفرات لباترول Y62', 'معدات سحب للرمل', 'هل يوجد تقسيط؟', 'أوقات الدوام'],
      found: 'هذه القطع المناسبة{v}:', found_any: 'هذه بعض الخيارات:', fits: 'تناسب {v}', uni: 'تناسب جميع السيارات', check: 'اسألنا لتأكيد التوافق', make_fit: 'تناسب سيارات {m}',
      none_for: 'ما لقيت {c} لـ {v} في الكتالوج الإلكتروني. غالباً نقدر نوفّرها — اسألنا على واتساب.', none: 'ما لقيت هذا في الكتالوج الإلكتروني. نقدر نوفّر قطع غير معروضة — اسألنا على واتساب.',
      which_part: 'تمام، {v}. وش تدور عليه؟', which_veh: 'لأي سيارة؟ {c} المناسبة تعتمد على الموديل.', pick_make: 'اختر الماركة:', pick_model: 'والموديل؟',
      view: 'عرض', add: 'أضف لعرض السعر', added: 'تمت الإضافة', req: 'السعر عند الطلب', more: 'عرض كل النتائج ({n})',
      ask_person: 'كلّم موظف على واتساب', wa_intro: 'مرحباً 4x4 Wheels، كنت أستخدم مساعد القطع في موقعكم.', wa_q: 'سؤالي', wa_v: 'سيارتي',
      hours: 'نفتح من السبت إلى الخميس، من 5 مساءً حتى 12 منتصف الليل، والجمعة مغلق. {now}', open_now: 'نحن مفتوحون الآن.', closed_now: 'نحن مغلقون الآن.',
      location: 'محلنا في المعبيلة، مسقط. راسلنا على واتساب قبل ما تجي عشان نجهز لك القطعة.', map: 'افتح في خرائط جوجل',
      qpay: 'تقدر تقسّط طلبك على 4 دفعات بدون فوائد مع Qpay (للطلبات حتى {x} ريال). للقطع اللي سعرها عند الطلب، نأكد السعر على واتساب ونرسل طلب Qpay لهاتفك.', qpay_more: 'كيف يعمل Qpay',
      delivery: 'تقدر تستلم من محلنا في المعبيلة، أو اسألنا على واتساب عن التوصيل لمنطقتك في عُمان.',
      install: 'اسألنا على واتساب عن التركيب — أرسل سيارتك والقطعة ونرتب لك أو ننصحك بورشة.',
      warranty: 'نبيع قطع أصلية من العلامات اللي نوفرها، ونتأكد معك من التوافق قبل الدفع.',
      price: 'الأسعار معروضة للقطع المسعّرة. القطع "السعر عند الطلب" أضفها لقائمة عرض السعر وأرسلها على واتساب — نرد عليك بالسعر والتوفر والتوافق قبل الدفع.',
      thanks: 'العفو! تبي شي ثاني لسيارتك؟', human: 'أكيد — اضغط تحت عشان تكلم فريقنا على واتساب.',
      err: 'عذراً، صار خطأ. حاول مرة ثانية أو اسألنا على واتساب.', ai_note: 'قد تخطئ إجابات الذكاء الاصطناعي — نؤكد السعر والتوفر والتوافق على واتساب قبل الدفع.'
    }
  };
  // reply in the customer's language: Arabic text gets an Arabic answer even on the English site
  let replyLang = null;
  const lang = () => replyLang || (ST.lang === 'ar' ? 'ar' : 'en');
  const T = (k, v) => { let s = (TX[lang()][k] != null ? TX[lang()][k] : TX.en[k]) || k; if (v) Object.keys(v).forEach(x => { s = String(s).split('{' + x + '}').join(v[x]); }); return s; };
  // names follow the reply language (an Arabic question on the English site gets Arabic names)
  const ar = () => lang() === 'ar';
  const makeName = (m) => { const x = (ST.C.makes || []).find(k => k.en === m); return x && ar() ? x.ar : m; };
  const vehName = (v) => (v ? (ar() && v.ar ? v.ar : v.en) : '');
  const catName = (id) => { const c = (ST.C.categories || []).find(x => x.id === id); return c ? (ar() ? c.ar : c.en) : id; };
  const pName = (p) => (ar() && p.nameAr) || p.name;
  const vehLabel = (id) => { const v = ST.veh(id); return v ? `${makeName(v.make)} ${vehName(v)}` : ''; };
  const isOpen = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Muscat' })); return d.getDay() !== 5 && d.getHours() >= 17; };

  // conversation state (kept for this visit only)
  const ctx = { vehicle: '', make: '', category: '', history: [] };
  const sv = ST.savedVehicle(); if (sv && sv.model && ST.veh(sv.model)) { ctx.vehicle = sv.model; ctx.make = ST.veh(sv.model).make; }

  // ---------- UI ----------
  const fab = document.createElement('button');
  fab.className = 'pa-fab'; fab.type = 'button';
  const panel = document.createElement('section');
  panel.className = 'pa hide'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
  document.body.append(fab, panel);
  let log, input, opened = false, busy = false;

  function chrome() {
    fab.innerHTML = `${icon('chat')}<span>${T('open')}</span>`; fab.setAttribute('aria-label', T('open'));
    panel.setAttribute('aria-label', T('title'));
    panel.innerHTML = `<header class="pa-h"><div><b>${T('title')}</b><small>${T('sub')}</small></div><button class="pa-x" type="button" aria-label="${T('close')}">${icon('x')}</button></header>
      <div class="pa-log" id="paLog" aria-live="polite"></div>
      <form class="pa-in" id="paForm"><input id="paQ" maxlength="${MAX_LEN}" autocomplete="off" placeholder="${esc(T('ph'))}" aria-label="${esc(T('ph'))}"><button type="submit" aria-label="${T('send')}">${icon('send')}</button></form>
      <a class="pa-wa" id="paWa" target="_blank" rel="noopener">${T('ask_person')}</a>`;
    log = panel.querySelector('#paLog'); input = panel.querySelector('#paQ');
    panel.querySelector('.pa-x').onclick = toggle;
    panel.querySelector('#paForm').onsubmit = (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.value = ''; ask(q); } };
    log.onclick = onLogClick;
    updateWa();
  }
  function toggle() {
    opened = !opened;
    panel.classList.toggle('hide', !opened); fab.classList.toggle('hide', opened);
    if (opened) {
      if (!log.childElementCount) { bot(`<p>${esc(T('hello'))}</p>`); chips(TX[lang()].chips); }
      setTimeout(() => input.focus(), 50);
    } else fab.focus();
  }
  fab.onclick = toggle;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && opened) toggle(); });
  ST.onLang = () => { replyLang = null; const was = opened; chrome(); log.innerHTML = ''; if (was) { bot(`<p>${esc(T('hello'))}</p>`); chips(TX[lang()].chips); } };

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function user(text) { const d = document.createElement('div'); d.className = 'pa-m me'; d.dir = 'auto'; d.textContent = text; log.appendChild(d); scroll(); }
  function bot(html) { const d = document.createElement('div'); d.className = 'pa-m bot'; d.dir = lang() === 'ar' ? 'rtl' : 'ltr'; d.innerHTML = html; log.appendChild(d); scroll(); return d; }
  function chips(list) { const d = document.createElement('div'); d.className = 'pa-chips'; d.innerHTML = list.map(c => `<button type="button" data-ask="${esc(c)}">${esc(c)}</button>`).join(''); log.appendChild(d); scroll(); }
  function typing() { return bot('<span class="pa-typing"><i></i><i></i><i></i></span>'); }
  function updateWa() {
    const a = panel.querySelector('#paWa'); if (!a) return;
    const last = ctx.history.filter(h => h.role === 'user').slice(-2).map(h => h.content).join(' / ');
    let msg = T('wa_intro');
    if (ctx.vehicle) msg += `\n${T('wa_v')}: ${vehLabel(ctx.vehicle)}`;
    if (last) msg += `\n${T('wa_q')}: ${last}`;
    a.href = ST.wa(msg);
  }

  function fitBadge(p) {
    const f = M.fitOf(p, ctx.vehicle, ctx.make);
    if (f === 'yes') return `<span class="pa-fit ok">✓ ${esc(T('fits', { v: vehLabel(ctx.vehicle) }))}</span>`;
    if (f === 'uni') return `<span class="pa-fit ok">✓ ${esc(T('uni'))}</span>`;
    if (f === 'make') return `<span class="pa-fit">${esc(T('make_fit', { m: makeName(ctx.make) }))}</span>`;
    return `<span class="pa-fit ask">${esc(T('check'))}</span>`;
  }
  function cards(list) {
    return `<div class="pa-cards">${list.map(p => `<div class="pa-card"><a class="pa-img" href="#/p/${encodeURIComponent(p.slug)}">${ST.img(p)}</a><div class="pa-b"><a class="pa-nm" href="#/p/${encodeURIComponent(p.slug)}">${esc(pName(p))}</a>${fitBadge(p)}
      <div class="pa-pr">${ST.hasPrice(p) ? ST.money(p.price) : esc(T('req'))}</div>
      <div class="pa-act"><a href="#/p/${encodeURIComponent(p.slug)}">${esc(T('view'))}</a><button type="button" data-add="${esc(p.slug)}" class="${ST.inQuote(p.slug) ? 'in' : ''}">${esc(ST.inQuote(p.slug) ? T('added') : T('add'))}</button></div></div></div>`).join('')}</div>`;
  }
  function onLogClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ask) { ask(b.dataset.ask); return; }
    if (b.dataset.add) { e.stopPropagation(); ST.addQuote(b.dataset.add, 1); b.classList.add('in'); b.textContent = T('added'); return; }
    if (b.dataset.make) { ctx.make = b.dataset.make; ctx.vehicle = ''; const models = (ST.C.vehicles || []).filter(v => v.make === b.dataset.make); bot(`<p>${esc(T('pick_model'))}</p><div class="pa-chips in">${models.map(v => `<button type="button" data-veh="${esc(v.id)}">${esc(vehName(v))}</button>`).join('')}</div>`); return; }
    if (b.dataset.veh) { ctx.vehicle = b.dataset.veh; ctx.make = (ST.veh(b.dataset.veh) || {}).make || ''; ST.saveVehicle({ make: ctx.make, model: ctx.vehicle }); user(vehLabel(ctx.vehicle)); answerLocal(ctx.category ? '' : vehLabel(ctx.vehicle), true); }
    if (b.dataset.cat) { ctx.category = b.dataset.cat; user(catName(b.dataset.cat)); answerLocal(''); }
  }
  // links inside the chat navigate the store; close the panel on phones so the page is visible
  panel.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#/"]'); if (a && innerWidth < 700) toggle(); });

  // ---------- local engine ----------
  function answerLocal(q, fromPick) {
    const intents = q ? M.intents(q) : [];
    const r = M.search(q || '', { vehicle: undefined });
    // remember context across turns
    if (r.vehicle.id && r.vehicle.id !== ctx.vehicle) { ctx.vehicle = r.vehicle.id; ctx.make = r.vehicle.make; ST.saveVehicle({ make: ctx.make, model: ctx.vehicle }); }
    else if (!ctx.vehicle && r.vehicle.make) ctx.make = r.vehicle.make;
    if (r.categories.length) ctx.category = r.categories[0];
    const hasProductAsk = r.categories.length || r.brand || r.results.some(x => x.score >= 50);
    const out = [];
    const faq = { hours: () => `<p>${esc(T('hours', { now: isOpen() ? T('open_now') : T('closed_now') }))}</p>`, location: () => `<p>${esc(T('location'))}</p><p><a class="pa-link" href="${esc(S.maps)}" target="_blank" rel="noopener">${esc(T('map'))} ↗</a></p>`, qpay: () => `<p>${esc(T('qpay', { x: S.qpayLimit || 500 }))}</p><p><a class="pa-link" href="#/installments">${esc(T('qpay_more'))} →</a></p>`, delivery: () => `<p>${esc(T('delivery'))}</p>`, install: () => `<p>${esc(T('install'))}</p>`, warranty: () => `<p>${esc(T('warranty'))}</p>`, human: () => `<p>${esc(T('human'))}</p>`, thanks: () => `<p>${esc(T('thanks'))}</p>` };
    ['hours', 'location', 'qpay', 'delivery', 'install', 'warranty', 'human'].forEach(k => { if (intents.includes(k) && !(k === 'human' && hasProductAsk)) out.push(faq[k]()); });
    if (intents.includes('price') && !hasProductAsk && !out.length) out.push(`<p>${esc(T('price'))}</p>`);
    if (intents.includes('thanks') && !hasProductAsk && !out.length) out.push(faq.thanks());

    const cat = r.categories[0] || (fromPick || !q ? ctx.category : '');
    const wantsParts = hasProductAsk || (!out.length && (r.vehicle.id || fromPick || !q));
    if (wantsParts) {
      const res = M.search((q || '') + ' ' + (cat && !r.categories.length ? (catName(cat) + ' ' + cat) : ''), { vehicle: ctx.vehicle || '', make: ctx.make, categories: cat ? [cat] : undefined, limit: 12 }).results;
      const specific = cat && ST.products().some(p => p.category === cat && !M.fitOf(p, '', '').match(/uni/));
      if (cat && !ctx.vehicle && specific && !res.some(x => x.fit === 'uni')) {
        out.push(`<p>${esc(T('which_veh', { c: catName(cat) }))}</p><p class="pa-s">${esc(T('pick_make'))}</p><div class="pa-chips in">${(ST.C.makes || []).map(m => `<button type="button" data-make="${esc(m.en)}">${esc(makeName(m.en))}</button>`).join('')}</div>`);
      } else if (!cat && ctx.vehicle && !r.brand && !res.some(x => x.score >= 50)) {
        const cats = (ST.C.categories || []).filter(c => ST.products().some(p => p.category === c.id && M.fitOf(p, ctx.vehicle, ctx.make) === 'yes'));
        out.push(`<p>${esc(T('which_part', { v: vehLabel(ctx.vehicle) }))}</p><div class="pa-chips in">${cats.map(c => `<button type="button" data-cat="${esc(c.id)}">${esc(catName(c.id))}</button>`).join('')}</div>`);
      } else {
        const good = res.filter(x => x.fit !== 'no' && x.score >= 12);
        if (good.length) {
          const shown = good.slice(0, 4).map(x => x.p);
          out.push(`<p>${esc(ctx.vehicle ? T('found', { v: lang() === 'ar' ? ' لـ ' + vehLabel(ctx.vehicle) : ' your ' + vehLabel(ctx.vehicle) }) : T('found_any'))}</p>${cards(shown)}`);
          if (good.length > 4) { const qs = ['c=' + encodeURIComponent(cat || ''), ctx.vehicle ? 'v=' + encodeURIComponent(ctx.vehicle) : ''].filter(x => !/=$/.test(x)).join('&'); out.push(`<p><a class="pa-link" href="#/shop${qs ? '?' + qs : ''}">${esc(T('more', { n: good.length }))} →</a></p>`); }
        } else out.push(`<p>${esc(cat && ctx.vehicle ? T('none_for', { c: catName(cat), v: vehLabel(ctx.vehicle) }) : T('none'))}</p>`);
      }
    }
    if (!out.length) { out.push(`<p>${esc(T('hello'))}</p>`); bot(out.join('')); chips(TX[lang()].chips); }
    else bot(out.join(''));
    updateWa();
  }

  // ---------- optional Claude (through the owner's proxy) ----------
  async function answerAI(q) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(AI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, credentials: 'omit', referrerPolicy: 'strict-origin',
        body: JSON.stringify({ lang: lang(), vehicle: ctx.vehicle || '', messages: ctx.history.slice(-8) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!d || typeof d.reply !== 'string') throw new Error('bad reply');
      if (d.vehicle && ST.veh(d.vehicle)) { ctx.vehicle = d.vehicle; ctx.make = ST.veh(d.vehicle).make; }
      const prods = (Array.isArray(d.products) ? d.products : []).map(ST.prodBy).filter(Boolean).slice(0, 4);
      // escape everything; allow only **bold** and line breaks
      const html = esc(d.reply.slice(0, 2000)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      bot(html + (prods.length ? cards(prods) : '') + `<p class="pa-s">${esc(T('ai_note'))}</p>`);
      ctx.history.push({ role: 'assistant', content: d.reply.slice(0, 1500) });
      updateWa();
      return true;
    } catch (e) { return false; } finally { clearTimeout(timer); }
  }

  async function ask(q) {
    if (busy) return;
    q = String(q).slice(0, MAX_LEN);
    replyLang = /[\u0600-\u06FF]/.test(q) ? 'ar' : /[a-z]{3,}/i.test(q) ? 'en' : null;
    user(q);
    ctx.history.push({ role: 'user', content: q });
    if (ctx.history.length > 16) ctx.history = ctx.history.slice(-16);
    busy = true;
    const tp = typing();
    try {
      let done = false;
      if (AI_URL) done = await (async () => { const ok = await answerAI(q); return ok; })();
      tp.remove();
      if (!done) answerLocal(q);
    } catch (e) { tp.remove(); bot(`<p>${esc(T('err'))}</p>`); }
    busy = false;
  }

  chrome();
  window.PartsAssistant = { ask, open: () => { if (!opened) toggle(); }, ctx };
})();
