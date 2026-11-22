import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        fluent: {
          bg: "#0f172a",
          surface: "#1e293b",
          card: "#1e293b99",
          border: "#334155",
          accent: "#0078d4",
          "accent-hover": "#106ebe",
          "accent-subtle": "#0078d420",
          success: "#107c41",
          warning: "#d83b01",
          danger: "#a80000",
          text: "#f8fafc",
          muted: "#94a3b8",
        },
      },
      fontFamily: {
        fluent: ["Segoe UI Variable", "Segoe UI", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        mica: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
