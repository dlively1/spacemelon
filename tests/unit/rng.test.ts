import { describe, expect, it } from "vitest";
import { Rng } from "../../src/agent/rng";

describe("Rng", () => {
  it("produces an identical sequence for the same seed", () => {
    const a = new Rng(0xc0ffee);
    const b = new Rng(0xc0ffee);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() stays within [0, 1)", () => {
    const rng = new Rng(42);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.next();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("range() stays within bounds", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const n = rng.range(-50, 130);
      expect(n).toBeGreaterThanOrEqual(-50);
      expect(n).toBeLessThan(130);
    }
  });

  it("int() covers the full range and respects the exclusive max", () => {
    const rng = new Rng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(0, 4);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
      seen.add(n);
    }
    expect(seen.size).toBe(4);
  });

  it("pick() only returns members of the list", () => {
    const rng = new Rng(5);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("a zero seed still produces a usable sequence", () => {
    const rng = new Rng(0);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
    expect(rng.next()).not.toBe(rng.next());
  });
});
