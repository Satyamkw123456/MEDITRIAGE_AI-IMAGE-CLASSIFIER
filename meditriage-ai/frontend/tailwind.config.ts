import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--bg)",
          tint: "var(--bg-tint)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        "border-control": "var(--border-control)",
        accent: {
          warm: "var(--accent-warm)",
        },
        glass: {
          bg: "var(--glass-bg)",
          border: "var(--glass-border)",
          hairline: "var(--glass-hairline)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          soft: "var(--primary-soft)",
          hover: "var(--primary-hover)",
        },
        emergency: {
          DEFAULT: "var(--emergency)",
          soft: "var(--emergency-soft)",
        },
        urgent: {
          DEFAULT: "var(--urgent)",
          soft: "var(--urgent-soft)",
        },
        routine: {
          DEFAULT: "var(--routine)",
          soft: "var(--routine-soft)",
        },
        selfcare: {
          DEFAULT: "var(--selfcare)",
          soft: "var(--selfcare-soft)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        DEFAULT: "var(--shadow)",
        card: "var(--shadow)",
        xs: "var(--shadow-sm)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        popover: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ["var(--font-latin)", "var(--font-devanagari)", "sans-serif"],
        latin: ["var(--font-latin)", "sans-serif"],
        devanagari: ["var(--font-devanagari)", "sans-serif"],
        display: ["var(--font-display)", "var(--font-latin)", "sans-serif"],
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      minHeight: {
        touch: "var(--touch-target)",
        "touch-elder": "56px",
      },
      minWidth: {
        touch: "var(--touch-target)",
        "touch-elder": "56px",
      },
      fontSize: {
        elder: ["1.25rem", { lineHeight: "1.75rem" }], // 20px base text for elder mode
      },
    },
  },
  plugins: [],
};

export default config;
