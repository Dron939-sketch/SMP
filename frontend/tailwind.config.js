/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        smp: {
          ink: "#070b16",
          panel: "#0e1424",
          "panel-2": "#141b30",
          accent: "#38bdf8",
          "accent-2": "#22d3ee",
          gold: "#eab308",
          warn: "#f59e0b",
          crit: "#ef4444",
          ok: "#10b981",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.18), 0 8px 30px -8px rgba(56,189,248,0.35)",
        elevated:
          "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 16px 32px -16px rgba(0,0,0,0.6), 0 4px 12px -4px rgba(0,0,0,0.4)",
      },
      backgroundImage: {
        "panel-gradient":
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #131b30 0%, #0d1424 100%)",
        "hero-gradient":
          "radial-gradient(60% 80% at 20% 0%, rgba(56,189,248,0.18) 0%, transparent 60%), radial-gradient(50% 80% at 90% 20%, rgba(234,179,8,0.10) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};
