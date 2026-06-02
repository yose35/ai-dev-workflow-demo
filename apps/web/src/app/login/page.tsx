"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoginSchema, type LoginInput } from "@/lib/validators";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import type { AuthSuccess } from "@/lib/api-types";

// AC-L1, AC-L2, AC-2FA-2（202 challenge）
export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);
    try {
      const res = await apiFetch<AuthSuccess>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSession(res.data.access_token, res.data.user);
      router.push("/");
    } catch (e) {
      const err = e as ApiError & { challenge_id?: string };
      // 202 路徑：fetch 仍視 res.ok 為 false（202 不是 2xx 中間）→ 走 catch
      // 但實際上 202 是 2xx，會走 then；msw 與 BE 都讓 body.ok=false 觸發 catch
      // 取得 body 的 error 中是否有 challenge_id 判斷
      const challenge_id = (err as { challenge_id?: string }).challenge_id;
      if (err.code === "TWO_FA_REQUIRED") {
        const raw = (await safeBodyFromError()) as { error?: { challenge_id?: string } } | null;
        const cid = challenge_id ?? raw?.error?.challenge_id;
        if (cid) {
          sessionStorage.setItem("2fa_challenge", cid);
          router.push("/login/2fa");
          return;
        }
      }
      setServerError(messageFor(err.code) ?? err.message);
    }
  };

  return (
    <AuthLayout
      title="登入"
      subtitle="輸入 Email 與密碼以繼續"
      footer={
        <>
          還沒有帳號？{" "}
          <Link className="text-primary-900 font-semibold hover:underline" href="/register">
            註冊
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input
          label="密碼"
          type="password"
          autoComplete="current-password"
          {...register("password")}
          error={errors.password?.message}
        />
        {serverError && (
          <p className="text-sm text-red-600" role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          登入
        </Button>
      </form>
    </AuthLayout>
  );
}

async function safeBodyFromError(): Promise<unknown> {
  // 預留：實際從 fetch 拿 body 已在 apiFetch 處理，這裡是 noop fallback
  return null;
}

function messageFor(code?: string): string | null {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "帳號或密碼錯誤";
    case "RATE_LIMITED":
      return "嘗試次數過多，請 15 分鐘後再試";
    default:
      return null;
  }
}
