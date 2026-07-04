import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  plugins: [vue(), vueDevTools()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/primevue") || id.includes("node_modules/@primeuix")) {
            return "primevue";
          }
          if (
            id.includes("node_modules/vue") ||
            id.includes("node_modules/@vue") ||
            id.includes("node_modules/pinia")
          ) {
            return "vue";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  server: {
    port: 8080,
    watch: {
      usePolling: true,
    },
  },
});
