import Link from "next/link";
import type { ComponentProps } from "react";

/** Link menu: tautan biasa untuk halaman di luar app Next (mis. /studio), Link Next untuk sisanya. */
export function NavLink({ external, href, ...rest }: ComponentProps<typeof Link> & { href: string; external?: boolean }) {
  if (external) return <a href={href} {...(rest as ComponentProps<"a">)} />;
  return <Link href={href} {...rest} />;
}
