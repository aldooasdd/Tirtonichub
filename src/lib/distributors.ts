// Brand racket/senar + distributor resminya. Dipakai dropdown scan Purchasing:
// Finance pilih brand dulu → routing prompt OCR per-brand di n8n + label data latih.
export type Brand = { key: string; brand: string; distributor: string };

export const BRANDS: Brand[] = [
  { key: "adidas", brand: "Adidas", distributor: "Nusantara Sportindo" },
  { key: "asics", brand: "Asics", distributor: "SAS" },
  { key: "deshibeli", brand: "Deshibeli", distributor: "Deshibeli" },
  { key: "dunlop", brand: "Dunlop", distributor: "Crown Sports" },
  { key: "ibuki", brand: "Ibuki", distributor: "KAI" },
  { key: "isospeed", brand: "Isospeed", distributor: "KAI" },
  { key: "kswiss", brand: "K-Swiss", distributor: "MAP Aktif Adiperkasa" },
  { key: "luxilon", brand: "Luxilon", distributor: "The Key" },
  { key: "mayami", brand: "Mayami", distributor: "Mayami" },
  { key: "nassau", brand: "Nassau", distributor: "Nassindo Utama Raya" },
  { key: "newbalance", brand: "New Balance", distributor: "MAP Aktif Adiperkasa" },
  { key: "prince", brand: "Prince", distributor: "MAP Aktif Adiperkasa" },
  { key: "signum", brand: "Signum", distributor: "KAI" },
  { key: "solinco", brand: "Solinco", distributor: "Solinco" },
  { key: "tecnifibre", brand: "Tecnifibre", distributor: "SAS Global Bisnis" },
  { key: "tourna", brand: "Tourna", distributor: "Tourna" },
  { key: "volkl", brand: "Volkl", distributor: "Arora Putra Sports & Music" },
  { key: "yonex", brand: "Yonex", distributor: "PT Sunrise Indonesia" },
];

export const brandByKey = (k: string | null | undefined): Brand | undefined => BRANDS.find((b) => b.key === k);
