/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Penn blue is the brand anchor; the engine surfaces statuses in green/yellow/red.
        penn: {
          DEFAULT: "#011F5B",
          50: "#E8ECF5",
          100: "#C5CFE3",
          200: "#9DAFCC",
          300: "#7590B5",
          400: "#4D70A0",
          500: "#01337A", // hover / active
          600: "#011F5B", // brand
          700: "#011645",
          800: "#000D2E",
          900: "#000516",
        },
        // Status colors (Healthcare-soft + Fintech-precise)
        success: { DEFAULT: "#15803D", soft: "#DCFCE7" },
        warning: { DEFAULT: "#B45309", soft: "#FEF3C7" },
        danger:  { DEFAULT: "#B91C1C", soft: "#FEE2E2" },
        // Soft surface palette
        canvas:  "#F7F8FB",   // page background
        surface: "#FFFFFF",   // card background
        muted:   "#64748B",   // secondary text
        border:  "#E2E8F0",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        // Numerics get a tabular monospace stack — fintech precision
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 4px 12px 0 rgba(15, 23, 42, 0.08)",
        panel:
          "0 4px 24px -4px rgba(15, 23, 42, 0.07), 0 2px 8px -2px rgba(15, 23, 42, 0.04)",
        lift: "0 20px 50px -20px rgba(1, 31, 91, 0.12)",
      },
      backgroundImage: {
        "dashboard-hero":
          "linear-gradient(135deg, #ffffff 0%, #f1f5f9 45%, #e8ecf5 100%)",
        "subtle-radial":
          "radial-gradient(1200px 600px at 10% -10%, rgba(1, 31, 91, 0.06), transparent 55%)",
      },
    },
  },
  plugins: [],
};
