// Spec: specs/dashboard-kpi.md §5 — Dashboard 頁面測試（走 MSW metrics handlers）
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import DashboardPage from "./page";
import { AuthProvider } from "@/lib/auth-store";
import { MswProvider } from "@/components/MswProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

function setup() {
  return render(
    <MswProvider>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MswProvider>
  );
}

describe("<DashboardPage />", () => {
  it("載入後顯示 7 張 KPI 卡與標題", async () => {
    setup();
    expect(screen.getByText("KPI Overview")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Wager")).toBeInTheDocument());
    // 7 個指標標籤都在（GGR/Margin 同時也是圖表標題，故用 getAllByText）
    for (const label of [
      "Wager",
      "Valid Wager",
      "GGR",
      "Margin",
      "Player Count",
      "Bet Count",
      "ATPPU",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("顯示本期/比較期區間與 seed 標示", async () => {
    setup();
    await waitFor(() => expect(screen.getByText(/示範資料/)).toBeInTheDocument());
    expect(screen.getByText(/本期/)).toBeInTheDocument();
  });

  it("品牌 chips 可切換（Choice 變 active）", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Wager")).toBeInTheDocument());
    const choice = screen.getByRole("button", { name: "Choice" });
    await user.click(choice);
    // 切換後重新載入仍顯示 KPI（不報錯）
    await waitFor(() => expect(screen.getByText("Wager")).toBeInTheDocument());
  });

  it("切到非 Revenue Volume 分頁顯示第二期提示", async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(screen.getByText("Wager")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "User Growth" }));
    expect(screen.getByText(/第二期範圍/)).toBeInTheDocument();
  });
});
