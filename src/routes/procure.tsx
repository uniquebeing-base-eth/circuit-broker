import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { connectWallet, sendCusd, shortAddr, detectProvider } from "@/lib/wallet";
import { createJob, confirmPayment, getJob, getCircuitInfo, getJobsForWallet } from "@/lib/circuit.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Address } from "viem";

export const Route = createFileRoute("/procure")({
  head: () => ({
    meta: [
      { title: "Procure — Circuit" },
      { name: "description", content: "Tell Circuit what you need. It hires, pays, and delivers." },
      { property: "og:title", content: "Procure — Circuit" },
      { property: "og:description", content: "Autonomous procurement on Celo." },
    ],
    links: [{ rel: "canonical", href: "/procure" }],
  }),
  component: Procure,
});

type Category = "logo" | "image" | "social";

function Procure() {
  const [addr, setAddr] = useState<Address | null>(null);
  const [walletKind, setWalletKind] = useState<string>("");
  const [category, setCategory] = useState<Category>("logo");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState(0.05);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createJobFn = useServerFn(createJob);
  const confirmFn = useServerFn(confirmPayment);
  const circuitInfoFn = useServerFn(getCircuitInfo);

  const info = useQuery({ queryKey: ["circuit-info"], queryFn: () => circuitInfoFn({}) });

  useEffect(() => {
    // Auto-connect MiniPay if injected
    const d = detectProvider();
    if (d?.kind === "minipay") {
      connectWallet().then(({ address, kind }) => { setAddr(address); setWalletKind(kind); }).catch(() => {});
    }
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!addr) throw new Error("Connect wallet first");
      if (prompt.trim().length < 3) throw new Error("Describe what you need");
      const job = await createJobFn({ data: { userWallet: addr, category, prompt: prompt.trim(), budgetCusd: budget } });
      const tx = await sendCusd(addr, job.payTo as Address, job.amountCusd);
      setJobId(job.jobId);
      // Fire-and-poll: tell server to verify + orchestrate
      confirmFn({ data: { jobId: job.jobId, txHash: tx } }).catch((e) => setError(e.message || String(e)));
      return job.jobId;
    },
    onError: (e: any) => setError(e?.message ?? String(e)),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Wallet bar */}
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-widest text-muted-foreground uppercase">Your wallet</div>
            <div className="font-mono text-sm">{addr ? `${shortAddr(addr)} · ${walletKind}` : "Not connected"}</div>
          </div>
          {!addr ? (
            <button
              onClick={async () => {
                try { const r = await connectWallet(); setAddr(r.address); setWalletKind(r.kind); }
                catch (e: any) { setError(e?.message ?? String(e)); }
              }}
              className="circuit-gradient text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Connect
            </button>
          ) : (
            <button onClick={() => setAddr(null)} className="rounded-lg border border-border px-3 py-2 text-xs">Disconnect</button>
          )}
        </div>

        {/* Circuit agent card */}
        {info.data && (
          <div className="glass rounded-2xl p-4 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Circuit agent</span><span className="font-mono">#{info.data.agentId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Receives at</span><span className="font-mono">{shortAddr(info.data.address)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Float</span><span className="font-mono">{Number(info.data.cusdBalance).toFixed(3)} cUSD · {info.data.celoBalance} CELO</span></div>
          </div>
        )}

        {!jobId ? (
          <div className="glass rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What do you need?</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["logo","image","social"] as Category[]).map((c) => (
                  <button key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${category===c?"border-circuit bg-circuit/10 text-foreground":"border-border bg-secondary/40 text-muted-foreground"}`}
                  >{c==="social"?"Social copy":c}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Describe it</label>
              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                placeholder={category==="logo"?"A logo for 'Lume' — a sleep coaching app. Minimal, lunar.":category==="image"?"Hero image: cozy coffee shop, morning light, warm tones.":"A punchy tweet announcing our seed round."}
                className="mt-2 w-full rounded-lg bg-input/60 border border-border p-3 text-sm focus:outline-none focus:border-circuit"
                maxLength={500}
              />
            </div>

            <div>
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Budget (cUSD)</label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range" min={0.01} max={0.1} step={0.005}
                  value={budget} onChange={(e) => setBudget(parseFloat(e.target.value))}
                  className="flex-1 accent-[oklch(0.82_0.16_195)]"
                />
                <span className="font-mono text-sm w-20 text-right">{budget.toFixed(3)}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Real cUSD on Celo mainnet. You pay Circuit; Circuit pays the provider.</div>
            </div>

            {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

            <button
              disabled={!addr || submit.isPending}
              onClick={() => submit.mutate()}
              className="w-full circuit-gradient text-primary-foreground rounded-lg py-3 text-sm font-semibold glow disabled:opacity-40"
            >
              {submit.isPending ? "Sending payment…" : addr ? `Hire Circuit · ${budget.toFixed(3)} cUSD` : "Connect wallet to continue"}
            </button>
          </div>
        ) : (
          <JobView jobId={jobId} onReset={() => { setJobId(null); setPrompt(""); }} />
        )}

        {addr && <RecentJobs wallet={addr} />}
      </main>
    </div>
  );
}

function JobView({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const getJobFn = useServerFn(getJob);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJobFn({ data: { jobId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.job?.status;
      return s === "completed" || s === "failed" ? false : 1500;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timeline_events", filter: `job_id=eq.${jobId}` }, () => {
        qc.invalidateQueries({ queryKey: ["job", jobId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` }, () => {
        qc.invalidateQueries({ queryKey: ["job", jobId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId, qc]);

  const job = data?.job;
  const events = data?.events ?? [];

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-widest text-muted-foreground uppercase">Job</div>
            <div className="font-mono text-xs">{jobId.slice(0, 8)}…</div>
          </div>
          <StatusPill status={job?.status} />
        </div>
        <div className="mt-3 text-sm">{job?.prompt}</div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Activity</div>
        <ol className="space-y-3">
          {events.map((e: any) => (
            <li key={e.id} className="flex gap-3">
              <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${e.status==="error"?"bg-destructive":e.status==="running"?"bg-warning animate-pulse":"bg-success"}`} />
              <div className="flex-1">
                <div className="text-sm">{e.message}</div>
                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{e.step} · {new Date(e.created_at).toLocaleTimeString()}</div>
                {e.metadata?.txHash && (
                  <a href={`https://celoscan.io/tx/${e.metadata.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-circuit underline font-mono">↗ {e.metadata.txHash.slice(0,10)}…</a>
                )}
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="text-xs text-muted-foreground">Waiting…</li>}
        </ol>
      </div>

      {job?.status === "completed" && (
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Delivered</div>
          {job.result_url && <img src={job.result_url} alt="Result" className="w-full rounded-lg border border-border" />}
          {job.result_text && <p className="whitespace-pre-wrap text-sm">{job.result_text}</p>}
          <button onClick={onReset} className="mt-4 w-full circuit-gradient text-primary-foreground rounded-lg py-2 text-sm font-semibold">New request</button>
        </div>
      )}

      {job?.status === "failed" && (
        <div className="glass rounded-2xl p-5 border-destructive/40">
          <div className="text-sm text-destructive">{job.error || "Something failed."}</div>
          <button onClick={onReset} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs">Try again</button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const color = status === "completed" ? "bg-success/20 text-success" : status === "failed" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${color}`}>{status.replace(/_/g, " ")}</span>;
}

function RecentJobs({ wallet }: { wallet: Address }) {
  const fn = useServerFn(getJobsForWallet);
  const { data } = useQuery({ queryKey: ["jobs", wallet], queryFn: () => fn({ data: { userWallet: wallet } }), refetchInterval: 5000 });
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  if (jobs.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Recent jobs</div>
      <ul className="space-y-2">
        {jobs.slice(0, 6).map((j: any) => (
          <li key={j.id} className="flex items-center justify-between text-xs">
            <div className="truncate flex-1 mr-2">
              <span className="text-muted-foreground capitalize mr-2">{j.category}</span>
              {j.prompt.slice(0, 50)}
            </div>
            <StatusPill status={j.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
