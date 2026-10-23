import { ActiveRoleProvider } from "@/components/layout/active-role-context";
import { AppShell } from "@/components/layout/app-shell";

export default function DashLayout({ children }: LayoutProps<"/">) {
  // ponytail: role aktif di-mock sampai auth Fase 1.
  return (
    <ActiveRoleProvider>
      <AppShell>{children}</AppShell>
    </ActiveRoleProvider>
  );
}
