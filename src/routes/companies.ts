import { Router, Request, Response } from "express";
import { Company } from "../models/company";
import { Contact } from "../models/contact";
import { Rfq } from "../models/rfq";
import { Quote } from "../models/quote";
import { Email } from "../models/email";

const router = Router();

// GET /api/companies
router.get("/companies", async (_req: Request, res: Response) => {
  try {
    const companies = await Company.find().sort({ updatedAt: -1 });
    const result = await Promise.all(
      companies.map(async (c) => {
        const contactCount = await Contact.countDocuments({ companyId: c._id });
        const rfqCount = await Rfq.countDocuments({ companyId: c._id });
        const quoteCount = await Quote.countDocuments({ companyId: c._id });
        return { ...c.toObject(), contactCount, rfqCount, quoteCount };
      })
    );
    res.json({ companies: result, total: result.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to load companies" });
  }
});

// GET /api/companies/:id
router.get("/companies/:id", async (req: Request, res: Response) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }

    const contacts = await Contact.find({ companyId: company._id }).sort({ isPrimary: -1 });
    const rfqs = await Rfq.find({ companyId: company._id }).sort({ createdAt: -1 });
    const quotes = await Quote.find({ companyId: company._id }).sort({ createdAt: -1 });

    const contactIds = contacts.map((c) => c._id);
    const recentEmails = contactIds.length
      ? await Email.find({ contactId: { $in: contactIds } }).sort({ receivedAt: -1 }).limit(20)
      : [];

    const activeRfqs = rfqs.filter((r) => r.status !== "archived").length;
    const totalRevenue = quotes.reduce((sum, q) => sum + (q.sellPriceUSD || 0), 0);

    res.json({
      company,
      contacts,
      rfqs,
      quotes,
      recentEmails,
      stats: {
        totalRfqs: rfqs.length,
        activeRfqs,
        totalQuotes: quotes.length,
        totalRevenue,
        firstContact: rfqs.length ? rfqs[rfqs.length - 1].createdAt : company.createdAt,
        lastContact: rfqs.length ? rfqs[0].createdAt : company.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get company" });
  }
});

// POST /api/companies
router.post("/companies", async (req: Request, res: Response) => {
  try {
    const company = await Company.create(req.body);
    res.status(201).json(company);
  } catch (err) {
    res.status(500).json({ error: "Failed to create company" });
  }
});

// PATCH /api/companies/:id
router.patch("/companies/:id", async (req: Request, res: Response) => {
  try {
    const { name, domain, industry, address, city, state, country, phone, website, tradeCorridors, cargoTypes, notes, tags, status } = req.body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (domain !== undefined) patch.domain = domain;
    if (industry !== undefined) patch.industry = industry;
    if (address !== undefined) patch.address = address;
    if (city !== undefined) patch.city = city;
    if (state !== undefined) patch.state = state;
    if (country !== undefined) patch.country = country;
    if (phone !== undefined) patch.phone = phone;
    if (website !== undefined) patch.website = website;
    if (tradeCorridors !== undefined) patch.tradeCorridors = tradeCorridors;
    if (cargoTypes !== undefined) patch.cargoTypes = cargoTypes;
    if (notes !== undefined) patch.notes = notes;
    if (tags !== undefined) patch.tags = tags;
    if (status !== undefined) patch.status = status;

    const updated = await Company.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!updated) { res.status(404).json({ error: "Company not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update company" });
  }
});

// DELETE /api/companies/:id (soft delete)
router.delete("/companies/:id", async (req: Request, res: Response) => {
  try {
    const updated = await Company.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!updated) { res.status(404).json({ error: "Company not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete company" });
  }
});

// POST /api/companies/:id/merge
router.post("/companies/:id/merge", async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const { mergeFromId } = req.body;
    if (!mergeFromId) { res.status(400).json({ error: "mergeFromId is required" }); return; }

    await Contact.updateMany({ companyId: mergeFromId }, { companyId: targetId });
    await Rfq.updateMany({ companyId: mergeFromId }, { companyId: targetId });
    await Quote.updateMany({ companyId: mergeFromId }, { companyId: targetId });
    await Company.findByIdAndUpdate(mergeFromId, { status: "inactive" });

    const company = await Company.findById(targetId);
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: "Failed to merge companies" });
  }
});

export { router as companiesRouter };
