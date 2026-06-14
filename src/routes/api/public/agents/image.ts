import { createFileRoute } from "@tanstack/react-router";
import { handleProviderRequest } from "@/lib/provider-route.server";

export const Route = createFileRoute("/api/public/agents/image")({
  server: {
    handlers: {
      GET: async ({ request }) => handleProviderRequest(request, "image"),
      POST: async ({ request }) => handleProviderRequest(request, "image"),
    },
  },
});
