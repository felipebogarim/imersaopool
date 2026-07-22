import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marca d'água diagonal repetida cobrindo toda a área principal.
 * Mostra e-mail do usuário logado + data/hora, para inibir vazamento por screenshot.
 * Impressa via CSS puro; não interfere em cliques (pointer-events: none).
 */
export function Watermark() {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  if (!email) return null;

  const stamp = new Date().toLocaleString("pt-BR");
  const text = `${email} • ${stamp} • CONFIDENCIAL`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220">
  <g transform="rotate(-25 260 110)" fill="rgba(120,120,120,0.10)" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="14" font-weight="500">
    <text x="20" y="110">${text.replace(/[<>&]/g, "")}</text>
  </g>
</svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] print:opacity-100"
      style={{
        backgroundImage: url,
        backgroundRepeat: "repeat",
        backgroundSize: "520px 220px",
        mixBlendMode: "multiply",
      }}
    />
  );
}
