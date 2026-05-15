import { Router, Request, Response } from "express";
import { Quote } from "../models/quote";

const router = Router();

// GET /api/quotes
router.get("/quotes", async (_req: Request, res: Response) => {
  try {
    const quotes = await Quote.find()
      .populate("companyId", "name")
      .populate("contactId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

// GET /api/quotes/:id
router.get("/quotes/:id", async (req: Request, res: Response) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate("companyId")
      .populate("contactId");
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to get quote" });
  }
});

// POST /api/quotes
router.post("/quotes", async (req: Request, res: Response) => {
  try {
    const quote = await Quote.create(req.body);
    res.status(201).json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to create quote" });
  }
});

// PATCH /api/quotes/:id
router.patch("/quotes/:id", async (req: Request, res: Response) => {
  try {
    const updated = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update quote" });
  }
});

// DELETE /api/quotes/:id
router.delete("/quotes/:id", async (req: Request, res: Response) => {
  try {
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

export { router as quotesRouter };
