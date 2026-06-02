"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-primary-900 tracking-tight">
            AI Dev Workflow
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/settings/2fa/enroll" className="text-slate-600 hover:text-primary-900">
              2FA
            </Link>
            <Link
              href="/settings/payment-methods"
              className="text-slate-600 hover:text-primary-900"
            >
              付款方式
            </Link>
            {user ? (
              <>
                <span className="text-slate-500" data-testid="user-email">
                  {user.email}
                </span>
                <button
                  onClick={clear}
                  className="text-slate-600 hover:text-accent font-semibold"
                >
                  登出
                </button>
              </>
            ) : (
              <Link href="/login" className="text-primary-900 font-semibold">
                登入
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
