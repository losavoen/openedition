// Sample mode (?sample): the app never talks to the server and shows the trip as it is now: not started, nobody signed up.
// Used by the preview PIN, so people can see how the app works without the trip's real
// photos, profiles or address.
(function () {
  var guests = []; // only people who've RSVP'd and made a profile, and in preview that's nobody
  var arrivals = [];
  var tab = [];
  var real = window.fetch.bind(window);
  function json(o) { return Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } })); }
  window.fetch = function (url, opts) {
    var u = String(url && url.url || url), m = (opts && opts.method) || 'GET';
    if (u.indexOf('/api/') < 0) return real(url, opts);
    if (u.indexOf('/api/guests') > -1) return json({ guests: guests });
    if (u.indexOf('/api/rsvps') > -1) return json({ arrivals: arrivals, songs: [] });
    if (u.indexOf('/api/house') > -1) return json({});
    if (u.indexOf('/api/kit') > -1) return json({ open: false });
    if (u.indexOf('/api/tab') > -1) {
      if (m === 'POST') { var b = JSON.parse(opts.body || '{}'); b.id = 't' + Date.now(); tab.push(b); return json({ id: b.id, token: 'x' }); }
      return json({ items: tab });
    }
    return json({ ok: true, id: 'p' + Date.now() });
  };
})();
