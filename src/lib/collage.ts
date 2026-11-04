export type CollageLayout = "grid" | "mosaic" | "filmstrip";
export interface Rect { x: number; y: number; w: number; h: number }

export const MAX_COLLAGE_PHOTOS = 16;
const GAP = 12;
const CAPTION_RATIO = 0.12;

/** Computes where each photo goes on the canvas. A caption band is reserved at the bottom. */
export function collageRects(layout: CollageLayout, count: number): { rects: Rect[]; canvas: { w: number; h: number }; captionHeight: number } {
  const n = Math.min(Math.max(count, 0), MAX_COLLAGE_PHOTOS);
  const canvas = layout === "filmstrip" ? { w: 2400, h: 1000 } : { w: 2000, h: 2000 };
  const captionHeight = Math.round(canvas.h * CAPTION_RATIO);
  const area = { x: GAP, y: GAP, w: canvas.w - GAP * 2, h: canvas.h - captionHeight - GAP };
  if (n === 0) return { rects: [], canvas, captionHeight };

  let rects: Rect[] = [];
  if (layout === "filmstrip") {
    const w = (area.w - GAP * (n - 1)) / n;
    rects = Array.from({ length: n }, (_, i) => ({ x: area.x + i * (w + GAP), y: area.y, w, h: area.h }));
  } else if (layout === "mosaic" && n > 1) {
    const bigW = (area.w - GAP) * (2 / 3);
    rects.push({ x: area.x, y: area.y, w: bigW, h: area.h });
    const rest = n - 1;
    const sideX = area.x + bigW + GAP;
    const sideW = area.w - bigW - GAP;
    const cols = rest > 4 ? 2 : 1;
    const rows = Math.ceil(rest / cols);
    const cw = (sideW - GAP * (cols - 1)) / cols;
    const ch = (area.h - GAP * (rows - 1)) / rows;
    for (let i = 0; i < rest; i++) {
      rects.push({ x: sideX + (i % cols) * (cw + GAP), y: area.y + Math.floor(i / cols) * (ch + GAP), w: cw, h: ch });
    }
  } else {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cw = (area.w - GAP * (cols - 1)) / cols;
    const ch = (area.h - GAP * (rows - 1)) / rows;
    rects = Array.from({ length: n }, (_, i) => ({ x: area.x + (i % cols) * (cw + GAP), y: area.y + Math.floor(i / cols) * (ch + GAP), w: cw, h: ch }));
  }
  return { rects, canvas, captionHeight };
}

/** Source rectangle for drawing an image into a cell with "cover" fitting (center crop). */
export function coverCrop(iw: number, ih: number, cw: number, ch: number) {
  const scale = Math.max(cw / iw, ch / ih);
  const sw = cw / scale;
  const sh = ch / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}
