/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#0c0b0a", paper: "#efe9dc", hazard: "#f2b705", oil: "#151311", bp: "#041224", bpline: "#4fc3ff", lcd: "#5dff9a", rust: "#c8261b" },
      fontFamily: {
        stencil: ['"Saira Stencil One"', '"Impact"', "sans-serif"],
        sans: ['"Barlow"', '"Inter"', "system-ui", "sans-serif"],
        cond: ['"Barlow Condensed"', '"Barlow"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
