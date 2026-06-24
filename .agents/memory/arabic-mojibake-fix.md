---
name: Arabic mojibake fix technique
description: How to fix triple-encoded Arabic text (UTF-8 bytes decoded as cp1252 then re-encoded as UTF-8)
---

## The rule
Arabic text that appears as `ÙŠØ±Ø¬Ù‰` instead of `يرجى` is triple-encoded.
Fix: char-by-char, encode each mojibake char back to its original byte using the cp1252 codec
(not latin-1), then decode the resulting byte sequence as UTF-8.

**Why:** The second encoding used Windows-1252 (cp1252), not Latin-1. Bytes 0x80-0x9F
in cp1252 map to smart quotes, em dashes, `Š` (U+0160), `‰` (U+2030), `„` (U+201E) etc. —
characters ABOVE U+00FF. Latin-1 encode() fails on these because latin-1 only covers U+0000-U+00FF.
If you see `Š` (U+0160) or `‰` (U+2030) in your mojibake runs, you need cp1252.

**How to apply:**
1. Identify mojibake char set: U+0080-U+00FF (direct byte ordinal) + cp1252 specials (U+0100+)
2. For each run of these chars:
   - chars U+0080-U+00FF: byte = ord(ch)   (same in both latin-1 and cp1252)
   - chars above U+00FF: byte = ch.encode('cp1252')  (cp1252 special e.g. U+0160 → 0x8A)
3. Decode the byte sequence as UTF-8; accept if result contains Arabic (U+0600-U+06FF)
4. Also scan for all source files — the same encoding bug typically affects multiple .tsx files
