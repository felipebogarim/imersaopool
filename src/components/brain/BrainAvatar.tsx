// Avatar da Inteligência Comercial: marca abstrata (constelação de dados em curva ascendente +
// brilho de insight) sobre esfera em gradiente da cor primária. Sem rosto, sem robô.
import { useId } from "react";
import { cn } from "@/lib/utils";

export function BrainAvatar({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label="Inteligência Comercial"
    >
      <defs>
        <linearGradient id={`g${id}`} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--primary, #1795b8)" }} />
          <stop
            offset="1"
            style={{ stopColor: "color-mix(in oklab, var(--primary, #1795b8) 50%, #0b1626)" }}
          />
        </linearGradient>
        <radialGradient id={`h${id}`} cx="16" cy="12" r="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill={`url(#g${id})`} />
      <circle cx="24" cy="24" r="23" fill={`url(#h${id})`} />
      <circle
        cx="24"
        cy="24"
        r="22.25"
        fill="none"
        stroke="#fff"
        strokeOpacity=".18"
        strokeWidth="1.5"
      />
      {/* constelação: tendência ascendente */}
      <path
        d="M12.5 32.5 L20 25.5 L26 28.5 L35 17"
        fill="none"
        stroke="#fff"
        strokeOpacity=".9"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12.5" cy="32.5" r="2.4" fill="#fff" />
      <circle cx="20" cy="25.5" r="2.4" fill="#fff" />
      <circle cx="26" cy="28.5" r="2.4" fill="#fff" />
      <circle cx="35" cy="17" r="3" fill="#fff" />
      {/* brilho de insight */}
      <path
        d="M33 8.5 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z"
        fill="#fff"
        fillOpacity=".85"
      />
    </svg>
  );
}
