function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left.toLowerCase());
  const b = new TextEncoder().encode(right.toLowerCase());
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

export async function verifyTrack17Signature(rawBody: string, receivedSignature: string | null) {
  const key = Deno.env.get("TRACK17_API_KEY")?.trim();
  if (!key) throw new Error("track17_api_key_missing");
  if (!receivedSignature || !/^[a-f0-9]{64}$/i.test(receivedSignature)) return false;
  const expected = await sha256Hex(`${rawBody}/${key}`);
  return constantTimeEqual(expected, receivedSignature);
}

export function signaturePreview(value: string | null) {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-6)}` : "[present]";
}
