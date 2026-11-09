"use client";

import * as React from "react";
import { Input } from "./input";

type Props = Omit<React.ComponentProps<"input">, "prefix"> & {
  plain?: boolean; // true = <input> biasa (kelas sendiri), false = komponen Input
  symbol?: string; // "Rp " (default) / "S$ "
};

/** Input uang: saat diketik tampil "1.250.000"; selesai (blur) tampil "Rp 1.250.000,00".
 *  Nilai & onChange tetap sama seperti input biasa (pakai fmtInt/fmtDec di pemanggil). */
export function RupiahInput({ plain, symbol = "Rp ", value, onFocus, onBlur, ...rest }: Props) {
  const [focus, setFocus] = React.useState(false);
  const v = String(value ?? "");
  const shown = focus || !v ? v : `${symbol}${v}${v.includes(",") ? "" : ",00"}`;
  const props = {
    ...rest,
    value: shown,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(true);
      onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(false);
      onBlur?.(e);
    },
  };
  return plain ? <input {...props} /> : <Input {...props} />;
}
