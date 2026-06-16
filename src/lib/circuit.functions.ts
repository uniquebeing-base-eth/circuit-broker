// Circuit orchestrator: chain-aware procurement loop (Celo + Base).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

const CreateJobSchema = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  category: z.string().min(2).max(40),
  prompt: z.string().min(3).max(2000),
  budgetCusd: z.number().positive().max(1),
  preferredChain: z.enum(["celo", "base"]).optional(),
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
  const { getCircuitAddress, getAssetBalance, fromAssetUnits, publicClientFor } = await import("@/lib/chains.server");
  const { CIRCUIT_AGENT_ID } = await import("@/lib/celo.server");
  const addr = getCircuitAddress();
  const balances: Record<string, { asset: string; balance: string; native: string }> = {};
  for (const chain of ["celo", "base"] as const) {
    try {
      const bal = await getAssetBalance(chain, addr);
      const native = await publicClientFor(chain).getBalance({ address: addr });
      balances[chain] = {
        asset: chain === "celo" ? "cUSD" : "USDC",
        balance: fromAssetUnits(chain, bal),
        native: (Number(native) / 1e18).toFixed(4),
      };
    } catch {
      balances[chain] = { asset: chain === "celo" ? "cUSD" : "USDC", balance: "0", native: "0" };
    }
  }
  return {
    address: addr,
    agentId: CIRCUIT_AGENT_ID.toString(),
    chains: balances,
    // backward-compat fields for existing UI
    cusdBalance: balances.celo.balance,
    celoBalance: balances.celo.native,
  };
});

export const createJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateJobSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCircuitAddress } = await import("@/lib/chains.server");

    let query = supabaseAdmin.from("agent_registry").select("*")
      .eq("category", data.category).eq("active", true)
      .lte("price_cusd", data.budgetCusd);
    if (data.preferredChain) query = query.eq("chain", data.preferredChain);
    const { data: agents, error: agentsErr } = await query
      .order("reputation", { ascending: false }).order("price_cusd", { ascending: true });
    if (agentsErr) throw new Error(agentsErr.message);
    if (!agents || agents.length === 0) throw new Error("No providers available within budget. Try a higher budget or a different category.");

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
      chain: provider.chain,
      asset: provider.asset,
    }).select("*").single();
    if (error) throw new Error(error.message);

    await logEvent(job.id, "created", `Job created on ${provider.chain.toUpperCase()}. Requesting ${userPay.toFixed(4)} ${provider.asset} from buyer.`);

    return {
      jobId: job.id as string,
      payTo: getCircuitAddress(),
      amountCusd: userPay,
      chain: provider.chain,
      asset: provider.asset,
      providerPreview: { name: provider.name, price: providerPrice, reputation: Number(provider.reputation), chain: provider.chain },
    };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmPaymentSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const {
      getCircuitAddress, verifyAssetPayment, toAssetUnits, circuitSendAsset, fromAssetUnits,
    } = await import("@/lib/chains.server");
    const { REPUTATION_ABI, ERC8004_REPUTATION, getCircuitWalletClient, publicClient, CIRCUIT_AGENT_ID } = await import("@/lib/celo.server");

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (jobErr || !job) throw new Error("Job not found");
    if (job.status !== "awaiting_payment") return { ok: true, alreadyRunning: true };

    const chain = job.chain || "celo";
    const asset = job.asset || "cUSD";

    await setJob(job.id, { user_tx_hash: data.txHash });

    await logEvent(job.id, "payment", `Verifying buyer payment on ${chain.toUpperCase()}…`, "running");
    const verify = await verifyAssetPayment({
      chainKey: chain,
      txHash: data.txHash as Hex,
      expectedFrom: getAddress(job.user_wallet) as Address,
      expectedTo: getCircuitAddress(),
      minAmount: toAssetUnits(chain, Number(job.user_pay_amount_cusd)),
    });
    if (!verify.ok) {
      await setJob(job.id, { status: "failed", error: `payment_invalid: ${verify.reason}` });
      await logEvent(job.id, "payment", `Payment verification failed: ${verify.reason}`, "error");
      throw new Error(`Payment verification failed: ${verify.reason}`);
    }
    await setJob(job.id, { status: "payment_received" });
    await logEvent(job.id, "payment", `✓ Received ${fromAssetUnits(chain, verify.actualAmount)} ${asset} from buyer`, "done", { txHash: data.txHash });

    // 2. Discovery — restrict to providers on the same chain as the buyer paid.
    await setJob(job.id, { status: "discovering" });
    await logEvent(job.id, "discover", `Discovering ${job.category} agents on ${chain.toUpperCase()}…`, "running");
    const { data: agents } = await supabaseAdmin
      .from("agent_registry").select("*")
      .eq("category", job.category).eq("active", true).eq("chain", chain)
      .lte("price_cusd", Number(job.budget_cusd))
      .order("reputation", { ascending: false }).order("price_cusd", { ascending: true });
    if (!agents || agents.length === 0) {
      await setJob(job.id, { status: "failed", error: "no_providers" });
      throw new Error("No providers");
    }
    await logEvent(job.id, "discover", `✓ ${agents.length} providers discovered on ${chain.toUpperCase()}`, "done", {
      providers: agents.map((a) => ({ name: a.name, price: Number(a.price_cusd), reputation: Number(a.reputation), chain: a.chain })),
    });

    await logEvent(job.id, "compare", "Comparing price, reputation, delivery time…", "running");
    const chosen = agents[0];
    await logEvent(job.id, "compare", `✓ Best value: ${chosen.name} @ ${Number(chosen.price_cusd).toFixed(3)} ${asset} (★${Number(chosen.reputation).toFixed(1)})`, "done");
    await setJob(job.id, { selected_agent_id: chosen.id, provider_pay_amount_cusd: Number(chosen.price_cusd) });

    await setJob(job.id, { status: "paying_provider" });
    const origin = new URL(getRequest().url).origin;
    const providerUrl = `${origin}${chosen.endpoint}?agent=${chosen.id}`;
    await logEvent(job.id, "quote", `Requesting x402 quote from ${chosen.name}…`, "running");
    const probe = await fetch(providerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (probe.status !== 402) {
      await setJob(job.id, { status: "failed", error: `unexpected_probe_status_${probe.status}` });
      throw new Error("Provider didn't return 402");
    }
    const reqs = await probe.json();
    const accept = reqs.accepts?.[0];
    await logEvent(job.id, "quote", `✓ ${chosen.name} requires ${fromAssetUnits(chain, BigInt(accept.maxAmountRequired))} ${asset} via x402`, "done");

    await logEvent(job.id, "pay_provider", `Paying ${chosen.name} ${Number(chosen.price_cusd).toFixed(3)} ${asset} on ${chain.toUpperCase()}…`, "running");
    let providerTx: Hex;
    try {
      providerTx = await circuitSendAsset(chain, chosen.wallet_address as Address, BigInt(accept.maxAmountRequired));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setJob(job.id, { status: "failed", error: `pay_failed: ${msg}` });
      await logEvent(job.id, "pay_provider", `Payment to provider failed: ${msg}`, "error");
      throw e;
    }
    await setJob(job.id, { provider_tx_hash: providerTx, circuit_fee_cusd: Number(job.user_pay_amount_cusd) - Number(chosen.price_cusd) });
    await logEvent(job.id, "pay_provider", `✓ Paid ${chosen.name}`, "done", { txHash: providerTx });

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

    // ERC-8004 reputation feedback (Celo registry, best-effort).
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
  const { data } = await supabaseAdmin.from("agent_registry").select("*").eq("active", true)
    .order("category").order("reputation", { ascending: false });
  return { providers: data ?? [] };
});

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("agent_registry").select("category, chain, price_cusd").eq("active", true);
  const map = new Map<string, { category: string; chains: Set<string>; minPrice: number; count: number }>();
  for (const row of data ?? []) {
    const cur = map.get(row.category) ?? { category: row.category, chains: new Set<string>(), minPrice: Infinity, count: 0 };
    cur.chains.add(row.chain);
    cur.minPrice = Math.min(cur.minPrice, Number(row.price_cusd));
    cur.count += 1;
    map.set(row.category, cur);
  }
  return {
    categories: Array.from(map.values()).map((c) => ({
      category: c.category, chains: Array.from(c.chains), minPrice: c.minPrice, count: c.count,
    })).sort((a, b) => a.category.localeCompare(b.category)),
  };
});
