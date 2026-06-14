# Circuit — Build Plan

Autonomous procurement agent on **Celo mainnet**. User → Circuit → provider agents, all settled in **cUSD** with real on-chain transactions.

## Scope (Hackathon MVP)

1. **Frontend (TanStack Start, mobile-first dark UI)**
   - Logo + favicon from uploaded image (lovable-assets)
   - Landing: hero, "what Circuit does", live demo CTA
   - `/procure` — request form (category, prompt, budget in cUSD)
   - **Activity Timeline** — animated live procurement steps (discover → quote → compare → pay → deliver)
   - Wallet connect: **MiniPay** (auto-detect) + **MetaMask** only
   - Spending history + completed jobs view
   - Circuit agent profile page (wallet, balance, ERC-8004 ID 9356, reputation)

2. **Backend (TanStack server functions + server routes)**
   - **`/api/public/agents/logo`**, `/api/public/agents/image`, `/api/public/agents/social` — provider endpoints, each **x402-protected** (return HTTP 402 with payment requirements; verify cUSD transfer; then generate via Lovable AI / image gen)
   - **Circuit orchestrator** (server fn): receives user job, discovers providers (registry + ERC-8004 read), gets quotes, picks best, pays provider in cUSD from agent wallet, returns result
   - **x402 facilitator** logic: build/verify EIP-3009 `transferWithAuthorization` signatures on cUSD
   - **ERC-8004 reads**: identity registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` (viem on Celo mainnet)
   - **ERC-8004 feedback write** after successful jobs (Circuit's wallet submits)
   - **Agent wallet**: viem `WalletClient` from `CIRCUIT_AGENT_PRIVATE_KEY` (server-only, used in handlers, never bundled)

3. **Data (Lovable Cloud / Supabase)**
   - `agent_registry` — provider name, category, price, wallet, endpoint, rep
   - `jobs` — user wallet, prompt, category, budget, status, provider, tx hashes (user→Circuit, Circuit→provider), result URL, timeline events
   - `timeline_events` — per-job step log streamed to UI
   - Seed 3–4 provider agents per category pointing at our own `/api/public/agents/*` (agent-to-agent: Circuit calls these exactly like external x402 APIs)

4. **Payment flow (real cUSD on Celo mainnet)**
   - User pays Circuit: MiniPay/MetaMask sends cUSD to `0xad3e...7233` (we monitor tx + wait for confirmation)
   - Circuit pays provider: server signs cUSD `transfer` from Circuit wallet → provider wallet
   - Fee: kept in Circuit wallet (difference between user payment and provider cost)

## Tech notes
- **viem** for all on-chain (no ethers). `celo` chain from `viem/chains`.
- cUSD: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
- AI: Lovable AI Gateway (`google/gemini-3-flash-preview` for copy, image-preview model for logos/images)
- MiniPay detection: `window.ethereum.isMiniPay`
- Storage: result images → Lovable Cloud storage bucket, return public URL

## Out of scope (MVP)
- TEE attestation, validation registry, zkML
- WalletConnect (per your spec — MiniPay + MetaMask only)
- Multi-provider real bidding (we simulate quotes from seeded registry; payments are real)

## What I need from you to ship
- Confirm: I'll enable **Lovable Cloud** (Supabase under the hood) for DB + storage. OK?
- Confirm: Circuit funds the agent wallet with **CELO for gas + some cUSD float** yourself before demo. I can't fund it.
- Heads-up: real mainnet money. I'll use small defaults (0.01–0.05 cUSD jobs) and add a clear "MAINNET" warning before any tx.

Approve and I'll start building.
