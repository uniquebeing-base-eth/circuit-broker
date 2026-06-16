// A2A / ERC-8004 agent card. Surfaces every active provider as a skill.
import { getCircuitAddress, CIRCUIT_AGENT_ID } from "@/lib/celo.server";

const IMAGE_CATEGORIES = new Set(["logo", "image"]);

export async function buildAgentCard(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: providers } = await supabaseAdmin
    .from("agent_registry").select("*").eq("active", true);

  const skills = (providers ?? []).map((p) => ({
    id: `${p.category}.${p.id.slice(0, 8)}`,
    name: p.name,
    description: p.description ?? `${p.category} generation`,
    tags: [p.category, "x402", p.chain, p.asset?.toLowerCase()],
    examples: [`Create a ${p.category.replace(/_/g, " ")} for a startup`],
    inputModes: ["text"],
    outputModes: IMAGE_CATEGORIES.has(p.category) ? ["image"] : ["text"],
    pricing: { amount: Number(p.price_cusd), currency: p.asset ?? "cUSD", network: p.chain ?? "celo" },
    endpoint: `${origin}${p.endpoint}?agent=${p.id}`,
  }));

  return {
    protocolVersion: "0.3.0",
    name: "Circuit",
    description: "Autonomous procurement agent on Celo & Base. Discovers specialized agents, pays them in cUSD or USDC via x402, and delivers results to the user.",
    url: `${origin}/`,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [
      { transport: "JSONRPC", url: `${origin}/api/a2a` },
      { transport: "HTTP", url: `${origin}/agent-card.json` },
      { transport: "HTTP", url: `${origin}/api/public/jobs/`, description: "Browse Circuit job activity" },
    ],
    provider: { organization: "Circuit", url: origin },
    version: "0.3.0",
    documentationUrl: `${origin}/integrate`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: true,
      extensions: [
        { uri: "https://x402.org/spec", required: false, description: "x402 HTTP 402 payments" },
      ],
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json", "image/png", "text/markdown", "text/plain"],
    securitySchemes: {
      x402Celo: { type: "http", scheme: "x402", description: "cUSD on Celo (chainId 42220)" },
      x402Base: { type: "http", scheme: "x402", description: "USDC on Base (chainId 8453)" },
    },
    skills: skills.length > 0 ? skills : [
      {
        id: "procurement.default",
        name: "Autonomous procurement",
        description: "Describe what you need. Circuit discovers, pays, and delivers.",
        tags: ["procurement", "x402"],
        examples: ["Create a logo", "Write a resume", "Draft a landing page"],
        inputModes: ["text"], outputModes: ["text", "image"],
      },
    ],
    erc8004: {
      agentId: CIRCUIT_AGENT_ID.toString(),
      chainId: 42220,
      address: getCircuitAddress(),
      supportedTrusts: ["reputation", "crypto-economic", "tee-attestation"],
    },
    chains: [
      { name: "celo", chainId: 42220, asset: "cUSD", assetAddress: "0x765DE816845861e75A25fCA122bb6898B8B1282a" },
      { name: "base", chainId: 8453, asset: "USDC", assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    ],
    publicApis: {
      jobsList: `${origin}/api/public/jobs/`,
      jobDetail: `${origin}/api/public/jobs/{jobId}`,
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
