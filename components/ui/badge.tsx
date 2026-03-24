import { cn } from "@/lib/utils";

export function Badge({ className, children, variant }: { className?: string; children: React.ReactNode; variant?: "default" | "secondary" | "outline" }) {
  const variantClassName =
    variant === "outline"
      ? "border border-border bg-transparent text-foreground"
      : variant === "secondary"
        ? "border border-slate-400/20 bg-slate-400/10 text-slate-200"
        : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", variantClassName, className)}
    >
      {children}
    </span>
  );
}