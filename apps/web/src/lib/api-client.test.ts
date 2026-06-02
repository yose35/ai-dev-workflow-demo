import { describe, it, expect } from "vitest";
import { apiFetch } from "./api-client";

describe("apiFetch (with msw)", () => {
  it("GET /health → mock 健康訊息", async () => {
    const res = await apiFetch<{ ok: boolean; data: { status: string; mock: boolean } }>("/health");
    expect(res.ok).toBe(true);
    expect(res.data.status).toBe("healthy");
    expect(res.data.mock).toBe(true);
  });

  it("POST /auth/register 弱密碼 → 拋 WEAK_PASSWORD", async () => {
    await expect(
      apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "short" }),
      })
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD", status: 400 });
  });

  it("POST /auth/register happy → 201 + access_token", async () => {
    const res = await apiFetch<{ ok: true; data: { access_token: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "alice-fe@example.com", password: "Password123" }),
    });
    expect(res.data.access_token).toMatch(/^eyJ/);
  });
});
