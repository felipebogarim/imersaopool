import { useQuery } from "@tanstack/react-query";
import { fetchDirectorBI } from "@/lib/director-bi-data";

export function useDirectorBI() {
  return useQuery({
    queryKey: ["director-bi"],
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
    queryFn: fetchDirectorBI,
  });
}
