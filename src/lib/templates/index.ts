export interface Palette {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accentSoft: string;
}

export interface TemplateDef {
  id: string;
  name: string;
  kind: string;
  culture: string;
  description: string;
  palette: Palette;
  /** Heading font key; resolved to a CSS stack in `fontStack`. */
  font: "serif" | "script" | "sans" | "display";
  /** Which optional sections the public page shows by default. */
  sections: Array<"program" | "venue" | "dress" | "rsvp" | "gifts" | "uploads">;
}

export const EVENT_KINDS = [
  { id: "wedding", label: "Wedding" },
  { id: "debut", label: "Debut (18th)" },
  { id: "quinceanera", label: "Quinceañera" },
  { id: "christening", label: "Christening" },
  { id: "birthday", label: "Birthday" },
  { id: "baby-shower", label: "Baby shower" },
  { id: "graduation", label: "Graduation" },
  { id: "anniversary", label: "Anniversary" },
  { id: "cultural", label: "Cultural & holiday" },
  { id: "corporate", label: "Corporate" },
] as const;

const ALL = ["program", "venue", "dress", "rsvp", "gifts", "uploads"] as const;

const t = (
  id: string, name: string, kind: string, culture: string, description: string,
  palette: Palette, font: TemplateDef["font"],
): TemplateDef => ({ id, name, kind, culture, description, palette, font, sections: [...ALL] });

export const TEMPLATES: TemplateDef[] = [
  t("classic-gold", "Classic Gold", "wedding", "Universal", "Timeless ivory and champagne gold.",
    { bg: "#faf6ee", surface: "#fffdf8", text: "#2b2418", accent: "#b8934a", accentSoft: "#f1e6cc" }, "serif"),
  t("garden-lavender", "Garden Lavender", "wedding", "Universal", "Soft lavender florals for outdoor weddings.",
    { bg: "#f6f2fa", surface: "#fdfbff", text: "#2a2338", accent: "#8a6fb5", accentSoft: "#e5dcf2" }, "script"),
  t("barong-ivory", "Barong Ivory", "wedding", "Filipino", "Warm ivory with piña-inspired detail.",
    { bg: "#fbf7ef", surface: "#fffefa", text: "#2e2a20", accent: "#a9814a", accentSoft: "#efe3c8" }, "serif"),
  t("debut-blush", "Debut Blush", "debut", "Filipino", "18 roses and 18 candles, in blush pink.",
    { bg: "#fdf1f3", surface: "#fffafb", text: "#3a2230", accent: "#d17a94", accentSoft: "#f8d9e1" }, "script"),
  t("debut-midnight", "Debut Midnight", "debut", "Filipino", "A midnight-blue and gold gala look.",
    { bg: "#141a33", surface: "#1d2545", text: "#f4efe0", accent: "#d9b45a", accentSoft: "#2a3563" }, "display"),
  t("quince-rose", "Quinceañera Rose", "quinceanera", "Latin American", "Romantic rose and gold for a fifteenth.",
    { bg: "#fff1f4", surface: "#fffafb", text: "#40202c", accent: "#c25479", accentSoft: "#f9d7e1" }, "script"),
  t("quince-royal", "Quinceañera Royal", "quinceanera", "Latin American", "Royal purple with a crown motif.",
    { bg: "#f3eefa", surface: "#fbf9ff", text: "#2a1f40", accent: "#7a52b8", accentSoft: "#e0d3f3" }, "display"),
  t("christening-dove", "Christening Dove", "christening", "Universal", "Gentle white and sky blue.",
    { bg: "#f2f7fb", surface: "#fbfdff", text: "#22303d", accent: "#6a9cc4", accentSoft: "#d9e8f4" }, "serif"),
  t("ninang-cream", "Binyag Cream", "christening", "Filipino", "Cream and sage, with room for ninong and ninang.",
    { bg: "#f8f6ee", surface: "#fffdf7", text: "#2b2f22", accent: "#7f9468", accentSoft: "#e4ead9" }, "serif"),
  t("party-confetti", "Confetti Party", "birthday", "Universal", "Bright, playful and loud.",
    { bg: "#fff8e6", surface: "#ffffff", text: "#2b2540", accent: "#ff6b6b", accentSoft: "#ffe0a8" }, "display"),
  t("dino-adventure", "Dino Adventure", "birthday", "Universal", "Green and orange for little explorers.",
    { bg: "#eef7e8", surface: "#fbfff7", text: "#1f3320", accent: "#f08a24", accentSoft: "#d6edc8" }, "sans"),
  t("elegant-40", "Elegant Milestone", "birthday", "Universal", "Understated black and gold for milestone birthdays.",
    { bg: "#161412", surface: "#211e1b", text: "#f2ece0", accent: "#c9a24b", accentSoft: "#332d24" }, "serif"),
  t("baby-cloud", "Baby Cloud", "baby-shower", "Universal", "Pastel clouds and stars.",
    { bg: "#f4f8fb", surface: "#ffffff", text: "#2a3340", accent: "#8bb7d9", accentSoft: "#dcebf6" }, "sans"),
  t("grad-ink", "Graduate", "graduation", "Universal", "Navy and gold for the big day.",
    { bg: "#f3f4f8", surface: "#ffffff", text: "#1b2238", accent: "#c79a2e", accentSoft: "#e3e6f1" }, "serif"),
  t("anniv-silver", "Silver Years", "anniversary", "Universal", "Silver and lavender for lasting love.",
    { bg: "#f4f3f7", surface: "#fdfdff", text: "#2a2833", accent: "#8c86a8", accentSoft: "#e3e1ec" }, "serif"),
  t("lunar-red", "Lunar New Year", "cultural", "East Asian", "Auspicious red and gold.",
    { bg: "#fff2ee", surface: "#fffaf8", text: "#3a1a14", accent: "#c8362d", accentSoft: "#f7d5c9" }, "display"),
  t("diwali-glow", "Diwali Glow", "cultural", "South Asian", "Marigold, magenta and diya light.",
    { bg: "#fff6e5", surface: "#fffcf4", text: "#3a1f2c", accent: "#d9467a", accentSoft: "#ffe0a3" }, "display"),
  t("eid-crescent", "Eid Crescent", "cultural", "Middle Eastern", "Deep emerald with a gold crescent.",
    { bg: "#eef6f1", surface: "#fbfffc", text: "#16312a", accent: "#b8964a", accentSoft: "#d3e8dc" }, "serif"),
  t("noche-buena", "Noche Buena", "cultural", "Latin American & Filipino", "Warm Christmas Eve reds and greens.",
    { bg: "#fbf3ea", surface: "#fffdf9", text: "#2f2118", accent: "#b6362f", accentSoft: "#e5ecd8" }, "serif"),
  t("corp-slate", "Corporate Slate", "corporate", "Universal", "Clean slate and teal for company events.",
    { bg: "#f3f5f7", surface: "#ffffff", text: "#1d2630", accent: "#1f8a8a", accentSoft: "#d8eded" }, "sans"),
];

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
}

export function templatesByKind(kind: string): TemplateDef[] {
  return TEMPLATES.filter((x) => x.kind === kind);
}

export const FONT_STACKS: Record<TemplateDef["font"], string> = {
  serif: "var(--font-serif), Georgia, serif",
  script: "var(--font-script), 'Brush Script MT', cursive",
  sans: "var(--font-sans), system-ui, sans-serif",
  display: "var(--font-display), 'Trebuchet MS', sans-serif",
};
