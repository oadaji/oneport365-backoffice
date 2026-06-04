import { Router, Request, Response } from "express";
import { Opportunity, STAGE_PROBABILITY, OpportunityStage } from "../models/opportunity";
import { Company } from "../models/company";
import { Contact } from "../models/contact";
import { Rfq } from "../models/rfq";

const router = Router();

// GET /api/opportunities - list all opportunities with population
router.get("/opportunities", async (req: Request, res: Response) => {
  try {
    const { companyId, stage, ownerId } = req.query;
    const filter: Record<string, unknown> = {};
    if (companyId) filter.companyId = companyId;
    if (stage) filter.stage = stage;
    if (ownerId) filter.ownerId = ownerId;

    const opportunities = await Opportunity.find(filter)
      .populate("companyId", "name domain")
      .populate("contactId", "firstName lastName email")
      .populate("ownerId", "name email")
      .sort({ updatedAt: -1 });

    // Compute summary stats
    const open = opportunities.filter(o => !o.stage.startsWith("closed"));
    const won = opportunities.filter(o => o.stage === "closed-won");
    const lost = opportunities.filter(o => o.stage === "closed-lost");
    const openValue = open.reduce((sum, o) => sum + o.value, 0);
    const wonValue = won.reduce((sum, o) => sum + o.value, 0);
    const winRate = won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0;

    res.json({
      opportunities,
      total: opportunities.length,
      stats: {
        open: open.length,
        openValue,
        won: won.length,
        wonValue,
        lost: lost.length,
        winRate,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load opportunities" });
  }
});

// GET /api/opportunities/:id - get single opportunity with full details
router.get("/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate("companyId")
      .populate("contactId")
      .populate("ownerId", "name email")
      .populate("linkedRfqIds");

    if (!opportunity) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    res.json(opportunity);
  } catch (err) {
    res.status(500).json({ error: "Failed to get opportunity" });
  }
});

// POST /api/opportunities - create new opportunity
router.post("/opportunities", async (req: Request, res: Response) => {
  try {
    const {
      companyId, contactId, title, value, currency, stage,
      expectedCloseDate, ownerId, source, linkedRfqIds,
      freightMode, route, notes
    } = req.body;

    if (!companyId || !title) {
      res.status(400).json({ error: "companyId and title are required" });
      return;
    }

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      res.status(400).json({ error: "Company not found" });
      return;
    }

    // Set probability based on stage
    const stageValue = (stage || "new-lead") as OpportunityStage;
    const probability = STAGE_PROBABILITY[stageValue];

    const opportunity = await Opportunity.create({
      companyId,
      contactId: contactId || undefined,
      title,
      value: value || 0,
      currency: currency || "USD",
      stage: stageValue,
      probability,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      ownerId: ownerId || undefined,
      source: source || "manual",
      linkedRfqIds: linkedRfqIds || [],
      freightMode,
      route,
      notes,
      wonAt: stageValue === "closed-won" ? new Date() : undefined,
    });

    const populated = await Opportunity.findById(opportunity._id)
      .populate("companyId", "name domain")
      .populate("contactId", "firstName lastName email")
      .populate("ownerId", "name email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Failed to create opportunity:", err);
    res.status(500).json({ error: "Failed to create opportunity" });
  }
});

// PATCH /api/opportunities/:id - update opportunity
router.patch("/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const {
      companyId, contactId, title, value, currency, stage,
      expectedCloseDate, ownerId, source, linkedRfqIds,
      freightMode, route, closeReason, notes
    } = req.body;

    const patch: Record<string, unknown> = {};

    if (companyId !== undefined) patch.companyId = companyId;
    if (contactId !== undefined) patch.contactId = contactId || null;
    if (title !== undefined) patch.title = title;
    if (value !== undefined) patch.value = value;
    if (currency !== undefined) patch.currency = currency;
    if (expectedCloseDate !== undefined) {
      patch.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    }
    if (ownerId !== undefined) patch.ownerId = ownerId || null;
    if (source !== undefined) patch.source = source;
    if (linkedRfqIds !== undefined) patch.linkedRfqIds = linkedRfqIds;
    if (freightMode !== undefined) patch.freightMode = freightMode;
    if (route !== undefined) patch.route = route;
    if (closeReason !== undefined) patch.closeReason = closeReason;
    if (notes !== undefined) patch.notes = notes;

    // Handle stage change - auto-set probability and wonAt
    if (stage !== undefined) {
      patch.stage = stage;
      patch.probability = STAGE_PROBABILITY[stage as OpportunityStage];
      if (stage === "closed-won") {
        const existing = await Opportunity.findById(req.params.id);
        if (existing && existing.stage !== "closed-won") {
          patch.wonAt = new Date();
        }
      }
    }

    const updated = await Opportunity.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate("companyId", "name domain")
      .populate("contactId", "firstName lastName email")
      .populate("ownerId", "name email");

    if (!updated) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error("Failed to update opportunity:", err);
    res.status(500).json({ error: "Failed to update opportunity" });
  }
});

// DELETE /api/opportunities/:id - delete opportunity
router.delete("/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await Opportunity.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    // Unlink from RFQs if needed
    if (deleted.linkedRfqIds && deleted.linkedRfqIds.length > 0) {
      await Rfq.updateMany(
        { _id: { $in: deleted.linkedRfqIds } },
        { $unset: { opportunityId: 1 } }
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete opportunity" });
  }
});

// POST /api/opportunities/:id/link-rfq - link an RFQ to opportunity
router.post("/opportunities/:id/link-rfq", async (req: Request, res: Response) => {
  try {
    const { rfqId } = req.body;
    if (!rfqId) {
      res.status(400).json({ error: "rfqId is required" });
      return;
    }

    const rfq = await Rfq.findById(rfqId);
    if (!rfq) {
      res.status(400).json({ error: "RFQ not found" });
      return;
    }

    const opportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { linkedRfqIds: rfqId } },
      { new: true }
    ).populate("companyId", "name domain")
     .populate("contactId", "firstName lastName email")
     .populate("ownerId", "name email");

    if (!opportunity) {
      res.status(404).json({ error: "Opportunity not found" });
      return;
    }

    // Also update the RFQ with opportunityId
    await Rfq.findByIdAndUpdate(rfqId, { opportunityId: opportunity._id });

    res.json(opportunity);
  } catch (err) {
    res.status(500).json({ error: "Failed to link RFQ" });
  }
});

export { router as opportunitiesRouter };
