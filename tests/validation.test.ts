import { describe, expect, it } from "vitest";
import { eventInputSchema, rsvpInputSchema, greetingInputSchema } from "@/lib/validation";

describe("eventInputSchema", () => {
  const base = { title: "Sofia at 18", kind: "debut", template_id: "debut-blush" };
  it("accepts minimal input and applies defaults", () => {
    const r = eventInputSchema.parse(base);
    expect(r.max_plus_ones).toBe(4);
    expect(r.meal_options).toEqual([]);
  });
  it("trims and rejects empty title", () => {
    expect(eventInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
  });
  it("parses meal options from comma text and caps them", () => {
    const r = eventInputSchema.parse({ ...base, meal_options: "Beef, Fish, ,Veg" });
    expect(r.meal_options).toEqual(["Beef", "Fish", "Veg"]);
  });
  it("turns empty datetime into null", () => {
    expect(eventInputSchema.parse({ ...base, starts_at: "" }).starts_at).toBeNull();
  });
});

describe("rsvpInputSchema", () => {
  it("requires a name", () => {
    expect(rsvpInputSchema.safeParse({ name: "", status: "accepted", party_size: 1 }).success).toBe(false);
  });
  it("coerces numeric strings (form data)", () => {
    expect(rsvpInputSchema.parse({ name: "Ana", status: "accepted", party_size: "2" }).party_size).toBe(2);
  });
  it("forces party size 0 when declining", () => {
    expect(rsvpInputSchema.parse({ name: "Ana", status: "declined", party_size: "3" }).party_size).toBe(0);
  });
  it("rejects bad email but allows empty", () => {
    expect(rsvpInputSchema.safeParse({ name: "A", status: "accepted", party_size: 1, email: "x" }).success).toBe(false);
    expect(rsvpInputSchema.safeParse({ name: "A", status: "accepted", party_size: 1, email: "" }).success).toBe(true);
  });
});

describe("greetingInputSchema", () => {
  it("limits length", () => {
    expect(greetingInputSchema.safeParse({ name: "A", text: "x".repeat(1001) }).success).toBe(false);
    expect(greetingInputSchema.safeParse({ name: "A", text: "Congrats!" }).success).toBe(true);
  });
});
