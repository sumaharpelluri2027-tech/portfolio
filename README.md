# sumaharpelluri.in

Portfolio of Sumahar Pelluri: systems builder across data, operations and AI.

**Stack:** React 18 · Vite · TypeScript · Tailwind CSS · Framer Motion · Three.js (particle field with bloom and pointer repulsion).

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to ./out (what Render serves)
```

Pages are hash routes (`#/work`, `#/experience`, `#/labs`, `#/about`, `#/contact`) so the site runs on any static host.
Content lives in `src/data.ts`; the chatbot persona and offline answers in `src/bot.ts`.
Add `?nogl` to the URL to disable WebGL (handy for screenshots).
