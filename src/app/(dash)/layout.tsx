import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { SessionProvider } from "@/components/layout/active-role-context";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashLayout({ children }: LayoutProps<"/">) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.activeRole) redirect("/pilih-role");

  return (
    <SessionProvider
      user={{ fullName: s.user.fullName, email: s.user.email }}
      role={s.activeRole}
      roles={s.roles}
    >
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
