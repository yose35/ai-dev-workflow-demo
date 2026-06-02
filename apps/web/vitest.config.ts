import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig 用 jsx:"preserve" 給 Next.js，vitest 這邊要自己指定 JSX runtime
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
