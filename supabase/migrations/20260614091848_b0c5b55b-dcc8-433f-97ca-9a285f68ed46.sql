
-- Agent registry: providers Circuit can hire
CREATE TYPE public.service_category AS ENUM ('logo', 'image', 'social');

CREATE TABLE public.agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category service_category NOT NULL,
  price_cusd NUMERIC(20, 6) NOT NULL,
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  reputation NUMERIC(3, 1) NOT NULL DEFAULT 4.5,
  avg_delivery_ms INT NOT NULL DEFAULT 8000,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_registry TO anon, authenticated;
GRANT ALL ON public.agent_registry TO service_role;
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active agents" ON public.agent_registry FOR SELECT USING (active = true);

-- Jobs: procurement requests
CREATE TYPE public.job_status AS ENUM (
  'awaiting_payment', 'payment_received', 'discovering', 'paying_provider',
  'provider_working', 'completed', 'failed'
);

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  category service_category NOT NULL,
  prompt TEXT NOT NULL,
  budget_cusd NUMERIC(20, 6) NOT NULL,
  user_pay_amount_cusd NUMERIC(20, 6) NOT NULL,
  user_tx_hash TEXT,
  selected_agent_id UUID REFERENCES public.agent_registry(id),
  provider_pay_amount_cusd NUMERIC(20, 6),
  provider_tx_hash TEXT,
  circuit_fee_cusd NUMERIC(20, 6),
  result_url TEXT,
  result_text TEXT,
  status job_status NOT NULL DEFAULT 'awaiting_payment',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jobs_user_wallet_idx ON public.jobs (lower(user_wallet), created_at DESC);

GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read jobs" ON public.jobs FOR SELECT USING (true);

-- Timeline events for live procurement display
CREATE TABLE public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'done',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX timeline_events_job_idx ON public.timeline_events (job_id, created_at);

GRANT SELECT ON public.timeline_events TO anon, authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read timeline" ON public.timeline_events FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Seed providers. Wallets are well-known Hardhat test addresses (indexes 1-9 of
-- the standard "test test ... junk" mnemonic) — used as receive-only addresses
-- so cUSD payments are real on-chain transfers visible on Celoscan.
INSERT INTO public.agent_registry (name, description, category, price_cusd, wallet_address, endpoint, reputation, avg_delivery_ms) VALUES
  ('LogoForge',     'Premium AI logo studio',          'logo',   0.025, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '/api/public/agents/logo',   4.8, 7000),
  ('MarkMint',      'Minimalist logo specialist',      'logo',   0.018, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', '/api/public/agents/logo',   4.6, 9000),
  ('BrandBolt',     'Fast budget logo agent',          'logo',   0.012, '0x90F79bf6EB2c4f870365E785982E1f101E93b906', '/api/public/agents/logo',   4.3, 5000),
  ('PixelForge',    'High-fidelity marketing images',  'image',  0.022, '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', '/api/public/agents/image',  4.7, 8000),
  ('ImageWave',     'Social-ready visuals',            'image',  0.015, '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', '/api/public/agents/image',  4.4, 6500),
  ('VisualMint',    'Budget product visuals',          'image',  0.010, '0x976EA74026E726554dB657fA54763abd0C3a0aa9', '/api/public/agents/image',  4.2, 5500),
  ('CopyCraft',     'Top-tier social copy & threads',  'social', 0.008, '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', '/api/public/agents/social', 4.9, 4000),
  ('TweetSmith',    'Punchy tweets and captions',      'social', 0.005, '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', '/api/public/agents/social', 4.5, 3000),
  ('WordWell',      'Budget copy generator',           'social', 0.003, '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', '/api/public/agents/social', 4.0, 2500);
