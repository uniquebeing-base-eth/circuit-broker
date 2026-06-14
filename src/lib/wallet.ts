// Client-side wallet helpers: MiniPay (auto) + MetaMask fallback. cUSD transfers only.
import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";

export const CELO_CHAIN_ID = 42220;
export const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const ERC20_TRANSFER_ABI = [{
  type: "function", name: "transfer", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ type: "bool" }],
}] as const;

declare global {
  interface Window { ethereum?: any }
}

export function detectProvider(): { provider: any; kind: "minipay" | "metamask" | "injected" } | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const eth = window.ethereum;
  if (eth.isMiniPay) return { provider: eth, kind: "minipay" };
  if (eth.isMetaMask) return { provider: eth, kind: "metamask" };
  return { provider: eth, kind: "injected" };
}

export async function connectWallet(): Promise<{ address: Address; kind: string }> {
  const detected = detectProvider();
  if (!detected) throw new Error("No wallet detected. Install MetaMask or open in MiniPay.");
  const accounts: string[] = await detected.provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("No account returned");
  await ensureCeloChain(detected.provider);
  return { address: accounts[0] as Address, kind: detected.kind };
}

async function ensureCeloChain(provider: any) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa4ec" }] });
  } catch (e: any) {
    if (e?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xa4ec", chainName: "Celo Mainnet",
          nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
          rpcUrls: ["https://forno.celo.org"], blockExplorerUrls: ["https://celoscan.io"],
        }],
      });
    }
  }
}

/** Send cUSD on Celo. Returns tx hash. */
export async function sendCusd(from: Address, to: Address, amountCusd: number): Promise<Hex> {
  const detected = detectProvider();
  if (!detected) throw new Error("No wallet");
  await ensureCeloChain(detected.provider);
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI, functionName: "transfer",
    args: [to, parseUnits(amountCusd.toFixed(6), 18)],
  });
  const hash: Hex = await detected.provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: CUSD_ADDRESS, data, value: "0x0" }],
  });
  return hash;
}

export function shortAddr(a?: string | null) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
