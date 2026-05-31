import { Router, Request, Response } from "express";
import { EmailAccount } from "../models/email-account";
import {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
} from "../lib/microsoft-oauth";

const router = Router();

// GET /api/auth/microsoft/url — return auth URL as JSON (avoids browser redirect caching)
router.get("/auth/microsoft/url", async (_req: Request, res: Response) => {
  try {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      res.status(500).json({ error: "Microsoft OAuth not configured — set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env" });
      return;
    }
    const shared = _req.query.shared === "true" ? "shared" : "";
    const url = await getAuthUrl(shared);
    res.set("Cache-Control", "no-store");
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate auth URL", details: err.message });
  }
});

// GET /api/auth/microsoft — redirect user to Azure AD login (legacy, also works)
router.get("/auth/microsoft", async (_req: Request, res: Response) => {
  try {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      res.status(500).json({ error: "Microsoft OAuth not configured — set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env" });
      return;
    }
    const shared = _req.query.shared === "true" ? "shared" : "";
    const url = await getAuthUrl(shared);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.redirect(url);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate auth URL", details: err.message });
  }
});

// GET /api/auth/microsoft/callback — exchange code for tokens, create/update email account
router.get("/auth/microsoft/callback", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  try {
    const code = req.query.code as string;
    const error = req.query.error as string;
    if (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/?outlook=error&message=${encodeURIComponent(req.query.error_description as string || error)}`);
      return;
    }
    if (!code) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/?outlook=error&message=${encodeURIComponent("No authorization code received. Please try again.")}`);
      return;
    }

    console.log("[OUTLOOK] Exchanging code for tokens...");
    const tokens = await exchangeCode(code);
    const isShared = (req.query.state as string) === "shared";
    console.log(`[OUTLOOK] Got tokens — email=${tokens.email}, hasRefresh=${!!tokens.refreshToken}, expiresAt=${tokens.expiresAt}`);

    if (!tokens.email) {
      console.error("[OUTLOOK] No email in token claims");
      res.status(400).json({ error: "Could not determine email from Microsoft account" });
      return;
    }

    // Upsert email account
    console.log(`[OUTLOOK] Saving account for ${tokens.email}...`);
    const existing = await EmailAccount.findOne({ email: tokens.email });
    if (existing) {
      console.log(`[OUTLOOK] Updating existing account ${existing._id}`);
      existing.accessToken = tokens.accessToken;
      existing.refreshToken = tokens.refreshToken;
      existing.tokenExpiresAt = tokens.expiresAt;
      existing.authType = "oauth2";
      existing.provider = "outlook";
      existing.active = true;
      existing.shared = isShared;
      existing.lastError = undefined;
      await existing.save();
    } else {
      console.log(`[OUTLOOK] Creating new account for ${tokens.email}`);
      await EmailAccount.create({
        email: tokens.email,
        label: tokens.name || tokens.email,
        provider: "outlook",
        authType: "oauth2",
        shared: isShared,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        imapHost: "outlook.office365.com",
        imapPort: 993,
        active: true,
      });
    }
    console.log(`[OUTLOOK] Account saved successfully for ${tokens.email}`);

    // Redirect to frontend RFQ dashboard
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/?outlook=connected&email=${encodeURIComponent(tokens.email)}`);
  } catch (err: any) {
    console.error(`[OUTLOOK] ERROR in callback: ${err.message}`);
    console.error(`[OUTLOOK] Stack: ${err.stack}`);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/?outlook=error&message=${encodeURIComponent(`[${err.name || "Error"}] ${err.message}`)}`);
  }
});

// POST /api/auth/microsoft/refresh/:id — manually refresh token for an account
router.post("/auth/microsoft/refresh/:id", async (req: Request, res: Response) => {
  try {
    const account = await EmailAccount.findById(req.params.id);
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    if (account.authType !== "oauth2" || !account.refreshToken) {
      res.status(400).json({ error: "Account is not using OAuth2" });
      return;
    }

    const refreshed = await refreshAccessToken(account.refreshToken);
    account.accessToken = refreshed.accessToken;
    account.refreshToken = refreshed.refreshToken;
    account.tokenExpiresAt = refreshed.expiresAt;
    account.lastError = undefined;
    await account.save();

    res.json({ ok: true, expiresAt: refreshed.expiresAt });
  } catch (err: any) {
    res.status(500).json({ error: "Token refresh failed", details: err.message });
  }
});

export { router as microsoftAuthRouter };
