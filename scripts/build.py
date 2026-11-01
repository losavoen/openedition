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
<meta property="og:image" content="assets/c4eb66219cdb3bccb6a3bd147e0dcdea.jpg">
<style>html,body{{margin:0;background:#FFFFFF}}</style>
{helmet.strip()}
<script src="rsvp.js" defer></script>
<script src="guests.js" defer></script>
</head>
<body>
{body.strip()}
</body>
</html>
'''
(root / 'index.html').write_text(html)
print('wrote index.html', len(html), 'bytes')
