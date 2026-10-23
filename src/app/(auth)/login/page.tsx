import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(s.activeRole ? "/beranda" : "/pilih-role");
  return <LoginForm />;
}
