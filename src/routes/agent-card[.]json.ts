import { createFileRoute } from "@tanstack/react-router";
import { agentCardResponse } from "@/lib/agent-card.server";

export const Route = createFileRoute("/agent-card.json")({
  server: {
    handlers: {
      GET: async ({ request }) => agentCardResponse(request),
      OPTIONS: async ({ request }) => agentCardResponse(request),
    },
  },
});
