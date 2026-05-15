import { Router, Request, Response } from "express";
import { AppSetting } from "../models/market";

const router = Router();

router.get("/settings", async (_req: Request, res: Response) => {
  try {
    const settings = await AppSetting.find();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/settings/:key", async (req: Request, res: Response) => {
  try {
    const { value, label } = req.body;
    const setting = await AppSetting.findOneAndUpdate(
      { key: req.params.key },
      { key: req.params.key, value, label },
      { upsert: true, new: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

router.delete("/settings/:key", async (req: Request, res: Response) => {
  try {
    await AppSetting.findOneAndDelete({ key: req.params.key });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete setting" });
  }
});

export { router as settingsRouter };
