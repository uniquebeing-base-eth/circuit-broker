// Provider endpoint factory: x402-protected, generates a result after cUSD payment is verified.
import { createFileRoute } from "@tanstack/react-router";
import { buildX402Response, parseX402PaymentHeader } from "@/lib/x402.server";
import { verifyCusdPayment, toCusdUnits } from "@/lib/celo.server";
import { generateImage, generateText, uploadDataUrlToStorage } from "@/lib/ai-gen.server";
import type { Address } from "viem";

type Category = "logo" | "image" | "social";

interface ProviderConfig {
  category: Category;
  name: string;
  priceCusd: number;
  wallet: Address; // where the buyer must pay
  resource: string;
}

export async function handleProviderRequest(req: Request, cfg: ProviderConfig): Promise<Response> {
  if (req.method === "GET") {
    // Discovery: return service descriptor + price
    return Response.json({
      name: cfg.name, category: cfg.category, priceCusd: cfg.priceCusd, payTo: cfg.wallet, resource: cfg.resource,
      scheme: "x402", asset: "cUSD", network: "celo",
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const paymentHeader = req.headers.get("X-PAYMENT");
  const payment = parseX402PaymentHeader(paymentHeader);

  if (!payment) {
    return buildX402Response({
      payTo: cfg.wallet, priceCusd: cfg.priceCusd, resource: cfg.resource,
      description: `${cfg.name} — ${cfg.category} generation`,
    });
  }

  const verify = await verifyCusdPayment({
    txHash: payment.txHash, expectedFrom: payment.from, expectedTo: cfg.wallet,
    minAmount: toCusdUnits(cfg.priceCusd),
  });
  if (!verify.ok) {
    return new Response(JSON.stringify({ error: "payment_invalid", reason: verify.reason }), {
      status: 402, headers: { "Content-Type": "application/json" },
    });
  }

  let body: { prompt?: string; jobId?: string } = {};
  try { body = await req.json(); } catch {}
  const prompt = (body.prompt ?? "").slice(0, 1000);
  if (!prompt) return new Response(JSON.stringify({ error: "missing_prompt" }), { status: 400 });

  try {
    if (cfg.category === "social") {
      const text = await generateText({
        system: `You are ${cfg.name}, a specialized social-copy agent. Return only the final copy, no preamble.`,
        user: prompt,
      });
      return Response.json({ ok: true, providerName: cfg.name, paymentTx: payment.txHash, result: { type: "text", text } });
    }
    const isLogo = cfg.category === "logo";
    const richPrompt = isLogo
      ? `Design a clean, professional vector-style logo. ${prompt}. Centered, on a solid background, no text unless requested.`
      : `Create a high-quality marketing image: ${prompt}. Polished, professional.`;
    const dataUrl = await generateImage(richPrompt);
    const path = `${cfg.category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const url = await uploadDataUrlToStorage(dataUrl, path);
    return Response.json({ ok: true, providerName: cfg.name, paymentTx: payment.txHash, result: { type: "image", url } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "generation_failed", message: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}

// Default config used when the routes load this factory; routes pass their own.
export function defineProviderRoute(path: string, cfg: ProviderConfig) {
  return createFileRoute(path as any)({
    server: {
      handlers: {
        GET: async ({ request }) => handleProviderRequest(request, cfg),
        POST: async ({ request }) => handleProviderRequest(request, cfg),
      },
    },
  });
}
