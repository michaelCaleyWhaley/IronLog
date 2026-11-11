/**
 * Generates client-side ULIDs: 48-bit millisecond timestamp + 80 bits of
 * randomness, Crockford base32 encoded (26 chars). Stable, unique and
 * roughly time-sortable.
 *
 * Entropy resolution order:
 *  1. An injected source (the app wires expo-crypto's CSPRNG at startup).
 *  2. `globalThis.crypto.getRandomValues` (Node, browsers, some runtimes).
 *  3. `Math.random` as a last resort — IDs are identifiers, not secrets.
 */

export type RandomBytesFn = (length: number) => Uint8Array;

let injectedRandomBytes: RandomBytesFn | null = null;

/** Called once at app startup to provide a cryptographic RNG. */
export function setRandomBytes(fn: RandomBytesFn): void {
  injectedRandomBytes = fn;
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RANDOM_BYTES = 10; // 80 bits -> exactly 16 base32 chars

function randomBytes(length: number): Uint8Array {
  if (injectedRandomBytes) {
    return injectedRandomBytes(length);
  }
  const cryptoObj = (
    globalThis as {
      crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function encodeTimestamp(timestampMs: number): string {
  let remaining = timestampMs;
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out = CROCKFORD[remaining % 32] + out;
    remaining = Math.floor(remaining / 32);
  }
  return out;
}

function encodeRandom(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(buffer >>> bits) & 31];
    }
  }
  return out;
}

export function newId(now: number = Date.now()): string {
  return encodeTimestamp(now) + encodeRandom(randomBytes(RANDOM_BYTES));
}
