"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { RoleCode } from "@/lib/roles";

type ActiveRoleCtx = {
  role: RoleCode;
  roles: RoleCode[];
  setRole: (r: RoleCode) => void;
};

const Ctx = createContext<ActiveRoleCtx | null>(null);

// ponytail: mock sampai auth Fase 1. Role aktif asli nanti dari Session.activeRoleCode.
export function ActiveRoleProvider({
  children,
  initialRole = "HR",
  roles = ["HR", "SALES"],
}: {
  children: React.ReactNode;
  initialRole?: RoleCode;
  roles?: RoleCode[];
}) {
  const [role, setRole] = useState<RoleCode>(initialRole);
  const value = useMemo(() => ({ role, roles, setRole }), [role, roles]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveRole() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useActiveRole di luar ActiveRoleProvider");
  return v;
}
