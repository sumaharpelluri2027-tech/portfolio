// Artifact preview only: binary 3D assets embedded as data URLs (the preview host doesn't serve .glb/.hdr).
const models = import.meta.glob("../public/models/*.glb", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;
const hdr = import.meta.glob("../public/hdr/*.hdr", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;
export const ASSETS: Record<string, string> = {};
for (const [k, v] of Object.entries({ ...models, ...hdr })) ASSETS[k.replace("../public/", "")] = v;
