import { Types } from "mongoose";
import { Opportunity } from "../models/opportunity";
import { IRfqField } from "../models/rfq";

interface CreateOpportunityParams {
  rfqId: Types.ObjectId;
  companyId?: Types.ObjectId | string | null;
  contactId?: Types.ObjectId | string | null;
  fields: IRfqField[];
  emailType: string;
}

/**
 * Extract field value by key from RFQ fields array
 */
function getField(fields: IRfqField[], key: string): string | undefined {
  const field = fields.find(f => f.k.toLowerCase() === key.toLowerCase());
  return field?.v || undefined;
}

/**
 * Auto-create an opportunity from a synced RFQ
 * Only creates for customer-rfq type with a resolved company
 */
export async function createOpportunityFromRfq(params: CreateOpportunityParams): Promise<void> {
  const { rfqId, companyId: rawCompanyId, contactId: rawContactId, fields, emailType } = params;

  // Only create opportunities for customer RFQs with a resolved company
  if (emailType !== "customer-rfq" || !rawCompanyId) {
    return;
  }

  // Convert string IDs to ObjectIds if needed
  const companyId = typeof rawCompanyId === "string" ? new Types.ObjectId(rawCompanyId) : rawCompanyId;
  const contactId = rawContactId ? (typeof rawContactId === "string" ? new Types.ObjectId(rawContactId) : rawContactId) : undefined;

  try {
    // Extract relevant fields for the opportunity
    const commodity = getField(fields, "Commodity") || "Freight";
    const freightMode = getField(fields, "Freight Mode") || "";
    const pol = getField(fields, "POL") || "";
    const pod = getField(fields, "POD") || "";
    const container = getField(fields, "Container") || "";

    // Build opportunity title
    let title = commodity;
    if (freightMode) {
      title = `${commodity} ${freightMode}`;
    }
    if (pol && pod) {
      // Extract port codes if present (format: "City (CODE)")
      const polCode = pol.match(/\(([A-Z]{5})\)/)?.[1] || pol.split(" ")[0];
      const podCode = pod.match(/\(([A-Z]{5})\)/)?.[1] || pod.split(" ")[0];
      title += ` — ${polCode} to ${podCode}`;
    }
    if (container) {
      title += ` ${container}`;
    }

    // Build route string
    let route = "";
    if (pol && pod) {
      const polCode = pol.match(/\(([A-Z]{5})\)/)?.[1] || pol;
      const podCode = pod.match(/\(([A-Z]{5})\)/)?.[1] || pod;
      route = `${polCode} → ${podCode}`;
    }

    // Check if opportunity already exists for this RFQ
    const existing = await Opportunity.findOne({ linkedRfqIds: rfqId });
    if (existing) {
      return; // Already linked
    }

    // Check for similar opportunity (same company, similar title) created recently
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const similar = await Opportunity.findOne({
      companyId,
      title: { $regex: commodity.substring(0, 20), $options: "i" },
      createdAt: { $gte: oneDayAgo },
    });

    if (similar) {
      // Link this RFQ to existing opportunity instead of creating new
      await Opportunity.findByIdAndUpdate(similar._id, {
        $addToSet: { linkedRfqIds: rfqId },
      });
      // Update RFQ with opportunityId
      const { Rfq } = await import("../models/rfq");
      await Rfq.findByIdAndUpdate(rfqId, { opportunityId: similar._id });
      return;
    }

    // Create new opportunity
    const opportunity = await Opportunity.create({
      companyId,
      contactId: contactId || undefined,
      title,
      value: 0, // Unknown until quote is generated
      currency: "USD",
      stage: "new-lead",
      probability: 20,
      source: "rfq-auto",
      linkedRfqIds: [rfqId],
      freightMode: freightMode || undefined,
      route: route || undefined,
    });

    // Update RFQ with opportunityId
    const { Rfq } = await import("../models/rfq");
    await Rfq.findByIdAndUpdate(rfqId, { opportunityId: opportunity._id });

    console.log(`Created opportunity "${title}" from RFQ ${rfqId}`);
  } catch (err) {
    // Log but don't fail the sync - opportunity creation is secondary
    console.error("Failed to create opportunity from RFQ:", err);
  }
}
