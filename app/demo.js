// Sample mode (?sample): the app runs on made-up data and never talks to the server.
// Used by the preview PIN, so people can see how the app works without the trip's real
// photos, profiles or address.
(function () {
  var guests = [
    { id: 'g1', name: 'Simi', from: 'Toronto', line: 'A Basquiat crown', status: 'I’m in' },
    { id: 'g2', name: 'Nero', from: 'Toronto', line: 'Anything by Amoako Boafo', status: 'I’m in' },
    { id: 'g3', name: 'Nicole', from: 'Toronto', line: 'A Kusama pumpkin', status: 'Probably' }
  ];
  var arrivals = [
    { name: 'Ilelosa', airport: 'MIA', arriveDay: 'Friday', landing: 'Morning', inTime: '10:40am' },
    { name: 'Simi', airport: 'MIA', arriveDay: 'Friday', landing: 'Morning', inTime: '10:55am' },
    { name: 'Nero', airport: 'FLL', arriveDay: 'Friday', landing: 'Afternoon', inTime: '1:20pm' },
    { name: 'Sayo', airport: 'MIA', arriveDay: 'Friday', landing: 'Morning', inTime: '11:30am' },
    { name: 'Nicole', airport: 'MIA', arriveDay: 'Saturday', landing: 'Evening' },
    { name: 'Chiara', airport: 'FLL', arriveDay: 'Friday', landing: 'Afternoon' }
  ];
  var tab = [{ id: 't1', what: 'Groceries', amount: 84, paidBy: 'Simi', split: [] }];
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
