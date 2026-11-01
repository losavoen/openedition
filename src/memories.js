// Memories: upload photos/videos to the shared album and leave a favourite moment.
// Bundled to /memories.js by scripts/build.py (esbuild) because it uses the Blob client.
import { upload } from '@vercel/blob/client';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ss = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const ls = {
  get: () => { try { return JSON.parse(localStorage.getItem('oe-memories') || '[]'); } catch { return []; } },
  add: (v) => { try { localStorage.setItem('oe-memories', JSON.stringify(ls.get().concat(v))); } catch {} }
};

let pw = ss.get('oe-pw');
let day = '';
let files = [];

async function api(method, body) {
  const r = await fetch('/api/memories', { method, headers: { 'Content-Type': 'application/json', 'x-guest-password': pw }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status });
  return j;
}

let authed = false;
let kind = 'memory';
function unlocked() {
  authed = true;
  ss.set('oe-pw', pw);
  $('mem-gate').hidden = true;
  $('mem-pw-row').hidden = true;
  $('mem-album-wrap').hidden = false;
}

async function loadAlbum() {
  const j = await api('GET');
  unlocked();
  const items = [];
  const all = j.memories || [];
  renderFits(all.filter((m) => m.kind === 'fit'));
  renderDaily(all.filter((m) => m.kind === 'daily'));
  const memories = all.filter((m) => m.kind !== 'fit' && m.kind !== 'daily');
  memories.forEach((m) => {
    const who = esc(m.name) + (m.day ? ' · ' + esc(m.day.slice(0, 3)) : '');
    m.media.forEach((x) => items.push(x.type === 'video'
      ? `<figure><video src="${esc(x.url)}" muted playsinline loop preload="metadata" controls></video></figure>`
      : `<figure><a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.url)}" alt="Photo from ${esc(m.name)}" loading="lazy"></a><figcaption class="mono cap">${who}</figcaption></figure>`));
    if (m.note) items.push(`<blockquote><p>${esc(m.note)}</p><p class="mono cap">${who}</p></blockquote>`);
  });
  const n = memories.reduce((a, m) => a + m.media.length, 0);
  $('mem-count').textContent = n ? n + (n === 1 ? ' photo' : ' photos and videos') : '';
  $('mem-album').innerHTML = items.length ? items.join('') : '<p class="mono cap">Nothing yet. Be the first.</p>';
}

const SHOTS = { Friday: 'Your first look at the fair', Saturday: 'Golden hour on the boat', Sunday: 'Sand to Wynwood', Monday: 'The last view before you fly' };

// Same spot, every day: newest group photo per day fills the 4-up strip.
function renderDaily(list) {
  const el = $('daily'); if (!el) return;
  const byDay = {};
  list.forEach((m) => { const x = (m.media || []).find((y) => y.type !== 'video'); if (x && m.day) byDay[m.day] = x.url; });
  el.innerHTML = ['Friday', 'Saturday', 'Sunday', 'Monday'].map((d) => byDay[d]
    ? `<figure class="has"><span class="mono cap">${d.slice(0, 3)}</span><img src="${esc(byDay[d])}" alt="Group photo, ${d}" loading="lazy"></figure>`
    : `<figure><span class="mono cap">${d.slice(0, 3)}</span></figure>`).join('');
}

function renderFits(fits) {
  const el = $('fits'); if (!el) return;
  const items = [];
  fits.forEach((m) => m.media.forEach((x) => {
    const cap = `<figcaption class="mono cap">${esc(m.name)}${m.day ? ' · ' + esc(m.day.slice(0, 3)) : ''}</figcaption>`;
    items.push(x.type === 'video'
      ? `<figure><video src="${esc(x.url)}" muted playsinline loop autoplay preload="metadata"></video>${cap}</figure>`
      : `<figure><img src="${esc(x.url)}" alt="${esc(m.name)}’s fit" loading="lazy">${cap}</figure>`);
  }));
  el.innerHTML = items.length ? items.join('') : '<p class="mono cap">One photo a day, once we’re there.</p>';
}

function open(mode) {
  kind = mode === 'fit' ? 'fit' : mode === 'daily' ? 'daily' : 'memory';
  const panel = $('mem-panel');
  panel.hidden = false;
  $('mem-title').textContent = mode === 'fit' ? 'Add today’s fit' : mode === 'daily' ? 'Add the daily group photo' : mode === 'note' ? 'Send a memory' : 'Add to the album';
  $('mem-pw-row').hidden = !!pw || authed;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => {
    if (!pw && !authed) panel.password.focus();
    else if (mode === 'note') panel.note.focus();
  }, 400);
}

function showThumbs() {
  $('mem-thumbs').innerHTML = '';
  files.forEach((f) => {
    const span = document.createElement('span');
    const url = URL.createObjectURL(f);
    span.innerHTML = /^video\//.test(f.type) ? `<video src="${url}" muted></video>` : `<img src="${url}" alt="">`;
    $('mem-thumbs').appendChild(span);
  });
}

function setDay(v) {
  day = day === v ? '' : v;
  const hint = $('mem-shot');
  if (hint) { hint.hidden = !day || kind === 'daily'; hint.textContent = day ? 'Today’s shot · ' + SHOTS[day] : ''; }
  [...$('mem-day').children].forEach((b) => { b.className = b.dataset.v === day ? 'pill on' : 'pill'; });
}

function progress(p) { $('mem-bar').hidden = false; $('mem-bar').firstElementChild.style.width = Math.round(p * 100) + '%'; }
const msg = (t) => { $('mem-msg').textContent = t || ''; };

async function share(e) {
  e.preventDefault();
  const f = e.target, btn = $('mem-save');
  if (!pw) pw = f.password.value;
  const note = f.note.value.trim();
  if (!files.length && !note) return msg('Add a photo or a few words.');
  if (kind === 'daily' && (!files.length || !day)) return msg('Pick the day and add the group photo.');
  btn.disabled = true; btn.textContent = 'Sharing…';
  try {
    if (!files.length) await api('GET'); // check the password before anything else
    const total = files.reduce((a, x) => a + x.size, 0) || 1;
    let done = 0;
    const media = [];
    for (const file of files) {
      const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-80) || 'file';
      const blob = await upload(`album/${safe}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ password: pw }),
        onUploadProgress: (ev) => progress((done + ev.loaded) / total)
      });
      done += file.size;
      media.push({ url: blob.url, type: file.type });
    }
    const j = await api('POST', { kind, name: f.name.value, day, note, media });
    ls.add({ id: j.id, token: j.token });
    files = []; showThumbs(); f.reset(); setDay(day);
    $('mem-bar').hidden = true;
    msg('Shared. Thank you.');
    await loadAlbum();
  } catch (err) {
    if (err.status === 401 || /password/i.test(err.message)) { pw = ''; $('mem-pw-row').hidden = false; msg('That’s not the password.'); }
    else msg(err.message || 'Upload failed. Try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Share';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!$('mem-panel')) return;
  $('mem-open-album').addEventListener('click', () => open('album'));
  $('mem-open-note').addEventListener('click', () => open('note'));
  if ($('fit-open')) $('fit-open').addEventListener('click', () => open('fit'));
  if ($('daily-open')) $('daily-open').addEventListener('click', () => open('daily'));
  $('mem-close').addEventListener('click', () => { $('mem-panel').hidden = true; });
  $('mem-day').addEventListener('click', (e) => { if (e.target.dataset && e.target.dataset.v) setDay(e.target.dataset.v); });
  const input = $('mem-panel').files, drop = $('mem-drop');
  input.addEventListener('change', () => { files = files.concat([...input.files]); input.value = ''; showThumbs(); });
  ['dragover', 'dragenter'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); files = files.concat([...e.dataTransfer.files].filter((x) => /^(image|video)\//.test(x.type))); showThumbs(); });
  $('mem-panel').addEventListener('submit', share);
  $('mem-gate').addEventListener('submit', (e) => {
    e.preventDefault(); pw = e.target.password.value;
    loadAlbum().catch((err) => { pw = ''; e.target.password.value = ''; e.target.password.placeholder = err.status === 401 ? 'That’s not the password' : err.message; });
  });
  document.addEventListener('oe-unlock', (e) => { pw = e.detail; loadAlbum().catch(() => {}); });
  loadAlbum().catch(() => {});
  // pick up new photos and notes every 30 seconds while the album is open
  setInterval(() => {
    if (!pw || document.hidden || $('mem-album-wrap').hidden) return;
    if ($('mem-save').disabled) return; // mid-upload
    loadAlbum().catch(() => {});
  }, 30000);
});
