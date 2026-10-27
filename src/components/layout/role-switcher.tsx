"use client";

import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/roles";
import { useActiveRole } from "./active-role-context";

export function RoleSwitcher({ compact }: { compact?: boolean } = {}) {
  const { role, roles, setRole } = useActiveRole();
  if (roles.length <= 1) {
    return (
      <span
        className={
          compact
            ? "shrink-0 rounded bg-secondary px-1.5 py-0.5 text-12 font-medium text-secondary-foreground"
            : "rounded-md bg-secondary px-3 py-1.5 text-14 font-medium text-secondary-foreground"
        }
      >
        {ROLE_LABELS[role]}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className={compact ? "h-6 gap-1 px-1.5 text-12" : "gap-2"}>
          {ROLE_LABELS[role]}
          <ChevronsUpDown className={compact ? "h-3 w-3 opacity-60" : "h-4 w-4 opacity-60"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Ganti role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => (
          <DropdownMenuItem key={r} onClick={() => setRole(r)}>
            <Check
              className={r === role ? "h-4 w-4 opacity-100" : "h-4 w-4 opacity-0"}
            />
            {ROLE_LABELS[r]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
