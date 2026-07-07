import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

/**
 * Main build — the Chrome extension proper (SW, popup, settings page, icons).
 * manifest has NO content_scripts entry; CRXJS never wraps a content loader
 * around our content code. The content script is built separately (see
 * vite.content.config.ts) and registered dynamically by the Service Worker.
 */
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
  },
});
