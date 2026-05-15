import { Router, Request, Response } from "express";
import { Contact } from "../models/contact";
import { Company } from "../models/company";
import { Rfq } from "../models/rfq";
import { Quote } from "../models/quote";
import { Email } from "../models/email";

const router = Router();

// GET /api/contacts
router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const contacts = await Contact.find().populate("companyId", "name").sort({ updatedAt: -1 });
    const result = contacts.map((c) => ({
      ...c.toObject(),
      companyName: (c.companyId as any)?.name || null,
    }));
    res.json({ contacts: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to load contacts" });
  }
});

// GET /api/contacts/:id
router.get("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) { res.status(404).json({ error: "Contact not found" }); return; }

    const company = contact.companyId ? await Company.findById(contact.companyId) : null;
    const rfqs = await Rfq.find({ contactId: contact._id }).sort({ createdAt: -1 });
    const quotes = await Quote.find({ contactId: contact._id }).sort({ createdAt: -1 });
    const emails = await Email.find({ contactId: contact._id }).sort({ receivedAt: -1 }).limit(50);

    res.json({
      contact,
      company,
      rfqs,
      quotes,
      emails,
      stats: {
        totalRfqs: rfqs.length,
        lastRfqDate: rfqs.length ? rfqs[0].createdAt : null,
        totalQuotes: quotes.length,
        lastContactedAt: contact.lastContactedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get contact" });
  }
});

// POST /api/contacts
router.post("/contacts", async (req: Request, res: Response) => {
  try {
    if (!req.body.firstName) { res.status(400).json({ error: "firstName is required" }); return; }
    if (!req.body.email && !req.body.phone && !req.body.whatsappPhone) {
      res.status(400).json({ error: "At least one of email, phone, or whatsappPhone is required" }); return;
    }
    const contact = await Contact.create(req.body);
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: "Failed to create contact" });
  }
});

// PATCH /api/contacts/:id
router.patch("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, whatsappPhone, jobTitle, role, isPrimary, companyId, notes, tags } = req.body;
    const patch: Record<string, unknown> = {};
    if (firstName !== undefined) patch.firstName = firstName;
    if (lastName !== undefined) patch.lastName = lastName;
    if (email !== undefined) patch.email = email;
    if (phone !== undefined) patch.phone = phone;
    if (whatsappPhone !== undefined) patch.whatsappPhone = whatsappPhone;
    if (jobTitle !== undefined) patch.jobTitle = jobTitle;
    if (role !== undefined) patch.role = role;
    if (isPrimary !== undefined) patch.isPrimary = isPrimary;
    if (companyId !== undefined) patch.companyId = companyId || null;
    if (notes !== undefined) patch.notes = notes;
    if (tags !== undefined) patch.tags = tags;

    const updated = await Contact.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) { res.status(404).json({ error: "Contact not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// DELETE /api/contacts/:id
router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    await Rfq.updateMany({ contactId: req.params.id }, { contactId: null });
    await Quote.updateMany({ contactId: req.params.id }, { contactId: null });
    await Email.updateMany({ contactId: req.params.id }, { contactId: null });
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// POST /api/contacts/:id/merge
router.post("/contacts/:id/merge", async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const { mergeFromId } = req.body;
    if (!mergeFromId) { res.status(400).json({ error: "mergeFromId is required" }); return; }

    await Rfq.updateMany({ contactId: mergeFromId }, { contactId: targetId });
    await Quote.updateMany({ contactId: mergeFromId }, { contactId: targetId });
    await Email.updateMany({ contactId: mergeFromId }, { contactId: targetId });
    await Contact.findByIdAndDelete(mergeFromId);

    const contact = await Contact.findById(targetId);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: "Failed to merge contacts" });
  }
});

export { router as contactsRouter };
