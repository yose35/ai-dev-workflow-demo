import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import TwoFaEnrollPage from "./page";
import { AuthProvider } from "@/lib/auth-store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function setup() {
  return render(
    <AuthProvider>
      <TwoFaEnrollPage />
    </AuthProvider>
  );
}

describe("<TwoFaEnrollPage />", () => {
  beforeEach(() => {
    setup();
  });

  it("AC-2FA-1：點啟用 → 顯示 QR + secret", async () => {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "開始啟用 2FA" }));
    await waitFor(() => {
      expect(screen.getByAltText("2FA QR code")).toBeInTheDocument();
    });
    // mock 回的 secret
    expect(screen.getByText(/MOCKSECRETBASE32/i)).toBeInTheDocument();
  });

  it("輸入錯誤 code（000000）→ 顯示「驗證碼錯誤」", async () => {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "開始啟用 2FA" }));
    await waitFor(() => screen.getByAltText("2FA QR code"));
    await u.type(screen.getByLabelText("驗證碼"), "000000");
    await u.click(screen.getByRole("button", { name: "確認啟用" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/驗證碼錯誤/);
  });

  it("輸入合法 code → 顯示「2FA 已成功啟用」", async () => {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "開始啟用 2FA" }));
    await waitFor(() => screen.getByAltText("2FA QR code"));
    await u.type(screen.getByLabelText("驗證碼"), "123456");
    await u.click(screen.getByRole("button", { name: "確認啟用" }));
    expect(await screen.findByText("✓ 2FA 已成功啟用")).toBeInTheDocument();
  });
});
