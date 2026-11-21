/* ============================================================
   4x4 Wheels Oman – AI assistant for the owner and the team
   ------------------------------------------------------------
   • Choose the AI provider (owner): Claude, Google Gemini (free key) or any
     OpenAI-compatible service. The key stays on the server; employees use it
     through the server, which checks their permissions.
   • Every action the AI wants to do (add a product, change stock, add an expense,
     give a task, create an employee account…) is shown first and only happens
     when the person presses "Do it".
   • PDF reports: any AI answer or report can be saved as a PDF (made in the
     browser — Arabic and English both work).
   • "Ask AI" button on every page.
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- PDF (loaded only when needed) ----------
  const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  let libs = null;
  const loadPDF = () => (libs = libs || Promise.all([loadScript('assets/vendor/html2canvas.min.js'), loadScript('assets/vendor/jspdf.umd.min.js')]).catch(e => { libs = null; throw e; }));
  const escH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fileName = (title) => (String(title || 'report').replace(/[\\/:*?"<>|#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'report') + '.pdf';

  async function fromHTML(title, html, opts) {
    await loadPDF();
    const rtl = (opts && opts.rtl != null) ? opts.rtl : document.documentElement.dir === 'rtl';
    const shop = (global.DB && DB.data && DB.data.settings) ? DB.data.settings : {};
    const box = document.createElement('div');
    box.className = 'pdf-page';
    box.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    box.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;padding:44px 48px;background:#fff;color:#1d2433;font:14px/1.55 Inter,"Noto Sans Arabic",Tahoma,Arial,sans-serif;';
    const when = new Date().toLocaleString(rtl ? 'ar-OM' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c2410c;padding-bottom:10px;margin-bottom:18px">
        <div><div style="font-size:12px;color:#6b7280;letter-spacing:.04em;text-transform:uppercase">${escH(shop.name || '4x4 Wheels Oman')}</div><div style="font-size:22px;font-weight:800;margin-top:2px">${escH(title)}</div></div>
        <div style="font-size:12px;color:#6b7280">${escH(when)}</div></div>
      <div class="pdf-body">${html}</div>
      <div style="margin-top:26px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">${escH(shop.name || '')}${shop.phone ? ' · ' + escH(shop.phone) : ''}</div>`;
    const st = document.createElement('style');
    st.textContent = '.pdf-page table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:12.5px}.pdf-page th,.pdf-page td{border:1px solid #e5e7eb;padding:5px 7px;text-align:start;vertical-align:top}.pdf-page th{background:#f3f4f6}.pdf-page h1,.pdf-page h2,.pdf-page h3{margin:16px 0 6px;line-height:1.25}.pdf-page h1{font-size:20px}.pdf-page h2{font-size:17px}.pdf-page h3{font-size:15px}.pdf-page ul,.pdf-page ol{padding-inline-start:22px;margin:6px 0}.pdf-page p{margin:6px 0}.pdf-page code{background:#f3f4f6;padding:0 4px;border-radius:4px}';
    box.prepend(st);
    document.body.appendChild(box);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = await global.html2canvas(box, { scale: 2, backgroundColor: '#ffffff', useCORS: false, logging: false, windowWidth: 900 });
      const { jsPDF } = global.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
      const pageH = Math.floor(canvas.width * ph / pw); // canvas pixels per PDF page
      // cut between lines of text where possible: look for a white row near the page end
      const ctx = canvas.getContext('2d');
      const whiteRow = (y) => { const d = ctx.getImageData(0, y, canvas.width, 1).data; for (let i = 0; i < d.length; i += 16) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; };
      let y = 0, first = true;
      while (y < canvas.height - 4) {
        let h = Math.min(pageH, canvas.height - y);
        if (y + h < canvas.height) { for (let k = 0; k < 160; k += 2) if (whiteRow(y + h - k)) { h -= k; break; } }
        const part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
        const pc = part.getContext('2d'); pc.fillStyle = '#fff'; pc.fillRect(0, 0, part.width, h); pc.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage();
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, h * pw / canvas.width);
        first = false; y += h;
      }
      if (opts && opts.blob) return pdf.output('blob');
      pdf.save(fileName(title));
      return true;
    } finally { box.remove(); }
  }
  const fromMarkdown = (title, md, opts) => fromHTML(title, global.AI ? AI.md(md || '') : '<pre>' + escH(md) + '</pre>', Object.assign({ rtl: /[؀-ۿ]/.test(String(md).slice(0, 400)) }, opts || {}));
  global.AIPDF = { fromHTML, fromMarkdown, load: loadPDF };

  window.BH_EXT = window.BH_EXT || [];
  window.BH_EXT.push(function (H, VIEWS) {
    const { t, $, $$, esc, modal, toast } = H;
    const L = (en, ar) => (I18N.lang === 'ar' ? ar : en);
    const online = () => !!(window.Auth && Auth.mode === 'server');

    // ---------- confirm before the AI does anything ----------
    const ACT_IC = { create_product: 'inventory', adjust_stock: 'box', create_purchase_order: 'truck', add_expense: 'wallet', create_task: 'check', assign_order: 'orders', prepare_campaign: 'megaphone', create_employee: 'users', make_pdf_report: 'file' };
    H.aiConfirm = (tool, input, summary) => new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const detail = Object.entries(input || {}).filter(([k, v]) => v !== '' && v != null && k !== 'markdown').map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(Array.isArray(v) ? v.map(x => (typeof x === 'object' ? Object.values(x).join(' × ') : x)).join(', ') : typeof v === 'object' ? JSON.stringify(v) : v)}</dd>`).join('');
      modal({
        title: `${icon('sparkle')} ${L('The AI wants to do this', 'يريد المساعد الذكي القيام بهذا')}`,
        body: `<div class="ai-act"><span class="ai-act-ic">${icon(ACT_IC[tool] || 'sparkle')}</span><b>${esc(summary)}</b></div>
          ${detail ? `<details class="mt"><summary class="faint">${L('Details', 'التفاصيل')}</summary><dl class="kv">${detail}</dl></details>` : ''}
          ${tool === 'make_pdf_report' && input && input.markdown ? `<div class="ai-prev md">${AI.md(String(input.markdown).slice(0, 4000))}</div>` : ''}
          <p class="faint" style="font-size:12.5px;margin:10px 0 0">${L('Nothing happens unless you press “Do it”. Every change is checked against your permissions and recorded.', 'لن يحدث شيء ما لم تضغط "نفّذ". يُفحص كل تغيير حسب صلاحياتك ويُسجّل.')}</p>`,
        footer: `<button class="btn" data-close id="aiNo">${L('No', 'لا')}</button><button class="btn primary" id="aiYes">${icon('check')}${L('Do it', 'نفّذ')}</button>`,
        onMount: (el, m) => {
          $('#aiYes', el).onclick = () => { finish(true); m.close(); };
          new MutationObserver((_, obs) => { if (!document.body.contains(el)) { obs.disconnect(); finish(false); } }).observe(document.body, { childList: true });
        }
      });
    });

    // ---------- "Ask AI" on every page ----------
    const mayUseAI = () => !online() || (!!Auth.me() && (Auth.isOwner() || Auth.can('ai', 'view') || ['quotes', 'inventory', 'whatsapp'].some(m => Auth.can(m, 'edit'))));
    function fab() {
      let b = document.getElementById('aiFab');
      const show = mayUseAI() && !/^#\/(advisor|pos)\b/.test(location.hash) && document.querySelector('.app');
      if (!show) { if (b) b.remove(); return; }
      if (b) return;
      b = document.createElement('button'); b.id = 'aiFab'; b.className = 'ai-fab'; b.type = 'button';
      b.innerHTML = `${icon('sparkle')}<span>${L('Ask AI', 'اسأل الذكاء')}</span>`;
      b.onclick = () => {
        modal({
          title: `${icon('sparkle')} ${L('Ask the AI', 'اسأل المساعد الذكي')}`,
          body: `<textarea class="input" id="fabQ" rows="3" placeholder="${esc(L('e.g. Add 5 units of BP-51 that arrived today · Which customers stopped buying? · Make a PDF of this week’s sales', 'مثال: أضف 5 قطع BP-51 وصلت اليوم · ما العملاء الذين توقفوا عن الشراء؟ · اعمل PDF لمبيعات هذا الأسبوع'))}"></textarea>`,
          footer: `<a class="btn ghost" href="#/advisor" data-close style="margin-inline-end:auto">${L('Open chat', 'فتح المحادثة')}</a><button class="btn primary" id="fabGo">${icon('send')}${L('Ask', 'اسأل')}</button>`,
          onMount: (el, m) => {
            const go = () => { const q = $('#fabQ', el).value.trim(); if (!q) return; m.close(); H.state.pendingQ = q; location.hash = '#/advisor'; };
            $('#fabGo', el).onclick = go;
            $('#fabQ', el).onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
          }
        });
      };
      document.body.appendChild(b);
    }
    window.addEventListener('hashchange', () => setTimeout(fab, 0));
    setTimeout(fab, 800); setInterval(fab, 2500); // also after sign-in / unlock

    // ---------- AI provider settings (owner, online) ----------
    const set = VIEWS.settings;
    if (set) VIEWS.settings = function (v) {
      set(v);
      if (!online() || !Auth.isOwner()) return;
      const card = $('#set-ai', v); if (!card) return;
      const body = $('.card-b', card);
      body.innerHTML = `<div class="muted">${L('Loading…', 'جارٍ التحميل…')}</div>`;
      Auth.api('GET', '/api/secrets').then(r => drawAI(card, r.ai)).catch(e => { body.innerHTML = `<div class="bad-t">${esc(e.message)}</div>`; });
    };
    function drawAI(card, ai) {
      const body = $('.card-b', card);
      const P = ai.providers || {};
      const HELP = {
        gemini: L(`Free: sign in at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> with a Google account, press “Create API key” and paste it here. The free plan has daily limits, and Google may use what is sent on the free plan to improve its products — don’t use it for data you must keep private, or switch the Google project to paid billing.`,
          `مجاني: سجّل الدخول في <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> بحساب Google، واضغط "Create API key" والصقه هنا. للخطة المجانية حدود يومية، وقد تستخدم Google ما يُرسل في الخطة المجانية لتحسين منتجاتها — لا تستخدمها لبيانات يجب أن تبقى خاصة، أو فعّل الدفع لمشروع Google.`),
        claude: L('Best quality. Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (paid by use).', 'أفضل جودة. أنشئ مفتاحًا من <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> (الدفع حسب الاستخدام).'),
        openai: L('Any service that works like OpenAI (OpenAI, Groq, OpenRouter, Mistral…). Enter its address and model name.', 'أي خدمة تعمل مثل OpenAI (OpenAI أو Groq أو OpenRouter أو Mistral…). أدخل العنوان واسم النموذج.')
      };
      const cur = ai.provider || 'claude';
      body.innerHTML = `<p class="muted" style="margin:0 0 12px">${L('The AI helps you and your team: it answers questions, analyses customers and employees, writes messages, makes PDF reports and does jobs after you confirm. Employees only get answers about what their permissions allow.', 'يساعدك المساعد الذكي أنت وفريقك: يجيب عن الأسئلة ويحلل العملاء والموظفين ويكتب الرسائل ويعمل تقارير PDF وينفّذ المهام بعد تأكيدك. يحصل الموظفون فقط على إجابات ضمن صلاحياتهم.')}</p>
        <div class="seg ai-prov" id="aiProv">${Object.entries(P).map(([k, p]) => `<button type="button" data-k="${k}" class="${k === cur ? 'on' : ''}">${esc(p.label)}${ai.hasKey[k] ? ' ✓' : ''}</button>`).join('')}</div>
        <div id="aiForm" class="mt"></div>`;
      const form = $('#aiForm', body);
      const draw = (k) => {
        const p = P[k] || {};
        form.innerHTML = `<p class="faint" style="font-size:13px;margin:0 0 10px">${HELP[k] || ''}</p>
          <div class="form-grid">
            <div class="field"><label>${L('API key', 'مفتاح API')}</label><input class="input" id="ai_key" type="password" autocomplete="off" placeholder="${ai.hasKey[k] ? '•••••••• ' + L('saved', 'محفوظ') : esc(k === 'gemini' ? 'AIza…' : k === 'claude' ? 'sk-ant-…' : 'sk-…')}"></div>
            <div class="field"><label>${L('Model', 'النموذج')} <span class="faint">(${L('optional', 'اختياري')})</span></label><input class="input" id="ai_model" dir="ltr" value="${esc(k === cur ? ai.model || '' : '')}" placeholder="${esc(p.model || '')}"></div>
            ${k === 'openai' ? `<div class="field full"><label>${L('Address', 'العنوان')}</label><input class="input" id="ai_base" dir="ltr" value="${esc(k === cur ? ai.baseUrl || '' : '')}" placeholder="https://api.openai.com/v1/chat/completions"></div>` : ''}
          </div>
          <div class="actions mt"><button class="btn primary" id="ai_save">${icon('check')}${k === cur ? L('Save', 'حفظ') : L('Save and use this one', 'حفظ واستخدام هذا')}</button>
            ${ai.hasKey[k] && k === cur ? `<button class="btn" id="ai_test">${icon('sparkle')}${L('Test', 'اختبار')}</button>` : ''}
            ${ai.hasKey[k] ? `<button class="btn danger" id="ai_rm">${L('Remove key', 'حذف المفتاح')}</button>` : ''}<span id="ai_msg" class="muted" style="font-size:13px"></span></div>
          ${k !== cur ? `<p class="faint" style="font-size:12.5px;margin:8px 0 0">${L('Now in use:', 'المستخدم الآن:')} <b>${esc((P[cur] || {}).label || cur)}</b></p>` : ''}`;
        const msg = (txt, cls) => { const m = $('#ai_msg', form); m.className = cls || 'muted'; m.textContent = txt; };
        $('#ai_save', form).onclick = async () => {
          const key = $('#ai_key', form).value.trim();
          if (!key && !ai.hasKey[k]) return msg(L('Paste the key first.', 'الصق المفتاح أولاً.'), 'bad-t');
          const b = { aiProvider: k, aiModel: $('#ai_model', form).value.trim() };
          if ($('#ai_base', form)) b.aiBaseUrl = $('#ai_base', form).value.trim();
          if (key) { b.aiKey = key; b.aiKeyFor = k; }
          try {
            msg(L('Saving…', 'جارٍ الحفظ…'));
            const r = await Auth.api('PUT', '/api/secrets', b); Auth.inbox().ai = r.hasAiKey;
            msg(L('Testing…', 'جارٍ الاختبار…'));
            await Auth.api('POST', '/api/ai/test', {});
            toast(L('AI connected ✓', 'تم ربط الذكاء الاصطناعي ✓')); drawAI(card, r.ai);
          } catch (e) { msg(e.message, 'bad-t'); Auth.api('GET', '/api/secrets').then(r => { ai = r.ai; }).catch(() => {}); }
        };
        if ($('#ai_test', form)) $('#ai_test', form).onclick = async () => { msg(L('Testing…', 'جارٍ الاختبار…')); try { const r = await Auth.api('POST', '/api/ai/test', {}); msg('✓ ' + (r.text || 'OK') + (r.model ? ' · ' + r.model : ''), 'ok-t'); } catch (e) { msg(e.message, 'bad-t'); } };
        if ($('#ai_rm', form)) $('#ai_rm', form).onclick = () => H.confirmBox(L('Remove this AI key?', 'حذف مفتاح الذكاء الاصطناعي هذا؟'), async () => { try { const r = await Auth.api('PUT', '/api/secrets', { aiKey: '', aiKeyFor: k }); Auth.inbox().ai = r.hasAiKey; drawAI(card, r.ai); } catch (e) { toast(e.message); } }, L('Remove', 'حذف'));
      };
      $$('#aiProv button', body).forEach(b => b.onclick = () => { $$('#aiProv button', body).forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.k); });
      draw(cur);
      let pill = $('.card-h .pill', card); if (!pill) { $('.card-h', card).insertAdjacentHTML('beforeend', '<span class="pill"></span>'); pill = $('.card-h .pill', card); }
      pill.className = 'pill ' + (ai.hasKey[cur] ? 's-delivered' : 'plain');
      pill.textContent = ai.hasKey[cur] ? 'ON · ' + ((P[cur] || {}).label || '') : 'OFF';
    }
  });
})(window);
