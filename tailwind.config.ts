import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./layouts/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: "#F59E0B",
        "brand-soft": "#FFF7E6",
        "brand-dark": "#1F2933",
        ink: "#0F172A",
        muted: "#6B7280",
        "border-subtle": "#E5E7EB",
        "bg-page": "#F3F4F6",
        "bg-elevated": "#FFFFFF",
        "accent-blue": "#3B82F6",
        "sc-bg": "var(--sc-bg)",
        "sc-surface": "var(--sc-surface)",
        "sc-surface-2": "var(--sc-surface-2)",
        "sc-border": "var(--sc-border)",
        "sc-text": "var(--sc-text)",
        "sc-muted": "var(--sc-muted)",
        "sc-yellow": "var(--sc-yellow)",
        "sc-yellow-2": "var(--sc-yellow-2)",
        "sc-danger": "var(--sc-danger)",
        "sc-focus": "var(--sc-focus)",
        "adm-bg": "var(--adm-bg)",
        "adm-surface": "var(--adm-surface)",
        "adm-surface-2": "var(--adm-surface-2)",
        "adm-border": "var(--adm-border)",
        "adm-text": "var(--adm-text)",
        "adm-muted": "var(--adm-muted)",
        "adm-accent": "var(--adm-accent)",
        "adm-warning": "var(--adm-warning)",
        "adm-danger": "var(--adm-danger)"
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 23, 42, 0.12)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
