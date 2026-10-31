// Self-check for the pure logic that the whole pipeline depends on.
// Run: npm run check
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { formatShotCode, withStyleBlock, maskKey, snapVeoDuration, splitScriptOffline } from "../src/lib/pure.js";

assert.equal(formatShotCode(0), "S01");
assert.equal(formatShotCode(8), "S09");
assert.equal(formatShotCode(99), "S100");

// Style block: prepended verbatim, exactly once.
const styled = withStyleBlock("STYLE-X", "mèo đi trên cỏ");
assert.equal(styled, "STYLE-X\n\nmèo đi trên cỏ");
assert.equal(withStyleBlock("STYLE-X", styled), styled, "must not double-prepend");
assert.equal(withStyleBlock("", "abc"), "abc");
assert.equal(withStyleBlock("  ", "abc"), "abc");

// Keys are masked before ever reaching the UI.
assert.equal(maskKey("sk-abcdefghwxyz"), "sk-…wxyz");
assert.equal(maskKey(""), "");
assert.equal(maskKey("short"), "••••");

// Veo only accepts 4/6/8s.
assert.equal(snapVeoDuration(1), 4);
assert.equal(snapVeoDuration(6), 6);
assert.equal(snapVeoDuration(30), 8);
assert.equal(snapVeoDuration(undefined), 8);

// Offline script breakdown splits on blank lines.
const shots = splitScriptOffline("Cảnh một làm gì đó\n\nCảnh hai làm gì khác");
assert.equal(shots.length, 2);
assert.equal(shots[0].durationSec, 8);

// Repo hygiene: both keys documented, no key-like value committed in .env.example.
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
assert.match(envExample, /OPENAI_API_KEY=\s*$/m);
assert.match(envExample, /GEMINI_API_KEY=\s*$/m);
assert.ok(existsSync(new URL("../src/lib/providers.ts", import.meta.url)));

console.log("self-check OK: shot codes, style block, key masking, Veo durations, offline breakdown, env template");
