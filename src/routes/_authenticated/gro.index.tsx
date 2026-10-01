/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useGroContext } from "@/hooks/useGroContext";

export const Route = createFileRoute("/_authenticated/gro/")({ component: GroIndex });
function GroIndex() {
  const navigate = useNavigate();
  const { data } = useGroContext();
  useEffect(() => {
    if (data)
      navigate({
        to: data.isConsultant ? "/gro/carteira" : "/gro/empresa/$section",
        params: data.isConsultant ? (undefined as any) : { section: "panorama" },
        replace: true,
      } as any);
  }, [data, navigate]);
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
