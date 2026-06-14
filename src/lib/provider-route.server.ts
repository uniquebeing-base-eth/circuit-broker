// x402-protected provider endpoint factory.
import { buildX402Response, parseX402PaymentHeader } from "@/lib/x402.server";
import { verifyCusdPayment, toCusdUnits } from "@/lib/celo.server";
import { generateImage, generateText, uploadDataUrlToStorage } from "@/lib/ai-gen.server";
import type { Address } from "viem";

export type Category = "logo" | "image" | "social";

async function loadAgent(agentId: string, category: Category) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("agent_registry").select("*").eq("id", agentId).eq("category", category).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function handleProviderRequest(req: Request, category: Category): Promise<Response> {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent");
  if (!agentId) {
    return new Response(JSON.stringify({ error: "missing_agent_id" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const agent = await loadAgent(agentId, category);
  if (!agent) return new Response(JSON.stringify({ error: "agent_not_found" }), { status: 404 });

  if (req.method === "GET") {
    return Response.json({
      name: agent.name, category: agent.category, priceCusd: Number(agent.price_cusd),
      payTo: agent.wallet_address, asset: "cUSD", network: "celo", scheme: "x402",
      resource: `${url.origin}${url.pathname}?agent=${agent.id}`,
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const payment = parseX402PaymentHeader(req.headers.get("X-PAYMENT"));
  const wallet = agent.wallet_address as Address;
  const price = Number(agent.price_cusd);

  if (!payment) {
    return buildX402Response({
      payTo: wallet, priceCusd: price,
      resource: `${url.origin}${url.pathname}?agent=${agent.id}`,
      description: `${agent.name} — ${category} generation`,
    });
  }

  const verify = await verifyCusdPayment({
    txHash: payment.txHash, expectedFrom: payment.from, expectedTo: wallet,
    minAmount: toCusdUnits(price),
  });
  if (!verify.ok) {
    return new Response(JSON.stringify({ error: "payment_invalid", reason: verify.reason }), {
      status: 402, headers: { "Content-Type": "application/json" },
    });
  }

  let body: { prompt?: string } = {};
  try { body = await req.json(); } catch {}
  const prompt = (body.prompt ?? "").slice(0, 1000);
  if (!prompt) return new Response(JSON.stringify({ error: "missing_prompt" }), { status: 400 });

  try {
    if (category === "social") {
      const text = await generateText({
        system: `You are ${agent.name}, a specialized social-copy agent. Return only the final copy, no preamble or quotes.`,
        user: prompt,
      });
      return Response.json({ ok: true, providerName: agent.name, paymentTx: payment.txHash, result: { type: "text", text } });
    }
    const richPrompt = category === "logo"
      ? `Design a clean, professional vector-style logo. ${prompt}. Centered on a solid background. Minimal, iconic, modern.`
      : `Create a high-quality marketing image: ${prompt}. Polished, professional, eye-catching.`;
    const dataUrl = await generateImage(richPrompt);
    const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const signedUrl = await uploadDataUrlToStorage(dataUrl, path);
    return Response.json({ ok: true, providerName: agent.name, paymentTx: payment.txHash, result: { type: "image", url: signedUrl } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "generation_failed", message: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
