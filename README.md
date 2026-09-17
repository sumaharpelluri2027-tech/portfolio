# Sumahar Pelluri — Systems Builder

A product-led portfolio built around one positioning: **I turn messy manual processes into intelligent systems.**

## Stack

- Next.js 15, React 19, TypeScript
- Lightweight CSS/SVG motion, with reduced-motion support
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
- Six independent screens: Mission Control, Product Lab, Case Files, The Numbers, My Operating System, and Contact
- Product Lab: six builds with The flow / Story / Next subtabs
- Case Files and impact: separate company tabs with large metrics and proportional charts
- Persistent original Suno soundtrack: Chasing the Horizon; tap Play to load the audio
- Live date/time in IST, animated system diagram, and reduced-motion support

All factual claims, metrics, project URLs, social links, and original photography were recovered from the repository’s earlier history before the redesign.

## September 2026 visual refresh

Replaced the stacked, scroll-driven presentation with a navigable portfolio workspace. Existing source facts, product links, photographs, and the original uploaded HTML soundtrack are retained. Audio uses `preload="none"` and is not autoplayed.

Validation: TypeScript and production build pass; desktop browser preview verified.

## Visual restoration

The original HTML’s six organization logos, data-pipeline story, conversion funnel, skills explorer, milestones, and additional project concepts are restored in compact tabs. Case files and products lead with images and diagrams; longer context lives behind Story tabs. The soundtrack uses a custom vinyl player with seeking and volume controls. Old project hashes and direct Decco/Priya shortcuts are supported.

Verification: production build and TypeScript checks; browser checks for all six main screens, seven project tabs, company switching, toolkit/milestones, command navigation, 320px/390px widths, light/dark contrast, and soundtrack play/pause/seeking.
