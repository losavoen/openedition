// "Your closet" in the Wardrobe room: a private log of looks and a list of things to buy.
// The closet belongs to this device ({ id, token } in localStorage). The closet link
// (#closet=<id>.<token>) opens the same closet on another phone or laptop.
(function () {
  var root = document.getElementById('closet');
  if (!root) return;

  var MOMENTS = ['Travel day', 'Welcome dinner · Fri', 'Art day · Sat', 'Everyday People · Sat', 'Church and Bigface · Sun', 'Casa Neos · Sun', 'Nikki Beach · Mon', 'Flying home', 'Any time'];
  var C = { looks: [], buys: [] };
  var cred = null, editing = null, busy = false;

  function $(s, el) { return (el || root).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function msg(t) { $('#closet-msg').textContent = t || ''; }
  function getCred() { try { return JSON.parse(localStorage.getItem('oe-closet') || 'null'); } catch (e) { return null; } }
  function setCred(v) { try { v ? localStorage.setItem('oe-closet', JSON.stringify(v)) : localStorage.removeItem('oe-closet'); } catch (e) {} }
  function rid() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }

  function api(method, body, q) {
    return fetch('/api/closet' + (q || ''), { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status }); return j; }); });
  }

  function resize(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var max = 900, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = function () { reject(new Error('That photo couldn’t be read. Try a JPG or PNG.')); };
      img.src = URL.createObjectURL(file);
    });
  }

  function save(note) {
    if (busy) return Promise.resolve();
    busy = true; msg('Saving…');
    var body = { looks: C.looks, buys: C.buys };
    if (cred) { body.id = cred.id; body.token = cred.token; }
    return api('POST', body).then(function (j) {
      C = j.closet; cred = { id: j.id, token: j.token }; setCred(cred);
      msg(note || 'Saved'); render();
    }).catch(function (e) { msg(e.message); }).then(function () { busy = false; });
  }

  // ---------- render ----------
  function render() {
    var toBuy = C.buys.filter(function (b) { return !b.bought; }), bought = C.buys.filter(function (b) { return b.bought; });
    var sum = function (a) { return a.reduce(function (s, b) { return s + (b.price || 0); }, 0); };
    $('#closet-count').textContent = C.looks.length + (C.looks.length === 1 ? ' look' : ' looks');
    $('#buy-count').textContent = toBuy.length ? money(sum(toBuy)) + ' to buy' + (bought.length ? ' · ' + money(sum(bought)) + ' bought' : '') : (bought.length ? 'All bought' : 'Nothing yet');

    $('#looks').innerHTML = C.looks.length ? C.looks.map(function (l) {
      var need = C.buys.filter(function (b) { return b.look === l.id && !b.bought; });
      return '<article class="look">' +
        '<button type="button" class="look-ph' + (l.photo ? '' : ' empty') + '" data-edit="' + l.id + '" aria-label="Edit ' + esc(l.title) + '">' + (l.photo ? '<img src="' + esc(l.photo) + '" alt="' + esc(l.title) + '">' : '<span class="mono cap">No photo yet</span>') + '</button>' +
        '<div class="look-lbl">' +
        '<p class="mono cap">' + esc(l.when || 'Any time') + '</p>' +
        '<p class="look-t">' + esc(l.title) + '</p>' +
        (l.pieces.length ? '<ul class="look-p">' + l.pieces.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
        (need.length ? '<p class="look-need mono cap">Still to buy: ' + need.map(function (b) { return esc(b.item); }).join(', ') + '</p>' : '') +
        (l.note ? '<p class="cap">' + esc(l.note) + '</p>' : '') +
        '<button type="button" class="pill sm" data-edit="' + l.id + '">Edit</button>' +
        '</div></article>';
    }).join('') : '<p class="mono cap closet-empty">Add your first look: a name, the pieces, and a photo of the fit or a screenshot.</p>';

    var lookName = function (id) { var l = C.looks.filter(function (x) { return x.id === id; })[0]; return l ? l.title : ''; };
    $('#buys').innerHTML = C.buys.length ? C.buys.slice().sort(function (a, b) { return a.bought - b.bought; }).map(function (b) {
      return '<li class="buy' + (b.bought ? ' done' : '') + '">' +
        '<label class="buy-chk"><input type="checkbox" data-bought="' + b.id + '"' + (b.bought ? ' checked' : '') + '><span class="sr">Bought</span></label>' +
        '<span class="buy-i"><span class="buy-n">' + esc(b.item) + '</span>' + (b.look ? '<span class="mono cap">For ' + esc(lookName(b.look)) + '</span>' : '') + '</span>' +
        '<span class="buy-r">' + (b.price ? '<span class="mono">' + money(b.price) + '</span>' : '') +
        (b.link ? '<a class="lk" href="' + esc(b.link) + '" target="_blank" rel="noopener">Shop ↗</a>' : '') +
        '<button type="button" class="buy-x" data-del-buy="' + b.id + '" aria-label="Remove ' + esc(b.item) + '">×</button></span></li>';
    }).join('') : '<li class="mono cap closet-empty">Pieces you still need. Tick them off as they arrive.</li>';

    var sel = $('#buy-form [name=look]'), cur = sel.value;
    sel.innerHTML = '<option value="">Any look</option>' + C.looks.map(function (l) { return '<option value="' + l.id + '">' + esc(l.title) + '</option>'; }).join('');
    sel.value = cur;
    $('#closet-link').hidden = !cred;

    $$('[data-edit]').forEach(function (b) { b.onclick = function () { openLook(b.getAttribute('data-edit')); }; });
    $$('[data-bought]').forEach(function (b) { b.onchange = function () { var x = C.buys.filter(function (y) { return y.id === b.getAttribute('data-bought'); })[0]; if (x) { x.bought = b.checked; save(b.checked ? 'Bought' : 'Back on the list'); } }; });
    $$('[data-del-buy]').forEach(function (b) { b.onclick = function () { C.buys = C.buys.filter(function (y) { return y.id !== b.getAttribute('data-del-buy'); }); save('Removed'); }; });
  }

  // ---------- look form ----------
  var lf = $('#look-form');
  lf.when.innerHTML = MOMENTS.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('');
  function openLook(id) {
    var l = id ? C.looks.filter(function (x) { return x.id === id; })[0] : null;
    editing = l ? l.id : null;
    lf.hidden = false;
    lf.lname.value = l ? l.title : ''; lf.when.value = l ? (l.when || 'Any time') : 'Art day · Sat';
    lf.pieces.value = l ? l.pieces.join('\n') : ''; lf.note.value = l ? l.note : ''; lf.photo.value = '';
    $('#look-form-t').textContent = l ? 'Edit look' : 'New look';
    $('#look-del').hidden = !l;
    lf.lname.focus();
    lf.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  $('#look-add').onclick = function () { openLook(null); };
  $('#look-cancel').onclick = function () { lf.hidden = true; editing = null; };
  $('#look-del').onclick = function () { C.looks = C.looks.filter(function (x) { return x.id !== editing; }); C.buys.forEach(function (b) { if (b.look === editing) b.look = ''; }); lf.hidden = true; editing = null; save('Look removed'); };
  lf.onsubmit = function (e) {
    e.preventDefault();
    var file = lf.photo.files && lf.photo.files[0];
    (file ? resize(file) : Promise.resolve(null)).then(function (photo) {
      var l = editing ? C.looks.filter(function (x) { return x.id === editing; })[0] : null;
      var data = { title: lf.lname.value.trim(), when: lf.when.value, pieces: lf.pieces.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean), note: lf.note.value.trim() };
      if (!data.title) { msg('Give the look a name'); return; }
      if (l) { Object.assign(l, data); if (photo) l.photo = photo; }
      else C.looks.push(Object.assign({ id: rid(), photo: photo || '' }, data));
      lf.hidden = true; editing = null;
      return save(l ? 'Look updated' : 'Look added');
    }).catch(function (err) { msg(err.message); });
  };

  // ---------- buy form ----------
  var bf = $('#buy-form');
  bf.onsubmit = function (e) {
    e.preventDefault();
    var item = bf.item.value.trim();
    if (!item) { msg('Add what you want to buy'); return; }
    var link = bf.link.value.trim(); if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
    C.buys.push({ id: rid(), item: item, price: parseFloat(String(bf.price.value).replace(/[^0-9.]/g, '')) || null, link: link, look: bf.look.value, bought: false });
    bf.item.value = ''; bf.price.value = ''; bf.link.value = '';
    save('Added to your list');
  };

  // ---------- another device ----------
  $('#closet-link').onclick = function () {
    if (!cred) return;
    var url = location.origin + '/#closet=' + cred.id + '.' + cred.token;
    var done = function () { msg('Link copied. Open it on your other phone or laptop. Anyone with it can see your closet.'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy your closet link', url); });
    else window.prompt('Copy your closet link', url);
  };

  // ---------- start ----------
  var m = location.hash.match(/^#closet=([a-f0-9]{12})\.([a-f0-9]{48})$/);
  if (m) { setCred({ id: m[1], token: m[2] }); history.replaceState(null, '', location.pathname + '#wardrobe'); }
  cred = getCred();
  render();
  if (cred) {
    msg('Opening your closet…');
    api('GET', null, '?id=' + cred.id + '&token=' + cred.token).then(function (j) { C = j.closet; msg(''); render(); })
      .catch(function (e) { if (e.status === 404) { cred = null; setCred(null); msg(''); } else msg(e.message); render(); });
  }
})();
