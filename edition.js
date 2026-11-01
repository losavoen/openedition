// "Your edition": after someone RSVPs yes, draw a one-of-one card from their name.
// The stripe painting is seeded by name + edition number, so everyone's is different
// and the same person always gets the same one. 1080x1350, ready for Instagram.
(function () {
  var W = 1080, H = 1350, M = 72;
  var INK = '#1C1C1A', RED = '#C0262D';
  var PALETTE = ['#F8ECEA', '#F8ECEA', '#D8E2DC', '#D8E2DC', '#DCE2BE', '#DCE2BE', '#A2AEDA', '#EDE6DD', '#FFFFFF', '#B0456C', '#4F5DA8', '#66702A', '#1C1C1A'];

  function seedFrom(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function painting(ctx, x, y, w, h, rand) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    var yy = y;
    while (yy < y + h) {
      var band = 4 + Math.floor(rand() * rand() * 46);
      var c = PALETTE[Math.floor(rand() * PALETTE.length)];
      ctx.fillStyle = c; ctx.fillRect(x, yy, w, Math.min(band, y + h - yy));
      if (rand() < 0.18) { ctx.fillStyle = 'rgba(28,28,26,0.85)'; ctx.fillRect(x, yy + band - 1, w, 1); }
      yy += band;
    }
    // one soft vertical sheen so it reads as paint, not a chart
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5 + (rand() - 0.5) * 0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }

  function draw(canvas, d) {
    var ctx = canvas.getContext('2d');
    var n = String(d.edition || 0).padStart(2, '0');
    var rand = rng(seedFrom((d.name || 'guest').toLowerCase() + '#' + n));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 24px "Azeret Mono", monospace';
    ctx.textAlign = 'left'; ctx.fillText('OPEN EDITION', M, 100);
    ctx.textAlign = 'right'; ctx.fillText('(MIAMI ART WEEK)', W - M, 100);

    painting(ctx, M, 140, W - 2 * M, 740, rand);
    ctx.strokeStyle = 'rgba(28,28,26,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(M, 140, W - 2 * M, 740);

    ctx.textAlign = 'left'; ctx.fillStyle = INK;
    ctx.font = '550 168px "Aspekta", Helvetica, Arial, sans-serif';
    ctx.fillText('No. ' + n, M - 6, 1070);

    // red dot: sold
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W - M - 18, 1020, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'right'; ctx.font = '400 22px "Azeret Mono", monospace';
    ctx.fillText('ACQUIRED', W - M - 48, 1028);

    ctx.textAlign = 'left'; ctx.font = '400 26px "Azeret Mono", monospace';
    var rows = [['COLLECTOR', (d.name || '').toUpperCase()], ['ARRIVES', [d.arriveDay, d.airport].filter(Boolean).join(' · ').toUpperCase() || 'TBC'], ['EDITION', 'ONE OF ONE · DEC 4–7, 2026']];
    rows.forEach(function (r, i) {
      var y = 1150 + i * 44;
      ctx.fillStyle = '#76736F'; ctx.fillText(r[0], M, y);
      ctx.fillStyle = INK; ctx.fillText(r[1].slice(0, 34), M + 210, y);
    });
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, 1108); ctx.lineTo(W - M, 1108); ctx.stroke();

    ctx.textAlign = 'right'; ctx.font = '400 40px "Cutive Mono", monospace';
    ctx.fillText('Ilelosa', W - M, 1290);
    ctx.font = '400 18px "Azeret Mono", monospace'; ctx.fillStyle = '#76736F';
    ctx.fillText('SIGNED', W - M, 1236);
  }

  function ready() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('550 168px "Aspekta"'),
      document.fonts.load('400 24px "Azeret Mono"'),
      document.fonts.load('400 40px "Cutive Mono"')
    ]).catch(function () {});
  }

  function render(d) {
    var c = document.getElementById('edition-canvas');
    if (!c) return Promise.resolve(null);
    return ready().then(function () { draw(c, d); return c; });
  }

  document.addEventListener('oe-edition', function (e) { render(e.detail); });

  document.addEventListener('oe-edition-save', function (e) {
    render(e.detail).then(function (c) {
      if (!c) return;
      var name = 'open-edition-' + String(e.detail.edition || 0).padStart(2, '0') + '.png';
      c.toBlob(function (blob) {
        if (!blob) return;
        var file;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (err) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'Open Edition (miami art week)' }).catch(function () {});
          return;
        }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    });
  });
})();
