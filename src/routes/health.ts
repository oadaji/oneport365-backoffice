import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
    envKeys: Object.keys(process.env).filter(k => k.includes("ANTHROPIC") || k.includes("CLAUDE") || k.includes("MONGO") || k.includes("PORT") || k.includes("RAILWAY")),
  });
});

// GET /api/health/claude — test Claude API connection
router.get("/health/claude", async (_req: Request, res: Response) => {
  try {
    const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!key) {
      res.json({ ok: false, error: "Neither ANTHROPIC_API_KEY nor CLAUDE_API_KEY is set" });
      return;
    }

    const anthropic = new Anthropic({ apiKey: key });
    const models = [
      "claude-sonnet-4-5-20241022",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-latest",
      "claude-3-haiku-20240307",
      "claude-3-sonnet-20240229",
    ];

    for (const model of models) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 20,
          messages: [{ role: "user", content: "Say OK" }],
        });
        const text = (response.content[0] as any).text || "";
        res.json({ ok: true, response: text, model: response.model, triedModel: model });
        return;
      } catch (e: any) {
        if (!e.message?.includes("not_found")) throw e;
        // try next model
      }
    }
    res.json({ ok: false, error: "No available model found", triedModels: models });
  } catch (err: any) {
    res.json({ ok: false, error: err.message, type: err.constructor.name });
  }
});

export { router as healthRouter };
