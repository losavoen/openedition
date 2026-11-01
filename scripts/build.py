"""Turn the Claude Design source (src/Miami.dc.html) into the static site (index.html).

Run from the repo root:  python3 scripts/build.py
Edit config.json to set the playlist and album links.
"""
import json, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / 'src' / 'Miami.dc.html').read_text()
cfg = json.loads((root / 'config.json').read_text())

title = re.search(r'<title>(.*?)</title>', src, re.S).group(1)
helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
body = re.search(r'</helmet>(.*?)</x-dc>', src, re.S).group(1)

# fonts and images -> local files
fonts = {'0f74346aba8ea7c3d33cf3de90043f0c': 'assets/fonts/Aspekta-400.woff2',
         'e873dd4be31e13bab633b0f24c83403d': 'assets/fonts/Aspekta-550.woff2'}
def blob(m):
    i = m.group(1)
    return fonts.get(i, f'assets/{i}.jpg')
helmet = re.sub(r'/_blob/([0-9a-f]{32})', blob, helmet)
body = re.sub(r'/_blob/([0-9a-f]{32})', blob, body)

# static holes
body = body.replace('{{ playlistUrl }}', cfg['playlistUrl']).replace('{{ albumUrl }}', cfg['albumUrl'])

# RSVP form: move the dynamic markup into a <template>, rendered by rsvp.js
m = re.search(r'(<div class="rsvp"[^>]*>)(.*?)(</div>\n</div>\n</section>)', body, re.S)
inner = m.group(2)
body = body[: m.start()] + m.group(1) + '<div id="rsvp-app" style="display: contents"></div><template id="rsvp-tpl">' + inner + '</template></div>\n</div>\n</section>' + body[m.end():]

assert '{{' not in re.sub(r'<template id="rsvp-tpl">.*?</template>', '', body, flags=re.S), 'unfilled hole outside the RSVP template'

desc = 'Plans, costs and RSVP for our trip to Miami Art Week, December 4–7, 2026.'
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="Open Edition — Miami Art Week">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="/assets/og.jpg">
<style>html,body{{margin:0;background:#FFFFFF}}</style>
{helmet.strip()}
<script src="rsvp.js" defer></script>
<script src="guests.js" defer></script>
<script src="memories.js" defer></script>
<script>window.OE_CONFIG = {json.dumps({k: cfg[k] for k in ('hostName', 'hostPhone', 'backupContact', 'rooms', 'payMethods') if k in cfg})};</script>
<script src="extras.js" defer></script>
<script src="edition.js" defer></script>
</head>
<body>
{body.strip()}
</body>
</html>
'''
(root / 'index.html').write_text(html)
print('wrote index.html', len(html), 'bytes')

# bundle the memories uploader (uses the Vercel Blob browser client)
import subprocess
subprocess.run(['npx', 'esbuild', 'src/memories.js', '--bundle', '--minify', '--format=iife', '--target=es2019', '--outfile=memories.js'], cwd=root, check=True)

# calendar file of the itinerary (times are Miami time)
import html as _html
from datetime import datetime, timedelta
def _txt(x):
    return _html.unescape(re.sub(r'<[^>]+>', '', x)).replace('\\', '\\\\').replace(',', '\\,').replace(';', '\;').strip()
events = []
for aid, date in [('fri', '2026-12-04'), ('sat', '2026-12-05'), ('sun', '2026-12-06'), ('mon', '2026-12-07')]:
    art = re.search(r'<article id="%s".*?</article>' % aid, src, re.S)
    if not art: continue
    rows = re.findall(r'<div class="ros"><span class="mono cap">(\d{1,2}):(\d{2})</span><div><p style="font-weight: 550">(.*?)</p>(?:<p class="cap">(.*?)</p>)?', art.group(0), re.S)
    starts = [datetime.fromisoformat(date) + timedelta(hours=int(h), minutes=int(m)) for h, m, *_ in rows]
    for i, (h, m, title, desc) in enumerate(rows):
        start = starts[i]
        end = starts[i + 1] if i + 1 < len(starts) and starts[i + 1] > start else start + timedelta(minutes=90)
        events.append((start, end, _txt(title), _txt(desc or '')))
stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Open Edition//Miami Art Week//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Open Edition (miami art week)', 'X-WR-TIMEZONE:America/New_York']
for n, (s_, e_, t_, d_) in enumerate(events):
    lines += ['BEGIN:VEVENT', 'UID:oe-%d-%s@openedition' % (n, s_.strftime('%Y%m%dT%H%M')), 'DTSTAMP:' + stamp,
              'DTSTART;TZID=America/New_York:' + s_.strftime('%Y%m%dT%H%M%S'), 'DTEND;TZID=America/New_York:' + e_.strftime('%Y%m%dT%H%M%S'),
              'SUMMARY:' + t_, 'DESCRIPTION:' + d_, 'END:VEVENT']
lines.append('END:VCALENDAR')
(root / 'openedition.ics').write_text('\r\n'.join(lines) + '\r\n')
print('wrote openedition.ics with', len(events), 'events')
