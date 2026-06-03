# FE PLAN.md — 前端進行中工作

> 對應 root `PLAN.md` 的 FE 部分。與 BE 並行。**FE 不等 BE merge**，靠 OpenAPI mock 起跑。

---

## 當前狀態

- ✅ BE 端到端已完成（56 tests，5 PR merged）
- ✅ OpenAPI 契約已穩定（`packages/contract/openapi.yaml`，12 端點）
- 🟢 FE 起跑點：scaffold + 型別 + mock 三件套

---

## 技術棧

| 層 | 選型 | 理由 |
|---|---|---|
| Framework | **Next.js 15 App Router** | SSR + RSC、生態完整、招募容易 |
| Language | TypeScript strict | 與 BE 一致、共用 OpenAPI 產出的型別 |
| Styling | Tailwind CSS 4 | utility-first，避免 CSS 結構債 |
| UI Components | shadcn/ui (Radix-based) | 擁有自己的元件碼，可自由客製，無 lock-in |
| State (server) | **TanStack Query v5** | request dedup、cache、retry、Suspense 整合 |
| State (local) | useState / useReducer | YAGNI，沒 zustand / redux |
| Forms | react-hook-form + zod | 與 BE 同份 schema 共用驗證邏輯 |
| API Mock | **msw (Mock Service Worker)** | 攔截瀏覽器與 test 端 fetch，BE 不在時也能跑 |
| Type codegen | `openapi-typescript` CLI | 由 `packages/contract/openapi.yaml` 直接產 TS types |
| Unit test | Vitest + Testing Library | 與 BE 同 runner，CI 整合方便 |
| E2E | Playwright | 真實瀏覽器、可錄影做 demo |

---

## 平行開發策略（FE 不等 BE）

1. **第一週**：FE 用 msw 完全 mock，獨立開發所有頁面
2. **第二週**：BE 第一個 endpoint 上 staging，FE 切換真實 API（環境變數控制）
3. msw 保留為 **test 環境永久 mock**，跑 unit / E2E 不依賴 BE

---

## 下一步（FE Code 階段，依序）

> AI / 工程師接手後依此順序推進，每完成一段就 commit。

1. **建立 `apps/web/` Next.js 骨架**
   - Next.js 15 App Router + TypeScript strict + Tailwind
   - shadcn/ui 初始化（Button / Input / Card / Dialog / Toast）
   - 預期：30 分鐘
2. **OpenAPI → TypeScript 自動產型別**
   - `pnpm contract:gen` 由 `packages/contract/openapi.yaml` 產 `apps/web/src/types/api.ts`
   - 寫 `apiFetch` wrapper，型別安全的 fetch
   - 預期：30 分鐘
3. **msw 設定 + 共用 handlers**
   - `src/mocks/handlers.ts` 覆蓋全部 12 端點
   - dev: `npm run dev` 自動啟動 msw
   - test: 與 vitest 整合
   - 預期：1 小時
4. **註冊 / 登入頁**
   - `/register` + `/login` + 2FA challenge 表單
   - react-hook-form + zod，錯誤訊息對應 BE error codes
   - 預期：2 小時
5. **2FA 啟用頁**
   - `/settings/2fa/enroll` 顯示 QR + 驗證 code 輸入
   - 預期：1 小時
6. **付款方式管理頁**
   - `/settings/payment-methods` 列表 + Stripe Elements 綁卡 + 刪除確認 dialog
   - 預期：2 小時
7. **E2E 測試**
   - Playwright 跑完整流程（與 BE 整合測試對應）
   - 預期：1.5 小時

**PR 切點建議：**
- FE PR #1：步驟 1–3（骨架 + 型別 + mock）
- FE PR #2：步驟 4–5（auth + 2FA 頁面）
- FE PR #3：步驟 6（payments 頁面）
- FE PR #4：步驟 7（E2E 測試）

---

## 已知未決

- ❓ 設計稿來源：目前無 Figma，FE 用 shadcn/ui 預設樣式 → 設計師補稿後再調
- ❓ i18n：本 sprint 不做（spec 未要求）
- ❓ Dark mode：shadcn/ui 內建支援，預設開但不強制

---

## AI 接手清單

1. ✅ 讀本檔的「下一步」
2. ✅ 與 BE 共用同一份 `packages/contract/openapi.yaml`
3. ✅ 任何頁面行為改變 → 同步檢查 `specs/login-and-payment.md` 的 AC
4. ✅ Mock handler 一律用 OpenAPI 規範的 response shape — 別自己造 schema
5. ✅ PR 命名：`feat(web): ...`
