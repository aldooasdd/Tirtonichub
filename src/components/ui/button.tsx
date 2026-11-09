"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { useFormStatus } from "react-dom"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"
import { AbstractCubeIsometricLoader } from "@/components/ui/abstract-cube-isometric-loader"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading,
  disabled,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Paksa tampil loader. Kalau tak diisi, loader otomatis muncul saat tombol
     *  diklik lalu jadi disabled (pola useTransition), saat form action pending,
     *  atau saat onClick mengembalikan Promise. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  // Pending dari <form action={...}> — aman dipanggil di luar form (balik false).
  const { pending: formPending } = useFormStatus()
  const [selfPending, setSelfPending] = React.useState(false)
  const [clicked, setClicked] = React.useState(false)

  // Pola existing: tombol diklik → parent set disabled={isPending}. Begitu disabled
  // lepas, reset supaya loader hilang.
  const [prevDisabled, setPrevDisabled] = React.useState(disabled)
  if (disabled !== prevDisabled) {
    setPrevDisabled(disabled)
    if (!disabled) setClicked(false)
  }

  // asChild (mis. bungkus <Link>) tak bisa disisipi overlay — navigasi sudah
  // ditangani loading.tsx, jadi loader di-skip.
  const showLoader =
    !asChild &&
    (loading === true || selfPending || formPending || (clicked && !!disabled))
  const isDisabled = disabled || loading === true || selfPending

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setClicked(true)
    const r = onClick?.(e) as unknown
    if (r && typeof (r as Promise<unknown>).then === "function") {
      setSelfPending(true)
      Promise.resolve(r).finally(() => {
        setSelfPending(false)
        setClicked(false)
      })
    }
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), showLoader && "relative")}
      disabled={asChild ? undefined : isDisabled}
      aria-busy={showLoader || undefined}
      onClick={asChild ? onClick : handleClick}
      {...props}
    >
      {showLoader ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <AbstractCubeIsometricLoader dotSize={3} gap={2} speed={1} />
          </span>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
