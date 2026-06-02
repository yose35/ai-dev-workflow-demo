import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import LoginPage from "./page";
import { AuthProvider } from "@/lib/auth-store";

// next/navigation router mock
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push }),
}));

function setup() {
  push.mockReset();
  sessionStorage.clear();
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}

describe("<LoginPage />", () => {
  beforeEach(() => setup());

  it("AC-L1 happy path：正確帳密 → router.push('/')", async () => {
    // mock 中需要先 register 才有人
    await fetch("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fe-test@example.com", password: "Password123" }),
    });

    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "fe-test@example.com");
    await u.type(screen.getByLabelText("密碼"), "Password123");
    await u.click(screen.getByRole("button", { name: "登入" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("AC-L2 錯誤密碼 → 顯示「帳號或密碼錯誤」", async () => {
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "nope@example.com");
    await u.type(screen.getByLabelText("密碼"), "wrong-password-xx");
    await u.click(screen.getByRole("button", { name: "登入" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("帳號或密碼錯誤");
  });

  it("FE 端 zod 驗證：空 email → 不送 request", async () => {
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "登入" }));
    expect(await screen.findByText("請輸入 Email")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
