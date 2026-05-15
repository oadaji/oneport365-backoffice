import { Router, Request, Response } from "express";
import { Rfq } from "../models/rfq";
import { Email } from "../models/email";

const router = Router();

// GET /api/rfqs
router.get("/rfqs", async (_req: Request, res: Response) => {
  try {
    const rfqs = await Rfq.find({ status: { $ne: "archived" } })
      .populate("emailId")
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .sort({ createdAt: -1 });

    const result = rfqs.map((r) => ({
      ...r.toObject(),
      email: r.emailId,
      company: r.companyId,
      contact: r.contactId,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load RFQs" });
  }
});

// GET /api/rfqs/:id
router.get("/rfqs/:id", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id)
      .populate("emailId")
      .populate("companyId")
      .populate("contactId");

    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

    res.json({
      ...rfq.toObject(),
      email: rfq.emailId,
      company: rfq.companyId,
      contact: rfq.contactId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get RFQ" });
  }
});

// PATCH /api/rfqs/:id
router.patch("/rfqs/:id", async (req: Request, res: Response) => {
  try {
    const { status, followUpDraft, notes, fields, missingFields } = req.body;
    const patch: Record<string, unknown> = {};
    if (status !== undefined) patch.status = status;
    if (followUpDraft !== undefined) patch.followUpDraft = followUpDraft;
    if (notes !== undefined) patch.notes = notes;
    if (fields !== undefined) patch.fields = fields;
    if (missingFields !== undefined) patch.missingFields = missingFields;

    const updated = await Rfq.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) { res.status(404).json({ error: "RFQ not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update RFQ" });
  }
});

// DELETE /api/rfqs/:id
router.delete("/rfqs/:id", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id);
    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

    await Rfq.findByIdAndDelete(req.params.id);

    // Delete source email if no other RFQs reference it
    if (rfq.emailId) {
      const otherRfqs = await Rfq.countDocuments({ emailId: rfq.emailId, _id: { $ne: rfq._id } });
      if (otherRfqs === 0) {
        await Email.findByIdAndDelete(rfq.emailId);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete RFQ" });
  }
});

export { router as rfqsRouter };
