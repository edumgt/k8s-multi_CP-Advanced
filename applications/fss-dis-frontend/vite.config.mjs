import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    quasar(),
  ],
  server: {
    host: "0.0.0.0",
    port: 9000,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
