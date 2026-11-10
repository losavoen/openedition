/* Open Edition — motion pass.
   1. Hero: the six polaroids orbit the title on a tilted ring (desktop). Drag to spin.
   2. Headlines: words slide up into place when they scroll into view.
   3. Highlighter under "I'm covering half of the house".
   4. Days to Miami: one dot per day, filled up to today (Miami time).
   5. The weekend on a map: the route draws itself as you scroll; stops light up.
   Everything renders complete without this file, and with reduced motion on. */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function onView(els, fn, opts) {
    if (!('IntersectionObserver' in window)) { els.forEach(fn); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { fn(e.target); io.unobserve(e.target); } });
    }, opts || { rootMargin: '0px 0px -12% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  function inView(el) { var r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }

  /* ---------- 1. hero ring ---------- */
  function ring() {
    var hero = $('.hero'), pola = $('.hero .pola');
    if (!hero || !pola || reduce) return;
    var mq = matchMedia('(min-width: 761px)');
    var cards = $$('a', pola), N = cards.length;
    var theta = 0, vel = 0, speed = 0.11, born = 0, raf = 0, visible = true, hover = false, drag = null, moved = 0;

    function layout(ts) {
      if (!born) born = ts;
      var grow = Math.min(1, (ts - born) / 1400); grow = 1 - Math.pow(1 - grow, 3);
      var w = hero.clientWidth, h = hero.clientHeight;
      var rx = w * 0.38 * (0.35 + 0.65 * grow), ry = h * 0.27 * (0.35 + 0.65 * grow);
      for (var i = 0; i < N; i++) {
        var a = theta + (i / N) * Math.PI * 2 + (1 - grow) * 2.2;
        var z = Math.cos(a), x = Math.sin(a) * rx, y = z * ry - h * 0.02;
        var depth = (z + 1) / 2, s = 0.6 + 0.4 * depth;
        var el = cards[i];
        el.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ') rotate(' + (Math.sin(a) * -7).toFixed(2) + 'deg)';
        el.style.opacity = (grow * (0.5 + 0.5 * depth)).toFixed(3);
        el.style.filter = z < -0.25 ? 'blur(' + ((-z - 0.25) * 2.6).toFixed(2) + 'px)' : 'none';
        el.style.zIndex = z > 0.2 ? 3 : 1;
      }
    }
    function tick(ts) {
      raf = 0;
      if (!mq.matches) return;
      if (!drag) {
        if (Math.abs(vel) > 0.0001) { theta += vel; vel *= 0.94; }
        else if (!hover) theta += speed / 60;
      }
      layout(ts);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf && mq.matches) raf = requestAnimationFrame(tick); }
    function on() {
      if (mq.matches) { pola.classList.add('orbit'); hero.classList.add('ringed'); born = 0; start(); }
      else { pola.classList.remove('orbit'); hero.classList.remove('ringed'); cards.forEach(function (c) { c.style.transform = c.style.opacity = c.style.filter = c.style.zIndex = ''; }); }
    }
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(hero);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
    pola.addEventListener('mouseover', function () { hover = true; });
    pola.addEventListener('mouseout', function () { hover = false; });
    pola.addEventListener('focusin', function () { hover = true; });
    pola.addEventListener('focusout', function () { hover = false; });
    hero.addEventListener('pointerdown', function (e) {
      if (!mq.matches || e.button !== 0) return;
      drag = { x: e.clientX, last: e.clientX }; moved = 0; vel = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.last; drag.last = e.clientX; moved += Math.abs(dx);
      if (moved > 6) hero.classList.add('dragging');
      theta += dx * 0.005; vel = dx * 0.005; start();
    });
    window.addEventListener('pointerup', function () { if (!drag) return; drag = null; hero.classList.remove('dragging'); start(); });
    pola.addEventListener('click', function (e) { if (moved > 6) { e.preventDefault(); moved = 0; } }, true);
    pola.addEventListener('dragstart', function (e) { e.preventDefault(); });
    on();
  }

  /* ---------- 2. headlines ---------- */
  function words() {
    if (reduce) return;
    var heads = $$('h2.big');
    heads.forEach(function (h) {
      var n = 0, parts = [];
      Array.prototype.slice.call(h.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { parts.push(document.createTextNode(' ')); return; }
            var o = document.createElement('span'); o.className = 'kw';
            var i = document.createElement('span'); i.textContent = w; i.style.transitionDelay = (n++ * 70) + 'ms';
            o.appendChild(i); parts.push(o);
          });
        } else if (node.nodeName === 'BR') { parts.push(node); }
        else {
          var o2 = document.createElement('span'); o2.className = 'kw';
          var i2 = document.createElement('span'); i2.style.transitionDelay = (n++ * 70) + 'ms';
          i2.appendChild(node); o2.appendChild(i2); parts.push(o2);
        }
      });
      h.textContent = ''; parts.forEach(function (p) { h.appendChild(p); });
      h.classList.remove('trk'); h.classList.add('kin');
      if (inView(h)) requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add('go'); }); });
    });
    onView(heads, function (h) { h.classList.add('go'); });
  }

  /* ---------- 3. highlighter ---------- */
  function highlight() {
    var els = $$('.hl');
    if (reduce) { els.forEach(function (e) { e.classList.add('go'); }); return; }
    onView(els, function (e) { e.classList.add('go'); }, { rootMargin: '0px 0px -25% 0px' });
  }

  /* ---------- 4. days to Miami ---------- */
  function days() {
    var box = $('#dots'), num = $('#days-n'), cap = $('#days-cap');
    if (!box) return;
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    var today = Date.UTC(+parts.slice(0, 4), +parts.slice(5, 7) - 1, +parts.slice(8, 10));
    var start = Date.UTC(2026, 10, 1), land = Date.UTC(2026, 11, 4), last = Date.UTC(2026, 11, 7), DAY = 864e5;
    var total = Math.round((land - start) / DAY) + 1; // Nov 1 … Dec 4
    var passed = Math.max(0, Math.min(total, Math.round((today - start) / DAY) + 1));
    var left = Math.round((land - today) / DAY);
    var html = '';
    for (var i = 0; i < total; i++) html += '<i' + (i === passed - 1 && left > 0 ? ' class="today"' : '') + '></i>';
    box.innerHTML = html;
    var label = left > 1 ? left + ' days to go' : left === 1 ? 'Tomorrow' : today <= last ? 'We’re in Miami' : 'That was Miami';
    if (left <= 0) cap.textContent = today <= last ? 'December 4–7' : 'See you at the next one';
    var dots = $$('i', box);
    function fill() {
      if (reduce) { dots.slice(0, passed).forEach(function (d) { d.classList.add('on'); }); num.textContent = label; return; }
      var k = 0, target = passed;
      (function step() {
        if (k < target) { dots[k].classList.add('on'); k++; num.textContent = left > 0 ? Math.max(left, total - k) + ' days to go' : label; setTimeout(step, 45); }
        else num.textContent = label;
      })();
    }
    num.textContent = label;
    if (inView(box)) fill(); else onView([box], fill);
  }

  /* ---------- 5. route ---------- */
  function route() {
    var wrap = $('#route'), path = $('#trail'), dot = $('#trail-dot');
    if (!wrap || !path || !path.getTotalLength) return;
    var L = path.getTotalLength();
    var stops = $$('.stop', wrap), items = $$('li', wrap);
    // where each stop sits along the line
    var at = stops.map(function (g) {
      var c = g.querySelector('circle'), cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), best = 0, bd = 1e9;
      for (var s = 0; s <= 400; s++) { var p = path.getPointAtLength(L * s / 400), d = (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy); if (d < bd) { bd = d; best = s / 400; } }
      return best;
    });
    function paint(f) {
      path.style.strokeDashoffset = (L * (1 - f)).toFixed(1);
      var p = path.getPointAtLength(L * f); dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
      stops.forEach(function (g, i) { var lit = f >= at[i] - 0.004; g.classList.toggle('lit', lit); if (items[i]) items[i].classList.toggle('lit', lit); });
    }
    if (reduce) { paint(1); return; }
    path.style.strokeDasharray = L.toFixed(1);
    wrap.classList.add('armed');
    var queued = false;
    function onScroll() {
      if (queued) return; queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var r = wrap.getBoundingClientRect(), vh = innerHeight;
        var f = (vh * 0.85 - r.top) / (r.height * 0.9 + vh * 0.25);
        paint(Math.max(0, Math.min(1, f)));
      });
    }
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
    onScroll();
  }


  /* ---------- 6. section links land at the top of the section ----------
     Images above a section can finish loading after the jump and push it down
     the page. Keep the section pinned to the top until the page settles or the
     visitor scrolls themselves. */
  function anchors() {
    var target = null, until = 0, lock = false;
    function offset(el) { var m = parseFloat(getComputedStyle(el).scrollMarginTop) || 0; return el.getBoundingClientRect().top + window.scrollY - m; }
    function go(el, smooth) {
      target = el; until = Date.now() + 12000; lock = true;
      window.scrollTo({ top: offset(el), behavior: smooth && !reduce ? 'smooth' : 'auto' });
      setTimeout(function () { lock = false; settle(); }, smooth ? 900 : 50);
      clearInterval(go.t);
      go.t = setInterval(function () { if (!target || Date.now() > until) { clearInterval(go.t); return; } settle(); }, 120);
    }
    function settle() {
      if (!target || lock || Date.now() > until) return;
      var want = offset(target);
      if (Math.abs(window.scrollY - want) > 4) window.scrollTo({ top: want, behavior: 'auto' });
    }
    function stop() { target = null; }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      var id = a.getAttribute('href').slice(1); if (!id) return;
      var el = document.getElementById(id); if (!el) return;
      e.preventDefault();
      if (history.pushState) history.pushState(null, '', '#' + id);
      go(el, true);
    });
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(settle); ro.observe(document.body); Array.prototype.forEach.call(document.querySelectorAll('section'), function (s) { ro.observe(s); }); }
    document.addEventListener('load', settle, true);
    ['wheel', 'touchmove', 'keydown'].forEach(function (t) { window.addEventListener(t, function (e) { if (e.type === 'keydown' && !/^(Arrow|Page|Home|End| )/.test(e.key)) return; stop(); }, { passive: true }); });
    if (location.hash.length > 1) { var el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(function () { go(el, false); }, 60); }
  }

  function init() { [ring, words, highlight, days, route, anchors].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn('motion', e); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
