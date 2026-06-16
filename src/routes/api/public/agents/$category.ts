// Dynamic x402-protected provider endpoint. Matches every category the registry knows.
import { createFileRoute } from "@tanstack/react-router";
import { handleProviderRequest } from "@/lib/provider-route.server";

const OPTIONS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PAYMENT, Accept",
};

export const Route = createFileRoute("/api/public/agents/$category")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: OPTIONS_HEADERS }),
      GET: async ({ request, params }) => handleProviderRequest(request, params.category),
      POST: async ({ request, params }) => handleProviderRequest(request, params.category),
    },
  },
});
