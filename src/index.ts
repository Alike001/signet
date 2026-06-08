/**
 * Signet CLI — the whole thesis in one place.
 *
 * Interactive (talk to the agent):
 *   npm start
 *   signet> send 0.001 ETH to 0x000000000000000000000000000000000000dEaD
 *
 * One-shot (scriptable):
 *   npm start -- "send 0.001 ETH to 0x000000000000000000000000000000000000dEaD"
 *
 * Flow per request: plain English -> Groq parses intent -> SOFTWARE policy check
 *   (cap + allowlist) -> build EIP-1559 tx -> HARDWARE approval on the Ledger
 *   (Speculos) -> broadcast.
 *
 * Two guardrails: a request that fails the policy is refused locally and the device is
 * never touched; one that passes still cannot move funds without a human approving on
 * the device. The agent holds no private key.
 *
 * Prereqs: Speculos running with our seed (see speculos/README.md), the device address
 * funded on Sepolia, and GROQ_API_KEY set in .env.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { parseIntent } from "./agent";
import { checkPolicy, type Policy } from "./policy";
import { buildUnsignedTx, assembleAndBroadcast } from "./chain";
import { connectAndGetSigner, signTxBytes, type Signer } from "./signer";

// The device session is opened once, lazily — only when a request actually needs signing.
// Refusals never touch it, so a refusal-only session doesn't even require Speculos.
let signer: Signer | null = null;
async function getSigner(): Promise<Signer> {
  if (!signer) {
    console.log("🔌 Connecting to Ledger (Speculos) …");
    signer = await connectAndGetSigner();
    console.log("   Device address:", signer.address);
  }
  return signer;
}

type Outcome = "broadcast" | "refused";

async function handleIntent(prompt: string, policy: Policy): Promise<Outcome> {
  console.log("🤖 Signet: parsing intent …");
  const intent = await parseIntent(prompt);
  console.log("   Intent:", intent);

  console.log("🛡️  Software policy check …");
  const verdict = checkPolicy(intent, policy);
  if (!verdict.ok) {
    console.log("   ❌ Refused locally:", verdict.reason);
    console.log("   (the device was never touched)");
    return "refused";
  }
  console.log("   ✅ Policy passed.");

  const { signerEth, address } = await getSigner();
  const built = await buildUnsignedTx(address, intent.to as `0x${string}`, intent.amountEth);

  console.log("🔐 Hardware approval required — review and approve on the device screen …");
  const sig = await signTxBytes(signerEth, built.bytes);

  const hash = await assembleAndBroadcast(built, sig);
  console.log("📡 Broadcast:", `https://sepolia.etherscan.io/tx/${hash}`);
  return "broadcast";
}

async function repl(policy: Policy) {
  console.log("\n  Signet — a Ledger-guarded AI agent.");
  console.log("  Try: send 0.001 ETH to 0x000000000000000000000000000000000000dEaD");
  console.log('  Type "exit" to quit.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "signet> " });
  // Track close so EOF/Ctrl+D (or piped input ending mid-await) never prompts a dead stream.
  let closed = false;
  rl.on("close", () => {
    closed = true;
  });

  if (!closed) rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (line === "exit" || line === "quit") break;
    if (line) {
      try {
        await handleIntent(line, policy);
      } catch (err) {
        console.error("   ❌", err instanceof Error ? err.message : err);
      }
      console.log("");
    }
    if (closed) break;
    rl.prompt();
  }
  if (!closed) rl.close();
}

async function main() {
  const policy: Policy = JSON.parse(readFileSync("policy.json", "utf8"));
  const argPrompt = process.argv.slice(2).join(" ").trim();

  if (argPrompt) {
    const outcome = await handleIntent(argPrompt, policy);
    process.exit(outcome === "refused" ? 2 : 0);
  }

  await repl(policy);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Signet failed:", err);
  process.exit(1);
});
