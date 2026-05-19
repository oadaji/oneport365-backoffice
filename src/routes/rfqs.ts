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

// POST /api/rfqs/:id/send-followup — send follow-up email
router.post("/rfqs/:id/send-followup", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id).populate("emailId");
    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

    const email = rfq.emailId as any;
    const { draft, fromEmail, cc } = req.body;

    if (!process.env.GMAIL_ADDRESS || !process.env.GMAIL_APP_PASSWORD) {
      res.status(400).json({ error: "Gmail credentials not configured" });
      return;
    }

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: fromEmail || process.env.GMAIL_ADDRESS, pass: process.env.GMAIL_APP_PASSWORD },
    });

    await transporter.sendMail({
      from: fromEmail || process.env.GMAIL_ADDRESS,
      to: email?.fromEmail,
      cc: cc || undefined,
      subject: `Re: ${email?.subject || ""}`,
      text: draft,
    });

    await Rfq.findByIdAndUpdate(rfq._id, { status: "replied", followUpDraft: draft });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send follow-up", details: err.message });
  }
});

// GET /api/rfqs/:id/thread — get email thread
router.get("/rfqs/:id/thread", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id);
    if (!rfq || !rfq.emailId) { res.status(404).json({ error: "RFQ not found" }); return; }

    const originalEmail = await Email.findById(rfq.emailId);
    if (!originalEmail) { res.json([]); return; }

    // Find replies (not the original)
    const replies = await Email.find({
      $or: [
        { parentEmailId: originalEmail._id },
        ...(originalEmail.messageId ? [{ inReplyTo: originalEmail.messageId }] : []),
      ],
      _id: { $ne: originalEmail._id },
    }).sort({ receivedAt: 1 });

    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: "Failed to get thread" });
  }
});

// POST /api/rfqs/:id/re-extract — re-run Claude extraction with full thread
router.post("/rfqs/:id/re-extract", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id).populate("emailId");
    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

    const email = rfq.emailId as any;
    if (!email) { res.status(400).json({ error: "No email linked" }); return; }

    // Build full thread: original email + all replies
    const { Email: EmailModel } = require("../models/email");
    const replies = await EmailModel.find({ parentEmailId: email._id }).sort({ receivedAt: 1 });

    let threadBody = email.body || "";
    if (replies.length > 0) {
      const replyTexts = replies.map((r: any) =>
        `\n\n──────────────\nReply from ${r.fromName} on ${r.receivedAt?.toISOString?.() || "unknown"}:\n${r.body}`
      ).join("");
      threadBody = `Original:\n${email.body}${replyTexts}`;
    }

    const { extractWithClaude } = require("../lib/ai-extract");
    const extraction = await extractWithClaude(
      { fromName: email.fromName, fromEmail: email.fromEmail, subject: email.subject, body: threadBody },
      rfq.emailType
    );

    if (extraction.shipments.length > 0) {
      const s = extraction.shipments[0];
      // Advance status if replies exist
      let newStatus = s.status;
      if (replies.length > 0 && s.missing.length === 0) newStatus = "ready";
      else if (replies.length > 0) newStatus = "replied";

      const updated = await Rfq.findByIdAndUpdate(rfq._id, {
        status: newStatus as any,
        fields: s.fields,
        missingFields: s.missing,
        followUpDraft: extraction.combinedDraft || s.draft,
      }, { new: true });
      res.json(updated);
    } else {
      res.json(rfq);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to re-extract" });
  }
});

export { router as rfqsRouter };
