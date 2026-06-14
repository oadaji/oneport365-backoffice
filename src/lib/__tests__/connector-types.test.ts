/**
 * Connector types utility tests.
 * Run with: npx tsx src/lib/__tests__/connector-types.test.ts
 */
import {
  computeDedupKey,
  computeExpiryStatus,
  NormalizedRate,
} from "../connectors/types";

let passed = 0;
let failed = 0;

function assert(name: string, actual: unknown, expected: unknown) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}\n  expected: ${expectedStr}\n  actual:   ${actualStr}`);
  }
}

// Test computeDedupKey
const sampleRate: NormalizedRate = {
  source: "searates",
  rateType: "spot",
  carrier: { name: "Maersk Line", scac: "MAEU" },
  lane: { origin: "CNSHA", destination: "NGAPP" },
  equipment: "40HC",
  currency: "USD",
  charges: [{ code: "OFR", description: "Ocean Freight", basis: "per_container", amount: 2500 }],
  validFrom: new Date("2025-01-01"),
  validTo: new Date("2025-03-31"),
  fetchedAt: new Date(),
};

const dedupKey = computeDedupKey(sampleRate);
assert("Dedup key format", dedupKey, "searates|MAEU|CNSHA|NGAPP|40HC|2025-01-01");

// Test dedup key without SCAC (uses carrier name)
const rateWithoutScac: NormalizedRate = {
  ...sampleRate,
  carrier: { name: "Unknown Carrier" },
};
const dedupKeyNoScac = computeDedupKey(rateWithoutScac);
assert("Dedup key without SCAC", dedupKeyNoScac, "searates|Unknown Carrier|CNSHA|NGAPP|40HC|2025-01-01");

// Test computeExpiryStatus
const now = new Date();
const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
const soonDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // yesterday

assert("30 days out = active", computeExpiryStatus(futureDate), "active");
assert("7 days out = expiring_soon", computeExpiryStatus(soonDate), "expiring_soon");
assert("Past date = expired", computeExpiryStatus(pastDate), "expired");

// Edge case: exactly 14 days
const exactly14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
assert("14 days out = expiring_soon", computeExpiryStatus(exactly14Days), "expiring_soon");

// Edge case: 15 days
const days15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
assert("15 days out = active", computeExpiryStatus(days15), "active");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
