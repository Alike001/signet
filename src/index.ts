/**
 * Sentinel CLI — the whole thesis in one command.
 *
 *   npm start -- "send 0.001 ETH to 0x000000000000000000000000000000000000dEaD"
 *
 * Flow: plain English -> Groq parses intent -> SOFTWARE policy check (cap + allowlist)
 *       -> build EIP-1559 tx -> HARDWARE approval on the Ledger (Speculos) -> broadcast.
 *
 * Two guardrails: an intent that fails the policy is refused locally and the device is
 * never touched; one that passes still cannot move funds without a human approving on
 * the device. The agent holds no private key.
 *
 * Prereqs: Speculos running with our seed (see speculos/README.md), the device address
 * funded on Sepolia, and GROQ_API_KEY set in .env.
 */
import { readFileSync } from "node:fs";
import { parseIntent } from "./agent";
import { checkPolicy, type Policy } from "./policy";
import { buildUnsignedTx, assembleAndBroadcast } from "./chain";
import { connectAndGetSigner, signTxBytes } from "./signer";

async function main() {
  const prompt = process.argv.slice(2).join(" ");
  if (!prompt) {
    console.error('Usage: npm start -- "send 0.01 ETH to 0x..."');
    process.exit(1);
  }

  const policy: Policy = JSON.parse(readFileSync("policy.json", "utf8"));

  console.log("🤖 Sentinel: parsing intent …");
  const intent = await parseIntent(prompt);
  console.log("   Intent:", intent);

  console.log("🛡️  Software policy check …");
  const verdict = checkPolicy(intent, policy);
  if (!verdict.ok) {
    console.error("   ❌ Refused locally:", verdict.reason);
    console.error("   (the device was never touched)");
    process.exit(2);
  }
  console.log("   ✅ Policy passed.");

  console.log("🔌 Connecting to Ledger (Speculos) …");
  const { signerEth, address } = await connectAndGetSigner();
  console.log("   From:", address);

  const built = await buildUnsignedTx(address, intent.to as `0x${string}`, intent.amountEth);

  console.log("🔐 Hardware approval required — review and approve on the device screen …");
  const sig = await signTxBytes(signerEth, built.bytes);

  const hash = await assembleAndBroadcast(built, sig);
  console.log("\n📡 Broadcast:", `https://sepolia.etherscan.io/tx/${hash}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Sentinel failed:", err);
  process.exit(1);
});
