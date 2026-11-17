import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "artifact" ? [viteSingleFile()] : [])],
  resolve: { alias: { "virtual:assets": mode === "artifact" ? "/src/assetsInline.ts" : "/src/assetsNone.ts" } },
  assetsInclude: ["**/*.hdr", "**/*.glb"],
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    copyPublicDir: mode !== "artifact",
    rollupOptions: mode === "artifact" ? undefined : { output: { manualChunks: { three: ["three"], ui: ["react", "react-dom", "framer-motion"] } } },
    chunkSizeWarningLimit: 1200,
  },
}));
