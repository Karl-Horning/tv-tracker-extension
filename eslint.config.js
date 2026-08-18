// @ts-check

/**
 * @fileoverview ESLint flat config for the extension, popup, and landing page.
 *
 * Type-aware TypeScript linting via `projectService`, which resolves each
 * file to the tsconfig that includes it (app, node, or docs) automatically.
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["dist/**", "coverage/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ["**/*.js"],
        ...tseslint.configs.disableTypeChecked,
    },
);
