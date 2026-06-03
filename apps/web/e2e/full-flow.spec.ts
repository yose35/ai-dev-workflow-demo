// 完整使用者旅程 E2E — 真實瀏覽器 + msw 攔截
// 對應 BE integration full-flow.test.ts，這是 FE 的對等驗證
import { test, expect } from "@playwright/test";

test.describe("End-to-end user journey", () => {
  test("register → 看到首頁 → 訪問設定頁 → 看到付款方式", async ({ page }) => {
    // ── (1) 首頁 ────────────────────────────────────────
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "FE 已就緒 ✓" })).toBeVisible();
    // 等 msw 起來
    await expect(page.getByText(/資料來源：MSW mock/)).toBeVisible({ timeout: 10_000 });

    // ── (2) 註冊 ───────────────────────────────────────
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "建立帳號" })).toBeVisible();

    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("密碼").fill("Password123");
    await page.getByRole("button", { name: "建立帳號" }).click();

    // 註冊成功會 router.push("/")
    await expect(page).toHaveURL("/");

    // ── (3) 直接到付款方式設定頁 ─────────────────────────
    await page.goto("/settings/payment-methods");
    await expect(page.getByRole("heading", { name: "付款方式" })).toBeVisible();
    // msw 預先 seed 一張 visa 4242
    await expect(page.getByText("•••• 4242")).toBeVisible();
    await expect(page.getByText("visa", { exact: false })).toBeVisible();

    // ── (4) 刪除卡片 — 跳 dialog ─────────────────────────
    await page.getByRole("button", { name: "刪除卡片 4242" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/唯一的付款方式/)).toBeVisible();

    // ── (5) 確認刪除 → 卡片消失 ──────────────────────────
    await page.getByRole("button", { name: "確認刪除" }).click();
    await expect(page.getByText("•••• 4242")).not.toBeVisible();
    await expect(page.getByText(/尚未綁定任何卡片/)).toBeVisible();
  });

  test("2FA enroll 三階段流程", async ({ page }) => {
    await page.goto("/settings/2fa/enroll");
    await expect(page.getByRole("heading", { name: "兩階段驗證" })).toBeVisible();

    // Stage 1: idle
    await page.getByRole("button", { name: "開始啟用 2FA" }).click();

    // Stage 2: enrolled — 顯示 QR + secret
    await expect(page.getByAltText("2FA QR code")).toBeVisible();
    await expect(page.getByText(/MOCKSECRETBASE32/)).toBeVisible();

    // 輸入合法 code → confirmed
    await page.getByLabel("驗證碼").fill("123456");
    await page.getByRole("button", { name: "確認啟用" }).click();

    // Stage 3: confirmed
    await expect(page.getByText("✓ 2FA 已成功啟用")).toBeVisible();
  });

  test("FE 端 zod 驗證：弱密碼擋下，不送 request", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email").fill("zod@example.com");
    await page.getByLabel("密碼").fill("short");
    await page.getByRole("button", { name: "建立帳號" }).click();
    await expect(page.getByText("密碼長度至少 10 字")).toBeVisible();
    // 沒跳到首頁
    await expect(page).toHaveURL(/\/register/);
  });
});
