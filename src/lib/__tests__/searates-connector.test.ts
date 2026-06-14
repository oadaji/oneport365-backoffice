/**
 * SeaRates connector normalization tests.
 * Run with: npx tsx src/lib/__tests__/searates-connector.test.ts
 */
import {
  SeaRatesConnector,
  normalizeSeaRatesQuote,
  SEARATES_SAMPLE_FIXTURE,
  SeaRatesQuote,
} from "../connectors/searates-connector";

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

function assertTruthy(name: string, actual: unknown) {
  if (actual) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}\n  expected truthy, got: ${actual}`);
  }
}

// Test 1: Normalize a single quote
const sampleQuote: SeaRatesQuote = SEARATES_SAMPLE_FIXTURE.data.quotes[0];
const normalized = normalizeSeaRatesQuote(sampleQuote);

assert("Source is searates", normalized.source, "searates");
assert("SourceRef is quote id", normalized.sourceRef, "sr-12345");
assert("RateType is spot", normalized.rateType, "spot");
assert("Carrier name", normalized.carrier.name, "Maersk Line");
assert("Carrier SCAC", normalized.carrier.scac, "MAEU");
assert("Lane origin", normalized.lane.origin, "CNSHA");
assert("Lane destination", normalized.lane.destination, "NGAPP");
assert("Via ports", normalized.lane.via, ["SGSIN"]);
assert("Equipment normalized", normalized.equipment, "40HC");
assert("Currency", normalized.currency, "USD");
assert("Transit time", normalized.transitTimeDays, 35);
assert("Service name", normalized.service, "Asia-West Africa Express");

// Test 2: Charges are properly normalized
assert("Number of charges", normalized.charges.length, 4);
assert("First charge code", normalized.charges[0].code, "OFR");
assert("First charge basis", normalized.charges[0].basis, "per_container");
assert("First charge amount", normalized.charges[0].amount, 2500);
assert("DOC charge basis", normalized.charges[2].basis, "per_bl");

// Test 3: Dates are parsed
assertTruthy("validFrom is Date", normalized.validFrom instanceof Date);
assertTruthy("validTo is Date", normalized.validTo instanceof Date);
assertTruthy("fetchedAt is Date", normalized.fetchedAt instanceof Date);

// Test 4: Raw payload is preserved
assertTruthy("Raw payload preserved", normalized.raw !== undefined);

// Test 5: Connector fetchFromFixture
async function testConnector() {
  const connector = new SeaRatesConnector();

  // Test isConfigured (should be false without env var)
  // Note: This depends on whether SEARATES_API_KEY is set in env
  // assert("Not configured without API key", connector.isConfigured(), false);

  // Test fetchFromFixture
  const result = await connector.fetchFromFixture(SEARATES_SAMPLE_FIXTURE);
  assert("Fixture fetch success", result.success, true);
  assert("Fixture rates count", result.rates.length, 2);

  // Verify first rate
  const firstRate = result.rates[0];
  assert("First rate source", firstRate.source, "searates");
  assert("First rate carrier", firstRate.carrier.name, "Maersk Line");

  // Test invalid fixture
  const invalidResult = await connector.fetchFromFixture({
    success: false,
    data: { quotes: [] },
    error: "Test error",
  });
  assert("Invalid fixture fails", invalidResult.success, false);
  assertTruthy("Invalid fixture has error", invalidResult.errors && invalidResult.errors.length > 0);

  // Test equipment normalization
  const quoteWithOddEquipment: SeaRatesQuote = {
    ...sampleQuote,
    container_type: "40'HC",
  };
  const normalizedOdd = normalizeSeaRatesQuote(quoteWithOddEquipment);
  assert("Equipment 40'HC → 40HC", normalizedOdd.equipment, "40HC");

  // Test charge basis normalization
  const quoteWithUnitBasis: SeaRatesQuote = {
    ...sampleQuote,
    charges: [
      { name: "Freight", amount: 1000, currency: "USD", basis: "PER_UNIT" },
      { name: "Doc Fee", amount: 50, currency: "USD", basis: "PER_DOCUMENT" },
    ],
  };
  const normalizedBasis = normalizeSeaRatesQuote(quoteWithUnitBasis);
  assert("PER_UNIT → per_container", normalizedBasis.charges[0].basis, "per_container");
  assert("PER_DOCUMENT → per_bl", normalizedBasis.charges[1].basis, "per_bl");
}

testConnector().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
