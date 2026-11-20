import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { prisma } from "@/server/db";
import { dailyRekap, type DailyRow } from "@/server/attendance/rekap";
import { ABSEN_ON } from "@/lib/flags";

const STATUS_LABEL: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  LATE: "Terlambat",
  ABSENT: "Tidak absen",
  LEAVE: "Cuti",
  SICK: "Sakit",
  PERMIT: "Izin",
  HOLIDAY: "Libur nasional",
  OFF: "Libur (jadwal)",
};
// Kode kalender + warna sel (ARGB).
const CODE: Record<string, [string, string]> = {
  ON_TIME: ["H", "FFC6EFCE"],
  LATE: ["T", "FFFFEB9C"],
  ABSENT: ["A", "FFFFC7CE"],
  PERMIT: ["I", "FFDDEBF7"],
  SICK: ["S", "FFFCE4D6"],
  LEAVE: ["C", "FFE4DFEC"],
  HOLIDAY: ["L", "FFEDEDED"],
  OFF: ["-", "FFF5F5F5"],
};
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
const THIN: Partial<ExcelJS.Borders> = { top: { style: "thin", color: { argb: "FFD0D0D0" } }, bottom: { style: "thin", color: { argb: "FFD0D0D0" } }, left: { style: "thin", color: { argb: "FFD0D0D0" } }, right: { style: "thin", color: { argb: "FFD0D0D0" } } };
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** Jam WIB "HH:MM". */
const hm = (d: Date | null) => (d ? new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16) : "");
const jam = (r: DailyRow) => (r.checkInAt && r.checkOutAt ? Math.round(((r.checkOutAt.getTime() - r.checkInAt.getTime()) / 3_600_000) * 100) / 100 : null);
const todayWIB = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Judul 2 baris di atas tabel + header bergaya di baris 4. */
function sheet(wb: ExcelJS.Workbook, name: string, title: string, sub: string, cols: { header: string; key: string; width: number }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = sub;
  ws.getCell("A2").font = { color: { argb: "FF6B7280" } };
  const h = ws.getRow(4);
  h.values = cols.map((c) => c.header);
  h.height = 30;
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = THIN;
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };
  return ws;
}
const tidy = (ws: ExcelJS.Worksheet, from = 5) => {
  for (let i = from; i <= ws.rowCount; i++) ws.getRow(i).eachCell({ includeEmpty: true }, (c) => { c.border = THIN; c.alignment = { vertical: "middle", ...c.alignment }; });
};

export async function GET(req: NextRequest) {
  if (!ABSEN_ON) return new Response("Fitur absen nonaktif", { status: 404 });
  const s = await getSession();
  if (!s || !s.activeRole || !can.manageEmployees(s.activeRole)) {
    return new Response("Forbidden", { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const view = sp.get("view") === "bulanan" ? "bulanan" : "harian";
  const branchId = sp.get("branch") || undefined;
  const branch = branchId ? (await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }))?.name : null;
  const scope = branch ? `Cabang ${branch}` : "Semua cabang";
  const printed = `Dicetak ${todayWIB()} ${hm(new Date())} WIB`;

  const wb = new ExcelJS.Workbook();
  let filename = "rekap.xlsx";

  if (view === "harian") {
    const date = sp.get("date") ?? todayWIB();
    const { rows } = await dailyRekap(new Date(date + "T00:00:00Z"), branchId);
    const ws = sheet(wb, "Rekap Harian", `Rekap Absen Harian — ${date}`, `${scope} · ${printed}`, [
      { header: "No", key: "no", width: 5 },
      { header: "Nama", key: "name", width: 26 },
      { header: "Cabang", key: "branch", width: 16 },
      { header: "Jadwal", key: "jadwal", width: 14 },
      { header: "Masuk", key: "in", width: 9 },
      { header: "Pulang", key: "out", width: 9 },
      { header: "Jam kerja", key: "jam", width: 10 },
      { header: "Status", key: "status", width: 16 },
      { header: "Telat (menit)", key: "late", width: 10 },
      { header: "Datang awal (menit)", key: "early", width: 11 },
    ]);
    rows.forEach((r, i) => {
      const row = ws.addRow({ no: i + 1, name: r.name, branch: r.branch ?? "-", jadwal: r.jadwal ?? "-", in: hm(r.checkInAt), out: hm(r.checkOutAt), jam: jam(r), status: STATUS_LABEL[r.status], late: r.lateMinutes || null, early: r.earlyMinutes || null });
      row.getCell("status").fill = fill(CODE[r.status]?.[1] ?? "FFFFFFFF");
    });
    tidy(ws);
    filename = `rekap-harian-${date}.xlsx`;
  } else {
    const monthStr = /^\d{4}-\d{2}$/.test(sp.get("m") ?? "") ? sp.get("m")! : todayWIB().slice(0, 7);
    const [y, m] = monthStr.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const today = todayWIB();
    // Hari yang sudah lewat/hari ini saja (hari depan belum ada absen).
    const days = Array.from({ length: last }, (_, i) => `${monthStr}-${String(i + 1).padStart(2, "0")}`).filter((d) => d <= today);
    // ponytail: pakai dailyRekap per hari (≤31 x 3 query) — logika status sama persis dengan rekap harian.
    const perDay = await Promise.all(days.map(async (d) => ({ d, rows: (await dailyRekap(new Date(d + "T00:00:00Z"), branchId)).rows })));
    const title = `${BULAN[m - 1]} ${y}`;

    // Per karyawan.
    const people = new Map<string, { name: string; branch: string; days: Map<string, DailyRow> }>();
    for (const { d, rows } of perDay)
      for (const r of rows) {
        const p = people.get(r.userId) ?? people.set(r.userId, { name: r.name, branch: r.branch ?? "-", days: new Map() }).get(r.userId)!;
        p.days.set(d, r);
      }
    const list = [...people.values()].sort((a, b) => a.branch.localeCompare(b.branch) || a.name.localeCompare(b.name));

    // 1. Ringkasan
    const sum = sheet(wb, "Ringkasan", `Rekap Absen Bulanan — ${title}`, `${scope} · s.d. ${days.at(-1) ?? "-"} · ${printed}`, [
      { header: "No", key: "no", width: 5 },
      { header: "Nama", key: "name", width: 26 },
      { header: "Cabang", key: "branch", width: 16 },
      { header: "Hari kerja (jadwal)", key: "kerja", width: 11 },
      { header: "Hadir", key: "hadir", width: 8 },
      { header: "Tepat waktu", key: "tepat", width: 9 },
      { header: "Telat", key: "telat", width: 8 },
      { header: "Total telat (menit)", key: "menit", width: 11 },
      { header: "Tidak absen", key: "alpa", width: 9 },
      { header: "Izin", key: "izin", width: 7 },
      { header: "Sakit", key: "sakit", width: 7 },
      { header: "Cuti", key: "cuti", width: 7 },
      { header: "Libur", key: "libur", width: 7 },
      { header: "Lupa absen pulang", key: "lupa", width: 10 },
      { header: "Total jam kerja", key: "jam", width: 10 },
      { header: "Rata-rata jam/hari", key: "rata", width: 10 },
      { header: "% Kehadiran", key: "pct", width: 10 },
    ]);
    list.forEach((p, i) => {
      const rs = [...p.days.values()];
      const n = (st: string) => rs.filter((r) => r.status === st).length;
      const hadir = n("ON_TIME") + n("LATE");
      const kerja = rs.filter((r) => r.jadwal).length;
      const lengkap = rs.map(jam).filter((x): x is number => x != null);
      const total = Math.round(lengkap.reduce((a, b) => a + b, 0) * 100) / 100;
      const row = sum.addRow({
        no: i + 1, name: p.name, branch: p.branch, kerja, hadir, tepat: n("ON_TIME"), telat: n("LATE"),
        menit: rs.reduce((a, r) => a + r.lateMinutes, 0), alpa: n("ABSENT"), izin: n("PERMIT"), sakit: n("SICK"), cuti: n("LEAVE"),
        libur: n("HOLIDAY") + n("OFF"),
        lupa: rs.filter((r) => r.checkInAt && !r.checkOutAt && r.status !== "ABSENT").length,
        jam: total, rata: lengkap.length ? Math.round((total / lengkap.length) * 100) / 100 : 0,
        pct: kerja ? hadir / kerja : null,
      });
      row.getCell("pct").numFmt = "0%";
      if (n("ABSENT")) row.getCell("alpa").fill = fill(CODE.ABSENT[1]);
      if (n("LATE")) row.getCell("telat").fill = fill(CODE.LATE[1]);
    });
    if (list.length) {
      const first = 5, end = 4 + list.length;
      const t = sum.addRow({ name: "TOTAL" });
      for (const k of ["kerja", "hadir", "tepat", "telat", "menit", "alpa", "izin", "sakit", "cuti", "libur", "lupa", "jam"]) {
        const col = sum.getColumn(k).letter;
        t.getCell(k).value = { formula: `SUM(${col}${first}:${col}${end})` };
      }
      t.font = { bold: true };
      t.eachCell({ includeEmpty: true }, (c) => { c.fill = fill("FFF3F4F6"); });
    }
    sum.getColumn("jam").numFmt = "0.0";
    sum.getColumn("rata").numFmt = "0.0";
    tidy(sum);

    // 2. Detail harian
    const det = sheet(wb, "Detail Harian", `Detail Absen Harian — ${title}`, `${scope} · ${printed}`, [
      { header: "Tanggal", key: "tgl", width: 11 },
      { header: "Hari", key: "hari", width: 6 },
      { header: "Nama", key: "name", width: 26 },
      { header: "Cabang", key: "branch", width: 16 },
      { header: "Jadwal", key: "jadwal", width: 13 },
      { header: "Masuk", key: "in", width: 8 },
      { header: "Pulang", key: "out", width: 8 },
      { header: "Jam kerja", key: "jam", width: 9 },
      { header: "Status", key: "status", width: 15 },
      { header: "Telat (menit)", key: "late", width: 9 },
      { header: "Datang awal (menit)", key: "early", width: 10 },
      { header: "Catatan", key: "note", width: 22 },
    ]);
    for (const p of list)
      for (const d of days) {
        const r = p.days.get(d);
        if (!r) continue;
        const dt = new Date(d + "T00:00:00Z");
        const row = det.addRow({
          tgl: dt, hari: HARI[dt.getUTCDay()], name: p.name, branch: p.branch, jadwal: r.jadwal ?? "-",
          in: hm(r.checkInAt), out: hm(r.checkOutAt), jam: jam(r), status: STATUS_LABEL[r.status],
          late: r.lateMinutes || null, early: r.earlyMinutes || null,
          note: r.checkInAt && !r.checkOutAt ? (d === today ? "Belum absen pulang" : "Lupa absen pulang") : "",
        });
        row.getCell("tgl").numFmt = "dd/mm/yyyy";
        row.getCell("status").fill = fill(CODE[r.status]?.[1] ?? "FFFFFFFF");
        if (dt.getUTCDay() === 0) row.getCell("hari").font = { color: { argb: "FFDC2626" } };
      }
    det.getColumn("jam").numFmt = "0.00";
    tidy(det);

    // 3. Kalender: nama x tanggal, kode status berwarna.
    const cal = sheet(wb, "Kalender", `Kalender Absen — ${title}`, "H hadir · T telat · A tidak absen · I izin · S sakit · C cuti · L libur nasional · - libur jadwal", [
      { header: "Nama", key: "name", width: 24 },
      { header: "Cabang", key: "branch", width: 14 },
      ...Array.from({ length: last }, (_, i) => {
        const dt = new Date(Date.UTC(y, m - 1, i + 1));
        return { header: `${i + 1}\n${HARI[dt.getUTCDay()]}`, key: `d${i + 1}`, width: 4.5 };
      }),
    ]);
    for (const p of list) {
      const row = cal.addRow({ name: p.name, branch: p.branch });
      for (const d of days) {
        const r = p.days.get(d);
        const c = r && CODE[r.status];
        if (!c) continue;
        const cell = row.getCell(`d${Number(d.slice(8))}`);
        cell.value = c[0];
        cell.fill = fill(c[1]);
        cell.alignment = { horizontal: "center" };
      }
    }
    tidy(cal);
    filename = `rekap-absen-${monthStr}${branch ? `-${branch.toLowerCase().replace(/\s+/g, "-")}` : ""}.xlsx`;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
