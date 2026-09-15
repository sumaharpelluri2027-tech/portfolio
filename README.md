# Sumahar Pelluri — Systems Builder

A product-led portfolio built around one positioning: **I turn messy manual processes into intelligent systems.**

## Stack

- Next.js 15, React 19, TypeScript
- Framer Motion for intentional interface motion
- Self-hosted variable fonts and optimized WebP assets
- App Router metadata routes for SEO, robots, sitemap, and 404 handling

## Run locally

```bash
npm install
npm run dev -- -H 127.0.0.1
```

Production check:

```bash
npm run lint
npm run build
npm run start -- -H 127.0.0.1
```

## Deploy

The repository includes `render.yaml` for a Render Blueprint. It also deploys without modification to Vercel. Set `NEXT_PUBLIC_SITE_URL` to the final public origin so canonical, Open Graph, sitemap, and robots URLs resolve to the production domain.

## Interaction map

- `/` or `⌘K`: command palette
- Light/dark mode: header control
- Developer mode: command palette → Developer mode
- Case Files: interactive experience archive
- Product Lab: six product narratives with architecture and roadmap

All factual claims, metrics, project URLs, social links, and original photography were recovered from the repository’s earlier history before the redesign.
