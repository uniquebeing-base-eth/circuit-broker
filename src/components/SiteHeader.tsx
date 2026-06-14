import { Link } from "@tanstack/react-router";
import logoAsset from "../assets/circuit-logo.asset.json";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Circuit" className="h-8 w-8 rounded-lg" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">CIRCUIT</div>
            <div className="text-[10px] text-muted-foreground">on Celo · cUSD</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          <Link to="/procure" className="rounded-md px-3 py-1.5 hover:bg-secondary transition" activeProps={{ className: "bg-secondary" }}>
            Procure
          </Link>
          <Link to="/agents" className="rounded-md px-3 py-1.5 hover:bg-secondary transition" activeProps={{ className: "bg-secondary" }}>
            Agents
          </Link>
          <Link to="/api" className="rounded-md px-3 py-1.5 hover:bg-secondary transition" activeProps={{ className: "bg-secondary" }}>
            API
          </Link>
        </nav>
      </div>
    </header>
  );
}
