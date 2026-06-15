import { createFileRoute } from "@tanstack/react-router";
import { agentCardResponse, buildAgentCard } from "@/lib/agent-card.server";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

// Minimal A2A JSON-RPC endpoint: supports `agent/getCard` and returns the agent card on GET.
export const Route = createFileRoute("/api/a2a")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => agentCardResponse(request),
      POST: async ({ request }) => {
        let body: any = {};
        try { body = await request.json(); } catch {}
        const id = body?.id ?? null;
        const method = body?.method ?? "";
        const origin = new URL(request.url).origin;
        if (method === "agent/getCard" || method === "agent/authenticatedExtendedCard") {
          return new Response(JSON.stringify({
            jsonrpc: "2.0", id, result: await buildAgentCard(origin),
          }), { status: 200, headers: HEADERS });
        }
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id,
          error: { code: -32601, message: `Method not found: ${method}. Try agent/getCard or fetch GET /agent-card.json.` },
        }), { status: 200, headers: HEADERS });
      },
    },
  },
});
