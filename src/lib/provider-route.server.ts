// Generic, chain-aware x402 provider endpoint. Handles any category in the registry.
import { buildX402Response, parseX402PaymentHeader } from "@/lib/x402.server";
import { verifyAssetPayment, toAssetUnits } from "@/lib/chains.server";
import { generateImage, generateText, uploadDataUrlToStorage } from "@/lib/ai-gen.server";
import type { Address } from "viem";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// Categories that produce an image. Everything else → text.
const IMAGE_CATEGORIES = new Set(["logo", "image"]);

const SYSTEM_PROMPTS: Record<string, string> = {
  social: "You are a social-copy specialist. Return only the final copy, no preamble or quotes.",
  resume: "You are a resume writer. Produce a recruiter-ready, ATS-friendly resume in clean Markdown with sections: Summary, Experience, Skills, Education. No preamble.",
  portfolio: "You are a portfolio copywriter. Produce a compelling bio and 2-3 project case studies in Markdown. No preamble.",
  website: "You are a landing page copywriter. Produce a structured single-page website plan in Markdown with: Hero (headline + sub + CTA), 3 Feature blocks, How it works, Social proof, FAQ, Footer CTA. No preamble.",
  pitch: "You are a startup pitch writer. Produce a 10-slide investor pitch outline in Markdown: Problem, Solution, Market, Product, Traction, Business model, Go-to-market, Competition, Team, Ask. No preamble.",
  business_plan: "You are a strategy consultant. Produce a lean business plan in Markdown: Mission, Customers, Value prop, Channels, Revenue, Costs, Key metrics, Risks. No preamble.",
  video_script: "You are a short-form video scriptwriter. Produce a script with [HOOK], [BODY] with scene/voiceover beats, and [CTA]. Optimize for retention. No preamble.",
  palette: "You are a brand designer. Return a brand palette as Markdown with 5 colors: name, hex, role (Primary, Secondary, Accent, Surface, Text). No preamble.",
  naming: "You are a brand naming consultant. Return 8 distinct brand name options as a Markdown list, each with a one-line rationale. No preamble.",
  blog: "You are an SEO-savvy blog writer. Produce a complete blog post in Markdown with H1, intro, 3-5 H2 sections, and a conclusion. No preamble.",
  product_copy: "You are an e-commerce copywriter. Return product copy in Markdown: headline, 1-paragraph description, 5 bullet benefits, 3 spec lines. No preamble.",
  email: "You are a B2B email writer. Return a complete cold email: Subject line, 4-6 line body, single CTA. No preamble.",
};

function systemPromptFor(category: string, agentName: string): string {
  const base = SYSTEM_PROMPTS[category] ?? `You are ${agentName}, a specialist agent for "${category}". Produce a high-quality result. No preamble.`;
  return `${base} You are ${agentName}.`;
}

function richImagePrompt(category: string, prompt: string): string {
  if (category === "logo") return `Design a clean, professional vector-style logo. ${prompt}. Centered on a solid background. Minimal, iconic, modern.`;
  return `Create a high-quality marketing image: ${prompt}. Polished, professional, eye-catching.`;
}

async function loadAgent(agentId: string, category: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("agent_registry").select("*").eq("id", agentId).eq("category", category).maybeSingle();
  return data;
}

export async function handleProviderRequest(req: Request, category: string): Promise<Response> {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent");
  if (!agentId) {
    return new Response(JSON.stringify({ error: "missing_agent_id", hint: "append ?agent=<uuid>" }), {
      status: 400, headers: JSON_HEADERS,
    });
  }
  const agent = await loadAgent(agentId, category);
  if (!agent) return new Response(JSON.stringify({ error: "agent_not_found" }), { status: 404, headers: JSON_HEADERS });

  const chain = agent.chain || "celo";
  const resource = `${url.origin}${url.pathname}?agent=${agent.id}`;

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      name: agent.name, description: agent.description, category: agent.category,
      priceCusd: Number(agent.price_cusd),
      payTo: agent.wallet_address, asset: agent.asset, chain, scheme: "x402",
      outputType: IMAGE_CATEGORIES.has(agent.category) ? "image" : "text",
      resource,
    }, null, 2), { status: 200, headers: JSON_HEADERS });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: JSON_HEADERS });

  const payment = parseX402PaymentHeader(req.headers.get("X-PAYMENT"));
  const wallet = agent.wallet_address as Address;
  const price = Number(agent.price_cusd);

  if (!payment) {
    return buildX402Response({
      chainKey: chain, payTo: wallet, priceCusd: price,
      resource, description: `${agent.name} — ${agent.category}`,
    });
  }

  const verify = await verifyAssetPayment({
    chainKey: chain, txHash: payment.txHash, expectedFrom: payment.from, expectedTo: wallet,
    minAmount: toAssetUnits(chain, price),
  });
  if (!verify.ok) {
    return new Response(JSON.stringify({ error: "payment_invalid", reason: verify.reason }), {
      status: 402, headers: JSON_HEADERS,
    });
  }

  let body: { prompt?: string } = {};
  try { body = await req.json(); } catch {}
  const prompt = (body.prompt ?? "").slice(0, 2000);
  if (!prompt) return new Response(JSON.stringify({ error: "missing_prompt" }), { status: 400, headers: JSON_HEADERS });

  try {
    if (IMAGE_CATEGORIES.has(agent.category)) {
      const dataUrl = await generateImage(richImagePrompt(agent.category, prompt));
      const path = `${agent.category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const signedUrl = await uploadDataUrlToStorage(dataUrl, path);
      return new Response(JSON.stringify({
        ok: true, providerName: agent.name, paymentTx: payment.txHash,
        result: { type: "image", url: signedUrl },
      }), { status: 200, headers: JSON_HEADERS });
    }
    const text = await generateText({
      system: systemPromptFor(agent.category, agent.name),
      user: prompt,
    });
    return new Response(JSON.stringify({
      ok: true, providerName: agent.name, paymentTx: payment.txHash,
      result: { type: "text", text },
    }), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "generation_failed", message: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: JSON_HEADERS,
    });
  }
}
