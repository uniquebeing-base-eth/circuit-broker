
-- Switch from enum to text for both tables so we can add categories freely
ALTER TABLE public.agent_registry ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.jobs ALTER COLUMN category TYPE text USING category::text;
DROP TYPE IF EXISTS public.service_category;

-- Multi-chain support
ALTER TABLE public.agent_registry
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'celo',
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'cUSD';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'celo',
  ADD COLUMN IF NOT EXISTS asset text NOT NULL DEFAULT 'cUSD';
