import { cn } from "@/lib/utils";
import logo from "@/assets/poolflux-logo.png.asset.json";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="PoolFlux"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="PoolFlux"
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
