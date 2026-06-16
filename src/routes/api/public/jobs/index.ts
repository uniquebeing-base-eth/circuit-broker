// Public list endpoint: lets other agents discover recent Circuit jobs.
import { createFileRoute } from "@tanstack/react-router";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

async function buildResponse(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const wallet = url.searchParams.get("wallet")?.toLowerCase();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("jobs").select("id, status, category, chain, asset, prompt, created_at, updated_at").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);
  if (category) q = q.eq("category", category);
  if (wallet) q = q.eq("user_wallet", wallet);
  const { data, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
  return new Response(JSON.stringify({ count: data?.length ?? 0, jobs: data ?? [] }, null, 2), { status: 200, headers: HEADERS });
}

export const Route = createFileRoute("/api/public/jobs/")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ request }) => buildResponse(request),
    },
  },
});
