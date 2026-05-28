/**
 * Koudai — Root Layout
 *
 * Sets up:
 *  - Google Fonts (Inter + JetBrains Mono) via next/font
 *  - Global CSS import
 *  - Full-height dark background
 *  - SEO metadata
 */

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* ── Font Configuration ──────────────────────────────────────────────── */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

/* ── SEO Metadata ────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: {
    default: "Koudai — AI Trading Agent | Injective",
    template: "%s | Koudai",
  },
  description:
    "Koudai is an AI-powered natural language DeFi trading agent built on the Injective network. Type trading commands in plain English and execute them instantly.",
  keywords: [
    "Koudai",
    "DeFi",
    "Injective",
    "AI trading",
    "Web3",
    "crypto trading agent",
    "natural language trading",
    "Gemini AI",
  ],
  authors: [{ name: "Koudai Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Koudai — AI Trading Agent | Injective",
    description:
      "Natural language DeFi trading on Injective. Powered by Gemini AI.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04050A",
  colorScheme: "dark",
};

/* ── Root Layout ─────────────────────────────────────────────────────── */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-dvh">
        {children}
      </body>
    </html>
  );
}
