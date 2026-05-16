import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";

/*
 * File-size guard (Phase 2 from the external audit, 2026-05-16).
 *
 * Goal: keep new modules small without blocking the existing oversized
 * AiAssistant.vue (3635 lines as of the audit) on CI. The rules below are
 * "warn" by default so that:
 *
 *  - CI does not fail (ESLint warn ≠ exit 1).
 *  - Editors still surface the warning to the author at write-time.
 *  - The current historical debt is tracked file-by-file in the
 *    `historicalLargeFiles` override so we can shrink the per-file cap
 *    over time without a single thousand-line refactor PR.
 *
 * When you bring a file below its current override, drop the override and
 * the global 800-line warn cap kicks in. The end state is no overrides at
 * all and an "error" level on max-lines for everyone.
 */
const FILE_LINE_LIMIT_DEFAULT = 800;
const FUNCTION_LINE_LIMIT_DEFAULT = 150;

const historicalLargeFiles = {
  // Triage Phase 2: each entry should shrink over time as we extract
  // composables and sub-components. Do NOT raise a number here without
  // also opening an issue tagged `tech-debt`. CSS files are NOT listed
  // here because ESLint does not parse CSS; for CSS size tracking see
  // `scripts/bundle-size-check.mjs` and the comment block at the top of
  // each `NN-*.css` slice.
  "src/components/AiAssistant.vue": 3800,
};

const sizeOverrides = Object.entries(historicalLargeFiles).map(
  ([file, cap]) => ({
    files: [file],
    rules: {
      "max-lines": [
        "warn",
        { max: cap, skipBlankLines: true, skipComments: true },
      ],
    },
  }),
);

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  prettier,
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/multi-word-component-names": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      /*
       * Phase 2: file-size guard. Default = warn at 800 lines; the
       * historical-large overrides below raise the cap for known
       * oversized files. New files inherit the 800-line cap.
       */
      "max-lines": [
        "warn",
        {
          max: FILE_LINE_LIMIT_DEFAULT,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      /*
       * Function-level cap is stricter and applies everywhere. Most
       * composables already comply; AiAssistant's giant setup() is split
       * into named functions so it should also stay under the cap.
       */
      "max-lines-per-function": [
        "warn",
        {
          max: FUNCTION_LINE_LIMIT_DEFAULT,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
    },
  },
  // Test files routinely have long describe blocks and large fixtures;
  // do not warn on file/function size there.
  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
  // Per-file overrides for historical large files (see comment above).
  ...sizeOverrides,
);
