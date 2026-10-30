import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function LupaPasswordPage() {
  const s = await getSession();
  if (s) redirect(s.activeRole ? "/beranda" : "/login");
  return <ForgotPasswordForm />;
}
