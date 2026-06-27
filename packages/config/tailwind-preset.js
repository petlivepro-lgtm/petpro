import { colors } from "./tokens.js";

/** Preset Tailwind compartilhado pelos apps (branding MyLivePet / Pet Live Pro). */
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        graphite: colors.graphite,
        orange: colors.orange,
        petrol: colors.petrol,
        "gray-neutral": colors.gray,
        "gray-soft": colors.grayLight,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        // papéis semânticos
        brand: {
          DEFAULT: colors.orange,
          fg: colors.white,
        },
        surface: {
          DEFAULT: colors.white,
          muted: colors.grayLight,
          dark: colors.graphite,
        },
      },
      fontFamily: {
        // resolvidas via CSS vars injetadas pelo next/font nos apps
        heading: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        accent: ["var(--font-accent)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,42,51,0.04), 0 4px 16px rgba(31,42,51,0.06)",
        "card-hover": "0 2px 4px rgba(31,42,51,0.06), 0 8px 28px rgba(31,42,51,0.10)",
      },
    },
  },
};
