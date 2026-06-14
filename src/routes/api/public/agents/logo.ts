import { createFileRoute } from "@tanstack/react-router";
import { handleProviderRequest } from "@/lib/provider-route.server";

export const Route = createFileRoute("/api/public/agents/logo")({
  server: {
    handlers: {
      GET: async ({ request }) => handleProviderRequest(request, "logo"),
      POST: async ({ request }) => handleProviderRequest(request, "logo"),
    },
  },
});
