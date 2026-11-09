import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Great_Vibes, Fredoka, Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const brand = Cinzel({ variable: "--font-brand", subsets: ["latin"], weight: ["500", "600"] });
// Script/display faces are only used on some invitation templates: load them on demand, not on every page.
const script = Great_Vibes({ variable: "--font-script", subsets: ["latin"], weight: "400", preload: false });
const display = Fredoka({ variable: "--font-display", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: { default: "Hapstoria — Every celebration has a story", template: "%s · Hapstoria" },
  description:
    "Beautiful digital invitations, effortless RSVPs, and a shared album for every guest's photos, videos and greetings.",
};

export const viewport: Viewport = { themeColor: "#faf6ee", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${brand.variable} ${script.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
