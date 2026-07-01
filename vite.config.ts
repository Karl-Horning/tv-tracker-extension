import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                popup: resolve(import.meta.dirname, "popup.html"),
                background: resolve(
                    import.meta.dirname,
                    "src/background/worker.ts",
                ),
            },
            output: {
                entryFileNames: "[name].js",
            },
        },
    },
    test: {
        environment: "node",
    },
});
