"use client";
// /settings/* 共用版面：置中容器 + 響應式側邊導覽
// 解決原本內容貼齊視窗邊緣、無 max-width 的問題
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/settings/payment-methods",
    label: "付款方式",
    desc: "信用卡綁定",
    icon: "💳",
    match: "/settings/payment-methods",
  },
  {
    href: "/settings/2fa/enroll",
    label: "兩階段驗證",
    desc: "TOTP 2FA",
    icon: "🔐",
    match: "/settings/2fa",
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-widest text-accent uppercase mb-6">設定</p>

      <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-8">
        {/* ── 側邊導覽 ─────────────────────────────── */}
        <aside className="md:sticky md:top-20 self-start">
          <nav className="flex md:flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors " +
                    (active
                      ? "bg-primary-50 border-primary-100"
                      : "border-transparent hover:bg-slate-50")
                  }
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="min-w-0">
                    <span
                      className={
                        "block text-sm " +
                        (active
                          ? "font-semibold text-primary-900"
                          : "font-medium text-slate-700")
                      }
                    >
                      {item.label}
                    </span>
                    <span className="block text-xs text-slate-400">{item.desc}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── 內容區 ───────────────────────────────── */}
        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
