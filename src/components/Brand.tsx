import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="pf-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.16 215)" />
          <stop offset="50%" stopColor="oklch(0.72 0.18 195)" />
          <stop offset="100%" stopColor="oklch(0.55 0.18 165)" />
        </linearGradient>
      </defs>
      <path d="M6 22 L14 8 L22 18 L30 6 L36 16 L32 30 L18 34 L8 30 Z" fill="url(#pf-g)" opacity="0.95" />
      <path d="M6 22 L14 8 L22 18 L18 24 Z" fill="oklch(0.95 0.05 200)" opacity="0.35" />
      <path d="M22 18 L30 6 L36 16 L28 22 Z" fill="oklch(0.55 0.18 165)" opacity="0.5" />
    </svg>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground -mb-0.5">pool</span>
        <span className="text-lg font-bold tracking-tight text-foreground">Flux</span>
      </div>
    </div>
  );
}
