import { describe, it, expect } from "vitest";
import { parseIntent } from "../src/agent";

describe("parseIntent", () => {
  it("parses a structured intent from the model's JSON reply", async () => {
    const fakeLlm = async () =>
      '{"to":"0x000000000000000000000000000000000000dEaD","amountEth":"0.01"}';
    const intent = await parseIntent("send 0.01 ETH to 0x...dEaD", fakeLlm);
    expect(intent).toEqual({
      to: "0x000000000000000000000000000000000000dEaD",
      amountEth: "0.01",
    });
  });

  it("extracts JSON even when the model wraps it in prose/markdown", async () => {
    const fakeLlm = async () =>
      'Sure! ```json\n{"to":"0x000000000000000000000000000000000000dEaD","amountEth":"0.5"}\n```';
    const intent = await parseIntent("pay 0.5", fakeLlm);
    expect(intent).toEqual({
      to: "0x000000000000000000000000000000000000dEaD",
      amountEth: "0.5",
    });
  });

  it("throws on non-JSON model output", async () => {
    const fakeLlm = async () => "I cannot help with that";
    await expect(parseIntent("hello", fakeLlm)).rejects.toThrow();
  });

  it("throws when the address is malformed", async () => {
    const fakeLlm = async () => '{"to":"0x1234","amountEth":"0.01"}';
    await expect(parseIntent("send to a bad address", fakeLlm)).rejects.toThrow(/address/i);
  });

  it("throws when the amount is not a decimal", async () => {
    const fakeLlm = async () =>
      '{"to":"0x000000000000000000000000000000000000dEaD","amountEth":"a lot"}';
    await expect(parseIntent("send lots", fakeLlm)).rejects.toThrow(/amount/i);
  });
});
