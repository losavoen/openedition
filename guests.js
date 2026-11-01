// "Who's coming": password gate, guest cards, and add/edit your own profile.
(function () {
  var pw = '';
  var status = 'I’m in';
  var guests = [];
  var mine = null; // { id, token } for this device

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function getMine() { try { var s = store('localStorage'); return s ? JSON.parse(s.getItem('oe-profile') || 'null') : null; } catch (e) { return null; } }
  function setMine(v) { try { var s = store('localStorage'); if (s) v ? s.setItem('oe-profile', JSON.stringify(v)) : s.removeItem('oe-profile'); } catch (e) {} }
  function getPw() { try { var s = store('sessionStorage'); return s ? s.getItem('oe-pw') || '' : ''; } catch (e) { return ''; } }
  function setPw(v) { try { var s = store('sessionStorage'); if (s) s.setItem('oe-pw', v); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function api(method, body) {
    return fetch('/api/guests', {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-guest-password': pw },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status }); return j; }); });
  }

  function msg(t) { $('guest-msg').textContent = t || ''; }

  function render() {
    var list = $('guest-list');
    if (!guests.length) { list.innerHTML = '<p class="mono cap" style="grid-column: 1 / -1">No one yet. Be the first.</p>'; return; }
    list.innerHTML = guests.map(function (g) {
      var face = g.photo ? '<img src="' + esc(g.photo) + '" alt="' + esc(g.name) + '">' : '<span class="gini">' + esc((g.name || '?').trim().charAt(0)) + '</span>';
      var ig = g.ig ? '<a class="mono cap" href="https://instagram.com/' + encodeURIComponent(g.ig) + '" target="_blank" rel="noopener">@' + esc(g.ig) + '</a>' : '';
      var you = mine && mine.id === g.id ? ' · You' : '';
      return '<article class="gcard"><span class="gph">' + face + '</span>' +
        '<p class="gname">' + esc(g.name) + '</p>' +
        (g.line ? '<p class="gline">' + esc(g.line) + '</p>' : '') +
        '<p class="gmeta mono cap"><span>' + esc(g.status) + esc(you) + '</span><span>' + esc(g.from) + '</span></p>' + ig + '</article>';
    }).join('');
  }

  function fillForm() {
    var f = $('guest-form');
    var me = mine && guests.filter(function (g) { return g.id === mine.id; })[0];
    if (mine && !me) { mine = null; setMine(null); }
    $('guest-form-title').textContent = me ? 'Edit your profile' : 'Add yourself';
    $('guest-remove').hidden = !me;
    f.name.value = me ? me.name || '' : f.name.value;
    f.line.value = me ? me.line || '' : f.line.value;
    f.from.value = me ? me.from || '' : f.from.value;
    f.ig.value = me ? (me.ig ? '@' + me.ig : '') : f.ig.value;
    setStatus(me ? me.status : status);
  }

  function setStatus(v) {
    status = v;
    Array.prototype.forEach.call($('guest-status').children, function (b) { b.className = b.getAttribute('data-v') === v ? 'pill on' : 'pill'; });
  }

  function load() {
    msg('Opening…');
    return api('GET').then(function (j) {
      guests = j.guests || [];
      setPw(pw);
      msg('');
      $('guest-gate').hidden = true;
      $('guest-area').hidden = false;
      render(); fillForm();
    }).catch(function (e) { msg(e.status === 401 ? 'That’s not the password.' : e.message); });
  }

  function resize(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 640, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!$('guest-gate')) return;
    mine = getMine();

    $('guest-gate').addEventListener('submit', function (e) {
      e.preventDefault();
      pw = e.target.password.value;
      load();
    });

    $('guest-status').addEventListener('click', function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-v');
      if (v) setStatus(v);
    });

    $('guest-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = $('guest-save');
      var file = f.photo.files && f.photo.files[0];
      btn.disabled = true; btn.textContent = 'Saving…';
      (file ? resize(file) : Promise.resolve(undefined)).then(function (photo) {
        var body = { name: f.name.value, line: f.line.value, from: f.from.value, ig: f.ig.value, status: status, photo: photo, keepPhoto: !photo };
        if (mine) { body.id = mine.id; body.token = mine.token; }
        return api('POST', body);
      }).then(function (j) {
        mine = { id: j.id, token: j.token }; setMine(mine);
        f.photo.value = '';
        return load();
      }).catch(function (err) { msg(err.message); })
        .then(function () { btn.disabled = false; btn.textContent = 'Save my profile'; });
    });

    $('guest-remove').addEventListener('click', function () {
      if (!mine) return;
      api('DELETE', { id: mine.id, token: mine.token }).then(function () {
        mine = null; setMine(null);
        $('guest-form').reset();
        return load();
      }).catch(function (err) { msg(err.message); });
    });

    pw = getPw();
    if (pw) load();
  });
})();
