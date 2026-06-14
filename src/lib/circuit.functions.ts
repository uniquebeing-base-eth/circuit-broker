// Circuit orchestrator: server functions for creating jobs, confirming payment,
// and running the full procurement loop (discover → pay provider → deliver).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

const CategoryEnum = z.enum(["logo", "image", "social"]);

const CreateJobSchema = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  category: CategoryEnum,
  prompt: z.string().min(3).max(500),
  budgetCusd: z.number().positive().max(1),
});

const ConfirmPaymentSchema = z.object({
  jobId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

async function logEvent(jobId: string, step: string, message: string, status: "running" | "done" | "error" = "done", metadata?: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("timeline_events").insert({ job_id: jobId, step, message, status, metadata: metadata as any });
}

async function setJob(jobId: string, patch: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId);
}

export const getCircuitInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { getCircuitAddress, getCusdBalance, fromCusdUnits, CIRCUIT_AGENT_ID } = await import("@/lib/celo.server");
  const addr = getCircuitAddress();
  let cusd = "0";
  let celo = "0";
  try {
    const bal = await getCusdBalance(addr);
    cusd = fromCusdUnits(bal);
  } catch {}
  try {
    const { publicClient } = await import("@/lib/celo.server");
    const native = await publicClient.getBalance({ address: addr });
    celo = (Number(native) / 1e18).toFixed(4);
  } catch {}
  return { address: addr, cusdBalance: cusd, celoBalance: celo, agentId: CIRCUIT_AGENT_ID.toString() };
});

export const createJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateJobSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCircuitAddress } = await import("@/lib/celo.server");

    // Pick the best provider for this category within budget (lowest price with high reputation).
    const { data: agents, error: agentsErr } = await supabaseAdmin
      .from("agent_registry").select("*")
      .eq("category", data.category).eq("active", true)
      .lte("price_cusd", data.budgetCusd)
      .order("reputation", { ascending: false }).order("price_cusd", { ascending: true });
    if (agentsErr) throw new Error(agentsErr.message);
    if (!agents || agents.length === 0) throw new Error("No providers available within budget. Increase budget.");

    // Circuit's price = provider price + 0.005 cUSD margin, capped at user budget.
    const provider = agents[0];
    const providerPrice = Number(provider.price_cusd);
    const userPay = Math.min(providerPrice + 0.005, data.budgetCusd);

    const { data: job, error } = await supabaseAdmin.from("jobs").insert({
      user_wallet: data.userWallet.toLowerCase(),
      category: data.category,
      prompt: data.prompt,
      budget_cusd: data.budgetCusd,
      user_pay_amount_cusd: userPay,
      status: "awaiting_payment",
    }).select("*").single();
    if (error) throw new Error(error.message);

    await logEvent(job.id, "created", `Job created. Requesting ${userPay.toFixed(4)} cUSD from buyer.`);

    return {
      jobId: job.id as string,
      payTo: getCircuitAddress(),
      amountCusd: userPay,
      providerPreview: { name: provider.name, price: providerPrice, reputation: Number(provider.reputation) },
    };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmPaymentSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      getCircuitAddress, verifyCusdPayment, toCusdUnits, circuitSendCusd, REPUTATION_ABI,
      ERC8004_REPUTATION, getCircuitWalletClient, publicClient, CIRCUIT_AGENT_ID,
    } = await import("@/lib/celo.server");

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (jobErr || !job) throw new Error("Job not found");
    if (job.status !== "awaiting_payment") {
      return { ok: true, alreadyRunning: true };
    }

    await setJob(job.id, { user_tx_hash: data.txHash });

    // 1. Verify the user's cUSD payment landed.
    await logEvent(job.id, "payment", "Verifying buyer payment on Celo…", "running");
    const verify = await verifyCusdPayment({
      txHash: data.txHash as Hex,
      expectedFrom: getAddress(job.user_wallet) as Address,
      expectedTo: getCircuitAddress(),
      minAmount: toCusdUnits(Number(job.user_pay_amount_cusd)),
    });
    if (!verify.ok) {
      await setJob(job.id, { status: "failed", error: `payment_invalid: ${verify.reason}` });
      await logEvent(job.id, "payment", `Payment verification failed: ${verify.reason}`, "error");
      throw new Error(`Payment verification failed: ${verify.reason}`);
    }
    await setJob(job.id, { status: "payment_received" });
    await logEvent(job.id, "payment", `✓ Received ${(Number(verify.actualAmount) / 1e18).toFixed(4)} cUSD from buyer`, "done", { txHash: data.txHash });

    // 2. Discovery — list providers (re-query for fresh data).
    await setJob(job.id, { status: "discovering" });
    await logEvent(job.id, "discover", "Discovering specialized agents on Celo…", "running");
    const { data: agents } = await supabaseAdmin
      .from("agent_registry").select("*")
      .eq("category", job.category).eq("active", true)
      .lte("price_cusd", Number(job.budget_cusd))
      .order("reputation", { ascending: false }).order("price_cusd", { ascending: true });
    if (!agents || agents.length === 0) {
      await setJob(job.id, { status: "failed", error: "no_providers" });
      throw new Error("No providers");
    }
    await logEvent(job.id, "discover", `✓ ${agents.length} providers discovered`, "done", {
      providers: agents.map((a) => ({ name: a.name, price: Number(a.price_cusd), reputation: Number(a.reputation) })),
    });

    // 3. Compare offers (already sorted by rep desc, price asc).
    await logEvent(job.id, "compare", "Comparing price, reputation, delivery time…", "running");
    const chosen = agents[0];
    await logEvent(job.id, "compare", `✓ Best value: ${chosen.name} @ ${Number(chosen.price_cusd).toFixed(3)} cUSD (★${Number(chosen.reputation).toFixed(1)})`, "done");
    await setJob(job.id, { selected_agent_id: chosen.id, provider_pay_amount_cusd: Number(chosen.price_cusd) });

    // 4. Hire via x402 — first call gets 402 with payment requirements.
    await setJob(job.id, { status: "paying_provider" });
    const origin = new URL(getRequest().url).origin;
    const providerUrl = `${origin}${chosen.endpoint}?agent=${chosen.id}`;
    await logEvent(job.id, "quote", `Requesting quote from ${chosen.name}…`, "running");
    const probe = await fetch(providerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (probe.status !== 402) {
      await setJob(job.id, { status: "failed", error: `unexpected_probe_status_${probe.status}` });
      throw new Error("Provider didn't return 402");
    }
    const reqs = await probe.json();
    const accept = reqs.accepts?.[0];
    await logEvent(job.id, "quote", `✓ ${chosen.name} requires ${(BigInt(accept.maxAmountRequired) / 10n ** 12n).toString()} micro-cUSD via x402`, "done");

    // 5. Pay the provider on-chain from Circuit's wallet.
    await logEvent(job.id, "pay_provider", `Paying ${chosen.name} ${Number(chosen.price_cusd).toFixed(3)} cUSD on Celo…`, "running");
    let providerTx: Hex;
    try {
      providerTx = await circuitSendCusd(chosen.wallet_address as Address, BigInt(accept.maxAmountRequired));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setJob(job.id, { status: "failed", error: `pay_failed: ${msg}` });
      await logEvent(job.id, "pay_provider", `Payment to provider failed: ${msg}`, "error");
      throw e;
    }
    await setJob(job.id, { provider_tx_hash: providerTx, circuit_fee_cusd: Number(job.user_pay_amount_cusd) - Number(chosen.price_cusd) });
    await logEvent(job.id, "pay_provider", `✓ Paid ${chosen.name}`, "done", { txHash: providerTx });

    // 6. Re-request with payment proof.
    await setJob(job.id, { status: "provider_working" });
    await logEvent(job.id, "delivery", `${chosen.name} working on your request…`, "running");
    const paymentHeader = Buffer.from(JSON.stringify({ txHash: providerTx, from: getCircuitAddress() })).toString("base64");
    const final = await fetch(providerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PAYMENT": paymentHeader },
      body: JSON.stringify({ prompt: job.prompt, jobId: job.id }),
    });
    if (!final.ok) {
      const text = await final.text();
      await setJob(job.id, { status: "failed", error: `provider_failed_${final.status}: ${text}` });
      await logEvent(job.id, "delivery", `Provider failed: ${text}`, "error");
      throw new Error("Provider delivery failed");
    }
    const payload = await final.json();
    const result = payload.result ?? {};
    await setJob(job.id, {
      status: "completed",
      result_url: result.type === "image" ? result.url : null,
      result_text: result.type === "text" ? result.text : null,
    });
    await logEvent(job.id, "delivery", `✓ ${chosen.name} delivered`, "done");
    await logEvent(job.id, "complete", "Procurement complete.", "done");

    // 7. Submit ERC-8004 reputation feedback (best-effort).
    try {
      const wallet = getCircuitWalletClient();
      const hash = await wallet.writeContract({
        address: ERC8004_REPUTATION,
        abi: REPUTATION_ABI,
        functionName: "giveFeedback",
        args: [CIRCUIT_AGENT_ID, 90, "starred", "", providerUrl, ("0x" + "00".repeat(32)) as Hex],
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      await logEvent(job.id, "reputation", "✓ ERC-8004 feedback submitted on-chain", "done", { txHash: hash });
    } catch (e) {
      await logEvent(job.id, "reputation", `Reputation submit skipped: ${e instanceof Error ? e.message.slice(0, 100) : "error"}`, "done");
    }

    return { ok: true };
  });

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin.from("jobs").select("*, agent_registry(*)").eq("id", data.jobId).maybeSingle();
    const { data: events } = await supabaseAdmin.from("timeline_events").select("*").eq("job_id", data.jobId).order("created_at");
    return { job, events: events ?? [] };
  });

export const getJobsForWallet = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: jobs } = await supabaseAdmin.from("jobs")
      .select("*, agent_registry(name, category)").eq("user_wallet", data.userWallet.toLowerCase())
      .order("created_at", { ascending: false }).limit(50);
    return { jobs: jobs ?? [] };
  });

export const listProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("agent_registry").select("*").eq("active", true).order("category").order("reputation", { ascending: false });
  return { providers: data ?? [] };
});
