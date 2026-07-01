import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                popup: resolve(import.meta.dirname, "popup.html"),
            },
        },
    },
});
