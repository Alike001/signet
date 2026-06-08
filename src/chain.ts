/**
 * Chain layer — build, encode, and broadcast EIP-1559 transactions on Sepolia.
 *
 * Split into pure (unit-tested) and networked parts:
 *  - encodeUnsigned / assembleSigned  -> pure, deterministic, tested in test/chain.test.ts
 *  - buildUnsignedTx / assembleAndBroadcast -> talk to the RPC (nonce, fees, send)
 *
 * The unsigned bytes are handed to the Ledger signer; the r/s/v it returns are
 * reattached here to make a broadcastable transaction. The agent never holds a key.
 */
import "./net-ipv4";
import "dotenv/config";
import {
  createPublicClient,
  http,
  serializeTransaction,
  hexToBytes,
  parseEther,
  type Hex,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";

const RPC = process.env.SEPOLIA_RPC_URL;
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC),
});

export type Eip1559 = {
  chainId: number;
  nonce: number;
  to: Address;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

/** Ledger ETH signer output: r/s are 0x-hex (32 bytes), v is the recovery id. */
export type LedgerSig = { r: Hex; s: Hex; v: number };

/** Serialize an unsigned EIP-1559 tx -> 0x02-prefixed hex + the raw bytes to sign. */
export function encodeUnsigned(tx: Eip1559): { serialized: Hex; bytes: Uint8Array } {
  const serialized = serializeTransaction({ type: "eip1559", ...tx });
  return { serialized, bytes: hexToBytes(serialized) };
}

/** Reattach a Ledger r/s/v signature -> broadcastable 0x02 serialized tx. */
export function assembleSigned(tx: Eip1559, sig: LedgerSig): Hex {
  return serializeTransaction(
    { type: "eip1559", ...tx },
    { r: sig.r, s: sig.s, yParity: sig.v & 1 },
  );
}

/** Build a fully-populated unsigned tx for `from`: live nonce + fee estimate. */
export async function buildUnsignedTx(
  from: Address,
  to: Address,
  amountEth: string,
): Promise<Eip1559 & { serialized: Hex; bytes: Uint8Array }> {
  const value = parseEther(amountEth);
  const nonce = await publicClient.getTransactionCount({ address: from });
  const fees = await publicClient.estimateFeesPerGas();
  const tx: Eip1559 = {
    chainId: sepolia.id,
    nonce,
    to,
    value,
    gas: 21000n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
  return { ...tx, ...encodeUnsigned(tx) };
}

/** Assemble the signed tx and broadcast it -> returns the tx hash. */
export async function assembleAndBroadcast(tx: Eip1559, sig: LedgerSig): Promise<Hex> {
  const serializedTransaction = assembleSigned(tx, sig);
  return publicClient.sendRawTransaction({ serializedTransaction });
}
