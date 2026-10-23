# DESIGN_TOKENS — Tirtonic Internal (SnowUI)

Sumber: Figma `Project-Aldo` (`eSNgdSzykyZrCuy3oLZbzX`), halaman **Colors** (`2607:19216`),
**Variables** (`2607:19115`), **Spacing/Size/Radius** (`2607:19155`), **Text Styles**
(`2607:19405`), **Effect Styles** (`2607:19440`). Nilai dark dibaca dari frame dashboard
dark (`2607:11413`), bukan asumsi.

> Prinsip SnowUI: warna terbagi dua.
> - **Theme variables** (Primary, Background, Surface, dan skala opacity Black/White) **berubah** saat light↔dark.
> - **Color styles** (Secondary, KPI accent `Color 1`/`Color 2`) **tetap** di kedua mode.
> - Kartu dibedakan lewat **warna latar**, bukan border tebal/shadow. Shadow sangat halus.

---

## 1. Palet warna

### 1.1 Theme variables (berubah per mode)

| Token | Light | Dark |
|---|---|---|
| `primary` (teks/fill utama) | `#000000` | `#ffffff` |
| `brand` | `#33d1ff` | `#33d1ff` |
| `background-1` (latar halaman) | `#ffffff` | `#333333` |
| `background-2` (latar blok/section) | `#f9f9fa` | `#3b3b3b` |
| `background-3` (latar translucent) | `rgba(255,255,255,0.90)` | `rgba(255,255,255,0.04)` |
| `surface-1` | `rgba(255,255,255,0.80)` | `rgba(255,255,255,0.10)` |
| `surface-2` | `rgba(0,0,0,0.03)` | `rgba(255,255,255,0.04)` |
| `surface-3` | `rgba(0,0,0,0.02)` | `rgba(255,255,255,0.04)` |

### 1.2 Skala opacity teks & garis (flip Black↔White)

Dipakai untuk teks sekunder, border, divider, ikon. **Light = Black/x%, Dark = White/x%.**

| Peran | Light | Dark |
|---|---|---|
| `fg` / 100% | `#000000` | `#ffffff` |
| `fg-80` (teks kuat) | `rgba(0,0,0,0.80)` | `rgba(255,255,255,0.80)` |
| `fg-40` (teks redup / placeholder) | `rgba(0,0,0,0.40)` | `rgba(255,255,255,0.40)` |
| `fg-20` (garis kuat) | `rgba(0,0,0,0.20)` | `rgba(255,255,255,0.20)` |
| `fg-10` (border/divider) | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` |
| `fg-4` (hover halus) | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` |

### 1.3 Color styles (TETAP di light & dark)

Secondary (status & chart):

| Nama | Hex |
|---|---|
| Purple | `#b899eb` |
| Indigo | `#adadfb` |
| Blue (= Brand) | `#33d1ff` |
| Cyan | `#a0bce8` |
| Mint | `#6be6d3` |
| Green | `#71dd8c` |
| Yellow | `#ffcc00` |
| Orange | `#ffb55b` |
| Red | `#ff4747` |

KPI accent card (latar kartu angka, tetap terang di dark):

| Nama | Hex |
|---|---|
| Color 1 | `#e6f1fd` |
| Color 2 | `#edeefc` |

### 1.4 Pemetaan status PRD → warna

| Status | Token |
|---|---|
| Pending | Yellow `#ffcc00` |
| Approved / Hadir tepat waktu / Aktif | Green `#71dd8c` |
| Rejected / Nonaktif | Red `#ff4747` |
| Terlambat | Orange `#ffb55b` |
| Izin/Cuti/Sakit (info) | Blue `#33d1ff` |

Teks di atas badge: pakai `fg-80` mode terkait (kontras cukup, cek di dark).

---

## 2. Tipografi

Font: **Inter**. Fallback: `ui-sans-serif, system-ui, sans-serif`. Letter spacing: `0`.
Bobot: Regular `400`, Semibold `600`.

| Nama | size / line-height | Pakai untuk |
|---|---|---|
| `text-12` | 12 / 16 | caption, label badge |
| `text-14` | 14 / 20 | body default, isi tabel |
| `text-16` | 16 / 24 | body besar, input |
| `text-18` | 18 / 28 | subjudul |
| `text-24` | 24 / 32 | angka KPI, judul section |
| `text-32` | 32 / 40 | heading halaman |
| `text-48` | 48 / 56 | display |
| `text-64` | 64 / 72 | display besar |

Aturan line-height desainer: font 12–18 → ±1.5×; font ≥24 → ±1.2×. (Sudah tercermin di tabel.)
Angka/nominal di tabel **rata kanan**, prefer Semibold.

---

## 3. Spacing, radius, ukuran

- **Spacing** (gap/padding/margin), skala px: `4, 8, 12, 16, 20, 24, 28, 40, 48, 80`.
- **Radius**: `8` (komponen kecil: input, badge, tombol), `12` (medium), `16` (kartu/blok), `24` (kartu besar/container). Pill = `9999`.
- **Target sentuh HP** ≥ `44px`.

---

## 4. Effect styles (shadow & blur)

Halus — jangan dilebihkan.

| Nama | Nilai |
|---|---|
| `drop-shadow-1` | `0 0.5px 0.5px rgba(0,0,0,0.10)` |
| `drop-shadow-2` | `0 2px 4px rgba(0,0,0,0.10)` |
| `glass-1` | backdrop-blur 16 + `0 4px 16px rgba(0,0,0,0.04)` |
| `glass-2` | backdrop-blur 40 + `0 8px 28px rgba(0,0,0,0.10)` |
| `focus` (ring) | `0 0 0 4px rgba(0,0,0,0.04)` |
| `glow` | `0 0 12px 8px rgba(255,255,255,0.20), 0 0 12px 8px rgba(0,0,0,0.20)` |
| `inner-shadow` | inner `1px 1.5px 4px rgba(0,0,0,0.10)` + highlight `0 -0.5px 1px rgba(255,255,255,0.30)` |
| `backdrop-blur-40` / `-100` | background blur radius 40 / 100 (panel kaca) |

---

## 5. Pemetaan shadcn/ui (semantic tokens)

shadcn memakai CSS variable. Mapping SnowUI → shadcn:

| shadcn | Light | Dark |
|---|---|---|
| `--background` | `#ffffff` | `#333333` |
| `--foreground` | `#000000` | `#ffffff` |
| `--card` / `--popover` | `#ffffff` | `#3b3b3b` |
| `--card-foreground` | `#000000` | `#ffffff` |
| `--muted` | `#f9f9fa` | `rgba(255,255,255,0.04)` |
| `--muted-foreground` | `rgba(0,0,0,0.40)` | `rgba(255,255,255,0.40)` |
| `--primary` | `#000000` | `#ffffff` |
| `--primary-foreground` | `#ffffff` | `#000000` |
| `--secondary` / `--accent` | `#f9f9fa` | `rgba(255,255,255,0.10)` |
| `--border` / `--input` | `rgba(0,0,0,0.10)` | `rgba(255,255,255,0.10)` |
| `--ring` | `#33d1ff` | `#33d1ff` |
| `--destructive` | `#ff4747` | `#ff4747` |
| `--radius` | `16px` (kartu); input 8px | sama |
| `--brand` (custom) | `#33d1ff` | `#33d1ff` |
| `--success` (custom) | `#71dd8c` | `#71dd8c` |
| `--warning` (custom) | `#ffcc00` | `#ffcc00` |

---

## 6. `globals.css` (Tailwind v4 — siap pakai)

```css
@import "tailwindcss";

:root {
  /* theme (light) */
  --background: #ffffff;
  --foreground: #000000;
  --card: #ffffff;
  --card-foreground: #000000;
  --popover: #ffffff;
  --popover-foreground: #000000;
  --muted: #f9f9fa;
  --muted-foreground: rgba(0,0,0,0.40);
  --primary: #000000;
  --primary-foreground: #ffffff;
  --secondary: #f9f9fa;
  --secondary-foreground: #000000;
  --accent: rgba(0,0,0,0.04);
  --accent-foreground: #000000;
  --border: rgba(0,0,0,0.10);
  --input: rgba(0,0,0,0.10);
  --ring: #33d1ff;
  --destructive: #ff4747;
  --destructive-foreground: #ffffff;

  /* brand & status (fixed) */
  --brand: #33d1ff;
  --success: #71dd8c;
  --warning: #ffcc00;
  --info: #33d1ff;
  --kpi-1: #e6f1fd;
  --kpi-2: #edeefc;

  /* opacity scale (light = black) */
  --fg-80: rgba(0,0,0,0.80);
  --fg-40: rgba(0,0,0,0.40);
  --fg-20: rgba(0,0,0,0.20);
  --fg-10: rgba(0,0,0,0.10);
  --fg-4:  rgba(0,0,0,0.04);

  --radius: 16px;      /* kartu/blok */
  --radius-sm: 8px;    /* input, badge, tombol */
}

.dark {
  --background: #333333;
  --foreground: #ffffff;
  --card: #3b3b3b;
  --card-foreground: #ffffff;
  --popover: #3b3b3b;
  --popover-foreground: #ffffff;
  --muted: rgba(255,255,255,0.04);
  --muted-foreground: rgba(255,255,255,0.40);
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: rgba(255,255,255,0.10);
  --secondary-foreground: #ffffff;
  --accent: rgba(255,255,255,0.04);
  --accent-foreground: #ffffff;
  --border: rgba(255,255,255,0.10);
  --input: rgba(255,255,255,0.10);
  --ring: #33d1ff;
  --destructive: #ff4747;
  --destructive-foreground: #ffffff;

  --fg-80: rgba(255,255,255,0.80);
  --fg-40: rgba(255,255,255,0.40);
  --fg-20: rgba(255,255,255,0.20);
  --fg-10: rgba(255,255,255,0.10);
  --fg-4:  rgba(255,255,255,0.04);
  /* --brand, --success, --warning, --kpi-* tetap */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --color-brand: var(--brand);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-kpi-1: var(--kpi-1);
  --color-kpi-2: var(--kpi-2);

  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;

  --text-12: 12px; --text-12--line-height: 16px;
  --text-14: 14px; --text-14--line-height: 20px;
  --text-16: 16px; --text-16--line-height: 24px;
  --text-18: 18px; --text-18--line-height: 28px;
  --text-24: 24px; --text-24--line-height: 32px;
  --text-32: 32px; --text-32--line-height: 40px;
  --text-48: 48px; --text-48--line-height: 56px;
  --text-64: 64px; --text-64--line-height: 72px;

  --spacing-4: 4px;   --spacing-8: 8px;   --spacing-12: 12px;
  --spacing-16: 16px; --spacing-20: 20px; --spacing-24: 24px;
  --spacing-28: 28px; --spacing-40: 40px; --spacing-48: 48px;
  --spacing-80: 80px;

  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px;

  --shadow-ds1: 0 0.5px 0.5px rgba(0,0,0,0.10);
  --shadow-ds2: 0 2px 4px rgba(0,0,0,0.10);
}

* { border-color: var(--border); }
body { background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
```

> **Catatan shadcn v3 (HSL):** jika pakai shadcn versi lama yang butuh format `hsl(var(--x))`
> triplet tanp`hsl()`, konversi hex di atas ke HSL dan hapus `hsl(...)` pembungkus. Warna
> ber-opacity (`rgba`) tidak cocok dengan format triplet HSL — untuk itu gunakan langsung
> nilai `rgba` seperti di contoh Tailwind v4 ini, atau definisikan channel + alpha terpisah.

---

## 7. Catatan implementasi

- Default tema ikut sistem (`prefers-color-scheme`), pilihan user disimpan (`User.themePref`) → set class `.dark` di `<html>`.
- KPI card (`kpi-1`/`kpi-2`) sengaja tetap terang di dark → teks di dalamnya **selalu gelap** (`#000` / `fg-80` light), jangan ikut `--foreground`.
- Kartu pakai `bg-card` + `rounded-lg` (16) tanpa border; divider antar baris pakai `border` (fg-10).
- Badge status: `rounded-sm` (8) + warna status + teks `fg-80`.
- Wajib: empty / loading / error state per list (PRD §12).
