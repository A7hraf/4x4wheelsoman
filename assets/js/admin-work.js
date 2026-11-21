/* ============================================================
   4x4 Wheels Oman – everyday work for the team
   ------------------------------------------------------------
   • Notification bell: new orders, orders and tasks given to you, reminders,
     approvals, supplier changes, WhatsApp messages (optionally as phone/PC alerts).
   • "My work" home screen for employees: their own numbers, tasks, orders given to
     them, new orders waiting — never the owner's overall sales and profit.
   • Tasks: the owner (or a manager) gives tasks with a due time; everyone can keep
     their own to-dos. Orders can be given to an employee.
   ============================================================ */
(function () {
  'use strict';
  I18N.add('en', { my_work: 'My work', tasks: 'Tasks', notifications: 'Notifications' });
  I18N.add('ar', { my_work: 'عملي', tasks: 'المهام', notifications: 'الإشعارات' });

  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS, ROUTES) {
    const { D, t, $, $$, esc, fmt, money, moneyTxt, modal, toast, fDate, fDT, kpi, statusPill, chart, cssVar, state } = H;
    const L = (en, ar) => (I18N.lang === 'ar' ? ar : en);
    const online = () => !!(window.Auth && Auth.mode === 'server');
    if (!online()) return; // team features need the shared online data
    const me = () => Auth.me();
    const isOwner = () => Auth.isOwner();
    const can = (m, l) => Auth.can(m, l || 'view');
    const canAssign = () => isOwner() || can('team', 'edit');
    const first = (n) => String(n || '').split(/\s+/)[0];
    const ago = (ts) => { const s = (Date.now() - ts) / 1000; if (s < 60) return L('just now', 'الآن'); if (s < 3600) return Math.round(s / 60) + L(' min', ' د'); if (s < 86400) return Math.round(s / 3600) + L(' h', ' س'); return fDate(ts); };
    const routeIs = (id) => (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'dashboard') === id;

    // small cache for server calls (re-renders when the answer arrives)
    const cache = {};
    function load(key, fn, maxAge) {
      const c = cache[key];
      if (c && !c.loading && Date.now() - c.at < (maxAge == null ? 60000 : maxAge)) return c;
      if (!c || !c.loading) {
        const route = location.hash; cache[key] = Object.assign(c || {}, { loading: true });
        fn().then(d => { cache[key] = { at: Date.now(), data: d }; }, e => { cache[key] = { at: Date.now(), err: e.message }; })
          .then(() => { if (location.hash === route && !document.querySelector('.overlay')) H.render(); });
      }
      return cache[key];
    }
    // the employee list is only for people who give work to others (same rule as the server)
    const mayList = () => isOwner() || ['orders', 'pos', 'quotes', 'team'].some(m => can(m, 'edit')) || can('team');
    const users = () => (mayList() ? load('brief', () => Auth.api('GET', '/api/users/brief'), 300000) : { data: null });
    const userName = (id) => { const u = ((users().data || {}).users || []).find(x => x.id === id); return u ? u.name : ''; };

    // =====================================================
    // NOTIFICATION BELL
    // =====================================================
    const KIND_IC = { order: 'orders', assigned: 'orders', task: 'check', task_done: 'check', reminder: 'clock', approval: 'inbox', approved: 'check', rejected: 'x', supplier: 'factory', whatsapp: 'whatsapp', info: 'bell' };
    let bell = $('#bellBtn'), panel = $('#notePanel');
    if (!bell) {
      bell = document.createElement('button'); bell.className = 'icon-btn bell-btn'; bell.id = 'bellBtn'; bell.type = 'button'; bell.setAttribute('aria-label', t('notifications'));
      $('#lockBtn').before(bell);
      panel = document.createElement('div'); panel.className = 'note-panel hide'; panel.id = 'notePanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', t('notifications'));
      document.body.appendChild(panel);
    }
    const drawBell = () => { const n = Auth.inbox().notes || 0; bell.innerHTML = icon('bell') + (n ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : ''); bell.title = n ? `${n} ${L('new', 'جديد')}` : t('notifications'); };
    drawBell();
    const deviceAlerts = () => { try { return localStorage.getItem('x4w_alerts') === '1' && 'Notification' in window && Notification.permission === 'granted'; } catch (e) { return false; } };
    async function openPanel() {
      panel.classList.remove('hide');
      panel.innerHTML = `<div class="np-h"><b>${t('notifications')}</b><button class="btn sm ghost" id="npAll">${L('Mark all read', 'تحديد الكل كمقروء')}</button></div><div class="np-list"><div class="empty"><span class="typing"><i></i><i></i><i></i></span></div></div>
        <div class="np-f">${'Notification' in window ? `<label class="check"><input type="checkbox" id="npDev" ${deviceAlerts() ? 'checked' : ''}> ${L('Alerts on this device (when the dashboard is open in the background)', 'تنبيهات على هذا الجهاز (عندما تكون اللوحة مفتوحة بالخلفية)')}</label>` : ''}</div>`;
      $('#npAll', panel).onclick = async () => { await Auth.api('POST', '/api/notifications/read', { all: true }); Auth.inbox().notes = 0; drawBell(); openPanel(); };
      if ($('#npDev', panel)) $('#npDev', panel).onchange = async (e) => {
        if (e.target.checked) { const p = await Notification.requestPermission(); if (p !== 'granted') { e.target.checked = false; toast(L('Alerts are blocked in this browser\'s settings.', 'التنبيهات محظورة في إعدادات المتصفح.')); return; } }
        try { localStorage.setItem('x4w_alerts', e.target.checked ? '1' : '0'); } catch (er) { }
      };
      try {
        const r = await Auth.api('GET', '/api/notifications?limit=40');
        $('.np-list', panel).innerHTML = r.items.length ? r.items.map(n => `<a class="np-item ${n.read ? '' : 'unread'}" href="${esc(n.link || '#/dashboard')}" data-id="${n.id}"><span class="np-ic">${icon(KIND_IC[n.kind] || 'bell')}</span><span class="grow"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<em>${ago(n.at)}</em></span></a>`).join('') : `<div class="empty">${L('Nothing yet.', 'لا شيء بعد.')}</div>`;
        $$('.np-item', panel).forEach(a => a.onclick = () => { closePanel(); if (a.classList.contains('unread')) Auth.api('POST', '/api/notifications/read', { ids: [a.dataset.id] }).then(() => { Auth.inbox().notes = Math.max(0, (Auth.inbox().notes || 1) - 1); drawBell(); }).catch(() => { }); });
      } catch (e) { $('.np-list', panel).innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }
    const closePanel = () => panel.classList.add('hide');
    bell.onclick = (e) => { e.stopPropagation(); if (panel.classList.contains('hide')) openPanel(); else closePanel(); };
    document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== bell) closePanel(); });
    window.addEventListener('x4w:inbox', drawBell);
    // something new for this person: a short message, and an alert on the device when the page is in the background
    window.addEventListener('x4w:notes', async () => {
      drawBell();
      try {
        const r = await Auth.api('GET', '/api/notifications?limit=3');
        const n = r.items.find(x => !x.read); if (!n) return;
        if (document.hidden && deviceAlerts()) { const a = new Notification(n.title, { body: n.body || '', tag: 'x4w-' + n.id, icon: 'assets/img/site/logo-mark.png' }); a.onclick = () => { window.focus(); location.hash = n.link || '#/dashboard'; a.close(); }; }
        else toast(n.title);
        if (['task', 'assigned', 'order', 'reminder'].includes(n.kind) && routeIs('dashboard')) H.render();
      } catch (e) { }
    });

    // =====================================================
    // TASKS
    // =====================================================
    const openTasks = (uid) => D().tasks.filter(x => !x.done && (!uid || x.assignedTo === uid)).sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
    const dueTxt = (x) => { if (!x.due) return ''; const late = x.due < Date.now() && !x.done; return `<span class="pill ${late ? 's-cancelled' : x.due - Date.now() < 86400000 ? 's-new' : 'plain'}">${late ? L('Overdue', 'متأخرة') + ' · ' : ''}${fDT(x.due)}</span>`; };
    function taskRow(x, opts) {
      return `<li class="task ${x.done ? 'done' : ''}"><label class="tk"><input type="checkbox" data-done="${x.id}" ${x.done ? 'checked' : ''} ${x.assignedTo === me().id || canAssign() ? '' : 'disabled'} aria-label="${esc(L('Done', 'تم'))}"></label>
        <div class="grow"><b>${esc(x.title)}</b>${x.notes ? `<div class="faint">${esc(x.notes)}</div>` : ''}<div class="task-meta">${dueTxt(x)}${opts && opts.who ? `<span class="pill plain">${icon('users')} ${esc(x.assignedName || userName(x.assignedTo) || '—')}</span>` : ''}${x.createdBy && x.createdBy !== x.assignedTo ? `<span class="faint">${L('from', 'من')} ${esc(x.createdByName || '')}</span>` : ''}${x.link ? `<a href="${esc(x.link)}">${L('Open', 'فتح')} →</a>` : ''}</div></div>
        ${canAssign() || x.createdBy === me().id ? `<button class="btn sm ghost" data-edit-task="${x.id}" aria-label="${esc(L('Edit', 'تعديل'))}">${icon('edit')}</button>` : ''}</li>`;
    }
    function bindTasks(root) {
      $$('[data-done]', root).forEach(c => c.onchange = () => { const x = D().tasks.find(y => y.id === c.dataset.done); if (!x) return; x.done = c.checked; x.doneAt = c.checked ? Date.now() : null; DB.save(); toast(c.checked ? L('Done ✓', 'تم ✓') : t('saved')); H.render(); });
      $$('[data-edit-task]', root).forEach(b => b.onclick = () => taskModal(D().tasks.find(y => y.id === b.dataset.editTask)));
    }
    function taskModal(x, preset) {
      const isNew = !x; x = x || Object.assign({ title: '', notes: '', assignedTo: me().id, due: null, link: '' }, preset || {});
      const list = ((users().data || {}).users || []);
      const local = (ts) => { if (!ts) return ''; const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
      modal({
        title: isNew ? L('New task', 'مهمة جديدة') : L('Task', 'مهمة'),
        body: `<div class="form-grid"><div class="field full"><label>${L('What needs doing', 'المطلوب')}</label><input class="input" id="tk_t" value="${esc(x.title)}" maxlength="140"></div>
          <div class="field full"><label>${L('Details (optional)', 'تفاصيل (اختياري)')}</label><textarea class="input" id="tk_n" rows="2">${esc(x.notes || '')}</textarea></div>
          <div class="field"><label>${L('For', 'لـ')}</label><select class="input" id="tk_a" ${canAssign() ? '' : 'disabled'}>${(canAssign() && list.length ? list : [{ id: me().id, name: me().name }]).map(u => `<option value="${u.id}" ${u.id === x.assignedTo ? 'selected' : ''}>${esc(u.name)}${u.id === me().id ? ' (' + L('me', 'أنا') + ')' : ''}</option>`).join('')}</select></div>
          <div class="field"><label>${L('Due (reminder 1 hour before)', 'الموعد (تذكير قبل ساعة)')}</label><input class="input" id="tk_d" type="datetime-local" value="${local(x.due)}"></div></div>`,
        footer: `${!isNew && (canAssign() || x.createdBy === me().id) ? `<button class="btn ghost danger" id="tk_del" style="margin-inline-end:auto">${t('delete')}</button>` : ''}<button class="btn" data-close>${t('cancel')}</button><button class="btn primary" id="tk_s">${icon('check')}${t('save')}</button>`,
        onMount: (el, m) => {
          $('#tk_t', el).focus();
          if ($('#tk_del', el)) $('#tk_del', el).onclick = () => { D().tasks = D().tasks.filter(y => y.id !== x.id); DB.save(); m.close(); H.render(); };
          $('#tk_s', el).onclick = () => {
            const title = $('#tk_t', el).value.trim(); if (!title) return $('#tk_t', el).focus();
            const due = $('#tk_d', el).value ? new Date($('#tk_d', el).value).getTime() : null;
            const to = $('#tk_a', el).value || me().id;
            const data = { title, notes: $('#tk_n', el).value.trim(), assignedTo: to, assignedName: (list.find(u => u.id === to) || { name: to === me().id ? me().name : '' }).name, due };
            if (isNew) D().tasks.push(Object.assign({ id: DB.uid('tk'), done: false, createdBy: me().id, createdByName: me().name, created: Date.now(), link: x.link || '' }, data));
            else { const live = D().tasks.find(y => y.id === x.id); Object.assign(live, data); if (live.due !== x.due) delete live.remindedAt; }
            DB.save(); m.close(); toast(t('saved')); H.render();
          };
        }
      });
    }
    H.taskModal = taskModal;
    // Team → Tasks (owner / managers): everyone's open and finished tasks
    H.renderTeamTasks = function (body) {
      const all = D().tasks.slice().sort((a, b) => (a.done - b.done) || (a.due || 9e15) - (b.due || 9e15));
      const open = all.filter(x => !x.done), done = all.filter(x => x.done).slice(0, 30);
      body.innerHTML = `<div class="actions" style="margin-bottom:12px">${canAssign() ? `<button class="btn primary" id="tkNew">${icon('plus')}${L('Give a task', 'إسناد مهمة')}</button>` : ''}</div>
        <div class="grid g-2"><div class="card"><div class="card-h"><h3>${L('Open', 'مفتوحة')} <span class="count">${open.length}</span></h3></div><div class="card-b">${open.length ? `<ul class="tasks">${open.map(x => taskRow(x, { who: true })).join('')}</ul>` : `<div class="empty">${L('No open tasks.', 'لا توجد مهام مفتوحة.')}</div>`}</div></div>
        <div class="card"><div class="card-h"><h3>${L('Finished', 'منجزة')}</h3></div><div class="card-b">${done.length ? `<ul class="tasks">${done.map(x => taskRow(x, { who: true })).join('')}</ul>` : `<div class="empty">—</div>`}</div></div></div>`;
      if ($('#tkNew', body)) $('#tkNew', body).onclick = () => taskModal(null, { assignedTo: '' });
      bindTasks(body);
    };

    // =====================================================
    // ORDERS: who handles an order
    // =====================================================
    const prevPeople = H.orderPeople;
    H.orderPeople = (s) => {
      let html = prevPeople ? prevPeople(s) : '';
      if (s.channel !== 'shop' || s.assignedTo) {
        const list = ((users().data || {}).users || []);
        if (can('orders', 'edit') && list.length) html += `<div class="field mt assign-f"><label>${icon('users')} ${L('Handled by', 'المسؤول')}</label><select class="input" data-assign-sale="${s.id}"><option value="">${L('Nobody yet', 'لا أحد بعد')}</option>${list.map(u => `<option value="${u.id}" ${u.id === s.assignedTo ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>`;
        else if (s.assignedTo) html += `<p class="faint people-line">${icon('users')} ${L('Handled by', 'المسؤول')} <b>${esc(s.assignedName || userName(s.assignedTo))}</b></p>`;
      }
      return html;
    };
    document.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-assign-sale]'); if (!sel) return;
      const s = D().sales.find(x => x.id === sel.dataset.assignSale); if (!s) return;
      s.assignedTo = sel.value || null; s.assignedName = sel.value ? sel.selectedOptions[0].textContent : ''; DB.save(); toast(t('saved'));
    });
    users(); // load the names early (for the order window)

    // =====================================================
    // MY WORK (employees' home screen)
    // =====================================================
    const ownerDash = VIEWS.dashboard;
    if (!isOwner()) { I18N.add('en', { dashboard: 'My work' }); I18N.add('ar', { dashboard: 'عملي' }); }
    VIEWS.dashboard = function (v) {
      if (isOwner()) return ownerDash(v);
      const tab = can('dashboard') ? (state.homeTab || 'me') : 'me';
      if (tab === 'shop') { ownerDash(v); v.insertAdjacentHTML('afterbegin', homeSeg(tab)); bindSeg(v); return; }
      myWork(v, tab);
    };
    const homeSeg = (tab) => can('dashboard') ? `<div class="seg" id="homeSeg" style="margin-bottom:12px"><button data-k="me" class="${tab === 'me' ? 'on' : ''}">${t('my_work')}</button><button data-k="shop" class="${tab === 'shop' ? 'on' : ''}">${L('Shop overview', 'نظرة على المتجر')}</button></div>` : '';
    const bindSeg = (v) => { const s = $('#homeSeg', v); if (s) H.bindSeg('homeSeg', k => { state.homeTab = k; H.render(); }); };
    function myWork(v) {
      const u = me(); const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const mine = D().sales.filter(s => s.createdBy === u.id && DB.countsAsRevenue(s));
      const today = mine.filter(s => s.date >= d0.getTime());
      const st = load('mestats', () => Auth.api('GET', '/api/me/stats?days=30'));
      const ms = (st.data && st.data.me) || {};
      const tasks = openTasks(u.id);
      const late = tasks.filter(x => x.due && x.due < Date.now());
      const assigned = D().sales.filter(s => s.assignedTo === u.id && !['completed', 'delivered', 'cancelled', 'refunded'].includes(s.status)).sort((a, b) => a.date - b.date);
      const waiting = can('orders') ? D().sales.filter(s => s.channel !== 'shop' && s.status === 'new' && !s.assignedTo) : [];
      const low = can('inventory') ? D().products.filter(p => p.active !== false && (p.reorder || 0) > 0 && p.stock <= p.reorder) : [];
      const notes = load('home-notes', () => Auth.api('GET', '/api/notifications?limit=6'), 30000);
      const hr = new Date().getHours();
      v.innerHTML = `${homeSeg('me')}
        <div class="page-head"><div><h2 style="display:block">${hr < 12 ? L('Good morning', 'صباح الخير') : L('Hello', 'مرحباً')}, ${esc(first(u.name))}</h2><p>${new Date().toLocaleDateString(I18N.lang === 'ar' ? 'ar-OM' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${tasks.length ? ' · ' + L(`${tasks.length} open task${tasks.length > 1 ? 's' : ''}`, `${tasks.length} مهام مفتوحة`) : ''}</p></div>
          <div class="actions">${can('pos', 'request') ? `<a class="btn primary" href="#/pos">${icon('pos')}${L('New sale', 'بيع جديد')}</a>` : ''}${can('quotes', 'request') ? `<a class="btn" href="#/quotes">${icon('file')}${L('New quote', 'عرض سعر')}</a>` : ''}<button class="btn" id="mwTask">${icon('plus')}${L('To-do', 'مهمة')}</button></div></div>
        <div class="grid g-kpi">
          ${kpi('pos', 'tone-brand', L('My sales today', 'مبيعاتي اليوم'), H.big(today.reduce((a, s) => a + (s.total || 0), 0)), `<span>${today.length} ${L('sales', 'عمليات')}</span>`)}
          ${kpi('trend', 'tone-ok', L('My sales · 30 days', 'مبيعاتي · 30 يوماً'), ms.revenue != null ? H.big(ms.revenue) : `<span class="num">${(ms.sales || 0) + (ms.orders || 0)}</span>`, `<span>${(ms.sales || 0) + (ms.orders || 0)} ${L('sales & orders', 'مبيعات وطلبات')}</span>`)}
          ${kpi('orders', 'tone-info', L('Orders I updated', 'طلبات حدّثتها'), `<span class="num">${ms.handled || 0}</span>`, `<span>${L('30 days', '30 يوماً')}${ms.quotes ? ` · ${ms.quotes} ${L('quotes', 'عروض')}` : ''}</span>`)}
          ${kpi('check', late.length ? 'tone-bad' : 'tone-violet', L('Open tasks', 'مهام مفتوحة'), `<span class="num">${tasks.length}</span>`, late.length ? `<span class="bad-t">${late.length} ${L('overdue', 'متأخرة')}</span>` : `<span>${L('on time', 'في الموعد')}</span>`)}
        </div>
        <div class="grid g-21 mt">
          <div>
            <div class="card"><div class="card-h"><h3>${icon('check')} ${L('My tasks', 'مهامي')}</h3></div><div class="card-b">${tasks.length ? `<ul class="tasks">${tasks.map(x => taskRow(x)).join('')}</ul>` : `<div class="empty">${icon('check')} ${L('All done. Nice work!', 'أنجزت كل شيء. عمل رائع!')}</div>`}</div></div>
            ${assigned.length || can('orders') ? `<div class="card mt"><div class="card-h"><h3>${icon('orders')} ${L('Orders given to me', 'طلبات مسندة إلي')} <span class="count">${assigned.length}</span></h3></div><div class="card-b" style="padding:6px 0 0">${assigned.length ? `<ul class="mini-list">${assigned.map(s => `<li class="click" data-oid="${s.id}"><div class="grow"><b>${esc(s.no)}</b> · ${esc(s.customerName || '')}<div class="faint">${fDate(s.date)} · ${money(s.total)}</div></div>${statusPill(s.status)}</li>`).join('')}</ul>` : `<div class="empty">${L('No orders given to you.', 'لا توجد طلبات مسندة إليك.')}</div>`}</div></div>` : ''}
            ${waiting.length ? `<div class="card mt"><div class="card-h"><h3>${icon('bell')} ${L('New orders waiting', 'طلبات جديدة بالانتظار')} <span class="count">${waiting.length}</span></h3></div><div class="card-b" style="padding:6px 0 0"><ul class="mini-list">${waiting.map(s => `<li><div class="grow click" data-oid="${s.id}"><b>${esc(s.no)}</b> · ${esc(s.customerName || '')}<div class="faint">${ago(s.date)} · ${money(s.total)}</div></div>${can('orders', 'edit') ? `<button class="btn sm primary" data-take="${s.id}">${L('Take it', 'استلمه')}</button>` : ''}</li>`).join('')}</ul></div></div>` : ''}
          </div>
          <div>
            <div class="card"><div class="card-h"><h3>${icon('bell')} ${t('notifications')}</h3></div><div class="card-b" style="padding:6px 0 0">${notes.data && notes.data.items.length ? `<ul class="mini-list">${notes.data.items.map(n => `<li><a class="grow" href="${esc(n.link || '#/dashboard')}"><b class="${n.read ? '' : 'strong'}">${esc(n.title)}</b><div class="faint">${esc(n.body || '')} · ${ago(n.at)}</div></a></li>`).join('')}</ul>` : `<div class="empty">${notes.data ? L('Nothing new.', 'لا جديد.') : '…'}</div>`}</div></div>
            ${(ms.daily || []).length > 1 ? `<div class="card mt"><div class="card-h"><h3>${L('My sales, last 30 days', 'مبيعاتي آخر 30 يوماً')}</h3></div><div class="card-b"><div style="height:170px"><canvas id="mwChart"></canvas></div></div></div>` : ''}
            ${low.length ? `<div class="card mt"><div class="card-h"><h3>${icon('inventory')} ${L('Running low', 'قارب على النفاد')} <span class="count">${low.length}</span></h3><a href="#/inventory">${L('Inventory', 'المخزون')} →</a></div><div class="card-b" style="padding:6px 0 0"><ul class="mini-list">${low.slice(0, 6).map(p => `<li><div class="grow"><b>${esc(p.name)}</b></div><span class="pill s-new">${p.stock} / ${p.reorder}</span></li>`).join('')}</ul></div></div>` : ''}
            ${Auth.inbox().pending ? `<div class="notice mt">${icon('inbox')}<div>${L(`${Auth.inbox().pending} of your requests are waiting for the owner.`, `${Auth.inbox().pending} من طلباتك بانتظار المالك.`)} <a href="#/approvals">${t('approvals')} →</a></div></div>` : ''}
          </div>
        </div>`;
      bindSeg(v); bindTasks(v);
      $('#mwTask', v).onclick = () => taskModal(null);
      $$('[data-oid]', v).forEach(el => el.onclick = () => H.orderModal(el.dataset.oid));
      $$('[data-take]', v).forEach(b => b.onclick = () => { const s = D().sales.find(x => x.id === b.dataset.take); if (!s) return; s.assignedTo = u.id; s.assignedName = u.name; DB.save(); toast(L('The order is yours', 'الطلب لك الآن')); H.render(); });
      if ($('#mwChart', v)) {
        const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push(Math.floor(d.getTime() / 864e5)); }
        const by = new Map((ms.daily || []).map(x => [x.d, x]));
        chart($('#mwChart', v), { type: 'bar', data: { labels: days.map(d => new Date(d * 864e5).getDate()), datasets: [{ data: days.map(d => (by.get(d) || {})[ms.revenue != null ? 'v' : 'n'] || 0), backgroundColor: cssVar('--brand'), borderRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
      }
    }
  });
})();
