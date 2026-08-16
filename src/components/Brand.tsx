import { cn } from "@/lib/utils";
import logo from "@/assets/poolflux-logo.png.asset.json";
import poolflowLogo from "@/assets/poolflow-logo.png.asset.json";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="PoolFlux — Diagnóstico Comercial"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="PoolFlux — Diagnóstico Comercial"
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}

export function PoolFlowLogo({ className }: { className?: string }) {
  return (
    <img
      src={poolflowLogo.url}
      alt="PoolFlow — Marketing & CRM"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}

