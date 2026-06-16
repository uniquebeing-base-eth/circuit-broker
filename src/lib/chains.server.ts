// Multi-chain helpers: Celo (cUSD) and Base (USDC). Server-only.
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, base } from "viem/chains";

export type ChainKey = "celo" | "base";

export const CHAIN_CONFIG = {
  celo: {
    chain: celo,
    rpc: "https://forno.celo.org",
    asset: "cUSD",
    assetAddress: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
    decimals: 18,
    explorer: "https://celoscan.io",
    chainId: 42220,
  },
  base: {
    chain: base,
    rpc: "https://mainnet.base.org",
    asset: "USDC",
    assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
    decimals: 6,
    explorer: "https://basescan.org",
    chainId: 8453,
  },
} as const;

export function getChainConfig(key: string) {
  const k = (key in CHAIN_CONFIG ? key : "celo") as ChainKey;
  return CHAIN_CONFIG[k];
}

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

function getCircuitAccount() {
  const key = process.env.CIRCUIT_AGENT_PRIVATE_KEY;
  if (!key) throw new Error("CIRCUIT_AGENT_PRIVATE_KEY missing");
  const normalized = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  return privateKeyToAccount(normalized);
}

export function getCircuitAddress(): Address {
  return getCircuitAccount().address;
}

export function publicClientFor(chainKey: string) {
  const cfg = getChainConfig(chainKey);
  return createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
}

export function walletClientFor(chainKey: string) {
  const cfg = getChainConfig(chainKey);
  return createWalletClient({ account: getCircuitAccount(), chain: cfg.chain, transport: http(cfg.rpc) });
}

export function toAssetUnits(chainKey: string, amount: number | string): bigint {
  return parseUnits(String(amount), getChainConfig(chainKey).decimals);
}
export function fromAssetUnits(chainKey: string, units: bigint): string {
  return formatUnits(units, getChainConfig(chainKey).decimals);
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function verifyAssetPayment(opts: {
  chainKey: string; txHash: Hex; expectedFrom: Address; expectedTo: Address; minAmount: bigint;
}): Promise<{ ok: boolean; actualAmount: bigint; reason?: string }> {
  try {
    const cfg = getChainConfig(opts.chainKey);
    const client = publicClientFor(opts.chainKey);
    const receipt = await client.waitForTransactionReceipt({ hash: opts.txHash, timeout: 120_000 });
    if (receipt.status !== "success") return { ok: false, actualAmount: 0n, reason: "tx_reverted" };
    const from = getAddress(opts.expectedFrom);
    const to = getAddress(opts.expectedTo);
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== getAddress(cfg.assetAddress)) continue;
      if (log.topics[0] !== TRANSFER_TOPIC) continue;
      const logFrom = getAddress(`0x${log.topics[1]!.slice(26)}`);
      const logTo = getAddress(`0x${log.topics[2]!.slice(26)}`);
      if (logFrom !== from || logTo !== to) continue;
      const amount = BigInt(log.data);
      if (amount >= opts.minAmount) return { ok: true, actualAmount: amount };
      return { ok: false, actualAmount: amount, reason: "amount_too_low" };
    }
    return { ok: false, actualAmount: 0n, reason: "no_matching_transfer" };
  } catch (e) {
    return { ok: false, actualAmount: 0n, reason: e instanceof Error ? e.message : "verify_failed" };
  }
}

export async function circuitSendAsset(chainKey: string, to: Address, amount: bigint): Promise<Hex> {
  const cfg = getChainConfig(chainKey);
  const wallet = walletClientFor(chainKey);
  const client = publicClientFor(chainKey);
  const hash = await wallet.writeContract({
    address: cfg.assetAddress, abi: ERC20_ABI, functionName: "transfer", args: [to, amount],
  });
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}

export async function getAssetBalance(chainKey: string, addr: Address): Promise<bigint> {
  const cfg = getChainConfig(chainKey);
  return publicClientFor(chainKey).readContract({
    address: cfg.assetAddress, abi: ERC20_ABI, functionName: "balanceOf", args: [addr],
  });
}

export function explorerTx(chainKey: string, hash: string) {
  return `${getChainConfig(chainKey).explorer}/tx/${hash}`;
}
