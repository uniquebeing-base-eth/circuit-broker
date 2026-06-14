// x402-style payment requirements helper for provider endpoints.
import type { Address } from "viem";

export interface X402Requirements {
  scheme: "exact";
  network: "celo";
  asset: string;
  payTo: Address;
  maxAmountRequired: string; // base units (cUSD wei)
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
}

export function buildX402Response(opts: {
  payTo: Address; priceCusd: number; resource: string; description: string;
}): Response {
  const requirements: X402Requirements = {
    scheme: "exact",
    network: "celo",
    asset: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    payTo: opts.payTo,
    maxAmountRequired: (BigInt(Math.round(opts.priceCusd * 1e18))).toString(),
    resource: opts.resource,
    description: opts.description,
    mimeType: "application/json",
    maxTimeoutSeconds: 120,
  };
  return new Response(
    JSON.stringify({ x402Version: 1, error: "payment_required", accepts: [requirements] }),
    { status: 402, headers: { "Content-Type": "application/json", "WWW-Authenticate": "X402" } },
  );
}

/** A payment header is a base64-encoded JSON: { txHash, from } */
export function parseX402PaymentHeader(headerValue: string | null): { txHash: `0x${string}`; from: Address } | null {
  if (!headerValue) return null;
  try {
    const decoded = JSON.parse(typeof atob === "function" ? atob(headerValue) : Buffer.from(headerValue, "base64").toString("utf8"));
    if (typeof decoded.txHash === "string" && typeof decoded.from === "string") {
      return { txHash: decoded.txHash as `0x${string}`, from: decoded.from as Address };
    }
  } catch {}
  return null;
}
