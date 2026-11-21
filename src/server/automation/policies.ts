// Aturan bisnis otomasi. Bawaan SEMUA "needs_configuration": tidak ada PIC, jadwal pengingat, penerima, atau metrik
// yang ditebak. Admin penuh mengaktifkan lewat halaman Otomasi › Konfigurasi (tersimpan di AutomationPolicy, teraudit).

export type PolicyStatus = "needs_configuration" | "active" | "disabled";
export type Policy = { key: PolicyKey; status: PolicyStatus; config: Record<string, unknown>; version: number };

export const POLICIES = {
  "assignment.mapping": {
    l: "Pemetaan PIC per jenis konten",
    d: "Sumber PIC saat kartu belum punya PIC: jobdesk FlowSpace yang sudah diatur admin (settings jobdesk, bawaan DEFAULT_JOB). Hanya mengisi PIC yang kosong.",
  },
  "notify.channel": { l: "Saluran notifikasi otomasi", d: "Notifikasi aplikasi (lonceng + push) saja, atau ditambah WhatsApp." },
  "reminder.schedule": { l: "Jadwal pengingat Deadline Ready", d: "Jam batas Deadline Ready (WIB), berapa jam sebelumnya pengingat dikirim (maks. 3 kali), dan ke siapa." },
  "performance.checkpoints": { l: "Pengingat evaluasi performa", d: "Checkpoint setelah tayang untuk mencatat metrik (D+1 / D+7 / D+30 sesuai Panduan CPR) dan penerimanya." },
  "campaign.master": { l: "Campaign master", d: "Belum ada data campaign resmi (hanya Campaign ID di kartu). Workflow campaign tidak bisa aktif sampai ada definisinya." },
} as const;
export type PolicyKey = keyof typeof POLICIES;
export const isPolicyKey = (v: unknown): v is PolicyKey => typeof v === "string" && v in POLICIES;
/** Tidak bisa diaktifkan dari aplikasi (butuh keputusan/definisi bisnis baru). */
export const BLOCKED_POLICIES: PolicyKey[] = ["campaign.master"];

const RECIP = ["pic", "reviewers", "creator"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const intIn = (v: unknown, a: number, b: number) => typeof v === "number" && Number.isInteger(v) && v >= a && v <= b;

/** null = konfigurasi sah untuk diaktifkan. */
export function policyConfigWhy(key: PolicyKey, c: Record<string, unknown>): string | null {
  switch (key) {
    case "assignment.mapping":
      return c.source === "jobdesk" ? null : "pilih sumber PIC: jobdesk FlowSpace";
    case "notify.channel":
      return c.channel === "app" || c.channel === "app_wa" ? null : "pilih saluran notifikasi";
    case "reminder.schedule": {
      const o = c.offsetsHours;
      if (!Array.isArray(o) || o.length < 1 || o.length > 3 || !o.every((x) => intIn(x, 1, 168)) || new Set(o).size !== o.length) return "isi 1–3 jarak jam (1–168) yang berbeda";
      if (!HHMM.test(String(c.deadlineTime ?? ""))) return "isi jam batas Deadline Ready (HH:MM, WIB)";
      return c.recipients === "pic" ? null : "pilih penerima pengingat";
    }
    case "performance.checkpoints": {
      const d = c.days;
      if (!Array.isArray(d) || d.length < 1 || !d.every((x) => [1, 7, 30].includes(Number(x))) || new Set(d).size !== d.length) return "pilih checkpoint D+1 / D+7 / D+30";
      if (!HHMM.test(String(c.sendTime ?? ""))) return "isi jam kirim pengingat (HH:MM, WIB)";
      return RECIP.includes(String(c.recipients)) ? null : "pilih penerima";
    }
    case "campaign.master":
      return "campaign master belum didefinisikan";
  }
}
export const defaultPolicy = (key: PolicyKey): Policy => ({ key, status: "needs_configuration", config: {}, version: 0 });
export const policyReady = (p: Policy | undefined) => !!p && p.status === "active" && !policyConfigWhy(p.key, p.config);
