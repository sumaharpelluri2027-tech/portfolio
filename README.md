# sumaharpelluri.in · Sumahar's Garage

A 3D portfolio. A BAJA buggy sits on a lift in a night-time garage; every part of the car opens a piece of work (brakes = data trust, engine = operations, accelerator = growth, steering = strategy, fuel = finance, navigation = AI, gauges = reporting). Garage objects open the rest: the build board (every Masters' Union project), the Wing and Decco boards, the tool chest, trophies, Sumahar AI on the laptop, a diagnostic scanner, and a power box that lifts the bonnet to show the data wiring. "Take it for a drive" opens a drivable test track where each gate is a business function and the pit unlocks the hiring achievement.

**Stack:** React 18 · Vite · TypeScript · Tailwind · Framer Motion · Three.js. Garage props, textures and lighting are CC0 from Poly Haven.

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + build to ./out (what Render serves)
```

- Content: `src/data.ts`, `src/content.ts` (car parts / job cards), `src/projects.ts` (build board), `src/bot.ts` (chatbot).
- Scenes: `src/scene/garage.ts`, `src/scene/buggy.ts`, `src/scene/track.ts`.
- Routes: `#/` garage, `#/drive` test track, `#/specs` plain spec sheet.
- `?low` forces low graphics quality.
