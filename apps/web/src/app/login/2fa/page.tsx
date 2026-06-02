"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TwoFaSchema, type TwoFaInput } from "@/lib/validators";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import type { AuthSuccess } from "@/lib/api-types";

// AC-2FA-2 login flow
export default function TwoFaPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [challenge_id, setChallenge] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TwoFaInput>({ resolver: zodResolver(TwoFaSchema) });

  useEffect(() => {
    const cid = sessionStorage.getItem("2fa_challenge");
    if (!cid) {
      router.replace("/login");
      return;
    }
    setChallenge(cid);
  }, [router]);

  const onSubmit = async (values: TwoFaInput) => {
    if (!challenge_id) return;
    setServerError(null);
    try {
      const res = await apiFetch<AuthSuccess>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: values.code, challenge_id }),
      });
      sessionStorage.removeItem("2fa_challenge");
      setSession(res.data.access_token, res.data.user);
      router.push("/");
    } catch (e) {
      const err = e as ApiError;
      setServerError(
        err.code === "INVALID_2FA_CODE" ? "驗證碼錯誤或已過期" : err.message
      );
    }
  };

  return (
    <AuthLayout title="兩階段驗證" subtitle="請輸入您 Authenticator app 上的 6 位數驗證碼">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="6 位數驗證碼"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          {...register("code")}
          error={errors.code?.message}
        />
        {serverError && (
          <p className="text-sm text-red-600" role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          驗證
        </Button>
      </form>
    </AuthLayout>
  );
}
