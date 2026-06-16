// x402-style payment requirements for provider endpoints, chain-aware.
import type { Address } from "viem";
import { getChainConfig } from "@/lib/chains.server";

export function buildX402Response(opts: {
  chainKey: string;
  payTo: Address;
  priceCusd: number;
  resource: string;
  description: string;
}): Response {
  const cfg = getChainConfig(opts.chainKey);
  const amount = BigInt(Math.round(opts.priceCusd * 10 ** cfg.decimals)).toString();
  const requirements = {
    scheme: "exact",
    network: opts.chainKey,
    asset: cfg.assetAddress,
    assetSymbol: cfg.asset,
    payTo: opts.payTo,
    maxAmountRequired: amount,
    resource: opts.resource,
    description: opts.description,
    mimeType: "application/json",
    maxTimeoutSeconds: 120,
  };
  return new Response(
    JSON.stringify({ x402Version: 1, error: "payment_required", accepts: [requirements] }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "X402",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/** Payment header: base64-encoded JSON { txHash, from } */
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
