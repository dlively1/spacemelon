import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Static-host base path. Defaults to "/" for local dev/preview; the Pages
  // deploy workflow sets BASE_PATH="/spacemelon/" so built asset URLs resolve
  // under the project-pages subpath (https://dlively1.github.io/spacemelon/).
  base: process.env.BASE_PATH ?? "/",
  server: {
    host: true, // bind 0.0.0.0 so dev server is reachable on LAN
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/.claude/**"],
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
