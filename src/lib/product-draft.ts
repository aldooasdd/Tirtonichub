// Draft produk dari form Tirtonic Channel → dikirim ke Tokopedia (Create / Edit / Partial Edit Product).
export type Img = { uri: string; url: string };
export type DraftVariant = { skuId?: string; value: string; price: number; stock: number; sellerSku: string; image?: Img | null };
export type DraftCert = { id: string; images: Img[]; files: { id: string; name: string }[] };

export type ProductDraft = {
  productId?: string; // ada = edit
  title: string;
  description?: string; // teks biasa; undefined = tidak diubah (edit)
  images: Img[];
  categoryId: string;
  categoryPath?: string;
  categoryChanged?: boolean; // edit: ganti kategori → Edit Product penuh
  brandId?: string | null;
  attributes: { id: string; value: string }[]; // nilai dipisah koma untuk pilihan ganda
  variantName?: string; // buat baru: nama varian (mis. Warna); kosong = tanpa varian
  variants?: DraftVariant[]; // buat baru saja; edit stok/harga lewat tabel varian
  weightKg: string;
  length: string;
  width: string;
  height: string;
  minOrder?: number | null;
  cod?: boolean;
  preOwned?: boolean;
  platforms: ("TOKOPEDIA" | "TIKTOK_SHOP")[];
  certifications: DraftCert[];
  sizeChart?: Img | null;
  video?: { id: string; name: string } | null;
  saveMode: "LISTING" | "AS_DRAFT";
  shippingTemplateId?: string;
};

/** Teks biasa → HTML deskripsi (paragraf per baris, karakter khusus di-escape). */
export function textToHtml(t: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

/** HTML deskripsi → teks biasa untuk diedit. */
export function htmlToText(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
