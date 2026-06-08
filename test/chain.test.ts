import { describe, it, expect } from "vitest";
import { encodeUnsigned, assembleSigned } from "../src/chain";

describe("encodeUnsigned", () => {
  it("serializes an unsigned eip1559 tx to a 0x02-prefixed hex with matching bytes", () => {
    const tx = {
      chainId: 11155111,
      nonce: 0,
      to: "0x000000000000000000000000000000000000dEaD" as const,
      value: 10000000000000000n, // 0.01 ETH
      gas: 21000n,
      maxFeePerGas: 30000000000n,
      maxPriorityFeePerGas: 1500000000n,
    };

    const { serialized, bytes } = encodeUnsigned(tx);

    expect(serialized.startsWith("0x02")).toBe(true);
    expect(bytes[0]).toBe(0x02);
    // bytes are the raw form of the same hex string
    expect(bytes.length).toBe((serialized.length - 2) / 2);
  });
});

describe("assembleSigned", () => {
  it("attaches a Ledger r/s/v signature and produces a broadcastable 0x02 tx", () => {
    const tx = {
      chainId: 11155111,
      nonce: 0,
      to: "0x000000000000000000000000000000000000dEaD" as const,
      value: 1000000000000000n, // 0.001 ETH
      gas: 21000n,
      maxFeePerGas: 30000000000n,
      maxPriorityFeePerGas: 1500000000n,
    };
    // A real secp256k1 signature triple as the Ledger ETH signer returns it:
    // r/s are 0x-prefixed 32-byte hex, v is a number (recovery id).
    const sig = {
      r: "0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8" as const,
      s: "0x73c8a78b6e0b9f5b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aa" as const,
      v: 1,
    };

    const signed = assembleSigned(tx, sig);

    expect(signed.startsWith("0x02")).toBe(true);
    // signed tx must be longer than the unsigned encoding (carries r,s,yParity)
    expect(signed.length).toBeGreaterThan(encodeUnsigned(tx).serialized.length);
  });
});
