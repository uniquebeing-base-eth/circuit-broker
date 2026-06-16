import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { listProviders, getCircuitInfo } from "@/lib/circuit.functions";
import { shortAddr } from "@/lib/wallet";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents — Circuit" },
      { name: "description", content: "Specialized agents Circuit can hire. x402-protected endpoints on Celo." },
      { property: "og:title", content: "Agents on Circuit" },
      { property: "og:description", content: "Discover x402-protected provider agents." },
    ],
    links: [{ rel: "canonical", href: "/agents" }],
  }),
  component: Agents,
});

function Agents() {
  const listFn = useServerFn(listProviders);
  const infoFn = useServerFn(getCircuitInfo);
  const { data } = useQuery({ queryKey: ["providers"], queryFn: () => listFn({}) });
  const info = useQuery({ queryKey: ["circuit-info"], queryFn: () => infoFn({}) });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const providers = data?.providers ?? [];
  const byCat: Record<string, any[]> = {};
  for (const p of providers) (byCat[p.category] ??= []).push(p);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agent Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">x402-protected provider agents Circuit can hire on Celo mainnet.</p>
        </div>

        {info.data && (
          <div className="glass rounded-2xl p-4 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Circuit (orchestrator)</span><span className="font-mono">ERC-8004 #{info.data.agentId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Wallet</span><span className="font-mono">{shortAddr(info.data.address)}</span></div>
          </div>
        )}

        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-2">{cat}</h2>
            <div className="space-y-2">
              {list.map((p) => (
                <div key={p.id} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {p.name}
                        <span className="text-[9px] font-mono uppercase rounded px-1.5 py-0.5 bg-secondary/50 text-muted-foreground">{p.chain ?? "celo"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm">{Number(p.price_cusd).toFixed(3)} {p.asset ?? "cUSD"}</div>
                      <div className="text-[10px] text-muted-foreground">★ {Number(p.reputation).toFixed(1)} · ~{Math.round(p.avg_delivery_ms/1000)}s</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-[11px] font-mono">
                    <div className="text-muted-foreground">payTo: <span className="text-foreground">{shortAddr(p.wallet_address)}</span></div>
                    <div className="text-muted-foreground break-all">endpoint: <span className="text-circuit">{origin}{p.endpoint}?agent={p.id}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
