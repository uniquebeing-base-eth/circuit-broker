// Server-only Celo / cUSD / ERC-8004 helpers. Do NOT import from client code.
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

export const CUSD_ADDRESS: Address = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
export const CUSD_DECIMALS = 18;

export const ERC8004_IDENTITY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
export const ERC8004_REPUTATION: Address = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";
export const CIRCUIT_AGENT_ID = 9356n;

export const CELO_RPC = "https://forno.celo.org";

export const publicClient = createPublicClient({ chain: celo, transport: http(CELO_RPC) });

function getCircuitAccount() {
  const key = process.env.CIRCUIT_AGENT_PRIVATE_KEY;
  if (!key) throw new Error("CIRCUIT_AGENT_PRIVATE_KEY missing");
  const normalized = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  return privateKeyToAccount(normalized);
}

export function getCircuitWalletClient() {
  return createWalletClient({ account: getCircuitAccount(), chain: celo, transport: http(CELO_RPC) });
}

export function getCircuitAddress(): Address {
  return getCircuitAccount().address;
}

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "event", name: "Transfer", inputs: [{ indexed: true, name: "from", type: "address" }, { indexed: true, name: "to", type: "address" }, { indexed: false, name: "value", type: "uint256" }] },
] as const;

export const IDENTITY_ABI = [
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export const REPUTATION_ABI = [
  {
    type: "function", name: "getSummary", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }, { name: "tag", type: "string" }],
    outputs: [{ name: "count", type: "uint256" }, { name: "avgScore", type: "uint256" }],
  },
  {
    type: "function", name: "giveFeedback", stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" }, { name: "score", type: "uint8" },
      { name: "tag1", type: "string" }, { name: "tag2", type: "string" },
      { name: "fileuri", type: "string" }, { name: "filehash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export function toCusdUnits(amount: number | string): bigint {
  return parseUnits(String(amount), CUSD_DECIMALS);
}
export function fromCusdUnits(units: bigint): string {
  return formatUnits(units, CUSD_DECIMALS);
}

/** Verify a user payment to Circuit by reading the Transfer event from the tx receipt. */
export async function verifyCusdPayment(opts: {
  txHash: Hex; expectedFrom: Address; expectedTo: Address; minAmount: bigint;
}): Promise<{ ok: boolean; actualAmount: bigint; reason?: string }> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: opts.txHash, timeout: 90_000 });
    if (receipt.status !== "success") return { ok: false, actualAmount: 0n, reason: "tx_reverted" };
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const from = getAddress(opts.expectedFrom);
    const to = getAddress(opts.expectedTo);
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== getAddress(CUSD_ADDRESS)) continue;
      if (log.topics[0] !== transferTopic) continue;
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

/** Send cUSD from Circuit's wallet. Returns tx hash. */
export async function circuitSendCusd(to: Address, amount: bigint): Promise<Hex> {
  const wallet = getCircuitWalletClient();
  const hash = await wallet.writeContract({
    address: CUSD_ADDRESS, abi: ERC20_ABI, functionName: "transfer", args: [to, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  return hash;
}

export async function getCusdBalance(addr: Address): Promise<bigint> {
  return publicClient.readContract({ address: CUSD_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] });
}
