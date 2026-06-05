# Sentinel — Design Spec

**Date:** 2026-06-05
**Author:** Hammed Ali Oyeleye (Alike001)
**Context:** Ledger "Agent Stack: Build & Show" bounty on college.xyz (bounty #38). Live until **Friday 12 June 2026, 23:59 CET**.
**Lane:** A + C hybrid (Zero-to-Signed-Transaction spine, dressed as a small real build).

---

## 1. One-liner

**Sentinel** is an AI agent that can move your ETH on command — but it holds no private key and **cannot sign anything** until a human physically approves the transaction on a Ledger device. The signing happens on Ledger's Speculos emulator, so no hardware is required to build, demo, or qualify.

This is Ledger's exact thesis made concrete: *agents gave us autonomous action; hardware gives us deterministic, human-enforced control.*

## 2. Why this qualifies (bounty mapping)

The bounty is **pass/fail**, not ranked: $100 to each of the first 50 valid submissions, plus a random raffle for 5 Ledger Flex devices and an optional "best content reshared by Ledger." We optimize for *valid + on time*, then for *shareable content* as upside.

| Requirement | How Sentinel meets it |
|---|---|
| Genuinely use DMK or Wallet CLI (proof) | Uses the **DMK** (`@ledgerhq/device-management-kit`) with the official **Speculos transport** + **Ethereum signer**. Proof = the signing flow on screen + public repo. |
| Public post on X or LinkedIn tagging @Ledger | Post with demo clip, tags `@Ledger`. |
| Visible `#Sponsored` / `#LedgerSponsor` disclosure | Included in the post text. |
| Proof of use (command / signing flow / repo) | All three: terminal command, recorded signing flow, public GitHub repo. |
| 18+, one submission, no unbacked claims, not excluded territory | Satisfied. README makes no security/financial claims it can't back. |
| Filed via official Google Form | Final step. |

Emulator-based submissions are explicitly accepted as valid proof-of-use.

## 3. Architecture

Four small, independently-testable pieces:

1. **Emulated device (Speculos)** — runs the Ethereum app on an emulated Ledger, exposing its API at `http://localhost:5000` (web screen + APDU server). This is the only non-TypeScript dependency.
2. **Signer layer (TypeScript)** — `@ledgerhq/device-management-kit` + `@ledgerhq/device-transport-kit-speculos` + `@ledgerhq/device-signer-kit-ethereum`. Builds the DMK pointed at Speculos, opens a session, derives the address, signs.
3. **Agent layer (TypeScript)** — parses natural-language input ("send 0.01 ETH to 0x…") into a structured intent `{ to, amountEth }` using **Groq's free API**. The agent's invariant: it can *build* and *broadcast* but **physically cannot sign** — that capability lives only behind the device.
4. **Chain layer (TypeScript)** — `viem` fetches nonce/gas/fees from a public **Sepolia** RPC, assembles the EIP-1559 transaction, and broadcasts the signed result, printing the tx hash + `sepolia.etherscan.io` link.

### Module boundaries

- `speculos/` — scripts/notes to launch the emulator with the ETH app (no app code; it's the dependency).
- `src/signer.ts` — DMK setup, session, `getAddress()`, `signTransaction()`. Depends only on DMK packages + a Speculos URL.
- `src/agent.ts` — `parseIntent(text) -> { to, amountEth }`. Depends only on Groq.
- `src/chain.ts` — `buildTx(intent) -> unsignedTx`, `broadcast(rawTx) -> hash`. Depends only on viem + an RPC URL.
- `src/index.ts` — wires them: read prompt → parse → build → sign (HITL) → broadcast → print link.

Each module can be tested in isolation: the signer against Speculos, the agent against sample strings, the chain layer against Sepolia.

## 4. End-to-end flow

```
"send 0.01 ETH to 0x123…"
   → agent.parseIntent (Groq)          → { to, amountEth }
   → chain.buildTx                     → unsigned EIP-1559 tx (nonce/gas/fees from Sepolia)
   → signer.signTransaction            → DMK asks Speculos to sign
   → Speculos shows clear-signing screen   ← THE KILL SWITCH (human approves on emulated device)
   → signature returned                → chain assembles raw tx
   → chain.broadcast                   → tx hash + sepolia.etherscan.io link
```

The demo's defining moment: the agent **halts, waiting on the device**. Nothing moves until a human approves on screen. If the human rejects, the agent reports the refusal and broadcasts nothing.

## 5. Key risk + spike

**Risk:** Speculos needs the **Ethereum app binary** (`.elf`) loaded; it isn't bundled. Primary path: build it once with Ledger's official `app-ethereum` Docker image, or fetch a prebuilt ELF from Ledger CI artifacts.

**Mitigation — Milestone 0 is a spike.** Nothing else starts until we prove: Speculos runs the ETH app, the DMK Speculos transport connects, and we can read an address. **Fallback** if the ETH app fights us: fall back to **message signing** (`signMessage` / EIP-191) on the emulated device — still a genuine DMK signing flow that satisfies the bounty — and adjust the demo narrative from "sign a transfer" to "sign an agent-authored message under human approval."

## 6. Milestones (≈7 days, staged, user in the loop)

- **M0 — Spike (de-risk):** Speculos + ETH app running; DMK Speculos transport reads an address. Green-light gate.
- **M1 — Sign one hardcoded tx** end-to-end on Sepolia (no agent). Proves signer + chain layers.
- **M2 — Add the agent layer** (Groq NL → intent). Now it is "an AI agent."
- **M3 — Polish + record:** clean terminal output; screen-record terminal + Speculos screen = proof-of-use.
- **M4 — Ship deliverables:** repo + portfolio-grade README; X and/or LinkedIn post tagging `@Ledger` with `#LedgerSponsor`; submit the Google Form.

We commit per milestone. Build commands (especially Speculos/Docker and the DMK steps) are handed to Ali to type himself — this is a learning build, not an unattended batch run.

## 7. Stack & cost

- **Runtime:** Node.js + TypeScript (Ali's strength).
- **Libraries:** `@ledgerhq/device-management-kit`, `@ledgerhq/device-transport-kit-speculos`, `@ledgerhq/device-signer-kit-ethereum`, `viem`, Groq SDK.
- **Emulator:** Speculos (`pip install speculos` or Docker).
- **Network:** Ethereum **Sepolia** testnet (free faucet ETH, zero real-money risk).
- **LLM:** Groq free tier.
- **Total cost: $0.**

## 8. Out of scope (YAGNI)

- Ledger Enterprise CLI and Multisig CLI (overkill for a solo 7-day build).
- A web UI (terminal + Speculos screen is enough for valid proof; a React front-end is a possible post-bounty portfolio upgrade).
- Multiple chains (Sepolia only).
- Real mainnet funds or any custody of real keys.

## 9. Deliverables

1. Public GitHub repo (`Alike001/sentinel` or similar) with all four modules.
2. Portfolio-grade README: problem → what it does → architecture → run instructions → demo clip.
3. Demo recording (terminal + Speculos approval screen).
4. Public X and/or LinkedIn post tagging `@Ledger` with a visible `#LedgerSponsor` disclosure.
5. Submission via the official Google Form before 12 June 2026, 23:59 CET.
