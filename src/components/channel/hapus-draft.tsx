"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { hapusDraft } from "@/server/actions/draft-produk";

export function HapusDraft({ id }: { id: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => confirm("Hapus draft ini? Tag RFID yang sudah dipasang tetap tersimpan.") && start(async () => { await hapusDraft(id); router.push("/channel/produk/draft"); })}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-14 text-destructive hover:bg-muted disabled:opacity-50"
    >
      <Trash2 className="size-4" /> Hapus draft
    </button>
  );
}
