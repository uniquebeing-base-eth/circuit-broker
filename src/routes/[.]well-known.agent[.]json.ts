import { createFileRoute } from "@tanstack/react-router";
import { agentCardResponse } from "@/lib/agent-card.server";

// Legacy A2A discovery path
export const Route = createFileRoute("/.well-known/agent.json")({
  server: {
    handlers: {
      GET: async ({ request }) => agentCardResponse(request),
      OPTIONS: async ({ request }) => agentCardResponse(request),
    },
  },
});
