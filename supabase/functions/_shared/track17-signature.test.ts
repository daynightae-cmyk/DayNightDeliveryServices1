import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { constantTimeEqual, sha256Hex } from "./track17-signature.ts";

Deno.test("creates lowercase SHA-256 hexadecimal digest", async () => {
  const digest = await sha256Hex("DAY NIGHT/secret");
  assertEquals(digest.length, 64);
  assert(/^[a-f0-9]{64}$/.test(digest));
});

Deno.test("constant-time comparator accepts equal values", () => {
  assertEquals(constantTimeEqual("abc123", "ABC123"), true);
  assertEquals(constantTimeEqual("abc123", "abc124"), false);
  assertEquals(constantTimeEqual("abc", "abc0"), false);
});
