import { Router, Request, Response } from "express";
import { Activity } from "../models/activity";

const router = Router();

// GET /api/activities — list activities with filters
router.get("/activities", async (req: Request, res: Response) => {
  try {
    const { companyId, contactId, opportunityId, limit = "50" } = req.query;

    const filter: Record<string, any> = {};
    if (companyId) filter.companyId = companyId;
    if (contactId) filter.contactId = contactId;
    if (opportunityId) filter.opportunityId = opportunityId;

    const activities = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10))
      .lean();

    res.json({ activities });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch activities", details: err.message });
  }
});

// GET /api/activities/:id — get single activity
router.get("/activities/:id", async (req: Request, res: Response) => {
  try {
    const activity = await Activity.findById(req.params.id).lean();
    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    res.json(activity);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch activity", details: err.message });
  }
});

// POST /api/activities — create activity (manual note/call/meeting)
router.post("/activities", async (req: Request, res: Response) => {
  try {
    const { companyId, contactId, opportunityId, type, summary, body, user, metadata } = req.body;

    if (!type || !summary) {
      res.status(400).json({ error: "type and summary are required" });
      return;
    }

    const activity = await Activity.create({
      companyId: companyId || undefined,
      contactId: contactId || undefined,
      opportunityId: opportunityId || undefined,
      type,
      summary,
      body: body || undefined,
      user: user || undefined,
      metadata: metadata || undefined,
    });

    res.status(201).json(activity);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create activity", details: err.message });
  }
});

// DELETE /api/activities/:id — delete activity
router.delete("/activities/:id", async (req: Request, res: Response) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete activity", details: err.message });
  }
});

export { router as activitiesRouter };
