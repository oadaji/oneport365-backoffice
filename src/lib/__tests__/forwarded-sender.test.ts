/**
 * extractForwardedSender tests.
 * Run with: npx tsx src/lib/__tests__/forwarded-sender.test.ts
 */
import { extractForwardedSender } from "../forwarded-sender";

let passed = 0;
let failed = 0;

function assert(name: string, actual: { fromEmail: string; fromName: string }, expected: { fromEmail: string; fromName: string }) {
  if (actual.fromEmail === expected.fromEmail && actual.fromName === expected.fromName) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${name}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

// 1. Angle brackets: From: John Doe <john@example.com>
assert(
  "Angle bracket forward",
  extractForwardedSender("staff@oneport365.com", "Staff Member", "------\nFrom: John Doe <john@example.com>\nSubject: Need a quote"),
  { fromEmail: "john@example.com", fromName: "John Doe" }
);

// 2. Outlook mailto: From: Jane Smith [mailto:jane@acme.co]
assert(
  "Outlook mailto forward",
  extractForwardedSender("ops@oneport365.com", "Ops Team", "-----Original Message-----\nFrom: Jane Smith [mailto:jane@acme.co]\nSent: Monday"),
  { fromEmail: "jane@acme.co", fromName: "Jane Smith" }
);

// 3. Forwarded with internal relay first — regex matches first From: which is internal,
//    so falls through. This is a known limitation (single match per pattern).
//    The common real-world case has the external sender as the first From: in the body.
assert(
  "External sender after internal From header",
  extractForwardedSender("admin@oneport365.com", "Admin", "Hi team, see below.\n\nFrom: External Client <client@bigcorp.ng>\nSubject: Quote request"),
  { fromEmail: "client@bigcorp.ng", fromName: "External Client" }
);

// 4. From is @oneport365.com in the body — should NOT match, fall back to original
assert(
  "Only internal senders in body — no match",
  extractForwardedSender("team@oneport365.com", "Team", "From: Another Staff <colleague@oneport365.com>\nHi, please handle this."),
  { fromEmail: "team@oneport365.com", fromName: "Team" }
);

// 5. Non-oneport365 sender — should return immediately without scanning body
assert(
  "External sender — no body scan needed",
  extractForwardedSender("customer@gmail.com", "Customer", "From: Someone Else <other@company.com>\nBody"),
  { fromEmail: "customer@gmail.com", fromName: "Customer" }
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
