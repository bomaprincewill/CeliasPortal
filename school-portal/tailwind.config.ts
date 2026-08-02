import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#ecfdf3", 100: "#d1fae0", 200: "#a7f3c4",
          300: "#6ee79a", 400: "#34d36d", 500: "#00a94f",
          600: "#00843d", 700: "#006f35", 800: "#005f30",
          900: "#00572d", 950: "#00572d",
        },
        ink:     "#0f172a",
        muted:   "#64748b",
        surface: "#f8fafc",
        card:    "#ffffff",
        border:  "#e2e8f0",
        success: "#16a34a",
        danger:  "#dc2626",
        warn:    "#d97706",
      },
      fontFamily: {
        sans:    ["Segoe UI", "Arial", "system-ui", "sans-serif"],
        display: ["Segoe UI", "Arial", "system-ui", "sans-serif"],
        mono:    ["Cascadia Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
