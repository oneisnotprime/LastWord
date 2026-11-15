import { resolve } from "node:path";
import { defineConfig } from "vite";

// Pages: the game, the art style prototypes (styles.html), the shape gallery and the word browser (words.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        styles: resolve(import.meta.dirname, "styles.html"),
        gallery: resolve(import.meta.dirname, "gallery.html"),
        words: resolve(import.meta.dirname, "words.html"),
      },
    },
  },
});
