import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 對齊簡報配色（Midnight Executive）
        primary: { DEFAULT: "#1E2761", 50: "#CADCFC", 500: "#1E2761", 900: "#162047" },
        accent:  { DEFAULT: "#F96167" },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Noto Sans TC", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
