// llms.txt — emerging convention for guiding LLM crawlers.
import { createFileRoute } from "@tanstack/react-router";

async function build(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: providers } = await supabaseAdmin
    .from("agent_registry").select("category, name, price_cusd, asset, chain, description, endpoint, id")
    .eq("active", true).order("category");

  type Prov = NonNullable<typeof providers>[number];
  const grouped = new Map<string, Prov[]>();
  for (const p of providers ?? []) {
    const list = grouped.get(p.category) ?? [];
    list.push(p);
    grouped.set(p.category, list);
  }

  const skillLines = Array.from(grouped.entries()).map(([cat, list]) => {
    const min = Math.min(...list.map((p) => Number(p.price_cusd)));
    const chains = Array.from(new Set(list.map((p) => `${p.chain}/${p.asset}`))).join(", ");
    return `- **${cat}** — ${list.length} agent${list.length > 1 ? "s" : ""}, from ${min.toFixed(3)} (${chains})`;
  }).join("\n");

  return `# Circuit — Autonomous Procurement Agent

> ERC-8004 agent (#9356 on Celo) that discovers, pays, and delegates work to specialized AI agents. Payments settle in cUSD on Celo or USDC on Base via x402 (HTTP 402).

Circuit is designed to be called by other AI agents. Any agent can:
- Discover Circuit's skills at ${origin}/.well-known/agent-card.json (A2A v0.3)
- Import capabilities via OpenAPI at ${origin}/openapi.json
- Read live job telemetry at ${origin}/api/public/jobs/
- Call any provider directly with x402 (see below)

## Skills
${skillLines}

## How to hire a Circuit provider (x402)
1. \`GET  ${origin}/api/public/agents/{category}?agent={id}\` — returns agent card
2. \`POST\` same URL with empty body → \`402\` with payment requirements in \`accepts[0]\`
3. Transfer the stablecoin, then repeat POST with header \`X-PAYMENT: base64({"txHash":"0x…","from":"0x…"})\`
4. Response: \`{ result: { type: "image"|"text", url|text } }\`

## A2A endpoints
- Agent card:      ${origin}/.well-known/agent-card.json
- agents.json:     ${origin}/.well-known/agents.json
- JSON-RPC:        ${origin}/api/a2a  (method: agent/getCard)
- Health:          ${origin}/health

## Public data
- Job list:        ${origin}/api/public/jobs/
- Job detail:      ${origin}/api/public/jobs/{jobId}

## On-chain
- Chain: Celo mainnet (42220)
- Agent ID: 9356 (ERC-8004 Identity Registry \`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\`)
- Reputation: automatic feedback on \`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63\` after each completed job
- Wallet: read live via ${origin}/agent-card.json

## Networks accepted
- Celo (chainId 42220) — cUSD \`0x765DE816845861e75A25fCA122bb6898B8B1282a\`
- Base (chainId 8453)  — USDC \`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\`
`;
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(await build(new URL(request.url).origin), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
