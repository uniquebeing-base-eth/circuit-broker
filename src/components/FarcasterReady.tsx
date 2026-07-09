import { useEffect } from "react";

// Signal to the Farcaster Mini App host that the app is ready.
// The SDK pulls in Node/browser-only deps (rpc-websockets) that don't build
// under the Cloudflare workerd SSR environment, so we load it via a runtime
// dynamic import that Vite/Rolldown cannot statically analyze.
export function FarcasterReady() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const modName = "@farcaster/miniapp-sdk";
        const mod: any = await import(/* @vite-ignore */ modName);
        if (cancelled) return;
        await mod.sdk?.actions?.ready?.();
      } catch {
        // Not running inside a Farcaster host — safe to ignore.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

