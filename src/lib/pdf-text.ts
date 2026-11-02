// Teks asli PDF digital (bukan scan) → baris per baris, kolom dipisah spasi. Buat OCR nota:
// angka dari lapisan teks pasti benar, dan nota banyak halaman tak perlu jadi puluhan gambar.
// "" bila PDF hasil scan (tanpa teks) → pemanggil pakai gambar.
type Item = { str: string; transform: number[]; width: number };
type Pdfjs = { getDocument: (src: { data: Uint8Array }) => { promise: Promise<Doc> } };
type Doc = { numPages: number; getPage: (n: number) => Promise<Page>; destroy: () => Promise<void> };
type Page = { getTextContent: () => Promise<{ items: unknown[] }> };

const MIN_CHARS_PER_PAGE = 40; // di bawah ini anggap scan (cuma stempel/watermark)

export function pageLines(items: Item[]): string {
  const rows: { y: number; parts: Item[] }[] = [];
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const y = it.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (row) row.parts.push(it);
    else rows.push({ y, parts: [it] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => {
      let line = "";
      let end = -Infinity;
      for (const p of r.parts.sort((a, b) => a.transform[4] - b.transform[4])) {
        const gap = p.transform[4] - end;
        line += !line ? "" : gap > 8 ? "   " : gap > 1 ? " " : "";
        line += p.str.trim();
        end = p.transform[4] + p.width;
      }
      return line;
    })
    .join("\n");
}

export async function pdfText(data: Uint8Array, pdfjs: Pdfjs): Promise<string> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const n = doc.numPages;
  const pages: string[] = [];
  for (let i = 1; i <= n; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(pageLines(tc.items.filter((x): x is Item => typeof (x as Item).str === "string")));
  }
  await doc.destroy();
  const chars = pages.join("").replace(/\s/g, "").length;
  if (chars < MIN_CHARS_PER_PAGE * n) return "";
  return pages.map((p, i) => `--- Halaman ${i + 1} ---\n${p}`).join("\n\n");
}

/** Browser: teks nota PDF digital. "" untuk scan / bukan PDF. */
export async function notaText(file: File): Promise<string> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return "";
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfText(new Uint8Array(await file.arrayBuffer()), pdfjs as unknown as Pdfjs);
}
