import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@comune": fileURLToPath(new URL("../../comune/src", import.meta.url)) },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    globals: true,
    // le prove casuali (archivi, documenti) e le finestre intere sono lente quando il computer è occupato: 5 s non bastano
    testTimeout: 30000,
    environment: "happy-dom",
    // il computer di prova si comporta come un Windows in italiano e ogni test parte con l'interfaccia in italiano (come pmb_docs)
    setupFiles: ["tests/impostazioni.ts"],
    environmentMatchGlobs: [
      ["tests/engine/**", "node"],
    ],
  },
});
