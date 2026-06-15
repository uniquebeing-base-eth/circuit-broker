import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { count } = await supabaseAdmin
            .from("agent_registry").select("*", { count: "exact", head: true }).eq("active", true);
          return new Response(JSON.stringify({
            status: "healthy",
            uptime: "ok",
            providers: count ?? 0,
            timestamp: new Date().toISOString(),
          }), { status: 200, headers: HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({
            status: "degraded",
            error: e instanceof Error ? e.message : String(e),
            timestamp: new Date().toISOString(),
          }), { status: 200, headers: HEADERS });
        }
      },
    },
  },
});
