// A2A / ERC-8004 agent card builder. Server-only.
import { getCircuitAddress, CIRCUIT_AGENT_ID } from "@/lib/celo.server";

export async function buildAgentCard(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: providers } = await supabaseAdmin
    .from("agent_registry").select("*").eq("active", true);

  const skills = (providers ?? []).map((p) => ({
    id: `${p.category}.${p.id.slice(0, 8)}`,
    name: p.name,
    description: p.description ?? `${p.category} generation`,
    tags: [p.category, "x402", "celo", "cusd"],
    examples: p.category === "social"
      ? ["Write a launch tweet for a Celo-native AI app"]
      : [`Generate a ${p.category} for a fintech startup`],
    inputModes: ["text"],
    outputModes: p.category === "social" ? ["text"] : ["image"],
    pricing: { amount: Number(p.price_cusd), currency: "cUSD", network: "celo" },
    endpoint: `${origin}${p.endpoint}?agent=${p.id}`,
  }));

  return {
    // A2A v0.3 agent card
    protocolVersion: "0.3.0",
    name: "Circuit",
    description: "Autonomous procurement agent on Celo. Discovers specialized agents, pays them in cUSD via x402, and delivers results to the user.",
    url: `${origin}/`,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [
      { transport: "JSONRPC", url: `${origin}/api/a2a` },
      { transport: "HTTP", url: `${origin}/agent-card.json` },
    ],
    provider: { organization: "Circuit", url: origin },
    version: "0.3.0",
    documentationUrl: `${origin}/integrate`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
      extensions: [{ uri: "https://x402.org/spec", required: false, description: "x402 HTTP 402 payments in cUSD on Celo" }],
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json", "image/png", "text/plain"],
    securitySchemes: {
      x402: { type: "http", scheme: "x402", description: "Pay-per-call in cUSD on Celo (chainId 42220)" },
    },
    skills: skills.length > 0 ? skills : [
      {
        id: "procurement.default",
        name: "Autonomous procurement",
        description: "Describe what you need. Circuit discovers, pays, and delivers.",
        tags: ["procurement", "logos", "images", "social", "x402"],
        examples: ["Create a logo for a coffee shop", "Generate a banner for a hackathon", "Write a launch tweet"],
        inputModes: ["text"], outputModes: ["text", "image"],
      },
    ],
    // ERC-8004 extras
    erc8004: {
      agentId: CIRCUIT_AGENT_ID.toString(),
      chainId: 42220,
      address: getCircuitAddress(),
      supportedTrusts: ["reputation", "crypto-economic", "tee-attestation"],
    },
    x402Support: true,
    active: true,
  };
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Cache-Control": "public, max-age=60",
};

export async function agentCardResponse(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  try {
    const origin = new URL(req.url).origin;
    const card = await buildAgentCard(origin);
    return new Response(JSON.stringify(card, null, 2), { status: 200, headers: JSON_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: "card_build_failed", message: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: JSON_HEADERS });
  }
}
