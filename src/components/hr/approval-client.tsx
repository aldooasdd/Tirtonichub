"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { REQ_TYPE_LABEL } from "@/lib/request-labels";
import { reviewRequest } from "@/server/actions/requests";

type Row = {
  id: string;
  userName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  swap?: { counterpart: string; approved: boolean } | null;
};

export function ApprovalClient({ requests }: { requests: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function act(id: string, decision: "APPROVED" | "REJECTED") {
    const note = notes[id] ?? "";
    if (decision === "REJECTED" && !note.trim()) {
      alert("Penolakan wajib ada catatan.");
      return;
    }
    start(async () => {
      const r = await reviewRequest(id, decision, note);
      if (!r.ok) alert(r.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">Pengajuan Masuk</h1>
      <div className="flex flex-col gap-3">
        {requests.length === 0 && (
          <p className="rounded-lg border bg-card py-10 text-center text-muted-foreground">
            Tidak ada pengajuan menunggu.
          </p>
        )}
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{r.userName}</p>
                <p className="text-14 text-muted-foreground">
                  {r.startDate}
                  {r.endDate !== r.startDate ? ` → ${r.endDate}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{REQ_TYPE_LABEL[r.type]}</Badge>
            </div>
            <p className="mt-2 text-14">{r.reason}</p>
            {r.swap && (
              <p className="mt-1 text-13 text-muted-foreground">
                Pengganti: {r.swap.counterpart} ·{" "}
                {r.swap.approved ? "pengganti setuju" : "menunggu persetujuan pengganti"}
              </p>
            )}
            <Input
              className="mt-3"
              placeholder="Catatan (wajib bila tolak)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                disabled={pending || (!!r.swap && !r.swap.approved)}
                onClick={() => act(r.id, "APPROVED")}
              >
                Setujui
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => act(r.id, "REJECTED")}
              >
                Tolak
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
