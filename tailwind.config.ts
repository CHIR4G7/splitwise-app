import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        // Chart marks use their own step: the brand ramp sits below the chroma floor
        // (validated against the light chart surface) and reads gray as a fill.
        chart: {
          DEFAULT: "#0d9488",
          soft: "#ccfbf1"
        },
        brand: {
          50: "#eef6f5",
          100: "#d5e9e6",
          200: "#aed4cf",
          300: "#7db8b1",
          400: "#4f9990",
          500: "#2f7d74",
          600: "#23645d",
          700: "#1d504b",
          800: "#193f3c",
          900: "#153331"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
