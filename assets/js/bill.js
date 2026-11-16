/* Online invoice page (opened from the WhatsApp bill link). Data comes from the link's #hash. */
  (function () {
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var fmt = function (n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); };
    var PAY = { cash: 'Cash', card: 'Card', transfer: 'Bank transfer', cod: 'Cash on delivery', qpay: 'Qpay installments' };
    // The shop's own details come from the published catalog, not from the link, so a forged
    // link cannot change the shop name, phone or WhatsApp number shown on this page.
    var DEF = { name: '4x4 Wheels Oman', whatsapp: '96895152025', phone: '+968 9515 2025', address: 'Al Maabela, Muscat, Oman', cr: '', qpayLink: 'https://qpay.om/' };
    var CS = (window.CATALOG && window.CATALOG.settings) || {};
    var SHOP = { n: CS.name || DEF.name, a: CS.address || DEF.address, ph: CS.phone || DEF.phone, w: String(CS.whatsapp || DEF.whatsapp).replace(/\D/g, ''), cr: CS.cr || DEF.cr };
    // Only real https Qpay links are ever shown as a button
    var safeQpay = function (u) { try { var x = new URL(u); return x.protocol === 'https:' && /(^|\.)qpay\.om$/i.test(x.hostname) ? x.href : ''; } catch (e) { return ''; } };
    var num = function (n) { n = Number(n); return isFinite(n) ? n : 0; };
    function render() {
    var d;
    try {
      var h = location.hash.slice(1).replace(/-/g, '+').replace(/_/g, '/');
      while (h.length % 4) h += '=';
      d = JSON.parse(decodeURIComponent(escape(atob(h))));
    } catch (e) { d = null; }
    var root = document.getElementById('root');
    if (d && typeof d === 'object') { d.b = SHOP; d.it = Array.isArray(d.it) ? d.it.slice(0, 200) : []; d.q = safeQpay(d.q || CS.qpayLink || DEF.qpayLink); }
    if (!d || !d.n) { root.innerHTML = '<div class="err"><h2>Invoice not found</h2><p>Please open the full link you received on WhatsApp.</p></div>'; return; }
    document.title = 'Invoice ' + d.n + ' | ' + (d.b && d.b.n || '4x4 Wheels Oman');
    var cu = /^[A-Z]{3}$/.test(d.cu || '') ? d.cu : 'OMR', date = new Date(num(d.d) || Date.now());
    var rows = d.it.map(function (i) { i = Array.isArray(i) ? i : []; return '<tr><td>' + esc(i[0]) + (i[1] ? '<small>' + esc(i[1]) + '</small>' : '') + '</td><td class="r">' + esc(num(i[2])) + '</td><td class="r hide-sm">' + fmt(i[3]) + '</td><td class="r">' + fmt(num(i[2]) * num(i[3])) + '</td></tr>'; }).join('');
    root.innerHTML =
      '<div class="sheet"><div class="top"><img src="assets/img/site/logo-mark.png" alt=""><div><h1>INVOICE</h1><div class="no">' + esc(d.n) + '<br>' + date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + '</div></div></div>' +
      '<div class="body"><div class="meta"><div><small>Billed to</small><b>' + esc(d.c) + '</b><br>' + esc(d.p || '') + '</div><div><small>From</small><b>' + esc(d.b.n) + '</b><br>' + esc(d.b.a) + '<br>' + esc(d.b.ph) + (d.b.cr ? '<br>CR ' + esc(d.b.cr) : '') + '</div></div>' +
      '<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r hide-sm">Price</th><th class="r">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="tot"><div><span>Subtotal</span><span>' + fmt(d.s) + '</span></div>' + (d.ds ? '<div><span>Discount</span><span>−' + fmt(d.ds) + '</span></div>' : '') + '<div><span>VAT ' + esc(num(d.vr) || 5) + '%</span><span>' + fmt(d.v) + '</span></div>' + (d.sh ? '<div><span>Delivery</span><span>' + fmt(d.sh) + '</span></div>' : '') + '<div class="g"><span>Total ' + esc(cu) + '</span><span>' + fmt(d.t) + '</span></div>' +
      '<div><span>Payment</span><span>' + esc(PAY[d.pm] || d.pm) + ' <span class="badge ' + (d.pd ? 'paid">PAID' : 'due">DUE') + '</span></span></div></div>' +
      (d.pm === 'qpay' ? '<div class="qp"><div><b>Pay in 4 with Qpay</b><br><span style="color:#6b6e76;font-size:14px">4 interest-free payments of ' + esc(cu) + ' ' + fmt(d.t / 4) + '</span></div>' + (d.q ? '<a class="btn red" style="height:40px" href="' + esc(d.q) + '" target="_blank" rel="noopener">Open Qpay</a>' : '') + '</div>' : '') +
      '</div><div class="foot"><span>Thank you for choosing ' + esc(d.b.n) + '!</span><span>Al Maabela · Sat–Thu 5 PM–12 AM</span></div></div>' +
      '<div class="bar"><button class="btn red" id="printBtn" type="button">Print / Save PDF</button>' + (d.b.w ? '<a class="btn" href="https://api.whatsapp.com/send?phone=' + encodeURIComponent(d.b.w) + '&text=' + encodeURIComponent('Hi, about invoice ' + d.n) + '">WhatsApp us</a>' : '') + '<a class="btn" href="./">Visit our shop</a></div>';
      var pb = document.getElementById('printBtn'); if (pb) pb.addEventListener('click', function () { window.print(); });
    }
    render();
    // a different invoice link opened in the same tab only changes the #hash
    window.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });
  })();
