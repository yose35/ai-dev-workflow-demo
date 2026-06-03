// FE 端的 zod schemas — 與 BE password.ts / 各 route 的驗證邏輯對齊
// 真實環境可進一步從 BE 自動產出（zod-from-openapi 之類）
import { z } from "zod";

export const emailField = z
  .string()
  .min(1, "請輸入 Email")
  .email("Email 格式不正確")
  .max(254);

export const passwordField = z
  .string()
  .min(10, "密碼長度至少 10 字")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
    message: "密碼需含字母與數字",
  });

export const RegisterSchema = z.object({
  email: emailField,
  password: passwordField,
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "請輸入密碼"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const TwoFaSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/, "請輸入 6 位數驗證碼"),
});
export type TwoFaInput = z.infer<typeof TwoFaSchema>;
