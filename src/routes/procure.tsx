import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { connectWallet, sendCusd, shortAddr, detectProvider } from "@/lib/wallet";
import { createJob, confirmPayment, getJob, getCircuitInfo, getJobsForWallet, listCategories } from "@/lib/circuit.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Copy, Check, Share2 } from "lucide-react";
import { downloadFile, copyText, shareText } from "@/lib/share";
import type { Address } from "viem";

export const Route = createFileRoute("/procure")({
  head: () => ({
    meta: [
      { title: "Procure — Circuit" },
      { name: "description", content: "Tell Circuit what you need. It hires, pays, and delivers." },
      { property: "og:title", content: "Procure — Circuit" },
      { property: "og:description", content: "Autonomous procurement on Celo & Base." },
    ],
    links: [{ rel: "canonical", href: "/procure" }],
  }),
  component: Procure,
});

const CATEGORY_LABELS: Record<string, string> = {
  logo: "Logo", image: "Image", social: "Social", resume: "Resume/CV",
  portfolio: "Portfolio", website: "Website", pitch: "Pitch deck",
  business_plan: "Business plan", video_script: "Video script",
  palette: "Brand palette", naming: "Brand naming", blog: "Blog post",
  product_copy: "Product copy", email: "Cold email",
};
function labelFor(c: string) { return CATEGORY_LABELS[c] ?? c.replace(/_/g, " "); }

const PLACEHOLDERS: Record<string, string> = {
  logo: "A logo for 'Lume' — a sleep coaching app. Minimal, lunar.",
  image: "Hero image: cozy coffee shop, morning light, warm tones.",
  social: "A punchy tweet announcing our seed round.",
  resume: "Senior product designer, 7 years, fintech + healthtech, looking for staff-level roles.",
  portfolio: "Web3 designer who shipped Aave & Uniswap concepts. 3 case studies.",
  website: "A landing page for a meal-planning app called Plate. Free tier + Pro.",
  pitch: "AI scheduling assistant for indie founders. $4M ask, B2B SaaS.",
  business_plan: "Local coffee roaster expanding to wholesale across 3 cities.",
  video_script: "30s TikTok hook: 'I made $10k in 30 days with this AI tool.'",
  palette: "Brand palette for a calm, premium meditation app.",
  naming: "Brand names for an on-chain identity company. Short, evocative.",
  blog: "Blog post: 'How x402 and Celo unlock micro-payments for AI agents.'",
  product_copy: "Wireless noise-cancelling headphones, 40h battery, USB-C.",
  email: "Cold email to a CTO pitching our error-tracking SaaS.",
};

function Procure() {
  const [addr, setAddr] = useState<Address | null>(null);
  const [walletKind, setWalletKind] = useState<string>("");
  const [category, setCategory] = useState<string>("logo");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState(0.05);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createJobFn = useServerFn(createJob);
  const confirmFn = useServerFn(confirmPayment);
  const circuitInfoFn = useServerFn(getCircuitInfo);
  const catsFn = useServerFn(listCategories);

  const info = useQuery({ queryKey: ["circuit-info"], queryFn: () => circuitInfoFn({}) });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => catsFn({}) });

  useEffect(() => {
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
      if (job.chain !== "celo") {
        // Buyer always pays in cUSD on Celo today; if provider lives on Base, Circuit fronts the swap-equivalent.
      }
      const tx = await sendCusd(addr, job.payTo as Address, job.amountCusd);
      setJobId(job.jobId);
      confirmFn({ data: { jobId: job.jobId, txHash: tx } }).catch((e) => setError(e.message || String(e)));
      return job.jobId;
    },
    onError: (e: any) => setError(e?.message ?? String(e)),
  });

  const categories = cats.data?.categories ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
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

        {info.data && (
          <div className="glass rounded-2xl p-4 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Circuit agent</span><span className="font-mono">ERC-8004 #{info.data.agentId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Wallet</span><span className="font-mono">{shortAddr(info.data.address)}</span></div>
            {info.data.chains && Object.entries(info.data.chains).map(([c, b]: any) => (
              <div key={c} className="flex justify-between"><span className="text-muted-foreground uppercase">{c}</span><span className="font-mono">{Number(b.balance).toFixed(3)} {b.asset}</span></div>
            ))}
          </div>
        )}

        {!jobId ? (
          <div className="glass rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What do you need?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.length === 0 && <div className="text-xs text-muted-foreground">Loading services…</div>}
                {categories.map((c: any) => (
                  <button
                    key={c.category}
                    onClick={() => setCategory(c.category)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${category===c.category?"border-circuit bg-circuit/10 text-foreground":"border-border bg-secondary/40 text-muted-foreground"}`}
                  >
                    {labelFor(c.category)}
                    <span className="ml-1.5 text-[9px] opacity-60">{c.chains.join("+")}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Describe it</label>
              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                placeholder={PLACEHOLDERS[category] ?? `Describe your ${labelFor(category)} request…`}
                className="mt-2 w-full rounded-lg bg-input/60 border border-border p-3 text-sm focus:outline-none focus:border-circuit"
                maxLength={2000}
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
              <div className="mt-1 text-[11px] text-muted-foreground">Real cUSD on Celo. Circuit pays the provider on their chain (Celo or Base).</div>
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

        {addr && <RecentJobs wallet={addr} onOpen={(id) => setJobId(id)} />}
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

  const job: any = data?.job;
  const events: any[] = data?.events ?? [];
  const explorerBase = (job?.chain ?? "celo") === "base" ? "https://basescan.org/tx/" : "https://celoscan.io/tx/";

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-widest text-muted-foreground uppercase">Job</div>
            <div className="font-mono text-xs">{jobId.slice(0, 8)}…</div>
          </div>
          <div className="flex items-center gap-2">
            {job?.chain && <span className="text-[9px] font-mono uppercase rounded px-1.5 py-0.5 bg-secondary/50 text-muted-foreground">{job.chain}</span>}
            <StatusPill status={job?.status} />
          </div>
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
                  <a href={`${explorerBase}${e.metadata.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-circuit underline font-mono">↗ {e.metadata.txHash.slice(0,10)}…</a>
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
          {job.result_url && <DeliveredImage url={job.result_url} category={job.category} jobId={jobId} events={events} explorerBase={explorerBase} />}
          {job.result_text && <DeliveredText text={job.result_text} />}
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

function RecentJobs({ wallet, onOpen }: { wallet: Address; onOpen: (id: string) => void }) {
  const fn = useServerFn(getJobsForWallet);
  const { data } = useQuery({ queryKey: ["jobs", wallet], queryFn: () => fn({ data: { userWallet: wallet } }), refetchInterval: 5000 });
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  if (jobs.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Recent jobs</div>
      <ul className="space-y-2">
        {jobs.slice(0, 8).map((j: any) => (
          <li key={j.id}>
            <button
              onClick={() => onOpen(j.id)}
              className="w-full flex items-center justify-between text-xs rounded-lg px-2 py-2 hover:bg-secondary/40 transition text-left gap-2"
            >
              <div className="truncate flex-1 mr-2">
                <span className="text-muted-foreground capitalize mr-2">{j.category}</span>
                {j.prompt.slice(0, 50)}
              </div>
              <StatusPill status={j.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveredImage({ url, category, jobId, events, explorerBase }: { url: string; category: string; jobId: string; events: any[]; explorerBase: string }) {
  const [open, setOpen] = useState(false);
  const filename = `circuit-${category}-${jobId.slice(0, 8)}.png`;
  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full">
        <img src={url} alt="Result" className="w-full rounded-lg border border-border hover:opacity-90 transition cursor-zoom-in" />
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => downloadFile(url, filename)}
          className="circuit-gradient text-primary-foreground rounded-lg py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"
        >
          <Download className="h-3.5 w-3.5" /> Save image
        </button>
        <button onClick={() => setOpen(true)} className="rounded-lg border border-border py-2 text-xs font-semibold">
          View activity
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">On iPhone, tap Save image → use the share sheet, or long-press the image to save.</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle className="text-sm">Delivery & activity</DialogTitle>
          </DialogHeader>
          <img src={url} alt="Result" className="w-full rounded-lg border border-border" />
          <button
            onClick={() => downloadFile(url, filename)}
            className="w-full circuit-gradient text-primary-foreground rounded-lg py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            <Download className="h-3.5 w-3.5" /> Save image
          </button>
          <div>
            <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2">Full activity</div>
            <ol className="space-y-2">
              {events.map((e: any) => (
                <li key={e.id} className="text-xs">
                  <div className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">{e.step} · {new Date(e.created_at).toLocaleTimeString()}</div>
                  <div>{e.message}</div>
                  {e.metadata?.txHash && (
                    <a href={`${explorerBase}${e.metadata.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-circuit underline font-mono">↗ {e.metadata.txHash.slice(0, 14)}…</a>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeliveredText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap break-words text-sm rounded-lg border border-border bg-secondary/30 p-3 font-sans">{text}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copy}
          className="circuit-gradient text-primary-foreground rounded-lg py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"
        >
          {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
        <button
          onClick={() => shareText(text)}
          className="rounded-lg border border-border py-2 text-xs font-semibold inline-flex items-center justify-center gap-2"
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
    </div>
  );
}
