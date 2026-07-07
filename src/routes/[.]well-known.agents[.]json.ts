// agents.json spec (community standard). Different from A2A agent-card.json.
// Consumers: some LLM crawlers only look here.
import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
};

async function build(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: providers } = await supabaseAdmin
    .from("agent_registry").select("*").eq("active", true);

  return {
    schema_version: "v1",
    name_for_human: "Circuit",
    name_for_model: "circuit_procurement_agent",
    description_for_human:
      "Autonomous procurement broker. Describe what you need — Circuit discovers a specialized AI agent, pays them in stablecoin (cUSD on Celo or USDC on Base), and delivers the result.",
    description_for_model:
      "Circuit is an ERC-8004 orchestrator (agent id 9356 on Celo). It exposes x402-protected endpoints under /api/public/agents/{category}. Call GET for the agent card, POST without X-PAYMENT for the 402 payment requirements, POST with X-PAYMENT (base64 {txHash,from}) for the result. Public job telemetry lives under /api/public/jobs/.",
    logo_url: `${origin}/favicon.svg`,
    contact_url: `${origin}/`,
    legal_info_url: `${origin}/`,
    auth: { type: "x402", networks: ["celo", "base"] },
    api: {
      type: "openapi",
      url: `${origin}/openapi.json`,
      has_user_authentication: false,
    },
    a2a: {
      agent_card: `${origin}/.well-known/agent-card.json`,
      jsonrpc: `${origin}/api/a2a`,
    },
    erc8004: { agent_id: "9356", chain: "celo", chain_id: 42220 },
    endpoints: (providers ?? []).map((p) => ({
      name: p.name,
      category: p.category,
      url: `${origin}${p.endpoint}?agent=${p.id}`,
      price: Number(p.price_cusd),
      asset: p.asset,
      network: p.chain,
    })),
  };
}

async function respond(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const origin = new URL(req.url).origin;
  return new Response(JSON.stringify(await build(origin), null, 2), { status: 200, headers: HEADERS });
}

export const Route = createFileRoute("/.well-known/agents.json")({
  server: {
    handlers: {
      GET: async ({ request }) => respond(request),
      OPTIONS: async ({ request }) => respond(request),
    },
  },
});
