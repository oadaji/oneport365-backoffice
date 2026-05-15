import { Router, Request, Response } from "express";
import { Partner } from "../models/partner";

const router = Router();

router.get("/partners", async (_req: Request, res: Response) => {
  try {
    const partners = await Partner.find().sort({ createdAt: -1 });
    res.json(partners);
  } catch (err) {
    res.status(500).json({ error: "Failed to load partners" });
  }
});

router.post("/partners", async (req: Request, res: Response) => {
  try {
    const partner = await Partner.create(req.body);
    res.status(201).json(partner);
  } catch (err) {
    res.status(500).json({ error: "Failed to create partner" });
  }
});

router.patch("/partners/:id", async (req: Request, res: Response) => {
  try {
    const updated = await Partner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) { res.status(404).json({ error: "Partner not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update partner" });
  }
});

router.delete("/partners/:id", async (req: Request, res: Response) => {
  try {
    await Partner.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete partner" });
  }
});

export { router as partnersRouter };
