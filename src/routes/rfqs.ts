import { Router, Request, Response } from "express";
import { Rfq } from "../models/rfq";
import { Email } from "../models/email";
import { extractWithClaude } from "../lib/ai-extract";
import { resolveContact } from "../lib/resolve-contact";
import { EmailAccount } from "../models/email-account";
import nodemailer from "nodemailer";
import { findThreadReplies } from "../lib/thread";
import { resolveSender } from "../lib/resolve-sender";
import crypto from "crypto";

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

// POST /api/rfqs/:id/send-followup — send follow-up email via EmailAccount
router.post("/rfqs/:id/send-followup", async (req: Request, res: Response) => {
  try {
    const rfq = await Rfq.findById(req.params.id).populate("emailId");
    if (!rfq) { res.status(404).json({ error: "RFQ not found" }); return; }

    const email = rfq.emailId as any;
    const { draft, cc, fromEmail } = req.body;

    // Look up sender account: prefer user's choice, then receivedInbox, then first active
    let senderAccount = fromEmail
      ? await EmailAccount.findOne({ email: fromEmail, active: true })
      : null;
    if (!senderAccount && email?.receivedInbox) {
      senderAccount = await EmailAccount.findOne({ email: email.receivedInbox, active: true });
    }
    if (!senderAccount) {
      senderAccount = await EmailAccount.findOne({ active: true });
    }
    if (!senderAccount) {
      res.status(400).json({ error: "No email account configured — add one via Email Monitoring first" });
      return;
    }

    const isOutlook = senderAccount.provider === "outlook";
    const transporter = nodemailer.createTransport({
      host: isOutlook ? "smtp.office365.com" : "smtp.gmail.com",
      port: isOutlook ? 587 : 465,
      secure: !isOutlook,
      auth: { user: senderAccount.email, pass: senderAccount.password },
    });

    const toAddress = rfq.resolvedSenderEmail || email?.fromEmail;
    await transporter.sendMail({
      from: senderAccount.email,
      to: toAddress,
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

    const replies = await findThreadReplies(originalEmail);
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
    const replies = await findThreadReplies(email);

    let threadBody = email.body || "";
    if (replies.length > 0) {
      const replyTexts = replies.map((r: any) =>
        `\n\n──────────────\nReply from ${r.fromName} on ${r.receivedAt?.toISOString?.() || "unknown"}:\n${r.body}`
      ).join("");
      threadBody = `Original:\n${email.body}${replyTexts}`;
    }

    // Content-hash: skip Claude if thread body hasn't changed
    const normalized = threadBody.replace(/\s+/g, " ").replace(/^>.*$/gm, "").trim();
    const threadHash = crypto.createHash("sha256").update(normalized).digest("hex");
    if (rfq.lastExtractionHash === threadHash) {
      res.json(rfq);
      return;
    }

    // Capture prior missing fields for status comparison
    const priorMissing = rfq.missingFields || [];

    const extraction = await extractWithClaude(
      { fromName: email.fromName, fromEmail: email.fromEmail, subject: email.subject, body: threadBody },
      rfq.emailType
    );

    if (extraction.status === "error") {
      res.status(502).json({ error: "Extraction failed", details: extraction.error });
      return;
    }

    if (extraction.shipments.length === 0) {
      res.json(rfq);
      return;
    }

    // Helper to compute status for a single shipment update
    function computeStatus(newMissing: string[], priorMissingForSibling: string[], hasReplies: boolean, claudeStatus: string): string {
      if (!hasReplies) return claudeStatus;
      if (newMissing.length === 0) return "ready";
      if (newMissing.length < priorMissingForSibling.length) return "partial";
      return "stuck";
    }

    // Multi-shipment: update all siblings in the group
    if (rfq.groupId) {
      const siblings = await Rfq.find({ groupId: rfq.groupId }).sort({ groupIndex: 1 });

      if (siblings.length !== extraction.shipments.length) {
        console.warn(`Re-extract group mismatch: ${siblings.length} siblings vs ${extraction.shipments.length} shipments for groupId=${rfq.groupId}. Updating by best-effort index match.`);
      }

      let updatedRfq = rfq;
      for (let idx = 0; idx < siblings.length; idx++) {
        const sibling = siblings[idx];
        const shipment = extraction.shipments[idx];
        if (!shipment) continue; // Claude returned fewer shipments than siblings

        const siblingPriorMissing = sibling.missingFields || [];
        const newMissing = shipment.missing || [];
        const newStatus = computeStatus(newMissing, siblingPriorMissing, replies.length > 0, shipment.status);

        const sender = resolveSender({ fromName: email.fromName, fromEmail: email.fromEmail, body: email.body }, shipment.fields);
        const result = await Rfq.findByIdAndUpdate(sibling._id, {
          status: newStatus as any,
          fields: shipment.fields,
          missingFields: newMissing,
          followUpDraft: idx === 0 ? (extraction.combinedDraft || shipment.draft) : undefined,
          resolvedSenderName: sender.name,
          resolvedSenderEmail: sender.email,
          lastExtractionHash: threadHash,
        }, { new: true });

        if (sibling._id.toString() === rfq._id.toString()) {
          updatedRfq = result || rfq;
        }
      }

      res.json(updatedRfq);
    } else {
      // Single shipment
      const s = extraction.shipments[0];
      const newMissing = s.missing || [];
      const newStatus = computeStatus(newMissing, priorMissing, replies.length > 0, s.status);

      const sender = resolveSender({ fromName: email.fromName, fromEmail: email.fromEmail, body: email.body }, s.fields);
      const updated = await Rfq.findByIdAndUpdate(rfq._id, {
        status: newStatus as any,
        fields: s.fields,
        missingFields: newMissing,
        followUpDraft: extraction.combinedDraft || s.draft,
        resolvedSenderName: sender.name,
        resolvedSenderEmail: sender.email,
        lastExtractionHash: threadHash,
      }, { new: true });
      res.json(updated);
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to re-extract" });
  }
});

// POST /api/emails/:id/retry-extraction — retry extraction on a failed email
router.post("/emails/:id/retry-extraction", async (req: Request, res: Response) => {
  try {
    const email = await Email.findById(req.params.id);
    if (!email) { res.status(404).json({ error: "Email not found" }); return; }
    if (email.extractionStatus !== "failed") {
      res.status(400).json({ error: "Email extraction did not fail — nothing to retry" });
      return;
    }

    const extraction = await extractWithClaude(
      { fromName: email.fromName, fromEmail: email.fromEmail, subject: email.subject, body: email.body },
      "customer-rfq"
    );

    if (extraction.status === "error") {
      await Email.findByIdAndUpdate(email._id, { extractionError: extraction.error });
      res.status(502).json({ error: "Extraction failed again", details: extraction.error, errorType: extraction.errorType });
      return;
    }

    const resolvedType = extraction.detectedEmailType || "irrelevant";
    if (resolvedType !== "customer-rfq" && resolvedType !== "internal-rfq" && resolvedType !== "rate-reply") {
      await Email.findByIdAndUpdate(email._id, { extractionStatus: "ok", extractionError: undefined, emailType: resolvedType });
      res.json({ success: true, skipped: true, reason: `Classified as ${resolvedType}` });
      return;
    }

    if (!extraction.shipments || extraction.shipments.length === 0) {
      await Email.findByIdAndUpdate(email._id, { extractionStatus: "ok", extractionError: undefined, emailType: resolvedType });
      res.json({ success: true, skipped: true, reason: "No shipments extracted" });
      return;
    }

    // Confirmed freight — resolve contact and create RFQs
    const crm = await resolveContact({ email: email.fromEmail, name: email.fromName, source: "email" });

    await Email.findByIdAndUpdate(email._id, {
      extractionStatus: "ok",
      extractionError: undefined,
      emailType: resolvedType,
      contactId: crm.contactId,
    });

    const isGroup = extraction.shipments.length > 1;
    const groupId = isGroup ? crypto.randomUUID() : undefined;
    const now = new Date();
    const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");

    const rfqs = [];
    for (let idx = 0; idx < extraction.shipments.length; idx++) {
      const s = extraction.shipments[idx];
      const rand = String(Math.floor(Math.random() * 9000) + 1000);
      const rfq = await Rfq.create({
        emailId: email._id,
        ref: `RFQ-${yymm}-${rand}`,
        emailType: resolvedType,
        status: s.status as any,
        fields: s.fields,
        missingFields: s.missing,
        followUpDraft: (isGroup ? (idx === 0 ? extraction.combinedDraft : undefined) : (extraction.combinedDraft || s.draft)) || undefined,
        groupId,
        groupIndex: isGroup ? idx + 1 : undefined,
        groupTotal: isGroup ? extraction.shipments.length : undefined,
        sourceMessageId: email.messageId || undefined,
        companyId: crm.companyId || undefined,
        contactId: crm.contactId,
      });
      rfqs.push(rfq);
    }

    res.json({ success: true, rfqsCreated: rfqs.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to retry extraction" });
  }
});

export { router as rfqsRouter };
