import { defineConfig } from "vite";

/**
 * Standalone content-script build — emits a single self-contained classic
 * (IIFE) bundle to `dist/content.js`. The Service Worker registers it
 * dynamically via `chrome.scripting.registerContentScripts`.
 *
 * Why a separate build:
 * - `chrome.scripting.registerContentScripts` does NOT support ES module
 *   scripts, so the content bundle must be a classic script with all deps
 *   inlined (inlineDynamicImports + IIFE).
 * - CRXJS's content-script loader (dynamic import + onExecute HMR wrapper) is
 *   incompatible with dynamic registration, so the content entry must NOT be
 *   declared in manifest.json or handled by CRXJS.
 *
 * The shared modules (storage/api/errors/etc.) are re-bundled here, which is
 * acceptable — the content script is the only consumer of this bundle.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/content/index.ts",
      name: "MouthpieceContent",
      fileName: () => "content.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        // Content script must be one file with everything inlined.
        inlineDynamicImports: true,
      },
    },
  },
});
