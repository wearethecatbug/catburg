import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        urgency: {
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
          overdue: "#dc2626",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

