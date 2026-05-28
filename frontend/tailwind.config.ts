/**
 * Koudai "Cyber-Shinobi" Tailwind v4 Configuration
 *
 * Tailwind CSS v4 uses a CSS-first configuration model.
 * This file only controls the `content` paths for class scanning.
 * All design tokens (colors, fonts, etc.) are defined in globals.css
 * using the @theme directive.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
