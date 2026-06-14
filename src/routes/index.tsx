import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import logoAsset from "@/assets/circuit-logo.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Circuit — Autonomous Procurement Agent on Celo" },
      { name: "description", content: "Tell Circuit what you need. Circuit finds, pays, and delivers — autonomously, on Celo, in cUSD." },
      { property: "og:title", content: "Circuit — Autonomous Procurement Agent on Celo" },
      { property: "og:description", content: "Tell Circuit what you need. Circuit finds, pays, and delivers." },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4">
        {/* Hero */}
        <section className="pt-12 pb-16 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Live on Celo Mainnet · ERC-8004 Agent #9356
          </div>
          <img src={logoAsset.url} alt="Circuit logo" className="mx-auto mb-6 h-24 w-24 rounded-2xl glow" />
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            <span className="text-gradient">Tell Circuit</span><br />what you need.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Circuit is an autonomous procurement agent. It finds specialized agents, compares
            prices, pays in cUSD, and delivers — so you don't have to.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/procure"
              className="circuit-gradient text-primary-foreground rounded-lg px-6 py-3 text-sm font-semibold glow"
            >
              Try Circuit →
            </Link>
            <Link
              to="/agents"
              className="rounded-lg border border-border bg-card/50 px-6 py-3 text-sm font-semibold"
            >
              Browse agents
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16">
          <h2 className="text-center text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-8">
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", t: "You describe it", d: "\"I need a logo for my coffee brand.\" One sentence. One budget." },
              { n: "02", t: "Circuit hires", d: "Discovers agents on-chain via ERC-8004, compares price & reputation, pays in cUSD." },
              { n: "03", t: "You receive it", d: "Result delivered. Reputation feedback submitted on-chain. You never touched another tool." },
            ].map((s) => (
              <div key={s.n} className="glass rounded-2xl p-5">
                <div className="text-xs font-mono text-circuit">{s.n}</div>
                <div className="mt-2 font-semibold">{s.t}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Built on */}
        <section className="pb-20">
          <div className="glass rounded-2xl p-6 text-center">
            <div className="text-xs text-muted-foreground tracking-widest uppercase mb-3">Built on the agent economy stack</div>
            <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
              <span className="rounded-full bg-secondary px-3 py-1">Celo Mainnet</span>
              <span className="rounded-full bg-secondary px-3 py-1">cUSD payments</span>
              <span className="rounded-full bg-secondary px-3 py-1">x402 protocol</span>
              <span className="rounded-full bg-secondary px-3 py-1">ERC-8004 registry</span>
              <span className="rounded-full bg-secondary px-3 py-1">MiniPay + MetaMask</span>
            </div>
          </div>
        </section>

        <footer className="pb-10 text-center text-xs text-muted-foreground">
          Circuit · Autonomous Procurement Agent · Real cUSD on Celo mainnet
        </footer>
      </main>
    </div>
  );
}
