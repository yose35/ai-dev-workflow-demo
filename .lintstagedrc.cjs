// 用 function 形式 → lint-staged 不會把檔名附在後面
// 避免 tsc -p ... 跟檔名衝突的 TS5042 錯誤
module.exports = {
  "apps/api/**/*.{ts,tsx}": () => "pnpm --filter @app/api check",
  "apps/web/**/*.{ts,tsx}": () => "pnpm --filter @app/web check",
};
