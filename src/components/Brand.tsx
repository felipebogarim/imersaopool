import { cn } from "@/lib/utils";
import logo from "@/assets/poolflux-logo.png.asset.json";
import poolflowLogo from "@/assets/poolflow-logo.png.asset.json";
import jornadaLogo from "@/assets/logo_jornada_de_produtos.png.asset.json";
import growupSaudeLogo from "@/assets/growup-saude-logo.png.asset.json";



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

export function JornadaProdutosLogo({ className }: { className?: string }) {
  return (
    <img
      src={jornadaLogo.url}
      alt="Jornada de Produtos Pool"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}

export function GrowUpSaudeLogo({ className }: { className?: string }) {
  return (
    <img
      src={growupSaudeLogo.url}
      alt="GrowUp Saúde"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}



