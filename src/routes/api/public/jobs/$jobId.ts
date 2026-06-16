// Public JSON endpoint: any agent can fetch a Circuit job timeline by jobId.
import { createFileRoute } from "@tanstack/react-router";
import { explorerTx } from "@/lib/chains.server";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Cache-Control": "no-cache",
};

async function buildResponse(jobId: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return new Response(JSON.stringify({ error: "invalid_job_id" }), { status: 400, headers: HEADERS });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: job } = await supabaseAdmin
    .from("jobs").select("*, agent_registry(name, category, chain, asset)").eq("id", jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: HEADERS });
  const { data: events } = await supabaseAdmin
    .from("timeline_events").select("*").eq("job_id", jobId).order("created_at");

  const chain = job.chain ?? "celo";
  const provider = (job as any).agent_registry;
  return new Response(JSON.stringify({
    jobId: job.id,
    status: job.status,
    category: job.category,
    prompt: job.prompt,
    chain,
    asset: job.asset ?? "cUSD",
    buyer: job.user_wallet,
    amounts: {
      buyerPaid: Number(job.user_pay_amount_cusd),
      providerPaid: job.provider_pay_amount_cusd != null ? Number(job.provider_pay_amount_cusd) : null,
      circuitFee: job.circuit_fee_cusd != null ? Number(job.circuit_fee_cusd) : null,
      budget: Number(job.budget_cusd),
    },
    transactions: {
      buyerToCircuit: job.user_tx_hash ? { hash: job.user_tx_hash, explorer: explorerTx(chain, job.user_tx_hash) } : null,
      circuitToProvider: job.provider_tx_hash ? { hash: job.provider_tx_hash, explorer: explorerTx(chain, job.provider_tx_hash) } : null,
    },
    provider: provider ? { name: provider.name, category: provider.category, chain: provider.chain, asset: provider.asset } : null,
    result: job.result_url ? { type: "image", url: job.result_url } : job.result_text ? { type: "text", text: job.result_text } : null,
    error: job.error ?? null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    timeline: (events ?? []).map((e) => ({
      step: e.step, message: e.message, status: e.status,
      txHash: (e.metadata as any)?.txHash ?? null,
      explorer: (e.metadata as any)?.txHash ? explorerTx(chain, (e.metadata as any).txHash) : null,
      metadata: e.metadata,
      at: e.created_at,
    })),
  }, null, 2), { status: 200, headers: HEADERS });
}

export const Route = createFileRoute("/api/public/jobs/$jobId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),
      GET: async ({ params }) => buildResponse(params.jobId),
    },
  },
});
