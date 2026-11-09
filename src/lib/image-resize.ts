/** Longest side, in pixels, of photos stored for invitations and albums. Plenty for phones and projectors. */
export const IMAGE_MAX_EDGE = 1920;
const MIN_BYTES_TO_COMPRESS = 400_000;
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Scales (width, height) down so the longest side is at most `maxEdge`, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Only big still photos are worth re-encoding. GIFs (animation), videos and HEIC (browsers can't decode it) are left alone. */
export function shouldCompress(file: { type: string; size: number }): boolean {
  return COMPRESSIBLE.has(file.type) && file.size >= MIN_BYTES_TO_COMPRESS;
}

/**
 * Browser-only: shrinks a big photo to a JPEG no larger than IMAGE_MAX_EDGE on its longest side. Any problem
 * (unsupported format, no canvas, result not smaller) returns the original file, so uploading never fails because of this.
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // PNG transparency becomes white instead of black in JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
