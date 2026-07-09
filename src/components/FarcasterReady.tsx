import { useEffect } from "react";

// Signal to the Farcaster Mini App host that the app is ready so the splash
// screen dismisses. We load the SDK from esm.sh at runtime because the npm
// package pulls in Node-only deps (rpc-websockets) that don't build under the
// Cloudflare workerd SSR bundle, and a bare-specifier dynamic import can't be
// resolved by the browser at runtime.
const SDK_URL = "https://esm.sh/@farcaster/miniapp-sdk@0.3.0";

export function FarcasterReady() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import(/* @vite-ignore */ SDK_URL);
        if (cancelled) return;
        await mod.sdk?.actions?.ready?.();
      } catch (err) {
        console.warn("[FarcasterReady] sdk.actions.ready failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
