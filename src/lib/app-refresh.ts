declare const __APP_BUILD_ID__: string;

export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "dev";

const RELOAD_GUARD_KEY = "app:stale-reload-at";
const RELOAD_GUARD_MS = 60_000;

function canReloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Remove caches locais da aplicação (mantém a sessão de autenticação). */
export async function purgeAppCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignora */ }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch { /* ignora */ }
  try {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch { /* ignora */ }
}

/** Limpa caches e recarrega a aplicação a partir do servidor. */
export async function hardReload(target?: string): Promise<void> {
  await purgeAppCaches();
  const url = target ?? window.location.pathname + window.location.search;
  window.location.replace(url);
}

function isStaleChunkError(message: string): boolean {
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Unable to preload CSS")
  );
}

async function recoverFromStaleBuild() {
  if (!canReloadOnce()) return;
  await purgeAppCaches();
  window.location.reload();
}

/** Compara a versão carregada no navegador com a versão publicada. */
export async function checkForStaleBuild(): Promise<void> {
  if (APP_BUILD_ID === "dev") return;
  try {
    const res = await fetch("/", { cache: "no-store", headers: { accept: "text/html" } });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/name="app-build"\s+content="([^"]+)"/);
    const serverBuild = match?.[1];
    if (serverBuild && serverBuild !== APP_BUILD_ID) {
      await recoverFromStaleBuild();
    }
  } catch { /* offline ou indisponível: ignora */ }
}

/** Instala a recuperação automática contra versões antigas em cache. */
export function installStaleBuildRecovery(): () => void {
  const onPreloadError = () => { void recoverFromStaleBuild(); };
  const onRejection = (e: PromiseRejectionEvent) => {
    const msg = String((e.reason as { message?: string } | undefined)?.message ?? e.reason ?? "");
    if (isStaleChunkError(msg)) void recoverFromStaleBuild();
  };
  const onError = (e: ErrorEvent) => {
    if (isStaleChunkError(String(e.message ?? ""))) void recoverFromStaleBuild();
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  void checkForStaleBuild();

  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
  };
}
