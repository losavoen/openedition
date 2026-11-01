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
    el.innerHTML = days.map(function (day) {
      var rows = byDay[day].sort(function (a, b) { return (a.airport || '').localeCompare(b.airport || '') || (LAND_ORDER.indexOf(a.landing) - LAND_ORDER.indexOf(b.landing)); });
      return '<div class="arr-day"><p style="font-weight: 550">' + esc(day) + '</p><div>' + rows.map(function (a) {
        return '<div class="arr-row"><span class="mono cap">' + esc(a.inTime || a.landing || '—') + '</span><span>' + esc(a.name) + '</span><span class="mono cap">' + esc(a.airport || '') + '</span><span class="cap">' + esc([a.inFlight, a.houseTime ? 'house ~' + a.houseTime : ''].filter(Boolean).join(' · ')) + '</span></div>';
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

  function rsvpData() { api('/api/rsvps').then(function (d) { board(d); songs(d); }).catch(function () {}); }

  document.addEventListener('DOMContentLoaded', function () {
    countdown(); liveItinerary(); config(); kit(); rsvpData();
    document.addEventListener('oe-rsvp-saved', rsvpData);
    setInterval(function () { if (!document.hidden) { countdown(); rsvpData(); } }, 60000);
  });
})();
