"use client";

import { useTransition } from "react";
import type { RoleCode } from "@/generated/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selectRoleAction } from "@/server/actions/auth";

export function RoleChooser({ roles }: { roles: RoleCode[] }) {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilih role</CardTitle>
        <CardDescription>Kamu punya beberapa role. Pilih yang ingin dipakai.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {roles.map((r) => (
          <Button
            key={r}
            variant="secondary"
            className="justify-start"
            disabled={pending}
            onClick={() => start(() => selectRoleAction(r).then(() => {}))}
          >
            {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
