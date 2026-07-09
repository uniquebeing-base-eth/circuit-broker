import { useEffect } from "react";

// Signal to the Farcaster Mini App host that the app is ready to display.
// Must be called after the UI is rendered so the splash screen dismisses.
export function FarcasterReady() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        await sdk.actions.ready();
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
