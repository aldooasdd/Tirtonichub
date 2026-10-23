import { redirect } from "next/navigation";
import { getSession, setActiveRole } from "@/server/auth/session";
import { RoleChooser } from "@/components/auth/role-chooser";

export default async function PilihRolePage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.activeRole) redirect("/beranda");
  if (s.roles.length <= 1) {
    if (s.roles[0]) {
      await setActiveRole(s.sessionId, s.roles[0]);
      redirect("/beranda");
    }
    redirect("/login");
  }
  return <RoleChooser roles={s.roles} />;
}
