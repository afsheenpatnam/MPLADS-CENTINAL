/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // "surface" = light neutral backgrounds/text (was "cream")
        surface: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
        },
        // "primary" = the main blue brand scale (was "brown")
        primary: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E3A8A",
          900: "#172554",
        },
        secondary: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          300: "#C4B5FD",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
        },
        accent: {
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
        risk: {
          low: "#10B981",
          medium: "#F59E0B",
          high: "#EA580C",
          critical: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
        "gradient-accent": "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
        "gradient-success": "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
      },
    },
  },
  plugins: [],
};
