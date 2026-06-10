import { defineConfig } from "vitest/config";

// Unit tests cover the pure game logic (src/rules/, src/levels/, src/agent/rng)
// and run in milliseconds — no browser, no Phaser. End-to-end behavior stays
// in the Playwright suite (tests/*.spec.ts).
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
