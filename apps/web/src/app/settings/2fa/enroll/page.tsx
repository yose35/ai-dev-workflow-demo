"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TwoFaSchema, type TwoFaInput } from "@/lib/validators";
import { apiFetch, type ApiError } from "@/lib/api-client";
import type { Enroll2faResponse } from "@/lib/api-types";

// AC-2FA-1：authenticated 使用者啟用 2FA
type Stage = "idle" | "enrolled" | "confirmed";

export default function TwoFaEnrollPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [enroll, setEnroll] = useState<{ secret: string; qr_data: string } | null>(null);
  const [enrollErr, setEnrollErr] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TwoFaInput>({ resolver: zodResolver(TwoFaSchema) });

  const startEnroll = async () => {
    setBusy(true);
    setEnrollErr(null);
    try {
      const res = await apiFetch<Enroll2faResponse>("/auth/2fa/enroll", { method: "POST" });
      setEnroll(res.data);
      setStage("enrolled");
    } catch (e) {
      setEnrollErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (values: TwoFaInput) => {
    setVerifyErr(null);
    try {
      await apiFetch("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: values.code }),
      });
      setStage("confirmed");
    } catch (e) {
      setVerifyErr(
        (e as ApiError).code === "INVALID_2FA_CODE"
          ? "驗證碼錯誤，請重試"
          : (e as ApiError).message
      );
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-primary-900">兩階段驗證</h1>
        <p className="mt-1 text-sm text-slate-600">
          使用 Authenticator app（Google Authenticator、1Password、Authy 等）保護你的帳號。
        </p>
      </header>

      {stage === "idle" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <p className="text-slate-700">
            點下方按鈕產生一組 TOTP secret，並用 Authenticator app 掃描 QR code。
          </p>
          {enrollErr && (
            <p className="text-sm text-red-600" role="alert">
              {enrollErr}
            </p>
          )}
          <Button onClick={startEnroll} loading={busy}>
            開始啟用 2FA
          </Button>
        </section>
      )}

      {stage === "enrolled" && enroll && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <p className="font-semibold text-primary-900 mb-2">步驟 1：掃描 QR code</p>
            <div className="inline-block rounded-lg border border-slate-200 p-3 bg-white">
              <img src={enroll.qr_data} alt="2FA QR code" className="w-44 h-44" />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              無法掃描？手動輸入 secret：
              <code className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 font-mono">
                {enroll.secret}
              </code>
            </p>
          </div>
          <form onSubmit={handleSubmit(onVerify)} className="space-y-3">
            <p className="font-semibold text-primary-900">步驟 2：輸入 app 上的 6 位數驗證碼</p>
            <Input
              label="驗證碼"
              type="text"
              inputMode="numeric"
              maxLength={6}
              {...register("code")}
              error={errors.code?.message}
            />
            {verifyErr && (
              <p className="text-sm text-red-600" role="alert">
                {verifyErr}
              </p>
            )}
            <Button type="submit" loading={isSubmitting}>
              確認啟用
            </Button>
          </form>
        </section>
      )}

      {stage === "confirmed" && (
        <section className="rounded-2xl border border-green-300 bg-green-50 p-6">
          <p className="font-bold text-green-700">✓ 2FA 已成功啟用</p>
          <p className="mt-1 text-sm text-green-700">
            下次登入時需要輸入 Authenticator app 上的驗證碼。
          </p>
        </section>
      )}
    </div>
  );
}
