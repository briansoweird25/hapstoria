import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplate, templatesByKind, EVENT_KINDS } from "@/lib/templates";

describe("templates", () => {
  it("has unique ids and valid hex colors", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) {
      for (const c of Object.values(t.palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("covers every event kind with at least one template", () => {
    for (const k of EVENT_KINDS) expect(templatesByKind(k.id).length).toBeGreaterThan(0);
  });
  it("falls back to the first template for unknown ids", () => {
    expect(getTemplate("nope").id).toBe(TEMPLATES[0].id);
  });
  it("includes culture-specific templates", () => {
    const ids = TEMPLATES.map((t) => t.id).join(" ");
    expect(ids).toMatch(/debut/);
    expect(ids).toMatch(/quince/);
  });
});
