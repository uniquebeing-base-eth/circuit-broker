import { createFileRoute } from "@tanstack/react-router";
import { handleProviderRequest } from "@/lib/provider-route.server";

export const Route = createFileRoute("/api/public/agents/social")({
  server: {
    handlers: {
      GET: async ({ request }) => handleProviderRequest(request, "social"),
      POST: async ({ request }) => handleProviderRequest(request, "social"),
    },
  },
});
