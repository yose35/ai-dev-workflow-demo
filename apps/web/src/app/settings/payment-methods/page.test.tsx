import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import PaymentMethodsPage from "./page";
import { AuthProvider } from "@/lib/auth-store";
import { MswProvider } from "@/components/MswProvider";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function setup() {
  return render(
    <MswProvider>
      <AuthProvider>
        <PaymentMethodsPage />
      </AuthProvider>
    </MswProvider>
  );
}

describe("<PaymentMethodsPage />", () => {
  beforeEach(() => {
    // seed 一張示範卡（test 端 server）
    const card = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2029,
      is_default: true,
    };
    server.use(
      http.get("/payments/methods", () => HttpResponse.json({ ok: true, data: [card] })),
      http.delete("/payments/methods/:id", () => new HttpResponse(null, { status: 204 }))
    );
  });

  afterEach(() => server.resetHandlers());

  it("AC-PAY-3：載入後顯示卡片 brand + last4", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/4242/)).toBeInTheDocument());
    expect(screen.getByText(/visa/i)).toBeInTheDocument();
  });

  it("AC-PAY-5：刪除唯一卡片時，提示更明確的警語", async () => {
    setup();
    await waitFor(() => screen.getByText(/4242/));
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "刪除卡片 4242" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/唯一的付款方式/)).toBeInTheDocument();
  });

  it("AC-PAY-4：確認刪除 → 卡片從列表消失", async () => {
    setup();
    await waitFor(() => screen.getByText(/4242/));
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "刪除卡片 4242" }));
    await u.click(screen.getByRole("button", { name: "確認刪除" }));
    await waitFor(() => expect(screen.queryByText(/4242/)).not.toBeInTheDocument());
  });
});
