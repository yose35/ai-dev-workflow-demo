import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import RegisterPage from "./page";
import { AuthProvider } from "@/lib/auth-store";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: push }),
}));

function setup() {
  push.mockReset();
  return render(
    <AuthProvider>
      <RegisterPage />
    </AuthProvider>
  );
}

describe("<RegisterPage />", () => {
  beforeEach(() => {
    setup();
  });

  it("AC-R1 happy：合格資料 → 201 後 router.push('/')", async () => {
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "new-fe@example.com");
    await u.type(screen.getByLabelText("密碼"), "Password123");
    await u.click(screen.getByRole("button", { name: "建立帳號" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("AC-R3 FE 端：太短密碼 → 顯示錯誤、不送 request", async () => {
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "a@b.com");
    await u.type(screen.getByLabelText("密碼"), "Short1");
    await u.click(screen.getByRole("button", { name: "建立帳號" }));
    expect(await screen.findByText("密碼長度至少 10 字")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("AC-R2 BE 端 USER_EXISTS → 顯示對應訊息", async () => {
    // 先註冊一次
    await fetch("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "dup-fe@example.com", password: "Password123" }),
    });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "dup-fe@example.com");
    await u.type(screen.getByLabelText("密碼"), "Password123");
    await u.click(screen.getByRole("button", { name: "建立帳號" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("已被註冊");
  });
});
