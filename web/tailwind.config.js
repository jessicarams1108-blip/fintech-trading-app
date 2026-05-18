/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "#2A5BDB",
          muted: "#1e4fc4",
        },
        oove: {
          blue: "#2A5BDB",
          green: "#00D395",
          page: "rgb(var(--oove-page) / <alpha-value>)",
          panel: "rgb(var(--oove-panel) / <alpha-value>)",
          card: "rgb(var(--oove-card) / <alpha-value>)",
          "card-muted": "rgb(var(--oove-card-muted) / <alpha-value>)",
          border: "rgb(var(--oove-border) / <alpha-value>)",
          ink: "rgb(var(--oove-text) / <alpha-value>)",
          "ink-muted": "rgb(var(--oove-text-muted) / <alpha-value>)",
          "ink-subtle": "rgb(var(--oove-text-subtle) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
