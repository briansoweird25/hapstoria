import { describe, expect, it } from "vitest";
import { collageRects, coverCrop, MAX_COLLAGE_PHOTOS, type Rect } from "@/lib/collage";

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

describe("collageRects", () => {
  for (const layout of ["grid", "mosaic", "filmstrip"] as const) {
    for (const n of [1, 2, 3, 5, 9, 12]) {
      it(`${layout} with ${n} photos: right count, in bounds, no overlap, caption room`, () => {
        const { rects, canvas, captionHeight } = collageRects(layout, n);
        expect(rects).toHaveLength(n);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(canvas.w + 0.01);
          expect(r.y + r.h).toBeLessThanOrEqual(canvas.h - captionHeight + 0.01);
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
        }
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(rects[i], rects[j])).toBe(false);
      });
    }
  }
  it("caps the number of photos", () => {
    expect(collageRects("grid", 100).rects).toHaveLength(MAX_COLLAGE_PHOTOS);
  });
  it("returns no rects for zero photos", () => {
    expect(collageRects("grid", 0).rects).toEqual([]);
  });
  it("mosaic makes the first photo the largest", () => {
    const { rects } = collageRects("mosaic", 5);
    const area = (r: Rect) => r.w * r.h;
    expect(area(rects[0])).toBeGreaterThan(Math.max(...rects.slice(1).map(area)));
  });
});

describe("coverCrop", () => {
  it("crops a wide image to fill a square cell, centered", () => {
    expect(coverCrop(400, 200, 100, 100)).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200 });
  });
  it("crops a tall image vertically", () => {
    expect(coverCrop(200, 400, 100, 100)).toEqual({ sx: 0, sy: 100, sw: 200, sh: 200 });
  });
});
