import { describe, expect, it } from "vitest";
import { median, latencyVerdict } from "@/lib/latency";

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBeNull();
  });
});

describe("latencyVerdict", () => {
  it("calls fast round trips fine", () => {
    expect(latencyVerdict(40)).toMatch(/good/i);
  });
  it("flags a probable region mismatch for slow round trips", () => {
    expect(latencyVerdict(250)).toMatch(/region/i);
  });
  it("handles unreachable", () => {
    expect(latencyVerdict(null)).toMatch(/could not reach/i);
  });
});
