/**
 * Extraction eval harness — runs live Claude extraction against fixture emails
 * and verifies key fields match expected results.
 *
 * Requires ANTHROPIC_API_KEY or CLAUDE_API_KEY in environment.
 * Run with: npx ts-node -r dotenv/config src/lib/__tests__/extraction-eval.ts
 *
 * This calls the real Claude API — costs money and takes ~30s for 10 fixtures.
 */
import * as fs from "fs";
import * as path from "path";
import { extractWithClaude } from "../ai-extract";

interface Expectation {
  file: string;
  fromName: string;
  fromEmail: string;
  expectedType: string;
  expectedShipmentCount: number;
  /** Key fields to check: [fieldKey, expectedOk] */
  expectedFields?: Array<[string, boolean]>;
  /** If true, expect at least one shipment with this freight mode */
  expectedFreightMode?: string;
}

const FIXTURES: Expectation[] = [
  {
    file: "01-ocean-fcl-import.txt",
    fromName: "John Okafor",
    fromEmail: "john@acmecargo.ng",
    expectedType: "customer-rfq",
    expectedShipmentCount: 1,
    expectedFields: [["POL", true], ["POD", true], ["Container", true], ["HS Code", true], ["Weight", true], ["Incoterm", true]],
    expectedFreightMode: "Ocean Freight",
  },
  {
    file: "02-air-freight.txt",
    fromName: "Sarah Chen",
    fromEmail: "sarah@techparts.hk",
    expectedType: "customer-rfq",
    expectedShipmentCount: 1,
    expectedFreightMode: "Air Freight",
    expectedFields: [["Weight", true], ["Commodity", true]],
  },
  {
    file: "03-internal-forward.txt",
    fromName: "Tunde Adeyemi",
    fromEmail: "tunde@oneport365.com",
    expectedType: "customer-rfq",
    expectedShipmentCount: 1,
    expectedFields: [["Customer", true], ["Container", true], ["Incoterm", true]],
  },
  {
    file: "04-rate-reply.txt",
    fromName: "Rates Desk",
    fromEmail: "rates@maersk.com",
    expectedType: "rate-reply",
    expectedShipmentCount: 0, // rate-reply should have empty or populated shipments
  },
  {
    file: "05-promotional.txt",
    fromName: "deals",
    fromEmail: "deals@gapfactory.com",
    expectedType: "promotional",
    expectedShipmentCount: 0,
  },
  {
    file: "06-outbound.txt",
    fromName: "OnePort 365 Commercial",
    fromEmail: "commercial@oneport365.com",
    expectedType: "outbound",
    expectedShipmentCount: 0,
  },
  {
    file: "07-multi-shipment.txt",
    fromName: "Ahmed Hassan",
    fromEmail: "ahmed@dubaisteel.ae",
    expectedType: "customer-rfq",
    expectedShipmentCount: 2,
  },
  {
    file: "08-irrelevant.txt",
    fromName: "LinkedIn",
    fromEmail: "notifications@linkedin.com",
    expectedType: "irrelevant",
    expectedShipmentCount: 0,
  },
  {
    file: "09-lcl-shipment.txt",
    fromName: "Priya Sharma",
    fromEmail: "priya@indiatextiles.in",
    expectedType: "customer-rfq",
    expectedShipmentCount: 1,
    expectedFields: [["Volume", true], ["Commodity", true], ["Pick-up", true], ["Incoterm", true]],
  },
  {
    file: "10-dg-cargo.txt",
    fromName: "Klaus Weber",
    fromEmail: "klaus@chemtrade.de",
    expectedType: "customer-rfq",
    expectedShipmentCount: 1,
    expectedFields: [["Cargo class", true], ["Container", true], ["Target Price", true]],
  },
];

async function runEval() {
  const fixtureDir = path.join(__dirname, "../../../test/fixtures/emails");
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  function fail(fixture: string, reason: string) {
    failed++;
    failures.push(`  FAIL [${fixture}]: ${reason}`);
  }

  for (const exp of FIXTURES) {
    const filePath = path.join(fixtureDir, exp.file);
    if (!fs.existsSync(filePath)) {
      fail(exp.file, "fixture file not found");
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    // Parse From/Subject from the fixture text
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/m);
    const subject = subjectMatch?.[1] || "(no subject)";
    const body = raw.replace(/^From:.*\n/m, "").replace(/^Subject:.*\n/m, "").trim();

    console.log(`\n── ${exp.file} ──`);

    const result = await extractWithClaude(
      { fromName: exp.fromName, fromEmail: exp.fromEmail, subject, body },
      "customer-rfq"
    );

    if (result.status === "error") {
      fail(exp.file, `extraction error: ${result.errorType} — ${result.error}`);
      continue;
    }

    let fileOk = true;

    // Check email type
    if (result.detectedEmailType !== exp.expectedType) {
      fail(exp.file, `type: expected "${exp.expectedType}", got "${result.detectedEmailType}"`);
      fileOk = false;
    }

    // Check shipment count
    if (exp.expectedShipmentCount > 0 && result.shipments.length !== exp.expectedShipmentCount) {
      fail(exp.file, `shipments: expected ${exp.expectedShipmentCount}, got ${result.shipments.length}`);
      fileOk = false;
    }
    if (exp.expectedShipmentCount === 0 && result.shipments.length > 0) {
      // For non-RFQ types, shipments should be empty
      if (["promotional", "irrelevant", "outbound"].includes(exp.expectedType)) {
        fail(exp.file, `shipments: expected 0 for ${exp.expectedType}, got ${result.shipments.length}`);
        fileOk = false;
      }
    }

    // Check key fields
    if (exp.expectedFields && result.shipments.length > 0) {
      const fields = result.shipments[0].fields;
      for (const [key, expectedOk] of exp.expectedFields) {
        const field = fields.find((f) => f.k === key);
        if (!field) {
          fail(exp.file, `field "${key}" not found in extraction`);
          fileOk = false;
        } else if (field.ok !== expectedOk) {
          fail(exp.file, `field "${key}": expected ok=${expectedOk}, got ok=${field.ok} (v="${field.v}")`);
          fileOk = false;
        }
      }
    }

    // Check freight mode
    if (exp.expectedFreightMode && result.shipments.length > 0) {
      const modeField = result.shipments[0].fields.find((f) => f.k === "Freight Mode");
      if (!modeField || !modeField.v.includes(exp.expectedFreightMode.split(" ")[0])) {
        fail(exp.file, `freight mode: expected "${exp.expectedFreightMode}", got "${modeField?.v || "missing"}"`);
        fileOk = false;
      }
    }

    if (fileOk) {
      passed++;
      console.log(`  PASS — type=${result.detectedEmailType}, shipments=${result.shipments.length}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${FIXTURES.length} fixtures`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(f));
  }

  process.exit(failed > 0 ? 1 : 0);
}

runEval().catch((err) => {
  console.error("Eval harness crashed:", err);
  process.exit(1);
});
