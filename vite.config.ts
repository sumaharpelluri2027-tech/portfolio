import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "artifact" ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    copyPublicDir: mode !== "artifact",
    chunkSizeWarningLimit: 1200,
  },
}));
