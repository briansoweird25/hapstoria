export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type UploadCheck = { ok: true; kind: "photo" | "video" } | { ok: false; error: string };

export function validateUpload(file: { type: string; size: number }): UploadCheck {
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.type in PHOTO_TYPES) {
    return file.size > MAX_PHOTO_BYTES
      ? { ok: false, error: "Photos can be up to 25 MB." }
      : { ok: true, kind: "photo" };
  }
  if (file.type in VIDEO_TYPES) {
    return file.size > MAX_VIDEO_BYTES
      ? { ok: false, error: "Videos can be up to 100 MB." }
      : { ok: true, kind: "video" };
  }
  return { ok: false, error: "Unsupported file type. Use JPG, PNG, WebP, GIF, HEIC, MP4, MOV or WebM." };
}

export function extensionFor(mime: string): string {
  return PHOTO_TYPES[mime] ?? VIDEO_TYPES[mime] ?? "bin";
}
