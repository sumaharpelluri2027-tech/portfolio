# sumaharpelluri.in

Personal portfolio of Sumahar Pelluri, served as a static site on Render.

- `src/page.html` is the page source (markup, styles and script in one file).
- `python3 build.py` (run from a folder that has `src/` and `assets/`) produces `dist-domain/`, which is copied into `site/`.
- `site/` is what gets published: `index.html`, `assets/` (images, logos, soundtrack), favicon, robots and sitemap.
- Render runs `npm ci && npm run build`, which copies `site/` to `out/`.

Soundtrack: "Chasing the Horizon", original.
