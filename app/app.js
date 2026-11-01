// Open Edition — the app.
// A pocket version of the show for the four days in Miami: what's on now, a camera
// with a 24-frame roll per day, a darkroom where photos develop overnight, the four
// rooms (days), and everyone who's coming. It opens on Friday, December 4.
//
// URL switches (for previews and the launch video):
//   ?preview          open the app before the trip, as if it's Friday at 2:10pm
//   ?at=sat-16:45     pretend it's this day and time in Miami
//   ?sample           fill the app with sample photos so every screen has content
(function () {
  'use strict';

  var TRIP = { start: '2026-12-04', end: '2026-12-07' };
  var Q = new URLSearchParams(location.search);
  var SAMPLE = Q.has('sample');
  var PREVIEW = Q.has('preview') || SAMPLE || Q.has('at');
  var ROLL = 24;
  var A = '/assets/';
  var INVITED = ['Ilelosa', 'Simi', 'Nero', 'Sayo', 'Nicole', 'Chiara'];
  var PLAYLIST = 'https://open.spotify.com/playlist/6nVE5YsGJgZkczU6wE9S9C';

  var LENSES = [
    { id: 'gallery', name: 'Gallery', note: 'Black and white, a little contrast. For people and places.', css: 'grayscale(1) contrast(1.08)' },
    { id: 'golden', name: 'Golden hour', note: 'Warm film colour with a soft light leak. For the boat and the beach.', css: 'sepia(0.35) saturate(1.2) contrast(1.05) brightness(1.03)' },
    { id: 'tape', name: 'Night tape', note: 'Camcorder colour, scan lines and a date stamp. For after dark.', css: 'saturate(0.8) contrast(1.15) brightness(0.95)' },
    { id: 'clean', name: 'Clean', note: 'Your photo exactly as you took it.', css: 'none' }
  ];
  var DAY_HERO = {
    Friday: A + 'c4eb66219cdb3bccb6a3bd147e0dcdea.jpg',
    Saturday: A + '9208bb2aa1b5568c58d43073ad5e76c6.jpg',
    Sunday: A + 'f74d28082aed0a2416fb3f59121b5f88.jpg',
    Monday: A + 'f63505a42750c5a52910c41fafde0526.jpg'
  };

  // ---------- small helpers ----------
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('oe-app-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('oe-app-' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2400); }
  function api(path, opts) {
    return fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status }); return j; }); });
  }

  // ---------- time (always Miami) ----------
  function realMiami() {
    var o = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  var DAYKEYS = { fri: '2026-12-04', sat: '2026-12-05', sun: '2026-12-06', mon: '2026-12-07' };
  function now() {
    var at = Q.get('at');
    if (at) { var m = at.match(/^(fri|sat|sun|mon)-(\d{1,2}):(\d{2})$/); if (m) return { date: DAYKEYS[m[1]], min: +m[2] * 60 + +m[3] }; }
    var r = realMiami();
    if (PREVIEW && r.date < TRIP.start) return { date: TRIP.start, min: 14 * 60 + 10 };
    return r;
  }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function miamiDateOf(iso) {
    var o = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).forEach(function (p) { o[p.type] = p.value; });
    return o.year + '-' + o.month + '-' + o.day;
  }
  function toMin(t) { var m = String(t).match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }
  function clock(min) { var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + (m ? ':' + String(m).padStart(2, '0') : '') + ap; }

  // Darkroom: frames develop the next morning at 9. Monday's develop at 9pm, before flights.
  function developsAt(m) {
    var d = m.createdAt ? miamiDateOf(m.createdAt) : (DAYKEYS[(m.day || '').slice(0, 3).toLowerCase()] || TRIP.start);
    if (d >= TRIP.end) return { date: TRIP.end, min: 21 * 60 };
    var next = new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
    return { date: next, min: 9 * 60 };
  }
  function developed(m, n) { var at = developsAt(m); return n.date > at.date || (n.date === at.date && n.min >= at.min); }

  // ---------- data ----------
  var S = { days: [], memories: [], guests: [], arrivals: [], house: null, tab: [], kit: null, name: store.get('name', ''), lens: store.get('lens', 'gallery') };

  function sampleMemories() {
    var t = function (d, h) { return new Date(Date.parse(d + 'T' + h + ':00-05:00')).toISOString(); };
    var mk = function (name, day, date, h, kind, img, note) { return { id: name + h + date, name: name, day: day, kind: kind, note: note || '', createdAt: t(date, h), media: [{ url: A + img, type: /\.mp4$/.test(img) ? 'video' : 'image' }] }; };
    return [
      mk('Ilelosa', 'Friday', '2026-12-04', '11:05', 'memory', 'f63505a42750c5a52910c41fafde0526.jpg', 'Wheels down.'),
      mk('Simi', 'Friday', '2026-12-04', '12:40', 'daily', '33b2dca8bf23bad75dc01309e0e0694f.jpg'),
      mk('Simi', 'Friday', '2026-12-04', '15:10', 'memory', 'ce9c479ce68a77630ab0c0e8cee3ed96.jpg', 'Lost everyone within five minutes.'),
      mk('Nero', 'Friday', '2026-12-04', '22:30', 'memory', '45d3085f470d21e1b85bcaedd49351e5.jpg'),
      mk('Sayo', 'Friday', '2026-12-04', '19:40', 'fit', 'd6d17608513a701b079d98bc3ec87c83.jpg'),
      mk('Nicole', 'Saturday', '2026-12-05', '10:20', 'daily', 'a84798b4498739329e65cf17fed751f2.jpg'),
      mk('Sayo', 'Saturday', '2026-12-05', '12:15', 'memory', '6d5b2c5b16a2856583fe6d970384b8b9.jpg'),
      mk('Ilelosa', 'Saturday', '2026-12-05', '17:20', 'memory', 'sample/boat.mp4', 'Nobody talked for ten minutes.'),
      mk('Chiara', 'Saturday', '2026-12-05', '18:05', 'memory', '1c8c9309193976c9a4e1ebbffde5c892.jpg'),
      mk('Nero', 'Saturday', '2026-12-05', '20:00', 'fit', '04489c978cf8f115fbac43843951a9a7.jpg')
    ];
  }

  function loadAll() {
    var jobs = [
      fetch('/app/itinerary.json').then(function (r) { return r.json(); }).then(function (j) { S.days = j.days || []; }).catch(function () {}),
      api('/api/guests').then(function (j) { S.guests = j.guests || []; }).catch(function () {}),
      api('/api/rsvps').then(function (j) { S.arrivals = j.arrivals || []; }).catch(function () {}),
      api('/api/house').then(function (j) { S.house = j.address ? j : null; }).catch(function () {}),
      api('/api/tab').then(function (j) { S.tab = j.items || []; }).catch(function () {}),
      api('/api/kit').then(function (j) { S.kit = j.open ? j.items : null; }).catch(function () {}),
      loadGame()
    ];
    if (SAMPLE) S.memories = sampleMemories();
    else jobs.push(api('/api/memories').then(function (j) { S.memories = j.memories || []; }).catch(function () {}));
    return Promise.all(jobs);
  }

  function today() {
    var n = now(), i = daysBetween(TRIP.start, n.date);
    i = Math.max(0, Math.min(3, i));
    return { n: n, i: i, day: S.days[i] };
  }

  // ---------- navigation ----------
  var current = 'now';
  function show(id) {
    $$('.screen').forEach(function (s) { s.classList.remove('on'); });
    var el = $('#s-' + id); el.classList.add('on');
    current = id;
    $$('.tabs [data-go]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-go') === id); });
    var R_ = { now: renderNow, rooms: renderRooms, dark: renderDark, guests: renderGuests, play: renderPlay }; if (R_[id]) R_[id]();
    window.scrollTo(0, 0);
  }

  // ---------- gate (before Friday) ----------
  function renderGate() {
    var el = $('#s-gate');
    function tick() {
      var target = Date.parse('2026-12-04T00:00:00-05:00'), d = Math.max(0, target - Date.now());
      var parts = [Math.floor(d / 864e5), Math.floor(d / 36e5) % 24, Math.floor(d / 6e4) % 60, Math.floor(d / 1e3) % 60];
      $$('.count b', el).forEach(function (b, i) { b.textContent = String(parts[i]).padStart(2, '0'); });
    }
    el.innerHTML = '<div class="gate">' +
      '<div style="display:flex;justify-content:space-between"><span class="mono">Open Edition</span><span class="mono muted">(miami art week)</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:22px">' +
      '<p class="mono muted">The app</p><h1 class="big">Doors<br>open<br>Friday</h1>' +
      '<p style="font-size:17px;max-width:320px" class="muted">This opens on December 4, the day we land. Until then, everything you need is on the site.</p>' +
      '<div class="count"><div><b>00</b><span class="mono muted">days</span></div><div><b>00</b><span class="mono muted">hrs</span></div><div><b>00</b><span class="mono muted">min</span></div><div><b>00</b><span class="mono muted">sec</span></div></div>' +
      '</div>' +
      '<a class="btn ghost full" href="/">Back to the site</a></div>';
    tick(); setInterval(tick, 1000);
  }

  // ---------- onboarding ----------
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
  function standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone; }

  function renderOb(step) {
    var el = $('#s-ob'), steps = 4;
    var dots = '<div class="dots">' + Array.apply(null, Array(steps)).map(function (_, i) { return '<i class="' + (i === step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    var body = '';
    if (step === 0) body =
      '<div class="stage"><p class="mono muted">December 4–7, 2026 · Miami</p><h1 class="big">Open<br>Edition</h1><p class="cutive" style="font-size:20px">(miami art week)</p>' +
      '<p style="font-size:18px;max-width:320px">A group show in four days. Everyone’s in it, and everyone’s shooting it.</p></div>' + dots +
      '<button class="btn full" data-ob="1">Begin</button>';
    if (step === 1) body =
      '<div class="stage"><p class="mono muted">01 · You</p><h2 style="font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:550">What should the label say?</h2>' +
      '<input class="field" id="ob-name" maxlength="40" placeholder="Your first name" value="' + esc(S.name) + '" autocomplete="given-name">' +
      '<p class="muted" style="font-size:14px">This goes on your photos and on the tape.</p></div>' + dots +
      '<button class="btn full" data-ob="2" id="ob-next">Next</button>';
    if (step === 2) body =
      '<div class="stage" style="gap:16px"><p class="mono muted">02 · Your lens</p><h2 style="font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:550">Pick how you see the weekend</h2>' +
      '<div class="lenses" id="ob-lenses">' + LENSES.map(function (l, i) {
        var img = [A + '45d3085f470d21e1b85bcaedd49351e5.jpg', A + '9208bb2aa1b5568c58d43073ad5e76c6.jpg', A + '1c8c9309193976c9a4e1ebbffde5c892.jpg', A + 'f74d28082aed0a2416fb3f59121b5f88.jpg'][i];
        return '<button class="lens' + (S.lens === l.id ? ' on' : '') + '" data-lens="' + l.id + '" style="padding:0;background:#000;cursor:pointer"><img src="' + img + '" alt="" style="filter:' + l.css + '"><span><p style="font-weight:550;font-size:20px;color:#fff;text-align:left">' + l.name + '</p><p class="mono" style="color:#ddd;text-align:left;margin-top:4px;line-height:1.5">' + l.note + '</p></span></button>';
      }).join('') + '</div><p class="muted" style="font-size:14px">You can switch any time in the camera. Originals aren’t kept, so the lens is part of the photo.</p></div>' + dots +
      '<button class="btn full" data-ob="3">Next</button>';
    if (step === 3) {
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      var install = standalone() ? '<p class="mono muted">Installed. You’re all set.</p>'
        : deferredInstall ? '<button class="btn ghost full" id="ob-install">Add Open Edition to your home screen</button>'
        : '<div class="card"><p class="mono muted" style="margin-bottom:8px">Keep it on your home screen</p><p style="font-size:14px">' + (ios ? 'Tap the Share button in Safari, then “Add to Home Screen”.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”.') + '</p></div>';
      body = '<div class="stage" style="gap:18px"><p class="mono muted">03 · How it works</p><h2 style="font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:550">Three things to know</h2>' +
        '<div class="steps">' +
        '<div><b>1</b><p><span style="font-weight:550">Take photos with the round button.</span> <span class="muted">You get 24 a day, so make them count.</span></p></div>' +
        '<div><b>2</b><p><span style="font-weight:550">They show up the next morning at 9.</span> <span class="muted">Like film. Nobody sees anything until then, so we stay off our phones at dinner.</span></p></div>' +
        '<div><b>3</b><p><span style="font-weight:550">On Sunday night we watch them together.</span> <span class="muted">Everyone’s photos become one video, the tape.</span></p></div>' +
        '</div>' + install + '</div>' + dots + '<button class="btn full" id="ob-done">Start</button>';
    }
    el.innerHTML = '<div class="ob">' + body + '</div>';
    $$('[data-ob]', el).forEach(function (b) {
      b.onclick = function () {
        if (step === 1) { var v = $('#ob-name').value.trim(); if (!v) { toast('Add your name first'); return; } S.name = v; store.set('name', v); }
        renderOb(+b.getAttribute('data-ob'));
      };
    });
    $$('[data-lens]', el).forEach(function (b) { b.onclick = function () { S.lens = b.getAttribute('data-lens'); store.set('lens', S.lens); $$('[data-lens]', el).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    var ins = $('#ob-install'); if (ins) ins.onclick = function () { deferredInstall.prompt(); deferredInstall.userChoice.finally(function () { deferredInstall = null; renderOb(3); }); };
    var done = $('#ob-done'); if (done) done.onclick = function () { store.set('onboarded', true); enter(); };
  }


  // ---------- looks (background themes, Slack-style picker) ----------
  var THEMES = [
    { id: 'night', name: 'Night', sw: ['#0E0E0D', '#F2F2EE'] },
    { id: 'gallery', name: 'Gallery white', sw: ['#FFFFFF', '#1C1C1A'] },
    { id: 'blush', name: 'Blush', sw: ['#F8ECEA', '#1C1C1A'] },
    { id: 'mist', name: 'Mist', sw: ['#D8E2DC', '#1C1C1A'] },
    { id: 'sage', name: 'Sage', sw: ['#DCE2BE', '#1C1C1A'] },
    { id: 'peri', name: 'Periwinkle', sw: ['#A2AEDA', '#1C1C1A'] }
  ];
  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    var t = THEMES.filter(function (x) { return x.id === id; })[0] || THEMES[0];
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.sw[0]);
  }
  applyTheme(store.get('theme', 'gallery'));

  // ---------- sending to iMessage / WhatsApp ----------
  // The phone's share sheet is how a web app hands photos to Messages or WhatsApp.
  function shareText(text) {
    if (navigator.share) return navigator.share({ text: text }).catch(function () {});
    sheet('<p class="mono muted">Send</p><h2 style="font-size:28px;margin:12px 0 16px;letter-spacing:-0.03em">Where to?</h2>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><a class="btn full" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a class="btn ghost full" href="sms:&body=' + encodeURIComponent(text) + '">Messages</a>' +
      '<button class="btn ghost full" id="copy-txt">Copy text</button></div>');
    $('#copy-txt').onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Copied'); closeSheet(); }).catch(function () { toast('Couldn’t copy'); }); };
  }
  function shareMedia(url, caption) {
    var text = caption ? caption + ' · Open Edition (miami art week)' : 'From Open Edition (miami art week)';
    if (!navigator.share) return shareText(text + '\n' + url);
    fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      var ext = /video/.test(b.type) ? 'mp4' : 'jpg';
      var f = new File([b], 'open-edition.' + ext, { type: b.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], text: text });
      return navigator.share({ text: text, url: url });
    }).catch(function () {});
  }
  function afterPost() {
    var url = cam.blob ? URL.createObjectURL(cam.blob) : '';
    sheet('<p class="mono muted">Posted</p><h2 style="font-size:28px;margin:12px 0 8px;letter-spacing:-0.03em">It’s in. Everyone sees it tomorrow at 9am.</h2>' +
      '<p class="muted" style="font-size:14px;margin-bottom:18px">Want to send it to the group chat now too?</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><button class="btn full" id="send-now">Send to iMessage or WhatsApp</button><button class="btn ghost full" id="send-later">Keep it a surprise</button></div>');
    var note = $('#cam-note').value.trim();
    $('#send-now').onclick = function () { shareMedia(url, note); closeSheet(); };
    $('#send-later').onclick = closeSheet;
  }

  // ---------- settings ----------
  function sheetSettings() {
    var cur = store.get('theme', 'gallery');
    sheet('<p class="mono muted">Settings</p><h2 style="font-size:30px;margin:12px 0 18px;letter-spacing:-0.03em">Make it yours</h2>' +
      '<p class="mono" style="margin-bottom:10px">Background</p>' +
      '<div class="themes">' + THEMES.map(function (t) {
        return '<button data-theme-pick="' + t.id + '" class="' + (t.id === cur ? 'on' : '') + '"><span class="sw" style="background:' + t.sw[0] + '"><i style="background:' + t.sw[1] + '"></i><i style="background:' + t.sw[1] + ';width:40%"></i></span><span style="font-size:13px">' + t.name + '</span></button>';
      }).join('') + '</div>' +
      '<p class="mono" style="margin:22px 0 10px">Your name</p><input class="field" id="set-name" maxlength="40" value="' + esc(S.name) + '">' +
      '<p class="mono" style="margin:22px 0 10px">Group chat link</p><input class="field" id="set-chat" placeholder="Paste the WhatsApp group invite link" value="' + esc(store.get('chat', '')) + '">' +
      '<p class="muted" style="font-size:13px;margin-top:8px">In WhatsApp: group info → Invite via link → Copy. For iMessage, leave it blank and we’ll open Messages.</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:22px"><button class="btn full" id="set-save">Save</button><button class="btn ghost full" id="set-how">Show me how it works again</button></div>');
    $$('[data-theme-pick]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-theme-pick'); store.set('theme', id); applyTheme(id); $$('[data-theme-pick]').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('#set-save').onclick = function () { var n = $('#set-name').value.trim(); if (n) { S.name = n; store.set('name', n); } store.set('chat', $('#set-chat').value.trim()); closeSheet(); toast('Saved'); show(current); };
    $('#set-how').onclick = function () { closeSheet(); store.set('coach', true); $('#tabs').classList.add('hide'); $$('.screen').forEach(function (x) { x.classList.remove('on'); }); $('#s-ob').classList.add('on'); renderOb(3); };
  }
  function openChat() {
    var link = store.get('chat', '');
    if (link) return window.open(link, '_blank');
    sheet('<p class="mono muted">Group chat</p><h2 style="font-size:28px;margin:12px 0 16px;letter-spacing:-0.03em">Open the chat</h2>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><a class="btn full" href="whatsapp://">Open WhatsApp</a><a class="btn ghost full" href="sms:">Open Messages</a><button class="btn ghost full" id="chat-set">Save our group link</button></div>');
    $('#chat-set').onclick = sheetSettings;
  }


  // ---------- Spotted: the trip game ----------
  var SQ = [
    'A banana taped to a wall', 'Head-to-toe white linen', 'A Lambo or a Rolls on Collins', 'A neon sign with a quote',
    'A dog dressed better than us', 'Art or a fire exit?', 'An artist at their own booth', 'Two of us in matching outfits',
    'A pink building', 'A flamingo, real or not', 'Someone filming a “day in my life”', 'A celebrity sighting',
    'A piece that costs more than a house', 'A stranger compliments your fit', 'Cafecito at a ventanita', 'Sunset from the water'
  ];
  var COUNTERS = [
    { id: 'giving', label: 'Times someone said “it’s giving”' }, { id: 'lost', label: 'Times we lost someone at the fair' },
    { id: 'lambo', label: 'Lambos spotted' }, { id: 'uber', label: 'Ubers called' },
    { id: 'skip', label: 'Songs skipped on the aux' }, { id: 'banana', label: 'Bananas on walls' }
  ];
  var LINES = (function () { var L = [], r, c; for (r = 0; r < 4; r++) L.push([0, 1, 2, 3].map(function (x) { return r * 4 + x; })); for (c = 0; c < 4; c++) L.push([0, 1, 2, 3].map(function (x) { return x * 4 + c; })); L.push([0, 5, 10, 15], [3, 6, 9, 12]); return L; })();
  S.game = { players: [], tallies: {} };
  function sampleGame() {
    var sp = function (ids) { var o = {}; ids.forEach(function (i) { o[i] = { photo: '' }; }); return o; };
    var players = [
      { name: 'Simi', spotted: sp([0, 1, 2, 3, 5, 9, 14]) }, { name: 'Ilelosa', spotted: sp([0, 4, 8, 12, 6, 15]) },
      { name: 'Nero', spotted: sp([2, 7, 10, 13]) }, { name: 'Sayo', spotted: sp([1, 11]) }, { name: 'Nicole', spotted: sp([3, 8, 15]) }, { name: 'Chiara', spotted: sp([0, 6]) }
    ];
    players.forEach(function (p) { var sc = scoreOf(p.spotted); p.squares = sc.squares; p.bingos = sc.bingos; p.points = sc.points; });
    players.sort(function (a, b) { return b.points - a.points; });
    return { players: players, tallies: { giving: 14, lost: 3, lambo: 22, uber: 9, skip: 31, banana: 2 } };
  }
  function scoreOf(sp) { var ids = Object.keys(sp || {}).map(Number), has = {}; ids.forEach(function (i) { has[i] = 1; }); var b = LINES.filter(function (l) { return l.every(function (i) { return has[i]; }); }).length; return { squares: ids.length, bingos: b, points: ids.length + b * 3 }; }
  function me() { var k = (S.name || '').toLowerCase().split(' ')[0]; return S.game.players.filter(function (p) { return p.name.toLowerCase().split(' ')[0] === k; })[0] || { name: S.name, spotted: {}, squares: 0, bingos: 0, points: 0 }; }
  function loadGame() { if (SAMPLE) { if (!S.game.players.length) S.game = sampleGame(); return Promise.resolve(); } return api('/api/game').then(function (j) { S.game = j; }).catch(function () {}); }

  function renderPlay() {
    var el = $('#s-play'), mine = me(), sp = mine.spotted || {};
    var rank = S.game.players.indexOf(S.game.players.filter(function (p) { return p === mine; })[0]) + 1;
    var lit = {}; LINES.forEach(function (l) { if (l.every(function (i) { return sp[i]; })) l.forEach(function (i) { lit[i] = 1; }); });
    el.innerHTML = '<div class="top"><button class="x" data-back aria-label="Back to today">←</button><span class="mono muted">The trip game</span></div>' +
      '<div class="hello"><h1 class="big">Spotted</h1><p style="font-size:15px;margin-top:12px;max-width:340px">See it, snap it, tap it. One point a square, three extra for every full line. The winner gets crowned at the Sunday screening.</p></div>' +
      '<div class="scorebar"><div><b>' + (mine.squares || 0) + '<span>/16</span></b><span class="mono muted">Spotted</span></div><div><b>' + (mine.bingos || 0) + '</b><span class="mono muted">Lines</span></div><div><b>' + (mine.points || 0) + '</b><span class="mono muted">Points</span></div><div><b>' + (rank > 0 ? '#' + rank : '—') + '</b><span class="mono muted">Place</span></div></div>' +
      '<div class="bingo">' + SQ.map(function (t, i) {
        var hit = sp[i], photo = hit && hit.photo;
        return '<button data-sq="' + i + '" class="' + (hit ? 'hit' : '') + (lit[i] ? ' lit' : '') + '">' + (photo ? '<img src="' + esc(photo) + '" alt="">' : '') + '<span class="n mono">' + String(i + 1).padStart(2, '0') + '</span><span class="t">' + esc(t) + '</span>' + (hit ? '<span class="ok">✓</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="sub"><span class="mono">The board</span><span class="mono muted">Live</span></div>' +
      '<div class="board-list">' + (S.game.players.length ? S.game.players.map(function (p, i) {
        return '<div class="lb' + (p === mine ? ' me' : '') + '"><span class="mono">' + String(i + 1).padStart(2, '0') + '</span><span style="font-weight:550">' + esc(p.name) + '</span><span class="mono muted">' + p.squares + ' sq · ' + p.bingos + ' lines</span><b>' + p.points + '</b></div>';
      }).join('') : '<p class="muted" style="font-size:14px">Nobody’s on the board yet. Spot something.</p>') + '</div>' +
      '<div class="sub"><span class="mono">Keep count</span><span class="mono muted">Everyone adds to these</span></div>' +
      '<div class="counters">' + COUNTERS.map(function (c) {
        return '<div class="counter"><p style="font-size:14px;line-height:1.25">' + c.label + '</p><div class="crow"><b>' + (S.game.tallies[c.id] || 0) + '</b><span style="display:flex;gap:6px"><button class="x" data-undo="' + c.id + '" aria-label="Undo">↺</button><button class="plus" data-plus="' + c.id + '" aria-label="Add one">+1</button></span></div></div>';
      }).join('') + '</div>';
    $('[data-back]', el).onclick = function () { show('now'); };
    $$('[data-sq]', el).forEach(function (b) { b.onclick = function () { spotSheet(+b.getAttribute('data-sq')); }; });
    $$('[data-plus]', el).forEach(function (b) { b.onclick = function () { tally(b.getAttribute('data-plus'), b); }; });
    $$('[data-undo]', el).forEach(function (b) { b.onclick = function () { untally(b.getAttribute('data-undo')); }; });
  }

  function spotSheet(i) {
    var mine = me(), hit = (mine.spotted || {})[i];
    if (hit) {
      sheet('<p class="mono muted">Square ' + String(i + 1).padStart(2, '0') + ' · spotted</p><h2 style="font-size:28px;margin:12px 0 16px;letter-spacing:-0.03em">' + esc(SQ[i]) + '</h2>' +
        (hit.photo ? '<img src="' + esc(hit.photo) + '" alt="" style="width:100%;border-radius:18px;margin-bottom:14px">' : '') +
        '<div style="display:flex;flex-direction:column;gap:10px">' + (hit.photo ? '<button class="btn full" id="sq-send">Send to the group chat</button>' : '') + '<button class="btn ghost full" id="sq-un">Unmark this square</button></div>');
      if (hit.photo) $('#sq-send').onclick = function () { shareMedia(hit.photo, 'Spotted: ' + SQ[i]); };
      $('#sq-un').onclick = function () { saveSpot(i, 'unspot'); };
      return;
    }
    sheet('<p class="mono muted">Square ' + String(i + 1).padStart(2, '0') + '</p><h2 style="font-size:28px;margin:12px 0 8px;letter-spacing:-0.03em">' + esc(SQ[i]) + '</h2><p class="muted" style="font-size:14px;margin-bottom:18px">Add a photo as proof. It goes on your card and in the tape. Photos here don’t count against your 24.</p>' +
      '<div style="display:flex;flex-direction:column;gap:10px"><label class="btn full">Take a photo<input type="file" accept="image/*" capture="environment" id="sq-cam" hidden></label>' +
      '<label class="btn ghost full">Choose from library<input type="file" accept="image/*" id="sq-lib" hidden></label>' +
      '<button class="btn ghost full" id="sq-trust">I saw it, no photo</button></div>');
    ['#sq-cam', '#sq-lib'].forEach(function (sel) { $(sel).onchange = function (e) { var f = e.target.files && e.target.files[0]; if (f) proof(i, f); }; });
    $('#sq-trust').onclick = function () { saveSpot(i, 'spot'); };
  }
  function proof(i, f) {
    if (!S.name) { toast('Add your name in Settings first'); return; }
    toast('Uploading…');
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (blob) {
        var up = SAMPLE ? Promise.resolve({ url: URL.createObjectURL(blob) }) : window.OEUpload('album/spotted-' + Date.now() + '.jpg', blob, { access: 'public', handleUploadUrl: '/api/upload', clientPayload: '{}', contentType: 'image/jpeg' });
        up.then(function (b) {
          if (!SAMPLE) api('/api/memories', { method: 'POST', body: JSON.stringify({ kind: 'memory', name: S.name, day: today().day ? today().day.day : '', note: 'Spotted: ' + SQ[i], media: [{ url: b.url, type: 'image/jpeg' }] }) }).catch(function () {});
          saveSpot(i, 'spot', b.url);
        }).catch(function (err) { toast(err.message || 'Upload failed'); });
      }, 'image/jpeg', 0.86);
    };
    img.src = URL.createObjectURL(f);
  }
  function saveSpot(i, action, photo) {
    if (!S.name) { toast('Add your name in Settings first'); return; }
    var done = function () {
      closeSheet();
      var sc = scoreOf(me().spotted);
      toast(action === 'spot' ? (sc.bingos > (me().bingos || 0) ? 'Line! +3' : 'Spotted. +1') : 'Unmarked');
      renderPlay();
    };
    if (SAMPLE) {
      var m = me(); if (S.game.players.indexOf(m) < 0) S.game.players.push(m);
      var before = m.bingos || 0;
      if (action === 'spot') m.spotted[i] = { photo: photo || '' }; else delete m.spotted[i];
      var sc = scoreOf(m.spotted); m.squares = sc.squares; m.points = sc.points;
      S.game.players.sort(function (a, b) { return b.points - a.points; });
      closeSheet(); toast(action === 'spot' ? (sc.bingos > before ? 'Line! +3' : 'Spotted. +1') : 'Unmarked'); m.bingos = sc.bingos; renderPlay(); return;
    }
    api('/api/game', { method: 'POST', body: JSON.stringify({ action: action, name: S.name, id: i, photo: photo || '' }) })
      .then(function () { return loadGame(); }).then(done).catch(function (err) { toast(err.message); });
  }
  function tally(id, btn) {
    S.game.tallies[id] = (S.game.tallies[id] || 0) + 1;
    var b = btn.closest('.counter').querySelector('b'); b.textContent = S.game.tallies[id]; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (SAMPLE) return;
    api('/api/game', { method: 'POST', body: JSON.stringify({ action: 'tally', counter: id }) }).then(function (j) { var k = store.get('taps', {}); (k[id] = k[id] || []).push(j.key); store.set('taps', k); }).catch(function () { toast('Couldn’t save that one'); });
  }
  function untally(id) {
    var k = store.get('taps', {}), key = (k[id] || []).pop();
    if (!key && !SAMPLE) { toast('Nothing of yours to undo'); return; }
    S.game.tallies[id] = Math.max(0, (S.game.tallies[id] || 0) - 1); renderPlay();
    if (SAMPLE) return;
    store.set('taps', k);
    api('/api/game', { method: 'POST', body: JSON.stringify({ action: 'untally', counter: id, key: key }) }).catch(function () {});
  }

  // ---------- now ----------
  function rollUsed() { return store.get('roll-' + today().n.date, 0); }
  function myRide() {
    var me = S.arrivals.filter(function (a) { return a.name && S.name && a.name.toLowerCase().split(' ')[0] === S.name.toLowerCase().split(' ')[0]; })[0];
    if (!me) return null;
    var crew = S.arrivals.filter(function (a) { return a.arriveDay === me.arriveDay && a.airport === me.airport && a.landing === me.landing; });
    return { me: me, crew: crew };
  }
  function settle() {
    var names = S.arrivals.map(function (a) { return a.name; }), bal = {};
    S.tab.forEach(function (it) { var p = it.split && it.split.length ? it.split : names; if (!p.length) return; var sh = it.amount / p.length; bal[it.paidBy] = (bal[it.paidBy] || 0) + it.amount; p.forEach(function (x) { bal[x] = (bal[x] || 0) - sh; }); });
    var mine = Object.keys(bal).filter(function (k) { return S.name && k.toLowerCase().split(' ')[0] === S.name.toLowerCase().split(' ')[0]; })[0];
    return mine ? Math.round(bal[mine] * 100) / 100 : null;
  }

  function renderNow() {
    var t = today(), d = t.day, el = $('#s-now');
    if (!d) { el.innerHTML = '<p class="empty-note">Loading…</p>'; return; }
    var rows = d.rows, cur = null, next = null;
    rows.forEach(function (r, i) { var m = toMin(r.time); if (m != null && m <= t.n.min) cur = i; });
    if (cur == null) next = rows[0]; else next = rows[cur + 1] || null;
    var nowRow = cur != null ? rows[cur] : null;
    var used = rollUsed(), hello = t.n.min < 720 ? 'Morning' : t.n.min < 1020 ? 'Afternoon' : 'Evening';
    var ride = myRide(), bal = settle();
    var developing = S.memories.filter(function (m) { return !developed(m, t.n); }).length;

    var row = function (act, title, sub, value) {
      return '<button class="row" data-act="' + act + '"><span><b>' + title + '</b><span class="rs">' + sub + '</span></span><span class="mono rv">' + value + '</span><span class="ra">→</span></button>';
    };
    var crewNames = ride && ride.crew.filter(function (c) { return c !== ride.me; }).map(function (c) { return c.name.split(' ')[0]; }).join(', ');
    el.innerHTML =
      // one coloured band: where we are, what's on now, what's next
      '<header class="band" style="--c:' + d.color + '">' +
        '<div class="bandtop"><span class="mono">Day ' + (t.i + 1) + ' of 4 · ' + clock(t.n.min) + ' in Miami</span><button class="x onband" data-act="settings" aria-label="Settings">⚙</button></div>' +
        '<p class="mono" style="opacity:0.7">' + hello + (S.name ? ', ' + esc(S.name) : '') + '</p>' +
        '<h1 class="big">' + esc(d.day) + '</h1>' +
        '<div class="nowblock"><p class="mono">' + (nowRow ? 'Now · ' + esc(nowRow.time) : 'Coming up · ' + esc(next ? next.time : '')) + '</p>' +
          '<h2>' + esc(nowRow ? nowRow.title : (next ? next.title : 'Free time')) + '</h2>' +
          '<p class="nd">' + esc(nowRow ? nowRow.desc : (next ? next.desc : '')) + '</p></div>' +
        (next && nowRow ? '<div class="nextline"><span class="mono">Next · ' + esc(next.time) + '</span><span>' + esc(next.title) + '</span></div>' : '') +
      '</header>' +
      (store.get('coach', true) ? '<section class="sect" id="coach"><div class="sh"><span class="mono">First time here?</span><button class="mono linkbtn" id="coach-ok">Got it</button></div>' +
        '<ol class="how"><li>Tap the round button to take a photo. You get 24 a day.</li><li>Your photos appear in Photos the next morning at 9.</li><li>Schedule has every plan. People has everyone coming.</li></ol></section>' : '') +
      // today's photo
      '<section class="sect"><div class="sh"><span class="mono">Today’s photo challenge</span><span class="mono muted">' + (ROLL - used) + ' of ' + ROLL + ' left</span></div>' +
        '<div class="shotimg"><img src="' + DAY_HERO[d.day] + '" alt=""></div>' +
        '<h3 class="shot-title">' + esc(d.shot) + '</h3>' +
        '<div class="roll">' + Array.apply(null, Array(ROLL)).map(function (_, i) { return '<i class="' + (i < used ? 'used' : '') + '"></i>'; }).join('') + '</div>' +
        '<button class="btn full" id="now-shoot" style="margin-top:14px">Take a photo</button></section>' +
      // everything else as one list
      '<section class="sect"><div class="sh"><span class="mono">The trip</span><span class="mono muted">Tap to open</span></div><div class="rows">' +
        row('play', 'Spotted', 'The trip game', (me().points || 0) + ' pts') +
        row('dark', 'Photos', developing ? developing + ' appear tomorrow at 9am' : 'Everyone’s photos so far', String(S.memories.length)) +
        row('tape', 'The tape', 'Everyone’s photos as one video', '▶') +
        (ride ? row('ride', 'Your ride', esc(ride.me.airport || '') + ' · ' + (ride.crew.length > 1 ? 'with ' + esc(crewNames) : 'solo for now'), ride.crew[0] === ride.me && ride.crew.length > 1 ? 'You call' : '') : '') +
        row('tab', 'The tab', 'Shared costs', bal == null ? 'Add' : bal > 0.009 ? '+$' + bal.toFixed(0) : bal < -0.009 ? '−$' + (-bal).toFixed(0) : 'Square') +
        row('chat', 'Group chat', 'iMessage or WhatsApp', '') +
        row('house', 'The house', S.house ? 'Directions in Maps' : 'Little River', '') +
        row('music', 'Soundtrack', 'On Spotify', '') +
        row('kit', 'The kit', S.kit ? S.kit.length + ' things inside' : 'Opens Friday', S.kit ? 'Open' : 'Sealed') +
      '</div></section>';
    $('#now-shoot').onclick = openCam;
    var co = $('#coach-ok'); if (co) co.onclick = function () { store.set('coach', false); var c = $('#coach'); if (c) c.remove(); };
    $$('[data-act]', el).forEach(function (b) { b.onclick = function () { act(b.getAttribute('data-act')); }; });
  }

  function act(a) {
    if (a === 'dark') return show('dark');
    if (a === 'play') return loadGame().then(function () { show('play'); });
    if (a === 'settings') return sheetSettings();
    if (a === 'chat') return openChat();
    if (a === 'tape') return location.href = '/tape' + (SAMPLE ? '?sample' : '');
    if (a === 'music') return window.open(PLAYLIST, '_blank');
    if (a === 'house') return S.house ? window.open(S.house.maps, '_blank') : toast('Sign in on the site to see the address');
    if (a === 'tab') return sheetTab();
    if (a === 'kit') return sheet(S.kit ? '<p class="mono muted">The kit</p><div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">' + S.kit.map(function (x) { return '<p style="font-size:22px;letter-spacing:-0.02em;border-top:1px solid var(--line);padding-top:10px">' + esc(x) + '</p>'; }).join('') + '</div>' : '<p class="mono muted">The kit</p><h2 style="font-size:30px;margin:12px 0;letter-spacing:-0.03em">Still sealed.</h2><p class="muted">It’s waiting at the house. It opens on Friday.</p>');
    if (a === 'ride') { var r = myRide(); return sheet('<p class="mono muted">Your ride</p><h2 style="font-size:30px;margin:12px 0;letter-spacing:-0.03em">' + esc(r.me.airport) + ' · ' + esc(r.me.landing || '') + '</h2>' + r.crew.map(function (c, i) { return '<div class="trow"><span class="mono">' + esc(c.inTime || '—') + '</span><div><p style="font-weight:550">' + esc(c.name) + (i === 0 && r.crew.length > 1 ? ' <span class="mono muted">calls the Uber</span>' : '') + '</p><p class="d">' + esc([c.inFlight, c.houseTime ? 'house ~' + c.houseTime : ''].filter(Boolean).join(' · ')) + '</p></div></div>'; }).join('')); }
  }

  // ---------- the tab (sheet) ----------
  function sheetTab() {
    var names = S.arrivals.map(function (a) { return a.name; });
    sheet('<p class="mono muted">The tab</p><h2 style="font-size:30px;margin:12px 0 18px;letter-spacing:-0.03em">Log what you paid</h2>' +
      '<form id="tabf" style="display:flex;flex-direction:column;gap:12px">' +
      '<input class="field" name="what" maxlength="60" placeholder="What for" required>' +
      '<input class="field" name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="Amount in USD" required>' +
      '<input class="field" name="paidBy" maxlength="60" placeholder="Paid by" value="' + esc(S.name) + '" required>' +
      '<p class="muted" style="font-size:13px">Split between ' + (names.length ? 'everyone coming (' + names.length + ')' : 'everyone') + '. Use the site to split between fewer people.</p>' +
      '<button class="btn full">Add it</button></form>' +
      '<div style="margin-top:18px">' + S.tab.slice(-6).reverse().map(function (it) { return '<div class="trow"><span class="mono">$' + it.amount.toFixed(2) + '</span><div><p style="font-weight:550">' + esc(it.what) + '</p><p class="d">Paid by ' + esc(it.paidBy) + '</p></div></div>'; }).join('') + '</div>');
    $('#tabf').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      api('/api/tab', { method: 'POST', body: JSON.stringify({ what: f.what.value, amount: parseFloat(f.amount.value), paidBy: f.paidBy.value, split: [] }) })
        .then(function () { return api('/api/tab'); }).then(function (j) { S.tab = j.items || []; closeSheet(); toast('Added to the tab'); renderNow(); })
        .catch(function (err) { toast(err.message); });
    };
  }

  // ---------- rooms ----------
  // Schedule: a day switcher (Fri–Mon), then that day's plan, then that day's photos.
  var schedDay = null;
  function renderRooms() {
    var t = today(), el = $('#s-rooms');
    if (schedDay == null) schedDay = t.i;
    var d = S.days[schedDay];
    if (!d) { el.innerHTML = '<p class="empty-note">Loading…</p>'; return; }
    var frames = S.memories.filter(function (m) { return m.day === d.day && developed(m, t.n); });
    el.innerHTML = '<div class="top"><span class="mono">Schedule · Miami time</span><button class="x" id="share-day" aria-label="Send this day’s plan">↗</button></div>' +
      '<div class="hello"><h1 class="big">' + d.day + '</h1></div>' +
      '<div class="daypick">' + S.days.map(function (x, i) {
        return '<button data-sd="' + i + '" class="' + (i === schedDay ? 'on' : '') + '" style="--c:' + x.color + '"><span class="mono">' + x.day.slice(0, 3) + '</span><b>' + x.date.slice(8) + '</b><i>' + (i === t.i ? 'today' : '&nbsp;') + '</i></button>';
      }).join('') + '</div>' +
      '<div class="daybar" style="background:' + d.color + '"><span class="mono">Day ' + (schedDay + 1) + ' of 4 · ' + d.rows.length + ' plans</span><span style="font-size:14px">Photo challenge: ' + esc(d.shot) + '</span></div>' +
      timeline(d, t) +
      '<div class="sub"><span class="mono">' + d.day + '’s photos</span><span class="mono muted">' + frames.length + '</span></div>' +
      '<div style="padding:0 20px">' + (frames.length ? gridHTML(frames) : '<p class="muted" style="font-size:14px">' + (schedDay >= t.i ? 'Photos from this day appear the next morning at 9.' : 'No photos from this day.') + '</p>') + '</div>';
    $$('[data-sd]', el).forEach(function (b) { b.onclick = function () { schedDay = +b.getAttribute('data-sd'); renderRooms(); }; });
    $('#share-day').onclick = function () { shareText(d.day + ' in Miami\n' + d.rows.map(function (r) { return r.time + '  ' + r.title; }).join('\n') + '\n\nPhoto challenge: ' + d.shot); };
    wireGrid(el);
  }
  function timeline(d, t) {
    var isToday = S.days.indexOf(d) === t.i, cur = null;
    if (isToday) d.rows.forEach(function (r, i) { var m = toMin(r.time); if (m != null && m <= t.n.min) cur = i; });
    return '<div class="timeline">' + d.rows.map(function (r, i) {
      return '<div class="trow' + (i === cur ? ' now' : '') + '"><span class="mono t">' + esc(r.time) + '</span><div><p style="font-weight:550">' + esc(r.title) + '</p>' + (r.desc ? '<p class="d">' + esc(r.desc) + '</p>' : '') + '</div></div>';
    }).join('') + '</div>';
  }
  function dayDetail(i) {
    var d = S.days[i], t = today();
    var frames = S.memories.filter(function (m) { return m.day === d.day && developed(m, t.n); });
    sheet('<p class="mono muted">Room 0' + (i + 1) + ' · Side ' + d.side + '</p><h2 class="big" style="margin:10px 0 6px">' + d.day + '</h2><p class="muted" style="margin-bottom:16px">Today’s shot · ' + esc(d.shot) + '</p>' +
      timeline(d, t).replace('class="timeline"', 'class="timeline" style="padding:0"') +
      '<div class="sub" style="padding:22px 0 10px"><span class="mono">On the wall</span><span class="mono muted">' + frames.length + ' frames</span></div>' +
      (frames.length ? gridHTML(frames) : '<p class="muted" style="font-size:14px">Nothing developed from this room yet.</p>'));
    wireGrid($('#sheet-body'));
  }

  // ---------- darkroom ----------
  function gridHTML(list, dev) {
    var out = [];
    list.forEach(function (m) { (m.media || []).forEach(function (x, j) {
      var media = x.type === 'video' ? '<video src="' + esc(x.url) + '" muted playsinline preload="metadata"></video>' : '<img src="' + esc(x.url) + '" alt="" loading="lazy">';
      out.push('<button class="' + (dev ? 'dev' : '') + '" data-m="' + esc(m.id || '') + '" data-j="' + j + '">' + media + (dev ? '<span class="mono">' + esc(m.name) + '</span>' : '') + '</button>');
    }); });
    return '<div class="grid3" style="padding:0">' + out.join('') + '</div>';
  }
  function wireGrid(root) {
    $$('[data-m]', root).forEach(function (b) {
      if (b.classList.contains('dev')) { b.onclick = function () { toast('This one appears tomorrow at 9am.'); }; return; }
      b.onclick = function () { var m = S.memories.filter(function (x) { return String(x.id) === b.getAttribute('data-m'); })[0]; if (m) view(m, +b.getAttribute('data-j')); };
    });
  }
  function renderDark() {
    var t = today(), el = $('#s-dark');
    var dev = S.memories.filter(function (m) { return !developed(m, t.n); });
    var done = S.memories.filter(function (m) { return developed(m, t.n); });
    var byDay = {}; done.forEach(function (m) { (byDay[m.day || 'The weekend'] = byDay[m.day || 'The weekend'] || []).push(m); });
    var nextAt = dev.length ? developsAt(dev[0]) : null;
    el.innerHTML = '<div class="top"><span class="mono">Photos · ' + done.length + ' so far</span><a class="x" href="/tape' + (SAMPLE ? '?sample' : '') + '" aria-label="Watch the tape">▶</a></div>' +
      '<div class="hello"><h1 class="big">Photos</h1></div>' +
      '<div class="redlight"><p class="mono" style="margin-bottom:8px">Coming tomorrow</p><p style="font-size:24px;font-weight:550;letter-spacing:-0.02em;line-height:1.05">' + (dev.length ? dev.length + ' photos waiting' : 'Nothing waiting') + '</p><p class="muted" style="font-size:14px;margin-top:6px">' + (dev.length ? 'They appear at ' + clock(nextAt.min) + (nextAt.date !== t.n.date ? ' tomorrow' : ' today') + ', like film. Until then they stay blurred.' : 'Photos you take today appear here the next morning at 9.') + '</p></div>' +
      (dev.length ? '<div style="padding:0 20px 8px">' + gridHTML(dev, true) + '</div>' : '') +
      ['Monday', 'Sunday', 'Saturday', 'Friday', 'The weekend'].filter(function (k) { return byDay[k]; }).map(function (k) {
        return '<div class="sub"><span class="mono">' + k + '</span><span class="mono muted">' + byDay[k].length + ' posts</span></div><div style="padding:0 20px">' + gridHTML(byDay[k]) + '</div>';
      }).join('') +
      (!S.memories.length ? '<p class="empty-note">No photos yet. Tap the round button to take the first one.</p>' : '');
    wireGrid(el);
  }

  // ---------- guests ----------
  function renderGuests() {
    var el = $('#s-guests');
    // Everyone invited shows up; profiles fill in as people add them on the site.
    var first = function (n) { return String(n || '').toLowerCase().split(' ')[0]; };
    var list = S.guests.slice();
    INVITED.forEach(function (n) { if (!list.some(function (g) { return first(g.name) === first(n); })) list.push({ name: n, status: '', from: '', pending: true }); });
    el.innerHTML = '<div class="top"><span class="mono">People · ' + list.length + ' coming</span><button class="x" data-act="chat" aria-label="Open the group chat">✉</button></div>' +
      '<div class="hello"><h1 class="big">Who’s<br>coming</h1><p class="muted" style="font-size:14px;margin-top:10px">Tap someone to see their profile and photos.</p></div>' +
      (list.length ? '<div class="glist">' + list.map(function (g, i) {
        var count = S.memories.filter(function (m) { return m.name && g.name && m.name.split(' ')[0].toLowerCase() === g.name.split(' ')[0].toLowerCase(); }).length;
        return '<button class="gitem" data-g="' + i + '"><span class="ph">' + (g.photo ? '<img src="' + esc(g.photo) + '" alt="">' : esc((g.name || '?').charAt(0))) + '</span><span><p style="font-weight:550;font-size:17px">' + esc(g.name) + '</p><p class="muted" style="font-size:13px">' + esc(g.pending ? 'Hasn’t added a profile yet' : g.from ? 'Lives and works in ' + g.from : g.status || '') + '</p></span><span class="mono muted">' + count + ' photos</span></button>';
      }).join('') + '</div>' : '<p class="empty-note">Guests show up here once they add a profile on the site.</p>') +
      '<div style="padding:20px"><a class="btn ghost full" href="/#guests">Edit my wall label</a></div>';
    $$('[data-act]', el).forEach(function (b) { b.onclick = function () { act(b.getAttribute('data-act')); }; });
    $$('[data-g]', el).forEach(function (b) { b.onclick = function () {
      var g = list[+b.getAttribute('data-g')], t = today();
      var frames = S.memories.filter(function (m) { return m.name && m.name.split(' ')[0].toLowerCase() === g.name.split(' ')[0].toLowerCase() && developed(m, t.n); });
      sheet('<div style="display:grid;grid-template-columns:96px 1fr;gap:16px;align-items:end">' +
        '<span class="ph" style="width:96px;height:120px;border-radius:12px;overflow:hidden;background:var(--panel2);display:grid;place-items:center;font-size:36px;font-weight:550">' + (g.photo ? '<img src="' + esc(g.photo) + '" alt="" style="width:100%;height:100%;object-fit:cover;filter:grayscale(1)">' : esc(g.name.charAt(0))) + '</span>' +
        '<div><p class="mono muted">Wall label</p><h2 style="font-size:30px;letter-spacing:-0.03em;line-height:1;margin-top:8px">' + esc(g.name) + '</h2></div></div>' +
        '<div class="card" style="margin:16px 0;background:var(--paper);color:var(--ink)">' +
        (g.from ? '<p style="font-size:14px">Lives and works in ' + esc(g.from) + '</p>' : '') +
        (g.line ? '<p style="font-size:14px;margin-top:4px">Would buy: “' + esc(g.line) + '”</p>' : '') +
        '<p style="font-size:12px;margin-top:6px;opacity:0.6">Mixed media: a carry-on, sunscreen, three outfits a day.</p>' +
        '<p class="mono" style="margin-top:10px">' + esc(g.status === 'Probably' ? 'On hold' : 'Acquired') + (g.ig ? ' · @' + esc(g.ig) : '') + '</p></div>' +
        '<div class="sub" style="padding:8px 0 10px"><span class="mono">Their frames</span><span class="mono muted">' + frames.length + '</span></div>' +
        (frames.length ? gridHTML(frames) : '<p class="muted" style="font-size:14px">Nothing developed yet.</p>'));
      wireGrid($('#sheet-body'));
    }; });
  }

  // ---------- sheet + viewer ----------
  function sheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').classList.add('on'); }
  function closeSheet() { $('#sheet').classList.remove('on'); }
  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  function view(m, j) {
    var x = m.media[j] || m.media[0];
    $('#v-media').innerHTML = x.type === 'video' ? '<video src="' + esc(x.url) + '" controls autoplay playsinline></video>' : '<img src="' + esc(x.url) + '" alt="">';
    $('#v-who').textContent = (m.name || '') + (m.day ? ' · ' + m.day : '');
    $('#v-note').textContent = m.note || '';
    $('#v-meta').textContent = m.kind === 'fit' ? 'Fit of the day' : m.kind === 'daily' ? 'Same spot, every day' : 'Moment';
    $('#v-send').onclick = function () { shareMedia(x.url, m.note); };
    $('#viewer').classList.add('on');
  }
  $('#v-close').onclick = function () { $('#viewer').classList.remove('on'); $('#v-media').innerHTML = ''; };

  // ---------- camera ----------
  var cam = { file: null, kind: 'memory', blob: null, isVideo: false };
  function openCam() {
    var t = today();
    if (rollUsed() >= ROLL) { toast('That’s your 24 photos for today. You get 24 more tomorrow.'); return; }
    cam = { file: null, kind: 'memory', blob: null, isVideo: false };
    $('#cam-frame').innerHTML = '<div class="empty"><p class="mono muted">Today’s photo challenge</p><p style="font-size:24px;font-weight:550;letter-spacing:-0.02em;max-width:260px;line-height:1.1">' + esc(t.day ? t.day.shot : '') + '</p><p class="muted" style="font-size:13px">Tap the big button to take a photo, or Library to pick one. Choose a filter, then tap Post.</p></div>';
    $('#cam-shot').textContent = 'Filter';
    $('#cam-day').textContent = t.day ? t.day.day : '';
    $('#cam-roll').textContent = (ROLL - rollUsed()) + ' of ' + ROLL + ' left today';
    $('#cam-note').value = '';
    $('#cam-send').disabled = true;
    $$('#kindseg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === 'memory'); });
    renderLensbar();
    $('#cam').classList.add('on');
  }
  function renderLensbar() {
    $('#lensbar').innerHTML = LENSES.map(function (l) { return '<button class="' + (S.lens === l.id ? 'on' : '') + '" data-l="' + l.id + '">' + l.name + '</button>'; }).join('');
    $$('#lensbar button').forEach(function (b) { b.onclick = function () { S.lens = b.getAttribute('data-l'); store.set('lens', S.lens); renderLensbar(); if (cam.file && !cam.isVideo) develop(cam.file); }; });
  }
  $('#cam-close').onclick = function () { $('#cam').classList.remove('on'); };
  $$('#kindseg button').forEach(function (b) { b.onclick = function () { cam.kind = b.getAttribute('data-k'); $$('#kindseg button').forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  ['#cam-take', '#cam-lib'].forEach(function (sel) { $(sel).onchange = function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) pick(f); }; });

  function pick(f) {
    cam.file = f; cam.isVideo = /^video\//.test(f.type);
    if (cam.isVideo) { cam.blob = f; $('#cam-frame').innerHTML = '<video src="' + URL.createObjectURL(f) + '" autoplay muted loop playsinline></video>'; $('#cam-send').disabled = false; return; }
    develop(f);
  }

  // Bake the lens into the photo (pixel maths, so it works the same on every phone).
  function develop(f) {
    var img = new Image();
    img.onload = function () {
      var max = 1600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      var lens = S.lens;
      if (lens !== 'clean') {
        var id = x.getImageData(0, 0, w, h), p = id.data, i, r, g, b, y;
        var con = function (v, c2) { return (v - 128) * c2 + 128; };
        for (i = 0; i < p.length; i += 4) {
          r = p[i]; g = p[i + 1]; b = p[i + 2];
          if (lens === 'gallery') { y = con(0.3 * r + 0.59 * g + 0.11 * b, 1.08); r = g = b = y; }
          else if (lens === 'golden') { r = con(r * 1.08 + 14, 1.05); g = con(g * 1.0 + 5, 1.05); b = con(b * 0.84, 1.05); }
          else if (lens === 'tape') { y = 0.3 * r + 0.59 * g + 0.11 * b; r = con(y + (r - y) * 0.75, 1.14) * 0.97; g = con(y + (g - y) * 0.75, 1.14) * 0.95; b = con(y + (b - y) * 0.75, 1.14) * 1.02; }
          p[i] = r < 0 ? 0 : r > 255 ? 255 : r; p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        }
        x.putImageData(id, 0, 0);
        if (lens === 'golden') {
          var gr = x.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.8);
          gr.addColorStop(0, 'rgba(255,140,60,0.35)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
          x.globalCompositeOperation = 'screen'; x.fillStyle = gr; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
        }
        if (lens === 'tape') {
          x.fillStyle = 'rgba(0,0,0,0.13)'; for (var s = 0; s < h; s += 3) x.fillRect(0, s, w, 1);
          var t = today(), stamp = (t.day ? t.day.date.slice(5).replace('-', ' ') : '') + ' 2026  ' + clock(t.n.min).toUpperCase();
          var fs = Math.round(w * 0.045); x.font = fs + 'px "Cutive Mono", monospace'; x.textAlign = 'right';
          x.fillStyle = 'rgba(255,40,40,0.6)'; x.fillText(stamp, w - fs * 0.8 + 2, h - fs * 0.9);
          x.fillStyle = 'rgba(40,140,255,0.6)'; x.fillText(stamp, w - fs * 0.8 - 2, h - fs * 0.9);
          x.fillStyle = '#FFE9C9'; x.fillText(stamp, w - fs * 0.8, h - fs * 0.9);
        }
      }
      c.toBlob(function (blob) {
        cam.blob = blob;
        $('#cam-frame').innerHTML = '<img src="' + URL.createObjectURL(blob) + '" alt="Preview">';
        $('#cam-send').disabled = false;
      }, 'image/jpeg', 0.88);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  }

  $('#cam-send').onclick = function () {
    var btn = this, t = today();
    if (!cam.blob) return;
    if (!S.name) { toast('Add your name in the welcome screens first'); return; }
    btn.disabled = true; btn.textContent = 'Posting…';
    var ext = cam.isVideo ? (cam.file.name.split('.').pop() || 'mp4') : 'jpg';
    var send = SAMPLE ? Promise.resolve({ url: URL.createObjectURL(cam.blob) }) :
      window.OEUpload('album/' + S.name.replace(/[^\w]+/g, '-') + '-' + Date.now() + '.' + ext, cam.blob, {
        access: 'public', handleUploadUrl: '/api/upload', clientPayload: JSON.stringify({}), contentType: cam.isVideo ? cam.file.type : 'image/jpeg'
      });
    send.then(function (blob) {
      var memo = { kind: cam.kind, name: S.name, day: t.day ? t.day.day : '', note: $('#cam-note').value.trim(), media: [{ url: blob.url, type: cam.isVideo ? 'video/' : 'image/jpeg' }] };
      if (SAMPLE) return { id: 's' + Date.now() };
      return api('/api/memories', { method: 'POST', body: JSON.stringify(memo) });
    }).then(function (j) {
      store.set('roll-' + t.n.date, rollUsed() + 1);
      S.memories.push({ id: j.id, kind: cam.kind, name: S.name, day: t.day ? t.day.day : '', note: $('#cam-note').value.trim(), createdAt: new Date().toISOString(), media: [{ url: URL.createObjectURL(cam.blob), type: cam.isVideo ? 'video' : 'image' }] });
      $('#cam').classList.remove('on');
      afterPost();
      show(current);
    }).catch(function (err) { toast(err.message || 'Upload failed. Try again.'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Post'; });
  };

  // ---------- start ----------
  function enter() {
    $('#tabs').classList.remove('hide');
    show('now');
  }
  $$('.tabs [data-go]').forEach(function (b) { b.onclick = function () { show(b.getAttribute('data-go')); }; });
  $('#open-cam').onclick = openCam;

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(function () {});

  var real = realMiami();
  if (real.date < TRIP.start && !PREVIEW) { $('#s-gate').classList.add('on'); renderGate(); return; }
  loadAll().then(function () {
    if (!store.get('onboarded', false) || Q.has('welcome')) { $('#s-ob').classList.add('on'); renderOb(0); }
    else enter();
  });
  setInterval(function () { if (!document.hidden && $('#tabs') && !$('#tabs').classList.contains('hide') && !$('#cam').classList.contains('on') && !$('#sheet').classList.contains('on')) {
    (SAMPLE ? Promise.resolve() : api('/api/memories').then(function (j) { S.memories = j.memories || []; })).catch(function () {}).then(function () { if ((current === 'now' || current === 'dark') && window.scrollY < 40) show(current); if (current === 'play') loadGame().then(function () { if (window.scrollY < 40) renderPlay(); }); });
  } }, 60000);
})();
