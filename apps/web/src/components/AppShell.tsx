"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, clear } = useAuth();
  const pathname = usePathname();
  // 登入 / 註冊 / 2FA 頁面不顯示 nav 中央的功能連結（雜訊太多）
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-primary-900 tracking-tight">
            AI Dev Workflow
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {user && !isAuthPage && (
              <>
                <NavLink href="/settings/2fa/enroll" current={pathname}>
                  2FA
                </NavLink>
                <NavLink href="/settings/payment-methods" current={pathname}>
                  付款方式
                </NavLink>
              </>
            )}
            {user ? (
              <>
                <span className="text-slate-500 hidden sm:inline" data-testid="user-email">
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
              <>
                <Link href="/login" className="text-slate-600 hover:text-primary-900">
                  登入
                </Link>
                <Link
                  href="/register"
                  className="bg-primary-900 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-primary-500"
                >
                  註冊
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: string | null;
  children: React.ReactNode;
}) {
  const active = current?.startsWith(href.split("?")[0]!);
  return (
    <Link
      href={href}
      className={
        active
          ? "text-primary-900 font-semibold"
          : "text-slate-600 hover:text-primary-900"
      }
    >
      {children}
    </Link>
  );
}
