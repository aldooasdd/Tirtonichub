import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { fmtWIB } from "@/lib/datetime";
import { dailyRekap, monthlyRekap } from "@/server/attendance/rekap";
import { ABSEN_ON } from "@/lib/flags";

const STATUS_LABEL: Record<string, string> = {
  ON_TIME: "Tepat waktu",
  LATE: "Terlambat",
  ABSENT: "Belum/Tidak absen",
  LEAVE: "Cuti",
  SICK: "Sakit",
  PERMIT: "Izin",
  HOLIDAY: "Libur",
  OFF: "Libur (jadwal)",
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

  const wb = new ExcelJS.Workbook();
  let filename = "rekap.xlsx";

  if (view === "harian") {
    const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);
    const { rows } = await dailyRekap(new Date(date + "T00:00:00Z"), branchId);
    const ws = wb.addWorksheet("Rekap Harian");
    ws.columns = [
      { header: "Nama", key: "name", width: 24 },
      { header: "Cabang", key: "branch", width: 18 },
      { header: "Jadwal", key: "jadwal", width: 16 },
      { header: "Masuk", key: "in", width: 20 },
      { header: "Awal (menit)", key: "early", width: 14 },
      { header: "Pulang", key: "out", width: 20 },
      { header: "Status", key: "status", width: 18 },
      { header: "Telat (menit)", key: "late", width: 14 },
    ];
    rows.forEach((r) =>
      ws.addRow({
        name: r.name,
        branch: r.branch ?? "-",
        jadwal: r.jadwal ?? "-",
        in: r.checkInAt ? fmtWIB(r.checkInAt) : "-",
        early: r.earlyMinutes,
        out: r.checkOutAt ? fmtWIB(r.checkOutAt) : "-",
        status: STATUS_LABEL[r.status],
        late: r.lateMinutes,
      }),
    );
    filename = `rekap-harian-${date}.xlsx`;
  } else {
    const monthStr = sp.get("m") ?? new Date().toISOString().slice(0, 7);
    const [y, m] = monthStr.split("-").map(Number);
    const rows = await monthlyRekap(y, m - 1, branchId);
    const ws = wb.addWorksheet("Rekap Bulanan");
    ws.columns = [
      { header: "Nama", key: "name", width: 24 },
      { header: "Hadir", key: "hadir", width: 10 },
      { header: "Telat", key: "telat", width: 10 },
      { header: "Menit telat", key: "menit", width: 12 },
      { header: "Izin", key: "izin", width: 8 },
      { header: "Sakit", key: "sakit", width: 8 },
      { header: "Cuti", key: "cuti", width: 8 },
      { header: "Total jam", key: "jam", width: 12 },
    ];
    rows.forEach((r) =>
      ws.addRow({
        name: r.name,
        hadir: r.hadir,
        telat: r.telat,
        menit: r.telatMenit,
        izin: r.izin,
        sakit: r.sakit,
        cuti: r.cuti,
        jam: r.totalJam,
      }),
    );
    filename = `rekap-bulanan-${monthStr}.xlsx`;
  }

  ws_style(wb);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

function ws_style(wb: ExcelJS.Workbook) {
  wb.worksheets.forEach((ws) => {
    ws.getRow(1).font = { bold: true };
  });
}
