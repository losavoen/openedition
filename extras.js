// Countdown, live itinerary, arrivals board, song requests, kit reveal, rooms and contacts.
(function () {
  var CFG = window.OE_CONFIG || {};
  var TRIP = { start: '2026-12-04', end: '2026-12-07' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Today's date and time in Miami
  function miamiNow() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, minutes: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

  function countdown() {
    var now = miamiNow(), d = daysBetween(now.date, TRIP.start), text;
    if (d > 1) text = d + ' days to Miami';
    else if (d === 1) text = 'Tomorrow, Miami';
    else if (daysBetween(now.date, TRIP.end) >= 0) text = 'We’re in Miami';
    else text = 'Thank you, Miami';
    Array.prototype.forEach.call(document.querySelectorAll('.ticker .cd'), function (el) { el.textContent = text; });
  }

  function liveItinerary() {
    var now = miamiNow();
    var ids = ['fri', 'sat', 'sun', 'mon'];
    var i = daysBetween(TRIP.start, now.date);
    if (i < 0 || i > 3) return;
    var card = document.querySelectorAll('.cards .card')[i];
    if (card) card.classList.add('today');
    var art = $(ids[i]);
    if (!art) return;
    art.classList.add('today');
    var rows = art.querySelectorAll('.ros'), current = null;
    Array.prototype.forEach.call(rows, function (r) {
      var t = (r.querySelector('.mono') || {}).textContent || '';
      var m = t.match(/^(\d{1,2}):(\d{2})/);
      if (m && parseInt(m[1], 10) * 60 + parseInt(m[2], 10) <= now.minutes) current = r;
    });
    if (current) current.classList.add('now');
  }

  function api(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  var DAY_ORDER = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'];
  var LAND_ORDER = ['Morning', 'Afternoon', 'Evening', 'Late night'];
  function board(data) {
    var el = $('arrivals'); if (!el) return;
    var list = (data.arrivals || []).filter(function (a) { return a.arriveDay || a.airport; });
    if (!list.length) { el.innerHTML = '<p class="cap" style="padding: 18px 0">No arrivals yet. They show up here as people RSVP.</p>'; return; }
    var byDay = {};
    list.forEach(function (a) { var k = a.arriveDay || 'Day not set'; (byDay[k] = byDay[k] || []).push(a); });
    var days = Object.keys(byDay).sort(function (a, b) { return (DAY_ORDER.indexOf(a) + 1 || 99) - (DAY_ORDER.indexOf(b) + 1 || 99); });
    // Ride groups: same day + same airport + same landing window share one Uber.
    // The first person listed is the ride captain (they call the car).
    el.innerHTML = days.map(function (day) {
      var groups = {};
      byDay[day].forEach(function (a) { var k = (a.airport || 'Airport TBC') + ' · ' + (a.landing || 'Time TBC'); (groups[k] = groups[k] || []).push(a); });
      var keys = Object.keys(groups).sort(function (x, y) {
        var ax = x.split(' · '), ay = y.split(' · ');
        return ax[0].localeCompare(ay[0]) || (LAND_ORDER.indexOf(ax[1]) - LAND_ORDER.indexOf(ay[1]));
      });
      var rideNo = 0;
      return '<div class="arr-day"><p style="font-weight: 550">' + esc(day) + '</p><div>' + keys.map(function (k, gi) {
        var people = groups[k];
        var who = people.map(function (a, i) {
          var bits = [a.inTime, a.inFlight].filter(Boolean).join(', ');
          return '<span>' + esc(a.name) + (i === 0 && people.length > 1 ? ' <span class="mono cap">(calls the Uber)</span>' : '') + (bits ? ' <span class="mono cap">' + esc(bits) + '</span>' : '') + '</span>';
        }).join('<br>');
        var label = people.length > 1 ? 'Ride ' + (++rideNo) + ' · ' + people.length + ' people' : 'Solo for now';
        return '<div class="ride"><span class="mono cap">' + esc(k) + '<br>' + esc(label) + '</span><span>' + who + '</span></div>';
      }).join('') + '</div></div>';
    }).join('');
  }

  function songs(data) {
    var el = $('song-requests'); if (!el) return;
    var list = data.songs || [];
    el.innerHTML = list.map(function (s, i) {
      return '<div class="trk-row"><span class="mono cap ip">' + (i === 0 ? 'Req.' : '') + '</span><span style="font-weight: 550">' + esc(s.songs) + '</span><span class="cap">Requested by ' + esc(s.name) + '</span><span class="mono cap">RSVP</span></div>';
    }).join('');
  }

  function kit() {
    api('/api/kit').then(function (j) {
      if (!j.open || !j.items || !j.items.length) return;
      var el = $('kit-items'); if (!el) return;
      el.innerHTML = j.items.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');
      el.hidden = false;
      var label = document.querySelector('#kit .sh span:last-child'); if (label) label.textContent = 'Opened';
    }).catch(function () {});
  }

  function config() {
    if (CFG.rooms && CFG.rooms.length && $('rooms')) {
      $('rooms').innerHTML = CFG.rooms.map(function (r) {
        return '<div><span class="mono cap">' + esc(r.room) + (r.beds ? ' · ' + esc(r.beds) : '') + '</span><span style="font-weight: 550">' + esc(r.people || 'Open') + '</span></div>';
      }).join('');
    }
    if (CFG.payMethods && $('pay-methods')) $('pay-methods').textContent = CFG.payMethods;
    var bits = [];
    if (CFG.hostPhone) bits.push((CFG.hostName || 'Me') + ': ' + CFG.hostPhone);
    if (CFG.backupContact) bits.push('Backup: ' + CFG.backupContact);
    if (bits.length && $('host-contact')) $('host-contact').textContent = ' ' + bits.join('. ') + '.';
  }

  function house() {
    api('/api/house').then(function (j) {
      if (j.pay) Array.prototype.forEach.call(document.querySelectorAll('[data-house="pay"]'), function (el) { el.textContent = j.pay; });
      if (!j.address) return;
      Array.prototype.forEach.call(document.querySelectorAll('[data-house="address"]'), function (el) { el.textContent = j.address; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-house="map"]'), function (el) { el.href = j.maps; });
    }).catch(function () {});
  }

  // Bottom nav: slides up while you scroll (past the hero), hides a moment after you stop.
  function dock() {
    var nav = $('dock'); if (!nav) return;
    var hero = document.querySelector('.hero'), list = $('dk-list'), btn = $('dk-idx'), prog = $('dk-prog');
    var rooms = Array.prototype.slice.call(list.querySelectorAll('a[data-n]'));
    var quick = Array.prototype.slice.call(nav.querySelectorAll('.dk-quick a'));
    var now = $('dk-now'), nEl = $('dk-n'), tEl = $('dk-t'), queued = false;
    function open(v) { list.hidden = !v; btn.setAttribute('aria-expanded', v ? 'true' : 'false'); btn.querySelector('span').textContent = v ? 'close' : 'index'; }
    function update() {
      queued = false;
      var past = !hero || hero.getBoundingClientRect().bottom < window.innerHeight * 0.5;
      nav.classList.toggle('show', past || !list.hidden);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
      var mid = window.innerHeight * 0.4, on = rooms[0];
      rooms.forEach(function (a) { var el = document.querySelector(a.getAttribute('href')); if (el && el.getBoundingClientRect().top <= mid) on = a; });
      rooms.forEach(function (a) { a.classList.toggle('on', a === on); });
      quick.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === on.getAttribute('href')); });
      if (nEl.textContent !== on.getAttribute('data-n')) {
        nEl.textContent = on.getAttribute('data-n');
        tEl.textContent = on.textContent.replace(/^\d+/, '');
        now.setAttribute('href', on.getAttribute('href'));
      }
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    btn.addEventListener('click', function () { open(list.hidden); update(); });
    list.addEventListener('click', function (e) { if (e.target.closest('a')) open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { open(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!list.hidden && !nav.contains(e.target)) open(false); });
    nav.addEventListener('focusin', function () { nav.classList.add('show'); });
    update();
  }


  // The tab: shared costs logged during the trip, settled into who-owes-who.
  var tabNames = [], tabSplit = null;
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }
  function tabTokens() { try { return JSON.parse(localStorage.getItem('oe-tab') || '{}'); } catch (e) { return {}; } }
  function saveToken(id, t) { try { var o = tabTokens(); o[id] = t; localStorage.setItem('oe-tab', JSON.stringify(o)); } catch (e) {} }
  function settle(items) {
    var bal = {};
    items.forEach(function (it) {
      var people = it.split && it.split.length ? it.split : tabNames;
      if (!people.length) return;
      var share = it.amount / people.length;
      bal[it.paidBy] = (bal[it.paidBy] || 0) + it.amount;
      people.forEach(function (p) { bal[p] = (bal[p] || 0) - share; });
    });
    // greedy: biggest debtor pays biggest creditor
    var cred = [], debt = [];
    Object.keys(bal).forEach(function (k) { var v = Math.round(bal[k] * 100) / 100; if (v > 0.009) cred.push([k, v]); else if (v < -0.009) debt.push([k, -v]); });
    cred.sort(function (a, b) { return b[1] - a[1]; }); debt.sort(function (a, b) { return b[1] - a[1]; });
    var out = [], i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      var amt = Math.min(debt[i][1], cred[j][1]);
      out.push({ from: debt[i][0], to: cred[j][0], amount: amt });
      debt[i][1] -= amt; cred[j][1] -= amt;
      if (debt[i][1] < 0.01) i++; if (cred[j][1] < 0.01) j++;
    }
    return out;
  }
  function renderSplit() {
    var box = $('tab-split'); if (!box) return;
    if (!tabNames.length) { box.innerHTML = '<span class="mono cap">Everyone coming</span>'; return; }
    if (!tabSplit) tabSplit = tabNames.slice();
    box.innerHTML = tabNames.map(function (n) { var on = tabSplit.indexOf(n) > -1; return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-n="' + esc(n) + '" aria-pressed="' + on + '">' + esc(n) + '</button>'; }).join('');
    $('tab-names').innerHTML = tabNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('');
  }
  function loadTab() {
    if (!$('tab')) return;
    api('/api/tab').then(function (j) {
      var items = j.items || [], mine = tabTokens();
      var plan = settle(items);
      $('tab-balances').innerHTML = plan.length ? plan.map(function (p) { return '<p><span>' + esc(p.from) + ' → ' + esc(p.to) + '</span><span class="mono cap">' + money(p.amount) + '</span></p>'; }).join('') : '<p class="mono cap">' + (items.length ? 'All square.' : 'Nothing on the tab yet.') + '</p>';
      var total = items.reduce(function (a, it) { return a + it.amount; }, 0);
      $('tab-list').innerHTML = items.length ? '<p class="mono cap" style="margin-bottom: 6px">' + items.length + ' items · ' + money(total) + ' total</p>' + items.map(function (it) {
        return '<div class="tab-row"><span>' + esc(it.what) + '</span><span class="mono cap">' + money(it.amount) + '</span><span class="cap">Paid by ' + esc(it.paidBy) + '</span><span class="cap">Split: ' + esc((it.split && it.split.length ? it.split : ['everyone']).join(', ')) + '</span>' + (mine[it.id] ? '<button type="button" data-del="' + esc(it.id) + '">Remove</button>' : '<span></span>') + '</div>';
      }).join('') : '';
    }).catch(function () {});
  }
  function tabSetup() {
    var f = $('tab-form'); if (!f) return;
    $('tab-split').addEventListener('click', function (e) {
      var n = e.target.getAttribute && e.target.getAttribute('data-n'); if (!n) return;
      tabSplit = tabSplit.indexOf(n) > -1 ? tabSplit.filter(function (x) { return x !== n; }) : tabSplit.concat(n);
      renderSplit();
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = { what: f.what.value, amount: parseFloat(f.amount.value), paidBy: f.paidBy.value, split: tabNames.length ? tabSplit : [] };
      if (tabNames.length && !body.split.length) { $('tab-msg').textContent = 'Pick at least one person.'; return; }
      fetch('/api/tab', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Try again'); return j; }); })
        .then(function (j) { saveToken(j.id, j.token); f.what.value = ''; f.amount.value = ''; $('tab-msg').textContent = 'Added.'; loadTab(); })
        .catch(function (err) { $('tab-msg').textContent = err.message; });
    });
    $('tab-list').addEventListener('click', function (e) {
      var id = e.target.getAttribute && e.target.getAttribute('data-del'); if (!id) return;
      fetch('/api/tab', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, token: tabTokens()[id] }) }).then(loadTab);
    });
  }

  // Song requests: saved and emailed to the host by /api/songs.
  function songForm() {
    var f = document.getElementById('song-form'); if (!f) return;
    var msg = document.getElementById('sr-msg'), btn = document.getElementById('sr-send');
    try { var who = JSON.parse(localStorage.getItem('oe-app-name') || 'null'); if (who && !f.name.value) f.name.value = who; } catch (e) {}
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = { name: f.name.value.trim(), song: f.song.value.trim(), artist: f.artist.value.trim(), moment: f.moment.value, website: f.website.value };
      if (!body.name || !body.song) { msg.textContent = 'Add your name and the song.'; return; }
      btn.disabled = true; btn.textContent = 'Sending…'; msg.textContent = '';
      fetch('/api/songs', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Couldn’t send that. Try again.'); return j; }); })
        .then(function () { msg.textContent = 'Sent. “' + body.song + '” is in the queue.'; f.song.value = ''; f.artist.value = ''; f.moment.value = 'Anytime'; })
        .catch(function (err) { msg.textContent = err.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send request'; });
    });
  }
  function rsvpData() { api('/api/rsvps').then(function (d) { board(d); songs(d); tabNames = (d.arrivals || []).map(function (a) { return a.name; }).filter(Boolean); renderSplit(); }).catch(function () {}); }

  document.addEventListener('DOMContentLoaded', function () {
    countdown(); liveItinerary(); config(); kit(); house(); dock(); tabSetup(); rsvpData(); loadTab(); songForm();
    document.addEventListener('oe-rsvp-saved', rsvpData);
    setInterval(function () { if (!document.hidden) { countdown(); rsvpData(); } }, 60000);
  });
})();
