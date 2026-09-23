/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy pulled from the MAP3D logo ring.
        ink: {
          DEFAULT: "#0c1a2e",
          900: "#0c1a2e",
          800: "#132842",
          700: "#1d3a5c",
          600: "#2c5282",
        },
        paper: {
          DEFAULT: "#f5f2ec",
          dark: "#ebe6dc",
        },
        // Hot-end orange: the one loud colour on the page.
        flame: {
          DEFAULT: "#ff5b1f",
          600: "#e84a10",
          100: "#ffe4d6",
        },
        sky: {
          DEFAULT: "#5aa9e6",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
