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
        bg: "var(--bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
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
        sm: "var(--shadow-sm)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ["var(--font-latin)", "var(--font-devanagari)", "sans-serif"],
        latin: ["var(--font-latin)", "sans-serif"],
        devanagari: ["var(--font-devanagari)", "sans-serif"],
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
