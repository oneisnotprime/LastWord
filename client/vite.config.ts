import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the game, and the art style prototypes (styles.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        styles: resolve(import.meta.dirname, "styles.html"),
        gallery: resolve(import.meta.dirname, "gallery.html"),
      },
    },
  },
});
