/* ============================================================
   4x4 Wheels Oman – WhatsApp Business (Meta Cloud API)
   ------------------------------------------------------------
   Ready for the owner's WhatsApp Business keys (Settings → WhatsApp):
   • bills and order updates are sent from the shop's own number, without
     opening WhatsApp on the device (falls back to WhatsApp when needed);
   • Inbox: customers' WhatsApp messages arrive in the dashboard, new numbers
     become customers, replies are sent from here;
   • marketing campaigns and discounts with approved templates, sent by the
     server to the customers chosen (only those who agreed to receive offers).
   Without the keys everything keeps working as before (opens WhatsApp).
   ============================================================ */
(function () {
  'use strict';
  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS, ROUTES) {
    const { D, t, $, $$, esc, modal, toast, fDT } = H;
    const L = (en, ar) => (I18N.lang === 'ar' ? ar : en);
    const online = () => !!(window.Auth && Auth.mode === 'server');
    if (!online()) return;
    const me = () => Auth.me();
    const isOwner = () => !!me() && Auth.isOwner();
    const canSee = () => !!me() && (isOwner() || Auth.can('whatsapp', 'view'));
    const canCampaign = () => !!me() && (isOwner() || Auth.can('whatsapp', 'edit'));
    const WA = H.WA || icon('whatsapp');
    const digits = (p) => String(p || '').replace(/\D/g, '').replace(/^00/, '');
    const intl = (p) => { const d = digits(p); return d.length === 8 ? '968' + d : d; };
    const custByWa = (wa) => D().customers.find(c => c.phone && intl(c.phone) === wa);

    // ---------- settings from the server ----------
    let cfg = null, cfgAt = 0, cfgP = null;
    const loadCfg = (force) => {
      if (!me()) return Promise.resolve(null);
      if (!force && cfg && Date.now() - cfgAt < 300000) return Promise.resolve(cfg);
      return (cfgP = cfgP || Auth.api('GET', '/api/whatsapp/config').then(c => { cfg = c; cfgAt = Date.now(); return c; }).catch(() => { cfg = { configured: false }; cfgAt = Date.now(); return cfg; }).finally(() => { cfgP = null; }));
    };
    setTimeout(() => loadCfg(), 1500);
    const hookUrl = (c) => (c && c.webhook && /^https:/.test(c.webhook) ? c.webhook : Auth.API + '/api/whatsapp/webhook');

    // ---------- send through the shop's number ----------
    const firstName = (n) => String(n || '').split(/\s+/)[0];
    function billParams(log) {
      const s = log && log.ref && D().sales.find(x => x.no === log.ref);
      if (!s) return null;
      let link = ''; try { link = H.billLink ? H.billLink(s) : ''; } catch (e) { /* no link */ }
      return [firstName(s.customerName) || L('customer', 'عميلنا'), s.no, `${(D().settings.currency || 'OMR')} ${H.fmt(s.total)}`, link];
    }
    function fallbackBox(ph, text, log, direct, reason) {
      modal({
        title: `${WA} ${L('Send with WhatsApp', 'الإرسال عبر واتساب')}`,
        body: `<p>${reason === 'outside_window'
          ? L('This customer has not written to the shop in the last 24 hours, so WhatsApp only allows an approved template. Add an order-update template in Settings → WhatsApp, or send it now from WhatsApp:', 'لم يراسل هذا العميل المتجر خلال آخر 24 ساعة، لذلك يسمح واتساب فقط بقالب معتمد. أضف قالب تحديث الطلب في الإعدادات ← واتساب، أو أرسلها الآن من واتساب:')
          : L('Could not send from the shop’s number. Send it from WhatsApp instead:', 'تعذّر الإرسال من رقم المتجر. أرسلها من واتساب بدلاً من ذلك:')}</p>`,
        footer: `<button class="btn" data-close>${t('cancel')}</button><button class="btn wa" id="fbGo" data-close>${WA}${L('Open WhatsApp', 'فتح واتساب')}</button>`,
        onMount: (el) => { $('#fbGo', el).addEventListener('click', () => direct(ph, text, log)); }
      });
    }
    H.sendWA = function (ph, text, log, direct) {
      // campaigns opened one by one and plain chats stay in WhatsApp; API campaigns use templates (below)
      if (!cfg || !cfg.configured || !digits(ph) || (log && ['campaign', 'direct'].includes(log.type))) return direct(ph, text, log);
      const kind = (log && log.type) || 'message';
      const params = billParams(log);
      toast(L('Sending from the shop’s WhatsApp…', 'جارٍ الإرسال من واتساب المتجر…'));
      Auth.api('POST', '/api/whatsapp/send', { to: ph, text, kind, ref: log && log.ref, template: params ? { params } : undefined })
        .then(r => {
          if (r.sent) { toast('✓ ' + L('Sent on WhatsApp', 'أُرسلت على واتساب')); DB.logWA(Object.assign({ to: ph, text: String(text).slice(0, 400), api: true }, log || {})); }
          else fallbackBox(ph, text, log, direct, r.reason);
        })
        .catch(e => { toast(e.message); fallbackBox(ph, text, log, direct, 'error'); });
      return true;
    };

    // ---------- badge on the WhatsApp page ----------
    const r = ROUTES.find(x => x.id === 'whatsapp');
    if (r) { const b0 = r.badge; r.badge = () => ((Auth.inbox() || {}).waUnread || 0) + (b0 ? b0() : 0); r.tone = r.tone || 'ok'; }

    // ---------- Settings → WhatsApp Business (owner) ----------
    const set = VIEWS.settings;
    if (set) VIEWS.settings = function (v) {
      set(v);
      if (!isOwner()) return;
      const anchor = $('#set-ai', v) || $('#secCard', v); if (!anchor) return;
      anchor.insertAdjacentHTML('afterend', `<div class="card mt" id="set-wa"><div class="card-h"><h3>${WA} ${L('WhatsApp Business', 'واتساب للأعمال')}</h3><span class="pill plain" id="wa_pill">…</span></div><div class="card-b" id="wa_b"><div class="muted">${L('Loading…', 'جارٍ التحميل…')}</div></div></div>`);
      const jump = $('nav.jump', v); if (jump && !$('[data-jump="set-wa"]', jump)) { const a = document.createElement('a'); a.href = '#set-wa'; a.dataset.jump = 'set-wa'; a.textContent = 'WhatsApp'; a.onclick = (e) => { e.preventDefault(); $('#set-wa').scrollIntoView({ behavior: 'smooth' }); }; const ai = $('[data-jump="set-ai"]', jump); if (ai) ai.after(a); else jump.appendChild(a); }
      loadCfg(true).then(c => drawSettings($('#set-wa', v), c));
    };
    function drawSettings(card, c) {
      if (!card) return;
      $('#wa_pill', card).textContent = c.configured ? L('Connected', 'متصل') + (c.displayNumber ? ' · ' + c.displayNumber : '') : L('Not connected', 'غير متصل');
      $('#wa_pill', card).className = 'pill ' + (c.configured ? 's-delivered' : 'plain');
      const b = $('#wa_b', card);
      b.innerHTML = `<p class="muted" style="margin:0 0 10px">${L('Connect the shop’s WhatsApp Business number to send bills and order updates automatically, receive customers’ messages in the Inbox and send campaigns and discounts. Without it, messages open in WhatsApp on this device (as now).', 'اربط رقم واتساب للأعمال الخاص بالمتجر لإرسال الفواتير وتحديثات الطلبات تلقائيًا، واستلام رسائل العملاء في صندوق الوارد، وإرسال الحملات والخصومات. بدونه تُفتح الرسائل في واتساب على هذا الجهاز (كما الآن).')}</p>
        <details class="wa-steps"><summary>${L('How to get these (Meta)', 'كيف تحصل عليها (Meta)')}</summary><ol>
          <li>${L('Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → Create app → type “Business” → add the <b>WhatsApp</b> product, and add the shop’s number (it must not be used in the normal WhatsApp app).', 'اذهب إلى <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> ← إنشاء تطبيق ← نوع "Business" ← أضف منتج <b>WhatsApp</b> وأضف رقم المتجر (يجب ألا يكون مستخدمًا في تطبيق واتساب العادي).')}</li>
          <li>${L('WhatsApp → API Setup: copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.', 'WhatsApp ← API Setup: انسخ <b>Phone number ID</b> و<b>WhatsApp Business Account ID</b>.')}</li>
          <li>${L('Business settings → System users → add a user with the WhatsApp permissions → <b>Generate token</b> (choose “never expires”).', 'إعدادات الأعمال ← System users ← أضف مستخدمًا بصلاحيات واتساب ← <b>Generate token</b> (اختر "لا ينتهي").')}</li>
          <li>${L('App settings → Basic → <b>App secret</b>.', 'إعدادات التطبيق ← Basic ← <b>App secret</b>.')}</li>
          <li>${L('WhatsApp → Configuration → Webhook: paste the address and verify token below, then subscribe to <b>messages</b>.', 'WhatsApp ← Configuration ← Webhook: الصق العنوان ورمز التحقق أدناه، ثم اشترك في <b>messages</b>.')}</li>
          <li>${L('WhatsApp Manager → Message templates: create an order-update template (Utility) with 4 values: {{1}} name, {{2}} order number, {{3}} total, {{4}} bill link — and Marketing templates for offers.', 'WhatsApp Manager ← Message templates: أنشئ قالب تحديث طلب (Utility) بأربع قيم: {{1}} الاسم، {{2}} رقم الطلب، {{3}} الإجمالي، {{4}} رابط الفاتورة — وقوالب تسويقية للعروض.')}</li></ol></details>
        <div class="form-grid mt">
          <div class="field"><label>Phone number ID</label><input class="input" id="wa_pid" dir="ltr" inputmode="numeric" value="${esc(c.phoneId || '')}"></div>
          <div class="field"><label>WhatsApp Business Account ID</label><input class="input" id="wa_waba" dir="ltr" inputmode="numeric" value="${esc(c.wabaId || '')}"></div>
          <div class="field"><label>${L('Access token', 'رمز الوصول (Token)')}</label><input class="input" id="wa_tok" type="password" autocomplete="off" placeholder="${c.hasToken ? '•••••••• ' + L('saved', 'محفوظ') : 'EAA…'}"></div>
          <div class="field"><label>App secret</label><input class="input" id="wa_sec" type="password" autocomplete="off" placeholder="${c.hasAppSecret ? '•••••••• ' + L('saved', 'محفوظ') : ''}"></div>
          <div class="field"><label>${L('Order-update template name', 'اسم قالب تحديث الطلب')}</label><input class="input" id="wa_bt" dir="ltr" value="${esc(c.billTemplate || '')}" placeholder="order_update"></div>
          <div class="field"><label>${L('Template language', 'لغة القالب')}</label><input class="input" id="wa_bl" dir="ltr" value="${esc(c.billLang || 'en')}" placeholder="en / ar"></div>
          <div class="field full"><label>${L('Webhook address (paste in Meta)', 'عنوان Webhook (الصقه في Meta)')}</label><div class="actions"><input class="input" readonly dir="ltr" id="wa_hook" value="${esc(hookUrl(c))}" style="flex:1"><button class="btn sm" data-copy="wa_hook">${L('Copy', 'نسخ')}</button></div></div>
          <div class="field full"><label>${L('Verify token (paste in Meta)', 'رمز التحقق (الصقه في Meta)')}</label><div class="actions"><input class="input" readonly dir="ltr" id="wa_vt" value="${esc(c.verifyToken || '')}" style="flex:1"><button class="btn sm" data-copy="wa_vt">${L('Copy', 'نسخ')}</button></div></div>
        </div>
        <div class="actions mt"><button class="btn primary" id="wa_save">${icon('check')}${L('Save', 'حفظ')}</button>${c.configured ? `<button class="btn" id="wa_test">${WA}${L('Test connection', 'اختبار الاتصال')}</button><button class="btn" id="wa_tpl">${icon('file')}${L('Approved templates', 'القوالب المعتمدة')}</button>` : ''}<span id="wa_msg" class="muted" style="font-size:13px"></span></div>
        <div id="wa_tpls"></div>`;
      const msg = (txt, cls) => { const m = $('#wa_msg', b); m.className = cls || 'muted'; m.textContent = txt; };
      $$('[data-copy]', b).forEach(x => x.onclick = () => { const i = $('#' + x.dataset.copy, b); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => toast(L('Copied', 'تم النسخ'))).catch(() => document.execCommand && document.execCommand('copy')); });
      $('#wa_save', b).onclick = async () => {
        const body = { phoneId: $('#wa_pid', b).value.trim(), wabaId: $('#wa_waba', b).value.trim(), billTemplate: $('#wa_bt', b).value.trim(), billLang: $('#wa_bl', b).value.trim() || 'en' };
        if ($('#wa_tok', b).value.trim()) body.token = $('#wa_tok', b).value.trim();
        if ($('#wa_sec', b).value.trim()) body.appSecret = $('#wa_sec', b).value.trim();
        try {
          msg(L('Saving…', 'جارٍ الحفظ…'));
          await Auth.api('PUT', '/api/whatsapp/config', body);
          const c2 = await loadCfg(true);
          if (c2.configured) { try { const r = await Auth.api('POST', '/api/whatsapp/test', {}); toast('✓ ' + L('WhatsApp connected', 'تم ربط واتساب') + (r.number ? ' · ' + r.number : '')); } catch (e) { toast(e.message); } }
          drawSettings(card, await loadCfg(true));
        } catch (e) { msg(e.message, 'bad-t'); }
      };
      if ($('#wa_test', b)) $('#wa_test', b).onclick = async () => { msg(L('Testing…', 'جارٍ الاختبار…')); try { const r = await Auth.api('POST', '/api/whatsapp/test', {}); msg(`✓ ${r.name || ''} ${r.number || ''}${r.quality ? ' · ' + r.quality : ''}`, 'ok-t'); } catch (e) { msg(e.message, 'bad-t'); } };
      if ($('#wa_tpl', b)) $('#wa_tpl', b).onclick = async () => {
        const box = $('#wa_tpls', b); box.innerHTML = `<div class="muted mt">${L('Loading…', 'جارٍ التحميل…')}</div>`;
        try { const r = await Auth.api('GET', '/api/whatsapp/templates'); box.innerHTML = r.items.length ? `<div class="table-wrap mt"><table class="t"><thead><tr><th>${L('Name', 'الاسم')}</th><th>${L('Type', 'النوع')}</th><th>${L('Language', 'اللغة')}</th><th>${L('Status', 'الحالة')}</th><th>${L('Text', 'النص')}</th></tr></thead><tbody>${r.items.map(x => `<tr><td dir="ltr" class="strong">${esc(x.name)}</td><td>${esc(x.category)}</td><td>${esc(x.language)}</td><td><span class="pill ${x.status === 'APPROVED' ? 's-delivered' : 'plain'}">${esc(x.status)}</span></td><td class="muted" style="max-width:360px">${esc(x.body)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted mt">${L('No templates yet — create them in WhatsApp Manager.', 'لا توجد قوالب بعد — أنشئها في WhatsApp Manager.')}</p>`; }
        catch (e) { box.innerHTML = `<p class="bad-t mt">${esc(e.message)}</p>`; }
      };
    }

    // ---------- WhatsApp page: Inbox + campaigns sent by the server ----------
    let inbox = false, sel = null, pollT = null;
    const base = VIEWS.whatsapp;
    if (base) VIEWS.whatsapp = function (v) {
      base(v);
      if (!canSee()) return;
      const tabs = $('#watabs', v);
      if (tabs) {
        const n = (Auth.inbox() || {}).waUnread || 0;
        tabs.insertAdjacentHTML('afterbegin', `<button data-k="inbox" id="wa_inboxTab">${L('Inbox', 'الوارد')}${n ? ` <span class="badge ok" style="position:static">${n}</span>` : ''}</button>`);
        tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.id !== 'wa_inboxTab') inbox = false; }, true);
        $('#wa_inboxTab', tabs).onclick = () => { inbox = true; H.render(); };
        if (inbox) { $$('button', tabs).forEach(b => b.classList.toggle('on', b.id === 'wa_inboxTab')); drawInbox($('#wabody', v)); }
        else clearInterval(pollT);
      }
      const acts = $('.page-head .actions', v);
      if (acts && canCampaign()) {
        acts.insertAdjacentHTML('afterbegin', `<button class="btn" id="wa_api">${icon('send')}${L('Send offer from shop number', 'إرسال عرض من رقم المتجر')}</button>`);
        $('#wa_api', acts).onclick = () => loadCfg().then(c => (c && c.configured ? apiCampaign() : toast(isOwner() ? L('Connect WhatsApp Business first: Settings → WhatsApp.', 'اربط واتساب للأعمال أولاً: الإعدادات ← واتساب.') : L('The owner has not connected WhatsApp Business yet.', 'لم يربط المالك واتساب للأعمال بعد.'))));
      }
    };

    async function drawInbox(body) {
      clearInterval(pollT);
      const c = await loadCfg();
      if (!c || !c.configured) {
        body.innerHTML = `<div class="card"><div class="empty">${icon('whatsapp', 'big')}<p>${isOwner() ? L('Connect WhatsApp Business to receive customers’ messages here.', 'اربط واتساب للأعمال لاستلام رسائل العملاء هنا.') : L('The owner has not connected WhatsApp Business yet.', 'لم يربط المالك واتساب للأعمال بعد.')}</p>${isOwner() ? `<a class="btn primary" href="#/settings">${L('Settings → WhatsApp', 'الإعدادات ← واتساب')}</a>` : ''}</div></div>`;
        return;
      }
      body.innerHTML = `<div class="card wa-inbox"><div class="wa-convs" id="wa_convs"><div class="muted" style="padding:14px">${L('Loading…', 'جارٍ التحميل…')}</div></div><div class="wa-thread" id="wa_thread"><div class="empty">${L('Choose a conversation', 'اختر محادثة')}</div></div></div>`;
      const convs = $('#wa_convs', body), thread = $('#wa_thread', body);
      body.querySelector('.wa-inbox').classList.toggle('has-sel', !!sel);
      const loadConvs = async () => {
        if (!document.body.contains(convs)) { clearInterval(pollT); return; }
        try {
          const r = await Auth.api('GET', '/api/whatsapp/conversations');
          convs.innerHTML = r.items.length ? r.items.map(x => { const cu = custByWa(x.wa); return `<button class="wa-conv ${x.wa === sel ? 'on' : ''}" data-wa="${esc(x.wa)}"><b>${esc((cu && cu.name) || x.name || '+' + x.wa)}</b>${x.unread ? `<span class="badge ok" style="position:static">${x.unread}</span>` : ''}<small>${x.direction === 'out' ? '↪ ' : ''}${esc(String(x.last || '').slice(0, 70))}</small><em>${fDT(x.at)}</em></button>`; }).join('') : `<div class="empty" style="padding:18px">${L('No messages yet. When customers write to the shop’s WhatsApp they appear here.', 'لا رسائل بعد. عندما يراسل العملاء واتساب المتجر تظهر هنا.')}</div>`;
          $$('[data-wa]', convs).forEach(b => b.onclick = () => { sel = b.dataset.wa; $$('.wa-conv', convs).forEach(x => x.classList.toggle('on', x === b)); body.querySelector('.wa-inbox').classList.add('has-sel'); loadThread(); });
        } catch (e) { convs.innerHTML = `<div class="bad-t" style="padding:14px">${esc(e.message)}</div>`; }
      };
      let tpls = null;
      const loadThread = async (keep) => {
        if (!sel) return;
        const wa = sel, cu = custByWa(wa);
        try {
          const r = await Auth.api('GET', '/api/whatsapp/messages?wa=' + encodeURIComponent(wa));
          if (wa !== sel || !document.body.contains(thread)) return;
          const draft = keep && $('#wa_txt', thread) ? $('#wa_txt', thread).value : '';
          thread.innerHTML = `<div class="wa-th-h"><button class="btn sm ghost wa-back" id="wa_back">←</button><div class="grow"><b>${esc((cu && cu.name) || '+' + wa)}</b><div class="faint" dir="ltr" style="font-size:12px">+${esc(wa)}${cu ? '' : ' · ' + L('new customer', 'عميل جديد')}</div></div>
              <span class="pill ${r.open ? 's-delivered' : 'plain'}" title="${esc(L('WhatsApp allows free replies for 24 hours after the customer’s last message', 'يسمح واتساب بالرد الحر لمدة 24 ساعة بعد آخر رسالة من العميل'))}">${r.open ? L('Can reply', 'يمكن الرد') : L('Template only', 'قالب فقط')}</span>
              ${cu && Auth.can('pos', 'edit') ? `<a class="btn sm" href="#/pos">${icon('pos')}${L('Sell', 'بيع')}</a>` : ''}</div>
            <div class="wa-msgs" id="wa_msgs">${r.items.map(m => `<div class="wa-m ${m.direction}"><div>${esc(m.body)}</div><small>${fDT(m.at)}${m.direction === 'out' ? ' · ' + esc(m.status === 'failed' ? '⚠️ ' + (m.error || 'failed') : m.status || '') : ''}</small></div>`).join('') || `<div class="empty">${L('No messages', 'لا رسائل')}</div>`}</div>
            ${r.open ? `<form class="wa-reply" id="wa_form"><textarea class="input" id="wa_txt" rows="2" placeholder="${esc(L('Write a reply…', 'اكتب ردًا…'))}"></textarea><button class="btn wa" type="submit">${icon('send')}</button></form>`
              : `<div class="wa-reply col"><p class="faint" style="margin:0 0 6px;font-size:12.5px">${L('More than 24 hours since the customer wrote: send an approved template.', 'مرّ أكثر من 24 ساعة على آخر رسالة من العميل: أرسل قالبًا معتمدًا.')}</p><div class="actions"><select class="input" id="wa_tsel" style="flex:1"><option value="">${L('Loading templates…', 'جارٍ تحميل القوالب…')}</option></select><button class="btn wa" id="wa_tgo">${icon('send')}</button></div><div id="wa_tpar" class="form-grid mt"></div></div>`}`;
          if (draft && $('#wa_txt', thread)) $('#wa_txt', thread).value = draft;
          const ms = $('#wa_msgs', thread); ms.scrollTop = ms.scrollHeight;
          $('#wa_back', thread).onclick = () => { sel = null; body.querySelector('.wa-inbox').classList.remove('has-sel'); };
          if (r.items.some(m => m.direction === 'in')) Auth.api('POST', '/api/whatsapp/read', { wa }).then(() => { Auth.refresh && Auth.refresh(); }).catch(() => {});
          if ($('#wa_form', thread)) {
            const send = async () => {
              const txt = $('#wa_txt', thread).value.trim(); if (!txt) return;
              try { const x = await Auth.api('POST', '/api/whatsapp/send', { to: wa, text: txt, kind: 'reply', name: cu && cu.name }); if (x.sent) { $('#wa_txt', thread).value = ''; loadThread(); } else toast(L('The 24-hour window has closed — use a template.', 'انتهت نافذة الـ24 ساعة — استخدم قالبًا.')); }
              catch (e) { toast(e.message); }
            };
            $('#wa_form', thread).onsubmit = (e) => { e.preventDefault(); send(); };
            $('#wa_txt', thread).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
          } else {
            tpls = tpls || (await Auth.api('GET', '/api/whatsapp/templates').catch(() => ({ items: [] }))).items.filter(x => x.status === 'APPROVED');
            const s = $('#wa_tsel', thread); if (!s) return;
            s.innerHTML = tpls.length ? tpls.map((x, i) => `<option value="${i}">${esc(x.name)} (${esc(x.language)})</option>`).join('') : `<option value="">${L('No approved templates', 'لا توجد قوالب معتمدة')}</option>`;
            const params = () => { const x = tpls[+s.value]; $('#wa_tpar', thread).innerHTML = x ? `<p class="faint full" style="margin:0;font-size:12.5px">${esc(x.body)}</p>` + x.params.map((p, i) => `<div class="field"><label>${esc(p)}</label><input class="input" data-tp="${i}" value="${i === 0 && cu ? esc(firstName(cu.name)) : ''}"></div>`).join('') : ''; };
            s.onchange = params; params();
            $('#wa_tgo', thread).onclick = async () => {
              const x = tpls[+s.value]; if (!x) return;
              try { await Auth.api('POST', '/api/whatsapp/send', { to: wa, kind: 'reply', name: cu && cu.name, template: { name: x.name, lang: x.language, params: $$('[data-tp]', thread).map(i => i.value) } }); loadThread(); }
              catch (e) { toast(e.message); }
            };
          }
        } catch (e) { thread.innerHTML = `<div class="bad-t" style="padding:14px">${esc(e.message)}</div>`; }
      };
      await loadConvs(); if (sel) loadThread();
      pollT = setInterval(() => { if (document.hidden) return; loadConvs(); if (sel && !($('#wa_txt', thread) && $('#wa_txt', thread).value)) loadThread(true); }, 15000);
    }

    // campaign sent by the server with an approved Marketing template
    function apiCampaign() {
      const cs = D().customers;
      const uniq = (f) => [...new Set(cs.map(f).filter(Boolean))].sort();
      const AUD = [['all', L('All customers who agreed to offers', 'كل العملاء الموافقين على العروض')], ['vehicle', L('By vehicle', 'حسب المركبة')], ['gov', L('By governorate', 'حسب المحافظة')], ['cat', L('Bought from a category', 'اشتروا من فئة')], ['workshop', L('Workshops', 'الورش')], ['inactive', L('Not bought for 60+ days', 'لم يشتروا منذ 60+ يومًا')]];
      modal({
        title: `${WA} ${L('Offer from the shop’s number', 'عرض من رقم المتجر')}`, wide: true,
        body: `<div class="form-grid">
            <div class="field"><label>${L('Campaign name', 'اسم الحملة')}</label><input class="input" id="ac_n" placeholder="${esc(L('e.g. Eid discount on lights', 'مثال: خصم العيد على الإضاءة'))}"></div>
            <div class="field"><label>${L('Approved template', 'القالب المعتمد')}</label><select class="input" id="ac_t"><option>${L('Loading…', 'جارٍ التحميل…')}</option></select></div>
            <div class="field"><label>${L('Customers', 'العملاء')}</label><select class="input" id="ac_a">${AUD.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
            <div class="field"><label>&nbsp;</label><select class="input hide" id="ac_v"></select></div>
            <div class="full" id="ac_tb"></div><div id="ac_par" class="form-grid full"></div>
            <div class="full notice" id="ac_cnt"></div>
          </div><div id="ac_prog"></div>`,
        footer: `<button class="btn" data-close>${t('close')}</button><button class="btn wa" id="ac_go" disabled>${WA}${L('Send now', 'أرسل الآن')}</button>`,
        onMount: async (el) => {
          const a = $('#ac_a', el), v = $('#ac_v', el), ts = $('#ac_t', el);
          const opts = { vehicle: uniq(c => c.vehicle).map(x => [x, x]), gov: uniq(c => c.city).map(x => [x, x]), cat: D().categories.map(c => [c.id, H.catName(c.id)]) };
          let tpls = [];
          const list = () => (H.waAudience ? H.waAudience(a.value, v.value) : cs.filter(c => c.optIn !== false && c.phone));
          const upd = () => {
            const o = opts[a.value]; v.classList.toggle('hide', !o);
            if (o && v.dataset.k !== a.value) { v.innerHTML = o.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join(''); v.dataset.k = a.value; }
            const x = tpls[+ts.value];
            $('#ac_tb', el).innerHTML = x ? `<p class="faint" style="margin:0;font-size:13px;white-space:pre-wrap">${esc(x.body)}</p>` : '';
            const n = list().length;
            $('#ac_cnt', el).innerHTML = `${icon('users')}<div><b>${n}</b> ${L('customers will receive it', 'عميل سيستلمها')} · ${L('only customers who agreed to receive offers; customers can reply STOP to stop.', 'فقط العملاء الموافقون على العروض؛ ويمكنهم الرد بـ STOP للإيقاف.')}</div>`;
            $('#ac_go', el).disabled = !x || !n;
          };
          const drawPar = () => { const x = tpls[+ts.value]; $('#ac_par', el).innerHTML = x ? x.params.map((p, i) => `<div class="field"><label>${esc(p)}</label><input class="input" data-ap="${i}" value="${i === 0 ? '{name}' : ''}" placeholder="${i === 0 ? '{name}' : ''}"></div>`).join('') + (x.params.length ? `<p class="faint full" style="margin:0;font-size:12px">${L('{name} = the customer’s first name', '{name} = الاسم الأول للعميل')}</p>` : '') : ''; upd(); };
          a.onchange = upd; v.onchange = upd; ts.onchange = drawPar;
          try { tpls = (await Auth.api('GET', '/api/whatsapp/templates')).items.filter(x => x.status === 'APPROVED'); } catch (e) { toast(e.message); }
          const mk = tpls.filter(x => x.category === 'MARKETING'); const order = mk.concat(tpls.filter(x => x.category !== 'MARKETING')); tpls = order;
          ts.innerHTML = tpls.length ? tpls.map((x, i) => `<option value="${i}">${esc(x.name)} · ${esc(x.category)} · ${esc(x.language)}</option>`).join('') : `<option value="">${L('No approved templates — create a Marketing template in WhatsApp Manager', 'لا قوالب معتمدة — أنشئ قالبًا تسويقيًا في WhatsApp Manager')}</option>`;
          drawPar();
          $('#ac_go', el).onclick = async () => {
            const x = tpls[+ts.value]; const rec = list(); if (!x || !rec.length) return;
            const pv = $$('[data-ap]', el).map(i => i.value);
            const name = $('#ac_n', el).value.trim() || x.name;
            $('#ac_go', el).disabled = true;
            try {
              const st = await Auth.api('POST', '/api/whatsapp/campaign', { name, template: { name: x.name, lang: x.language }, recipients: rec.map(c => ({ to: c.phone, name: c.name, params: pv.map(p => p.replace(/\{name\}/g, firstName(c.name))) })) });
              D().campaigns.push({ id: DB.uid('cp'), name, date: Date.now(), audienceLabel: a.selectedOptions[0].textContent + (v.classList.contains('hide') ? '' : ': ' + v.selectedOptions[0].textContent), message: `[${x.name}] ${x.body}`, productIds: [], api: true, recipients: rec.map(c => ({ cid: c.id, sent: true, at: Date.now(), text: '' })) }); DB.save();
              const prog = $('#ac_prog', el);
              const tick = async () => {
                const s = await Auth.api('GET', '/api/whatsapp/campaign/' + st.id).catch(() => ({ done: true }));
                if (!document.body.contains(prog)) return;
                const doneN = (s.sent || 0) + (s.failed || 0) + (s.skipped || 0);
                prog.innerHTML = `<div class="bar mt" style="height:10px"><span style="width:${doneN / Math.max(1, st.total) * 100}%;background:#25d366"></span></div><p class="muted" style="margin:6px 0 0">${L('Sent', 'أُرسلت')} ${s.sent || 0} · ${L('failed', 'فشلت')} ${s.failed || 0} · ${L('skipped (no consent)', 'تم تخطيها (بدون موافقة)')} ${s.skipped || 0} / ${st.total}${s.done ? ' — ' + L('finished ✓', 'انتهت ✓') : ''}</p>${(s.errors || []).length ? `<p class="bad-t" style="font-size:12.5px">${esc(s.errors[0])}</p>` : ''}`;
                if (!s.done) setTimeout(tick, 2000);
              };
              tick();
            } catch (e) { toast(e.message); $('#ac_go', el).disabled = false; }
          };
        }
      });
    }
    H.waCampaignAPI = apiCampaign;
  });
})();
