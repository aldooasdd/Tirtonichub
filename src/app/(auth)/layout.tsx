import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <DarkGradientBg>
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </DarkGradientBg>
  );
}
