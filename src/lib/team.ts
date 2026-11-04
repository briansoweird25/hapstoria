import { z } from "zod";
import { isValidSlug } from "@/lib/slug";

export type Role = "editor" | "viewer";

export const canWrite = (role: Role | null | undefined): boolean => role === "editor";

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const isHexColor = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["editor", "viewer"]),
});

export const profileSchema = z.object({
  business_name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().refine(isValidSlug, "Use 3–60 lowercase letters, numbers or dashes"),
  tagline: z.string().trim().max(160).optional(),
  brand_color: z.string().trim().refine(isHexColor, "Use a hex color like #8a6fb5").default("#b8934a"),
  is_public: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()).default(false),
});
export type ProfileInput = z.infer<typeof profileSchema>;
