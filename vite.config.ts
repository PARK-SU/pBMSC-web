import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Served site adress setting.
export const base = "./";

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      scope: base,
      manifest: {
        id: base,
        name: "pBMSC-Web",
        short_name: "pBMSC-Web",
        description: "Online BMS chart editor",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f0f0f0",
        theme_color: "#f0f0f0",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: { globPatterns: ["**/*"], globIgnores: ["**/*.map"] },
    }),
  ],
  worker: {
    format: "es",
    rollupOptions: {
      external: ["codec-parser"],
      output: { paths: { "codec-parser": "../vendor/codec-parser/index.js" } },
    },
  },
});
