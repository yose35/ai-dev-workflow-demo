// 確保 tsc 看到 vitest + jest-dom matchers (toBeInTheDocument / toHaveTextContent ...)
// 沒這檔的話 tsconfig include 只看 src/，會錯過 vitest.setup.ts 的型別擴充
import "@testing-library/jest-dom/vitest";
