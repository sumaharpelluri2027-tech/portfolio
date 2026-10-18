import re, pathlib, shutil
src = pathlib.Path('src/page.html').read_text(encoding='utf-8')
# artifact build: content only (platform adds the skeleton)
art = pathlib.Path('dist-artifact'); art.mkdir(exist_ok=True)
(art/'index.html').write_text(src, encoding='utf-8')
# domain build: full document, title + meta in head
body = re.sub(r'<title>.*?</title>\n', '', src, count=1)
body = body.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sumahar Pelluri | Systems builder: data, operations, AI</title>
<meta name="description" content="Sumahar Pelluri turns messy manual processes into measurable, automated systems across data, operations and AI. PGP-TBM '27 at Masters' Union. Open to Data/BI, Founder's Office and Product roles.">
<link rel="canonical" href="https://sumaharpelluri.in/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://sumaharpelluri.in/">
<meta property="og:title" content="Sumahar Pelluri | Systems builder">
<meta property="og:description" content="Data you can trust, work that runs itself, AI you can inspect.">
<meta property="og:image" content="https://sumaharpelluri.in/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12100d">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
'''
dom = pathlib.Path('dist-domain'); dom.mkdir(exist_ok=True)
(dom/'index.html').write_text(head + body + '\n</body>\n</html>\n', encoding='utf-8')
(dom/'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#f3ece0"/><text x="32" y="42" font-family="Georgia,serif" font-size="28" text-anchor="middle" fill="#12100d">SP</text></svg>')
(dom/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://sumaharpelluri.in/sitemap.xml\n')
(dom/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://sumaharpelluri.in/</loc></url></urlset>\n')
for d in (art, dom):
    if (d/'assets').exists(): shutil.rmtree(d/'assets')
    shutil.copytree('assets', d/'assets')
print('built', len(src)//1024, 'KB page')
