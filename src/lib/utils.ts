import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Exibe nomes de família com acentuação correta (ex.: MODULOS -> MÓDULOS). */
export function famLabel(name: string): string {
  if (!name) return name;
  return name
    .replace(/MODULOS/g, "MÓDULOS")
    .replace(/Modulos/g, "Módulos")
    .replace(/\bmodulos\b/g, "módulos");
}
