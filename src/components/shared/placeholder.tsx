import { Inbox } from "lucide-react";

// Empty state generik (PRD §12: tiap list punya empty state).
export function Placeholder({
  title,
  description = "Modul ini disiapkan di fase berikutnya.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-24 font-semibold">{title}</h1>
      <div className="flex flex-col items-center justify-center rounded-lg bg-card py-16 text-center">
        <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-14 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
