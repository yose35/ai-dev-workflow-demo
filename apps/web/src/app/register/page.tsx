"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RegisterSchema, type RegisterInput } from "@/lib/validators";
import { apiFetch, type ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";
import type { AuthSuccess } from "@/lib/api-types";

// AC-R1..R4
export default function RegisterPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    mode: "onChange",
  });

  const onSubmit = async (values: RegisterInput) => {
    setServerError(null);
    try {
      const res = await apiFetch<AuthSuccess>("/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSession(res.data.access_token, res.data.user);
      router.push("/");
    } catch (e) {
      const err = e as ApiError;
      setServerError(messageFor(err.code) ?? err.message);
    }
  };

  const pw = watch("password") ?? "";
  const strength = passwordStrength(pw);

  return (
    <AuthLayout
      title="建立帳號"
      subtitle="開始使用 AI Dev Workflow Demo"
      footer={
        <>
          已有帳號？{" "}
          <Link className="text-primary-900 font-semibold hover:underline" href="/login">
            登入
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
        <div>
          <Input
            label="密碼"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
            hint="至少 10 字、含字母與數字"
          />
          {pw && !errors.password && (
            <div className="mt-2 flex gap-1" aria-label="密碼強度">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={
                    "h-1 flex-1 rounded " +
                    (i < strength
                      ? strength >= 3
                        ? "bg-green-500"
                        : strength === 2
                        ? "bg-yellow-500"
                        : "bg-red-400"
                      : "bg-slate-200")
                  }
                />
              ))}
            </div>
          )}
        </div>
        {serverError && (
          <p className="text-sm text-red-600" role="alert">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          建立帳號
        </Button>
      </form>
    </AuthLayout>
  );
}

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function messageFor(code?: string): string | null {
  switch (code) {
    case "USER_EXISTS":
      return "此 Email 已被註冊，請改用登入";
    case "WEAK_PASSWORD":
      return "密碼太弱：至少 10 字、含字母與數字";
    case "INVALID_EMAIL":
      return "Email 格式不正確";
    default:
      return null;
  }
}
