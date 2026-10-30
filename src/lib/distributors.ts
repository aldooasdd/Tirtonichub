// Brand racket/senar + distributor resminya. Dipakai dropdown scan Purchasing:
// Finance pilih brand dulu → routing prompt OCR per-brand di n8n + label data latih.
// trained: false = AI belum punya contoh latih → option disabled di dropdown sampai dilatih.
export type Brand = { key: string; brand: string; distributor: string; trained: boolean };

export const BRANDS: Brand[] = [
  { key: "adidas", brand: "Adidas", distributor: "Nusantara Sportindo", trained: true },
  { key: "asics", brand: "Asics", distributor: "SAS", trained: true },
  { key: "deshibeli", brand: "Deshibeli", distributor: "Deshibeli", trained: true },
  { key: "ibuki", brand: "Ibuki", distributor: "KAI", trained: true },
  { key: "isospeed", brand: "Isospeed", distributor: "KAI", trained: true },
  { key: "kswiss", brand: "K-Swiss", distributor: "MAP Aktif Adiperkasa", trained: true },
  { key: "luxilon", brand: "Luxilon", distributor: "The Key", trained: true },
  { key: "mayami", brand: "Mayami", distributor: "Mayami", trained: true },
  { key: "nassau", brand: "Nassau", distributor: "Nassindo Utama Raya", trained: true },
  { key: "newbalance", brand: "New Balance", distributor: "MAP Aktif Adiperkasa", trained: true },
  { key: "prince", brand: "Prince", distributor: "MAP Aktif Adiperkasa", trained: true },
  { key: "signum", brand: "Signum", distributor: "KAI", trained: true },
  { key: "tecnifibre", brand: "Tecnifibre", distributor: "SAS Global Bisnis", trained: true },
  { key: "tourna", brand: "Tourna", distributor: "Tourna", trained: true },
  { key: "volkl", brand: "Volkl", distributor: "Arora Putra Sports & Music", trained: true },
  { key: "yonex", brand: "Yonex", distributor: "PT Sunrise Indonesia", trained: true },
  // Belum terlatih (nota belum cocok / belum dikirim) — disabled di dropdown:
  { key: "dunlop", brand: "Dunlop", distributor: "Crown Sports", trained: false },
  { key: "solinco", brand: "Solinco", distributor: "Solinco", trained: false },
  { key: "babolat", brand: "Babolat", distributor: "Babolat", trained: false },
  { key: "head", brand: "HEAD", distributor: "Kanmo", trained: false },
  { key: "hundred", brand: "Hundred", distributor: "Mentari Cemerlang Indonesia", trained: true },
  { key: "lacoste", brand: "Lacoste", distributor: "Mitra Adiperkasa", trained: false },
  { key: "mizuno", brand: "Mizuno", distributor: "PT. Surya Bumi Retailindo", trained: false },
  { key: "nike", brand: "Nike", distributor: "Generasi Anugerah Berkarya", trained: false },
  { key: "toroline", brand: "Restring / Toroline", distributor: "GSM Sports", trained: false },
  { key: "toalson", brand: "Toalson", distributor: "PT. Pradajaya Sportivo Indonesia", trained: false },
  { key: "treton", brand: "Treton", distributor: "KAI", trained: true },
  { key: "wilson", brand: "Wilson", distributor: "Era Gaya Indonesia", trained: false },
];

export const brandByKey = (k: string | null | undefined): Brand | undefined => BRANDS.find((b) => b.key === k);
