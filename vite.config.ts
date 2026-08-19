/**
 * @fileoverview Vite build and Vitest test configuration for the extension.
 *
 * Defines the popup and background service worker as separate build
 * entry points, and configures Vitest to run tests in a Node environment.
 */

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                popup: resolve(import.meta.dirname, "popup.html"),
                import: resolve(import.meta.dirname, "import.html"),
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
