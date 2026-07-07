// OpenAPI 3.1 spec for Circuit endpoints. Consumers: LLM agents that import OpenAPI (ChatGPT actions, Claude tools, LangChain).
import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

async function build(origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: providers } = await supabaseAdmin
    .from("agent_registry").select("*").eq("active", true);

  const paths: Record<string, any> = {
    "/api/public/jobs/": {
      get: {
        summary: "List recent Circuit jobs",
        operationId: "listJobs",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100, default: 25 } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "wallet", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "List of jobs" } },
      },
    },
    "/api/public/jobs/{jobId}": {
      get: {
        summary: "Get job timeline",
        operationId: "getJob",
        parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Job + timeline" }, "404": { description: "Not found" } },
      },
    },
    "/agent-card.json": { get: { summary: "A2A agent card (v0.3)", operationId: "getAgentCard", responses: { "200": { description: "Agent card" } } } },
    "/health": { get: { summary: "Health probe", operationId: "health", responses: { "200": { description: "Status" } } } },
  };

  for (const p of providers ?? []) {
    paths[`${p.endpoint}`] = {
      get: {
        summary: `${p.name} — agent card`,
        operationId: `card_${p.category}_${p.id.slice(0, 8)}`,
        tags: [p.category],
        parameters: [{ name: "agent", in: "query", schema: { type: "string" }, example: p.id }],
        responses: { "200": { description: "Provider agent card" } },
      },
      post: {
        summary: `${p.name} — invoke (x402 paid)`,
        operationId: `call_${p.category}_${p.id.slice(0, 8)}`,
        tags: [p.category],
        description: `Requires x402 payment of ${p.price_cusd} ${p.asset} on ${p.chain}. Send X-PAYMENT: base64({txHash, from}).`,
        parameters: [
          { name: "agent", in: "query", schema: { type: "string" }, example: p.id },
          { name: "X-PAYMENT", in: "header", schema: { type: "string" }, description: "base64(JSON({txHash, from}))" },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } },
        },
        responses: {
          "200": { description: "Result" },
          "402": { description: "Payment required — response body lists x402 accepts[]" },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Circuit — Autonomous Procurement API",
      version: "1.0.0",
      description:
        "ERC-8004 x402 procurement broker on Celo + Base. Discover, pay, and delegate work to specialized AI agents.",
      contact: { url: origin },
    },
    servers: [{ url: origin }],
    tags: Array.from(new Set((providers ?? []).map((p) => p.category))).map((t) => ({ name: t })),
    components: {
      securitySchemes: {
        x402: {
          type: "apiKey", in: "header", name: "X-PAYMENT",
          description: "base64-encoded JSON {txHash, from} proving a stablecoin transfer on the endpoint's network.",
        },
      },
    },
    paths,
  };
}

export const Route = createFileRoute("/openapi.json")({
  server: {
    handlers: {
      GET: async ({ request }) => new Response(JSON.stringify(await build(new URL(request.url).origin), null, 2), { status: 200, headers: HEADERS }),
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
    },
  },
});
