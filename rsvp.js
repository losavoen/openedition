// RSVP form: four steps, then a review screen that opens a pre-filled email.
// The markup lives in <template id="rsvp-tpl"> in index.html. This file fills
// {{ holes }}, expands <sc-for> / <sc-if>, wires events and re-renders on change.
(function () {
  var RSVP_EMAIL = 'hello@losaeguavoen.com';

  var state = { step: 1, name: '', attending: '', airport: '', arriveDay: '', landing: '', inFlight: '', houseTime: '', inTime: '', leaving: '', leaveTime: '', monday: '', outFlight: '', outTime: '', extras: [], tee: '', songs: '', questions: '', note: '' };

  function setState(patch) { Object.assign(state, patch); render(); }

  function vals() {
    var s = state;
    var set = function (k) { return function (e) { var p = {}; p[k] = e.target.value; setState(p); }; };
    var opts = function (key, list) {
      return list.map(function (v) { return { label: v, cls: s[key] === v ? 'pill on' : 'pill', pick: function () { var p = {}; p[key] = v; setState(p); } }; });
    };
    var extrasList = ['Art Basel day ticket', 'Superblue', 'The boat', 'Everyday People', 'Circoloco', 'Beach club', 'Dinner at MILA', 'Happy to drive a rental', 'Splitting a rental car'];
    var toggle = function (v) { return function () { setState({ extras: s.extras.indexOf(v) > -1 ? s.extras.filter(function (x) { return x !== v; }) : s.extras.concat(v) }); }; };
    var declined = s.attending === 'Can’t make it';
    var go = function (n) { return function () { setState({ step: n }); }; };
    var back = function () { setState({ step: declined && s.step === 5 ? 1 : Math.max(1, s.step - 1) }); };
    var labels = ['You', 'Getting there', 'Heading home', 'Extras'];
    var progress = labels.map(function (l, i) { return { label: l, bar: Math.min(s.step, 4) > i ? 'bar on' : 'bar' }; });
    var rows = declined
      ? [{ k: 'Name', v: s.name || '—' }, { k: 'Coming', v: 'Can’t make it this time' }]
      : [
          { k: 'Name', v: s.name || '—' },
          { k: 'Coming', v: s.attending || '—' },
          { k: 'Flying into', v: s.airport || '—' },
          { k: 'Arriving', v: [s.arriveDay, s.landing, s.inFlight, s.inTime].filter(Boolean).join(' · ') || '—' },
          { k: 'At the house', v: s.houseTime || '—' },
          { k: 'Leaving', v: [s.leaving, s.leaveTime, s.outFlight, s.outTime].filter(Boolean).join(' · ') || '—' },
          { k: 'Monday', v: (s.leaving === 'Monday' || s.leaving === 'Tuesday') ? (s.monday || '—') : 'Not staying' },
          { k: 'Count me in', v: s.extras.length ? s.extras.join(', ') : 'Nothing extra yet' },
          { k: 'Size', v: s.tee || '—' },
          { k: 'Songs', v: s.songs || '—' },
          { k: 'Questions', v: s.questions || '—' },
          { k: 'Good to know', v: s.note || '—' }
        ];
    var body = rows.map(function (r) { return r.k + ': ' + r.v; }).join('\n');
    var mailto = 'mailto:' + RSVP_EMAIL + '?subject=' + encodeURIComponent('RSVP · Miami Art Week · ' + (s.name || 'Guest')) + '&body=' + encodeURIComponent(body);
    return {
      s1: s.step === 1, s2: s.step === 2, s3: s.step === 3, s4: s.step === 4, s5: s.step === 5,
      progress: progress,
      name: s.name, setName: set('name'),
      inFlight: s.inFlight, setInFlight: set('inFlight'), inTime: s.inTime, setInTime: set('inTime'),
      outFlight: s.outFlight, setOutFlight: set('outFlight'), outTime: s.outTime, setOutTime: set('outTime'),
      tee: s.tee, setTee: set('tee'), songs: s.songs, setSongs: set('songs'),
      questions: s.questions, setQuestions: set('questions'), note: s.note, setNote: set('note'),
      attendOpts: opts('attending', ['I’m in', 'Probably', 'Can’t make it']),
      airportOpts: opts('airport', ['MIA', 'FLL', 'Other']),
      dayOpts: opts('arriveDay', ['Thursday', 'Friday', 'Saturday', 'Sunday']),
      landOpts: opts('landing', ['Morning', 'Afternoon', 'Evening', 'Late night']),
      houseTime: s.houseTime, setHouseTime: set('houseTime'),
      leaveOpts: opts('leaving', ['Saturday', 'Sunday', 'Monday', 'Tuesday']),
      leaveTimeOpts: opts('leaveTime', ['Morning', 'Afternoon', 'Evening', 'Late night']),
      mondayOpts: opts('monday', ['Working with you', 'Taking the day off']),
      extraOpts: extrasList.map(function (v) { var on = s.extras.indexOf(v) > -1; return { label: v, pressed: on ? 'true' : 'false', cls: on ? 'pill on' : 'pill', pick: toggle(v) }; }),
      stayingMonday: s.leaving === 'Monday' || s.leaving === 'Tuesday',
      block1: !s.name.trim() || !s.attending,
      block2: !s.airport || !s.arriveDay,
      block3: !s.leaving,
      next1: declined ? go(5) : go(2), next2: go(3), next3: go(4), next4: go(5), back: back,
      summary: rows, mailto: mailto,
      // save to the site (arrivals board, song requests), then the mailto link opens your email app
      submit: function () {
        try {
          fetch('/api/rsvps', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
            .then(function () { document.dispatchEvent(new CustomEvent('oe-rsvp-saved')); }).catch(function () {});
        } catch (e) {}
      }
    };
  }

  // ---- tiny template engine ----
  var HOLE = /\{\{\s*([\w.]+)\s*\}\}/g;
  var ONLY = /^\{\{\s*([\w.]+)\s*\}\}$/;
  function get(scope, path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, scope); }

  function process(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(node.nodeValue.replace(HOLE, function (_, p) { var v = get(scope, p); return v == null ? '' : v; }))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var list = get(scope, (node.getAttribute('list').match(ONLY) || [])[1]) || [];
      var as = node.getAttribute('as');
      list.forEach(function (item) {
        var sub = Object.assign({}, scope); sub[as] = item;
        node.childNodes.forEach(function (c) { process(c, sub, out); });
      });
      return;
    }
    if (tag === 'sc-if') {
      if (get(scope, (node.getAttribute('value').match(ONLY) || [])[1])) node.childNodes.forEach(function (c) { process(c, scope, out); });
      return;
    }
    var el = document.createElement(tag);
    Array.prototype.forEach.call(node.attributes, function (a) {
      var name = a.name, m = a.value.match(ONLY);
      if (/^on/.test(name) && m) {
        var fn = get(scope, m[1]);
        if (typeof fn === 'function') el.addEventListener(name === 'onchange' ? 'input' : name.slice(2), fn);
        return;
      }
      if (name === 'disabled' && m) { if (get(scope, m[1])) el.setAttribute('disabled', ''); return; }
      if (name === 'value' && m) { el.value = get(scope, m[1]) || ''; return; }
      el.setAttribute(name, a.value.replace(HOLE, function (_, p) { var v = get(scope, p); return v == null ? '' : v; }));
    });
    node.childNodes.forEach(function (c) { process(c, scope, el); });
    if (tag === 'textarea') el.value = (function () { var m = (node.getAttribute('value') || '').match(ONLY); return m ? get(scope, m[1]) || '' : el.value; })();
    out.appendChild(el);
  }

  var tpl, mount;
  function render() {
    // keep focus and caret on the field being typed in
    var active = document.activeElement, idx = -1, start, end;
    if (active && mount.contains(active) && /input|textarea/i.test(active.tagName)) {
      idx = Array.prototype.indexOf.call(mount.querySelectorAll('input,textarea'), active);
      start = active.selectionStart; end = active.selectionEnd;
    }
    var frag = document.createDocumentFragment(), scope = vals();
    tpl.content.childNodes.forEach(function (c) { process(c, scope, frag); });
    mount.replaceChildren(frag);
    if (idx > -1) { var f = mount.querySelectorAll('input,textarea')[idx]; if (f) { f.focus(); try { f.setSelectionRange(start, end); } catch (e) {} } }
  }

  document.addEventListener('DOMContentLoaded', function () {
    tpl = document.getElementById('rsvp-tpl');
    mount = document.getElementById('rsvp-app');
    if (tpl && mount) render();
  });
})();
