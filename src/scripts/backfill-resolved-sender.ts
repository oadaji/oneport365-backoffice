/**
 * One-off backfill script: compute and store resolvedSenderName/Email
 * for all existing RFQs that don't have them yet.
 *
 * Run manually with:
 *   npx ts-node -r dotenv/config src/scripts/backfill-resolved-sender.ts
 */
import mongoose from "mongoose";
// Import all models to ensure they're registered with Mongoose before populate
import "../models/email";
import "../models/company";
import "../models/contact";
import { Rfq } from "../models/rfq";
import { resolveSender } from "../lib/resolve-sender";

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/oneport365";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const rfqs = await Rfq.find({
    $or: [
      { resolvedSenderName: { $exists: false } },
      { resolvedSenderName: null },
      { resolvedSenderName: "" },
    ],
  }).populate("emailId");

  console.log(`Found ${rfqs.length} RFQs without resolvedSender`);

  let updated = 0;
  for (const rfq of rfqs) {
    const email = rfq.emailId as any;
    if (!email) continue;

    const sender = resolveSender(
      { fromName: email.fromName, fromEmail: email.fromEmail, body: email.body },
      rfq.fields || []
    );

    await Rfq.findByIdAndUpdate(rfq._id, {
      resolvedSenderName: sender.name,
      resolvedSenderEmail: sender.email,
    });
    updated++;
  }

  console.log(`Updated ${updated} RFQs`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
