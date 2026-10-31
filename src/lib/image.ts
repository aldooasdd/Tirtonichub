// Kompres gambar di browser: skala ≤ maxDim, JPEG quality. Dipakai chat (upload gambar).
export async function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob null"))), "image/jpeg", quality),
  );
}

// Nota (PDF/foto) → strip horizontal JPEG base64 buat OCR. OpenAI ngecilin gambar full-halaman
// ke sisi pendek 768px (A4 ≈93dpi, tabel rapat kabur & AI ngarang). Strip 2480×≤700 (A4 ≈300dpi).
// 2048 masih kurang: tabel Excel rapat (Lacoste) salah baca qty; 2480 cocok PI 19/19 brand (tes 2×).
// Overlap 80px biar baris di batas potongan nggak kepotong.
const STRIP_W = 2480;
const STRIP_H = 700;
const OVERLAP = 80;

function whiteCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG tanpa alpha: transparan jadi hitam kalau nggak diisi putih
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

async function notaPages(file: File): Promise<HTMLCanvasElement[]> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: HTMLCanvasElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: STRIP_W / page.getViewport({ scale: 1 }).width });
      const { c, ctx } = whiteCanvas(Math.round(viewport.width), Math.round(viewport.height));
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push(c);
    }
    await doc.destroy();
    return pages;
  }
  const bmp = await createImageBitmap(file);
  const { c, ctx } = whiteCanvas(STRIP_W, Math.round((bmp.height * STRIP_W) / bmp.width));
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return [c];
}

export async function notaStrips(file: File): Promise<string[]> {
  const strips: string[] = [];
  for (const page of await notaPages(file)) {
    for (let y = 0; ; y += STRIP_H - OVERLAP) {
      const h = Math.min(STRIP_H, page.height - y);
      const { c, ctx } = whiteCanvas(page.width, h);
      ctx.drawImage(page, 0, y, page.width, h, 0, 0, page.width, h);
      strips.push(c.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "");
      if (y + h >= page.height) break;
    }
  }
  return strips;
}
