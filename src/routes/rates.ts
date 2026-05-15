import { Router, Request, Response } from "express";
import { OceanFreightRate, HaulageImportRate, HaulageExportRate, OtherCharge } from "../models/rate";

const router = Router();

// Ocean Freight Rates
router.get("/rates/ocean", async (_req: Request, res: Response) => {
  try {
    const rates = await OceanFreightRate.find({ archived: false }).populate("partnerId", "name").sort({ createdAt: -1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to load ocean rates" });
  }
});

router.post("/rates/ocean", async (req: Request, res: Response) => {
  try {
    const rates = Array.isArray(req.body) ? await OceanFreightRate.insertMany(req.body) : [await OceanFreightRate.create(req.body)];
    res.status(201).json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to create ocean rate" });
  }
});

router.patch("/rates/ocean/:id", async (req: Request, res: Response) => {
  try {
    const updated = await OceanFreightRate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) { res.status(404).json({ error: "Rate not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update rate" });
  }
});

router.delete("/rates/ocean/:id", async (req: Request, res: Response) => {
  try {
    await OceanFreightRate.findByIdAndUpdate(req.params.id, { archived: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete rate" });
  }
});

// Haulage Import Rates
router.get("/rates/haulage-import", async (_req: Request, res: Response) => {
  try {
    const rates = await HaulageImportRate.find({ archived: false }).sort({ createdAt: -1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to load haulage import rates" });
  }
});

router.post("/rates/haulage-import", async (req: Request, res: Response) => {
  try {
    const rates = Array.isArray(req.body) ? await HaulageImportRate.insertMany(req.body) : [await HaulageImportRate.create(req.body)];
    res.status(201).json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to create haulage import rate" });
  }
});

// Haulage Export Rates
router.get("/rates/haulage-export", async (_req: Request, res: Response) => {
  try {
    const rates = await HaulageExportRate.find({ archived: false }).sort({ createdAt: -1 });
    res.json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to load haulage export rates" });
  }
});

router.post("/rates/haulage-export", async (req: Request, res: Response) => {
  try {
    const rates = Array.isArray(req.body) ? await HaulageExportRate.insertMany(req.body) : [await HaulageExportRate.create(req.body)];
    res.status(201).json(rates);
  } catch (err) {
    res.status(500).json({ error: "Failed to create haulage export rate" });
  }
});

// Other Charges
router.get("/rates/other-charges", async (_req: Request, res: Response) => {
  try {
    const charges = await OtherCharge.find({ archived: false }).sort({ createdAt: -1 });
    res.json(charges);
  } catch (err) {
    res.status(500).json({ error: "Failed to load other charges" });
  }
});

router.post("/rates/other-charges", async (req: Request, res: Response) => {
  try {
    const charges = Array.isArray(req.body) ? await OtherCharge.insertMany(req.body) : [await OtherCharge.create(req.body)];
    res.status(201).json(charges);
  } catch (err) {
    res.status(500).json({ error: "Failed to create other charge" });
  }
});

export { router as ratesRouter };
