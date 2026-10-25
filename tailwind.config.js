/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { space: "#030014", drawer: "#333333", lime: "#CCFF00", energy: "#88AAFF" },
      fontFamily: {
        display: ['"Anton"', '"Impact"', '"Arial Black"', "sans-serif"],
        sans: ['"Space Grotesk"', '"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
