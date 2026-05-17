import { Router, Request, Response } from "express";
import { EmailAccount } from "../models/email-account";
import { getGoogleAuthUrl, exchangeGoogleCode } from "../lib/gmail-api";

const router = Router();

// GET /api/auth/google — redirect to Google OAuth consent
router.get("/auth/google", (_req: Request, res: Response) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(500).json({ error: "Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" });
    return;
  }
  const url = getGoogleAuthUrl();
  res.redirect(url);
});

// GET /api/auth/google/callback — exchange code, create/update email account
router.get("/auth/google/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: "Missing authorization code" });
      return;
    }

    const tokens = await exchangeGoogleCode(code);

    if (!tokens.email) {
      res.status(400).json({ error: "Could not determine email from Google account" });
      return;
    }

    // Upsert email account
    const existing = await EmailAccount.findOne({ email: tokens.email });
    if (existing) {
      existing.refreshToken = tokens.refreshToken;
      existing.accessToken = tokens.accessToken;
      existing.authType = "oauth2";
      existing.provider = "gmail";
      existing.active = true;
      existing.lastError = undefined;
      await existing.save();
    } else {
      await EmailAccount.create({
        email: tokens.email,
        label: tokens.name || tokens.email,
        provider: "gmail",
        authType: "oauth2",
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        active: true,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/?gmail=connected&email=${encodeURIComponent(tokens.email)}`);
  } catch (err: any) {
    console.error("Google OAuth callback error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/?gmail=error&message=${encodeURIComponent(err.message)}`);
  }
});

export { router as googleAuthRouter };
