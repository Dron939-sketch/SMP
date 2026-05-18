/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        smp: {
          ink: "#0b1220",
          panel: "#111827",
          accent: "#22d3ee",
          warn: "#f59e0b",
          crit: "#ef4444",
          ok: "#10b981",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
