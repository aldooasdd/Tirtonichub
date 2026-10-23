"use client";

import { createContext, useContext, useMemo, useTransition } from "react";
import type { RoleCode } from "@/generated/prisma";
import { selectRoleAction } from "@/server/actions/auth";

export type SessionUser = { fullName: string; email: string };

type Ctx = {
  user: SessionUser;
  role: RoleCode;
  roles: RoleCode[];
  setRole: (r: RoleCode) => void;
  switching: boolean;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({
  children,
  user,
  role,
  roles,
}: {
  children: React.ReactNode;
  user: SessionUser;
  role: RoleCode;
  roles: RoleCode[];
}) {
  const [switching, start] = useTransition();
  const value = useMemo<Ctx>(
    () => ({
      user,
      role,
      roles,
      switching,
      setRole: (r) => start(() => selectRoleAction(r).then(() => {})),
    }),
    [user, role, roles, switching],
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

function useSession() {
  const v = useContext(SessionCtx);
  if (!v) throw new Error("useSession di luar SessionProvider");
  return v;
}

export function useActiveRole() {
  const { role, roles, setRole } = useSession();
  return { role, roles, setRole };
}

export function useSessionUser() {
  return useSession().user;
}
