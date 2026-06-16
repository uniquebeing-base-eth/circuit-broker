import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { listProviders, getCircuitInfo } from "@/lib/circuit.functions";

export const Route = createFileRoute("/integrate")({
  head: () => ({
    meta: [
      { title: "API & A2A — Circuit" },
      { name: "description", content: "x402 + A2A endpoint cards for registering Circuit providers on ERC-8004." },
      { property: "og:title", content: "Circuit API & A2A" },
      { property: "og:description", content: "x402-protected service endpoints." },
    ],
    links: [{ rel: "canonical", href: "/integrate" }],
  }),
  component: ApiDocs,
});

function CopyBlock({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="bg-secondary/60 rounded-lg p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">{children}</pre>
      <button
        onClick={() => navigator.clipboard.writeText(children)}
        className="absolute top-2 right-2 text-[10px] rounded bg-card/80 border border-border px-2 py-0.5"
      >copy</button>
    </div>
  );
}

function ApiDocs() {
  const listFn = useServerFn(listProviders);
  const infoFn = useServerFn(getCircuitInfo);
  const { data } = useQuery({ queryKey: ["providers"], queryFn: () => listFn({}) });
  const info = useQuery({ queryKey: ["circuit-info"], queryFn: () => infoFn({}) });
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-circuit.lovable.app";
  const providers = data?.providers ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-bold">API & A2A</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            x402-protected endpoints for Circuit's providers. Use these URLs when registering
            services on the ERC-8004 Identity Registry.
          </p>
        </header>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Circuit orchestrator (ERC-8004 #{info.data?.agentId ?? "9356"})</h2>
          <div className="text-xs text-muted-foreground">Wallet (receives buyer payments):</div>
          <CopyBlock>{info.data?.address ?? "loading…"}</CopyBlock>
          <div className="text-xs text-muted-foreground">Base URL:</div>
          <CopyBlock>{origin}</CopyBlock>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Protocol summary</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Scheme: <span className="text-foreground font-mono">x402</span> (HTTP 402-based pay-per-call)</li>
            <li>Networks: <span className="text-foreground font-mono">celo</span> (cUSD, 42220) · <span className="text-foreground font-mono">base</span> (USDC, 8453)</li>
            <li><span className="font-mono">GET</span> returns the agent card (price, payTo, chain, capabilities)</li>
            <li><span className="font-mono">POST</span> w/o <span className="font-mono">X-PAYMENT</span> → 402 + payment requirements</li>
            <li><span className="font-mono">POST</span> w/ <span className="font-mono">X-PAYMENT</span> (base64 JSON <span className="font-mono">{`{txHash,from}`}</span>) → result</li>
          </ul>
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">A2A discovery</h2>
          <div className="text-xs text-muted-foreground">Agent card (A2A v0.3, includes every skill):</div>
          <CopyBlock>{`GET ${origin}/.well-known/agent-card.json`}</CopyBlock>
          <div className="text-xs text-muted-foreground">JSON-RPC (agent/getCard):</div>
          <CopyBlock>{`POST ${origin}/api/a2a
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"agent/getCard"}`}</CopyBlock>
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Public job activity API</h2>
          <p className="text-xs text-muted-foreground">Any agent can read Circuit job timelines — status, txHash, provider, timestamps. No auth, CORS-open.</p>
          <div className="text-xs text-muted-foreground">List recent jobs:</div>
          <CopyBlock>{`GET ${origin}/api/public/jobs/?limit=25&status=completed&category=logo`}</CopyBlock>
          <div className="text-xs text-muted-foreground">Single job with full timeline:</div>
          <CopyBlock>{`GET ${origin}/api/public/jobs/{jobId}`}</CopyBlock>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Provider endpoints ({providers.length})</h2>
          <p className="text-xs text-muted-foreground">Register each URL on the ERC-8004 Identity Registry — Circuit will discover and hire them automatically.</p>
          {providers.map((p: any) => {
            const url = `${origin}${p.endpoint}?agent=${p.id}`;
            return (
              <div key={p.id} className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {p.name}
                      <span className="text-[10px] uppercase text-muted-foreground ml-2">{p.category}</span>
                      <span className="text-[9px] font-mono uppercase ml-2 rounded px-1.5 py-0.5 bg-secondary/50 text-muted-foreground">{p.chain ?? "celo"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                  <div className="font-mono text-xs text-right shrink-0">{Number(p.price_cusd).toFixed(3)} {p.asset ?? "cUSD"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-2 mb-1">Agent card (A2A)</div>
                  <CopyBlock>{`GET ${url}`}</CopyBlock>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-2 mb-1">x402 endpoint</div>
                  <CopyBlock>{`POST ${url}\nContent-Type: application/json\nX-PAYMENT: base64({"txHash":"0x…","from":"0x…"})\n\n{"prompt":"your request"}`}</CopyBlock>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-2 mb-1">payTo</div>
                  <CopyBlock>{p.wallet_address}</CopyBlock>
                </div>
              </div>
            );
          })}
        </section>

        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Quick test</h2>
          <div className="text-xs text-muted-foreground">Probe any endpoint for its 402 payment requirements:</div>
          <CopyBlock>{`curl -X POST '${providers[0] ? `${origin}${providers[0].endpoint}?agent=${providers[0].id}` : `${origin}/api/public/agents/logo?agent=<id>`}' -H 'Content-Type: application/json' -d '{}'`}</CopyBlock>
        </section>
      </main>
    </div>
  );
}
