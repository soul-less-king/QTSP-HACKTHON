import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // QSTP brand palette (extracted from qstp.qa): teal primary + green/lime accents
        brand: {
          50: "#f0fbfb",
          100: "#d3f4f5",
          200: "#ace9eb",
          300: "#74d8dc",
          400: "#38c0c6",
          500: "#20abb1", // QSTP teal
          600: "#1a8f95",
          700: "#1b7378",
          800: "#1d5c60",
          900: "#1c4c50",
          950: "#0b2f32",
        },
        accent: {
          50: "#ecfdf3",
          100: "#d2f9e0",
          200: "#a8f0c6",
          300: "#6fe3a5",
          400: "#3fce85",
          500: "#36b769", // QSTP green
          600: "#299654",
          700: "#237845",
          800: "#1f5f39",
          900: "#1b4e31",
          950: "#0a2c1b",
        },
        lime: {
          50: "#fbfde9",
          100: "#f3facb",
          200: "#ebf495",
          300: "#dde85a",
          400: "#d8e24f",
          500: "#c9d62c", // QSTP lime
          600: "#a4ad22",
          700: "#7e8420",
          800: "#646a21",
          900: "#545a20",
        },
        ink: "#111315", // QSTP near-black (logo / headings)
        cream: "#f1f4e9", // QSTP off-white
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Tahoma", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "loading-bar": {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(320%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
        "loading-bar": "loading-bar 1.15s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
