import type { Config } from "tailwindcss";

/**
 * Dark theme.
 *
 * The scales below are inverted rather than renamed: throughout the app a low step means
 * "recessive surface" and a high step means "prominent text", so flipping the ramps turns the
 * whole UI dark without rewriting every className. Neutrals carry a slight teal bias toward the
 * brand hue so they read as chosen rather than as default grey.
 *
 * `white` stays true white — it is only used as label text on filled buttons. Surfaces use the
 * explicit `card` token instead.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        // Panel surface, one step lighter than the page so cards separate without a border.
        card: "#18211e",

        // Chart marks. Validated against both the light and dark chart surfaces —
        // the brand ramp falls below the chroma floor and reads grey as a large fill.
        chart: {
          DEFAULT: "#0d9488",
          soft: "#123c38"
        },

        // 50 = page ground … 900 = strongest text.
        slate: {
          50: "#0f1614",
          100: "#212d29",
          200: "#24322e",
          300: "#2c3b36",
          400: "#6b7d77",
          500: "#8a9d96",
          600: "#a4b5ae",
          700: "#c0cec8",
          800: "#d8e3de",
          900: "#eaf1ee"
        },

        // 50–300 are tints and disabled fills, 600 is the filled-button ground,
        // 700–800 are text on dark.
        brand: {
          50: "#14231f",
          100: "#1b2f2a",
          200: "#27443d",
          300: "#3d6b62",
          400: "#55897f",
          500: "#6ea79c",
          600: "#227c6e",
          700: "#8fc7bc",
          800: "#a8d6cc",
          900: "#c2e3db"
        },

        emerald: {
          50: "#12241a",
          200: "#24422f",
          700: "#7fd39a",
          800: "#a5e3b8"
        },

        amber: {
          50: "#2a1f10",
          200: "#4a3a1c",
          700: "#e0b370",
          800: "#f0cb96"
        },

        red: {
          50: "#2a1618",
          200: "#4a2528",
          300: "#5e3033",
          500: "#c9534c",
          600: "#b3453f",
          700: "#f0a3a0",
          800: "#f5b8b5"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
