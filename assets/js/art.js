/* Product artwork: uploaded photo if present, otherwise a clean category illustration (SVG) */
(function (global) {
  const PAL = {
    wheels: ['#2b2f36', '#d9480f'], tyres: ['#1f242b', '#868e96'], suspension: ['#16325c', '#4dabf7'], bumpers: ['#3b2a12', '#f59f00'],
    lighting: ['#0b3a44', '#66d9e8'], recovery: ['#0f3d2b', '#51cf66'], roof: ['#2d1f4f', '#b197fc'], accessories: ['#4a1530', '#f783ac']
  };
  const spokes = (n, r1, r2) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, b = a + 0.32;
    return `<path d="M${100 + r1 * Math.cos(a)} ${100 + r1 * Math.sin(a)} L${100 + r2 * Math.cos(a)} ${100 + r2 * Math.sin(a)} L${100 + r2 * Math.cos(b)} ${100 + r2 * Math.sin(b)} L${100 + r1 * Math.cos(b - .12)} ${100 + r1 * Math.sin(b - .12)}Z"/>`;
  }).join('');
  const treads = (n) => Array.from({ length: n }, (_, i) => { const a = i / n * 360; return `<rect x="96" y="22" width="8" height="18" rx="2" transform="rotate(${a} 100 100)"/>`; }).join('');
  const SHAPES = {
    wheels: (c) => `<circle cx="100" cy="100" r="74" fill="#111" /><circle cx="100" cy="100" r="62" fill="${c}" opacity=".25"/><circle cx="100" cy="100" r="58" fill="none" stroke="#e9ecef" stroke-width="6"/><g fill="#e9ecef">${spokes(6, 18, 54)}</g><circle cx="100" cy="100" r="18" fill="#e9ecef"/><circle cx="100" cy="100" r="7" fill="${c}"/>`,
    tyres: (c) => `<circle cx="100" cy="100" r="78" fill="#111"/><g fill="#2b2b2b">${treads(28)}</g><circle cx="100" cy="100" r="48" fill="none" stroke="#3a3a3a" stroke-width="6"/><circle cx="100" cy="100" r="40" fill="${c}"/><circle cx="100" cy="100" r="14" fill="#111"/><text x="100" y="72" font-family="Arial" font-weight="900" font-size="9" fill="#ddd" text-anchor="middle" letter-spacing="2">ALL-TERRAIN</text>`,
    suspension: (c) => `<rect x="90" y="26" width="20" height="148" rx="6" fill="#dee2e6"/><rect x="84" y="20" width="32" height="14" rx="4" fill="#adb5bd"/><rect x="84" y="166" width="32" height="14" rx="4" fill="#adb5bd"/>${Array.from({ length: 8 }, (_, i) => `<path d="M62 ${44 + i * 15} Q100 ${36 + i * 15} 138 ${44 + i * 15}" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join('')}`,
    bumpers: (c) => `<path d="M24 92 h152 l-10 40 h-132z" fill="#212529"/><path d="M40 66 h120 l16 26 h-152z" fill="#343a40"/><rect x="58" y="100" width="84" height="22" rx="3" fill="#495057"/><circle cx="46" cy="110" r="9" fill="${c}"/><circle cx="154" cy="110" r="9" fill="${c}"/><path d="M70 66 q30 -34 60 0" stroke="#495057" stroke-width="8" fill="none"/>`,
    lighting: (c) => `<g opacity=".55" fill="${c}"><path d="M30 92 L4 40 L60 92Z"/><path d="M80 92 L70 30 L110 92Z"/><path d="M120 92 L130 30 L150 92Z"/><path d="M170 92 L196 40 L140 92Z"/></g><rect x="20" y="90" width="160" height="34" rx="10" fill="#212529"/>${Array.from({ length: 8 }, (_, i) => `<circle cx="${34 + i * 19}" cy="107" r="7" fill="#fff"/><circle cx="${34 + i * 19}" cy="107" r="3.5" fill="${c}"/>`).join('')}<rect x="60" y="124" width="10" height="20" fill="#495057"/><rect x="130" y="124" width="10" height="20" fill="#495057"/>`,
    recovery: (c) => `<g transform="rotate(-18 100 100)"><rect x="34" y="62" width="132" height="44" rx="12" fill="${c}"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${50 + i * 16} 70 l6 14 l-6 14" stroke="#0b2b1d" stroke-width="5" fill="none"/>`).join('')}<rect x="34" y="114" width="132" height="44" rx="12" fill="${c}" opacity=".7"/></g>`,
    roof: (c) => `<path d="M30 130 L50 70 H150 L170 130Z" fill="none" stroke="#dee2e6" stroke-width="8" stroke-linejoin="round"/>${[0, 1, 2, 3, 4].map(i => `<line x1="${48 + i * 26}" y1="74" x2="${42 + i * 29}" y2="128" stroke="${c}" stroke-width="6"/>`).join('')}<rect x="44" y="130" width="12" height="20" fill="#adb5bd"/><rect x="144" y="130" width="12" height="20" fill="#adb5bd"/>`,
    accessories: (c) => `<rect x="40" y="58" width="120" height="96" rx="12" fill="#dee2e6"/><rect x="40" y="58" width="120" height="26" rx="12" fill="${c}"/><rect x="84" y="44" width="32" height="16" rx="6" fill="none" stroke="#adb5bd" stroke-width="6"/><rect x="58" y="100" width="84" height="8" rx="4" fill="#adb5bd"/><rect x="58" y="118" width="60" height="8" rx="4" fill="#ced4da"/>`
  };
  const ALIAS = { 'wheels-tires': 'wheels', power: 'lighting', performance: 'suspension', drivetrain: 'bumpers', 'side-steps': 'roof', tops: 'roof' };
  function productArt(p, opts) {
    opts = opts || {};
    if (p && p.image) return `<img src="${p.image}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:${opts.fit || 'cover'};display:block">`;
    const cat = ALIAS[(p && p.category)] || (p && p.category) || 'accessories';
    const [bg, accent] = PAL[cat] || PAL.accessories;
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" role="img" aria-label="${(p && p.name || '').replace(/"/g, '')}">
      <defs><radialGradient id="${id}" cx="30%" cy="20%" r="100%"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset=".6" stop-color="${bg}"/></radialGradient></defs>
      <rect width="200" height="200" fill="${bg}"/><rect width="200" height="200" fill="url(#${id})"/>
      <g transform="translate(100 104) scale(.78) translate(-100 -100)">${(SHAPES[cat] || SHAPES.accessories)(accent)}</g></svg>`;
  }
  // shrink an uploaded image to a small JPEG data URL so it fits in browser storage
  function toJpeg(src, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(src, 0, 0, w, h);
    const out = cv.toDataURL('image/jpeg', 0.82); cv.width = cv.height = 0; // free canvas memory right away (iOS)
    return out;
  }
  async function shrinkImage(file, max) {
    max = max || 640;
    // Phones: decode the camera photo already downsized, instead of a full 12+ MP image in memory
    if (global.createImageBitmap) {
      try {
        const probe = await createImageBitmap(file, { resizeWidth: 64, resizeQuality: 'low' });
        const landscape = probe.width >= probe.height; probe.close && probe.close();
        const bmp = await createImageBitmap(file, landscape ? { resizeWidth: max, resizeQuality: 'high' } : { resizeHeight: max, resizeQuality: 'high' });
        const out = toJpeg(bmp, bmp.width, bmp.height); bmp.close && bmp.close();
        return out;
      } catch (e) { /* fall back below */ }
    }
    return shrinkImageLegacy(file, max);
  }
  function shrinkImageLegacy(file, max) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = reject;
      rd.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          resolve(toJpeg(img, Math.round(img.width * k), Math.round(img.height * k)));
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  global.productArt = productArt;
  global.shrinkImage = shrinkImage;
})(window);
