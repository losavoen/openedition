// GET  /api/songs -> every request so far, oldest first (song, artist, moment, first name)
// POST /api/songs -> a guest asks for a song on the soundtrack.
// Every request is saved to Blob (songreq/) and, when RESEND_API_KEY is set,
// emailed to SONG_REQUEST_TO. Needs the site password (cookie or header).
import { put, list } from '@vercel/blob';
import { checkPassword, newId } from '../lib/guests.js';

const clip = (v, n) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const MOMENTS = ['Anytime', 'Getting ready', 'At the house', 'Beach club', 'The boat', 'In the car', 'Monday'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!checkPassword(req)) return res.status(401).json({ error: 'Sign in first' });
  if (req.method === 'GET') {
    try {
      const blobs = []; let cursor;
      do { const page = await list({ prefix: 'songreq/', cursor, limit: 1000 }); cursor = page.hasMore ? page.cursor : undefined; blobs.push(...page.blobs); } while (cursor);
      const rows = (await Promise.all(blobs.map(async (b) => { try { return await (await fetch(b.url, { cache: 'no-store' })).json(); } catch { return null; } }))).filter((r) => r && r.song);
      rows.sort((a, c) => String(a.createdAt).localeCompare(String(c.createdAt)));
      // drop exact repeats of the same song
      const seen = new Set();
      const requests = rows.filter((r) => { const k = (r.song + '|' + (r.artist || '')).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
        .map((r) => ({ song: r.song, artist: r.artist || '', moment: r.moment || 'Anytime', name: String(r.name || '').split(/\s+/)[0] }));
      return res.status(200).json({ requests });
    } catch (e) { console.error(e); return res.status(500).json({ error: 'Couldn’t load requests' }); }
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (clip(body.website, 50)) return res.status(200).json({ ok: true }); // spam trap
    const r = { id: newId(), name: clip(body.name, 60), song: clip(body.song, 120), artist: clip(body.artist, 120), moment: MOMENTS.includes(body.moment) ? body.moment : 'Anytime', note: clip(body.note, 280), createdAt: new Date().toISOString() };
    if (!r.name || !r.song) return res.status(400).json({ error: 'Add your name and the song' });
    await put(`songreq/${r.id}.json`, JSON.stringify(r), { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
    let emailed = false;
    if (process.env.RESEND_API_KEY && process.env.SONG_REQUEST_TO) {
      const text = `${r.name} requested a song for the Open Edition soundtrack.\n\nSong: ${r.song}\nArtist: ${r.artist || '—'}\nFor: ${r.moment}\n${r.note ? 'Note: ' + r.note + '\n' : ''}\nSent ${r.createdAt}`;
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.SONG_REQUEST_FROM || 'Open Edition <onboarding@resend.dev>', to: [process.env.SONG_REQUEST_TO], subject: `Song request: ${r.song}${r.artist ? ' — ' + r.artist : ''}`, text })
      });
      emailed = resp.ok;
      if (!resp.ok) console.error('resend', resp.status, await resp.text().catch(() => ''));
    }
    return res.status(201).json({ ok: true, emailed });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Couldn’t send that. Try again.' });
  }
}
