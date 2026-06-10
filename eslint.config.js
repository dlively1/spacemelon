import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "playwright-report/", "test-results/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      // The codebase deliberately uses non-null assertions where Phaser's
      // lifecycle guarantees presence (keyboard plugin, scene fields).
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // Determinism: gameplay code must route all randomness through the seeded
    // Rng (src/agent/rng.ts) so runs are reproducible per seed.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Use the seeded Rng (src/agent/rng.ts) — gameplay must stay deterministic per seed.",
        },
      ],
    },
  },
  {
    // Audio synthesis is exempt: noise buffers aren't gameplay-observable
    // state, and re-seeding them per run would add complexity for no benefit.
    files: ["src/audio/**/*.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
);
