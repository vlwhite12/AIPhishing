import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system tokens – mirrors the risk-level palette used in components
        risk: {
          safe: "#16a34a",       // green-600
          "safe-bg": "#dcfce7",  // green-100
          low: "#ca8a04",        // yellow-600
          "low-bg": "#fef9c3",   // yellow-100
          medium: "#ea580c",     // orange-600
          "medium-bg": "#ffedd5",// orange-100
          high: "#dc2626",       // red-600
          "high-bg": "#fee2e2",  // red-100
          critical: "#7f1d1d",   // red-900
          "critical-bg": "#fecaca", // red-200
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
