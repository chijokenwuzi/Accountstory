import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#071021",
        panel: "#0d1b33",
        accent: "#9ab7ff"
      }
    }
  },
  plugins: []
} satisfies Config;
