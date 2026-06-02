import "./globals.css";
import type { Metadata } from "next";
import { MswProvider } from "@/components/MswProvider";
import { AuthProvider } from "@/lib/auth-store";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "AI Dev Workflow Demo",
  description: "登入 + 付款方式綁定，由 OpenAPI 契約驅動的 FE / BE 平行開發。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <MswProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </MswProvider>
      </body>
    </html>
  );
}
