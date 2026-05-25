/**
 * Port code resolution tests.
 * Run with: npx tsx src/lib/__tests__/port-codes.test.ts
 */
import { resolvePortCode, postProcessPortCodes } from "../port-codes";

let passed = 0;
let failed = 0;

function assert(name: string, actual: string, expected: string) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

// 1. Bare Nigerian port
assert("Lagos → Apapa (NGAPP)", resolvePortCode("Lagos"), "Apapa (NGAPP)");

// 2. Already formatted — no change
assert("Already formatted", resolvePortCode("Shanghai (CNSHA)"), "Shanghai (CNSHA)");

// 3. Case insensitive
assert("Case insensitive", resolvePortCode("ROTTERDAM"), "Rotterdam (NLRTM)");

// 4. Dubai → Jebel Ali
assert("Dubai → Jebel Ali", resolvePortCode("Dubai"), "Jebel Ali (AEJEA)");

// 5. Multi-word port
assert("Tin Can Island", resolvePortCode("Tin Can Island"), "Tin Can (NGTCN)");

// 6. Air port
assert("London → Heathrow", resolvePortCode("London"), "Heathrow (LHR)");

// 7. Unknown port — pass through
assert("Unknown port", resolvePortCode("Mogadishu"), "Mogadishu");

// 8. Empty / not specified
assert("Not specified", resolvePortCode("not specified"), "not specified");

// 9. Shenzhen alias
assert("Shenzhen → Yantian", resolvePortCode("Shenzhen"), "Yantian (CNYTN)");

// 10. postProcessPortCodes integration
const fields = [
  { k: "POL", v: "Apapa", ok: true },
  { k: "POD", v: "Rotterdam (NLRTM)", ok: true },
  { k: "Commodity", v: "Cashew nuts", ok: true },
  { k: "POL", v: "not specified", ok: false },
];
const processed = postProcessPortCodes(fields);
assert("postProcess POL bare", processed[0].v, "Apapa (NGAPP)");
assert("postProcess POD already formatted", processed[1].v, "Rotterdam (NLRTM)");
assert("postProcess non-port field unchanged", processed[2].v, "Cashew nuts");
assert("postProcess ok=false skipped", processed[3].v, "not specified");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
