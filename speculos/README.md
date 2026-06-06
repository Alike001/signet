# Speculos + DMK — notes

This folder holds the emulator setup and the **confirmed** Ledger Device Management Kit (DMK)
API that `src/signer.ts` depends on. The API below was verified against Ledger's official
`ledgerhq/agent-skills` (skill `ledger-dmk-implementation`) and the installed npm packages — not guessed.

## Confirmed DMK connect API

```ts
import { DeviceManagementKitBuilder, DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { speculosTransportFactory } from "@ledgerhq/device-transport-kit-speculos";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom, filter, map } from "rxjs";

// 1. Build the DMK pointed at Speculos (URL optional; defaults to http://127.0.0.1:5000)
const dmk = new DeviceManagementKitBuilder()
  .addTransport(speculosTransportFactory("http://localhost:5000"))
  .build();

// 2. Discover one device, then connect -> sessionId (Promise<DeviceSessionId>)
const device = await firstValueFrom(dmk.startDiscovering({ transport: /* speculos id */ }));
const sessionId = await dmk.connect({ device });

// 3. Build the Ethereum signer from the same sessionId
const signerEth = new SignerEthBuilder({ dmk, sessionId }).build();
// (originToken is OPTIONAL — omit it and the device shows raw hex, fine for our demo)

// 4. Get address — BIP32 path is a PLAIN STRING, not an array
const { observable } = signerEth.getAddress("44'/60'/0'/0/0", { checkOnDevice: true });
const out = await firstValueFrom(
  observable.pipe(
    filter((s) => s.status === DeviceActionStatus.Completed || s.status === DeviceActionStatus.Error),
    map((s) => { if (s.status === DeviceActionStatus.Error) throw s.error; return s.output; }),
  ),
);
// out.address -> "0x..."   out.publicKey -> "0x..."

// 5. Sign a transaction (txBytes = RLP-encoded Uint8Array of the unsigned EIP-1559 tx)
const { observable: sigObs } = signerEth.signTransaction("44'/60'/0'/0/0", txBytes);
// Completed -> state.output.r, state.output.s, state.output.v
```

### Key facts (source: agent-skills + installed pkgs)

- `dmk.connect({ device })` returns `Promise<DeviceSessionId>`. Every other async op returns
  `{ observable, cancel }`. (sdk-reference.md:55)
- Sessions are chain-agnostic; one `sessionId` works for any signer. Don't disconnect between ops.
- `speculosTransportFactory(speculosUrl?, isE2E?, deviceModelId?)` — all args optional; URL defaults
  to `http://127.0.0.1:5000`. Package also exports `SpeculosTransport`.
- Device-action status is the string enum `DeviceActionStatus` → `.Completed` / `.Error` /
  `.Pending` / `.NotStarted` / `.Stopped`.
- User rejection surfaces as `RefusedByUserDAError` (status words `5501` / `6985`) — treat as a
  distinct "rejected" outcome, NOT a red error.
- Observable → single value via `firstValueFrom(obs.pipe(filter(Completed||Error), map(...)))`.

## Speculos launch (filled in during Task 0.3)

_TODO: exact `docker pull` / `docker run` commands that worked, the ETH app ELF source,
the API URL, and how to approve/reject on the web screen._
