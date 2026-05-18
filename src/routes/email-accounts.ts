import { Router, Request, Response } from "express";
import { ImapFlow } from "imapflow";
import { EmailAccount } from "../models/email-account";

const router = Router();

// GET /api/email-accounts
router.get("/email-accounts", async (_req: Request, res: Response) => {
  try {
    const accounts = await EmailAccount.find().select("-password -refreshToken -accessToken").sort({ createdAt: 1 });
    const result = accounts.map((acc) => ({ ...acc.toObject(), isEnvAccount: false }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to load email accounts" });
  }
});

// POST /api/email-accounts — add new account
router.post("/email-accounts", async (req: Request, res: Response) => {
  try {
    const { email, password, label, provider, imapHost, imapPort } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    // Auto-detect provider
    const isOutlook = ["outlook.com", "hotmail.com", "live.com", "msn.com"].some((d) => email.includes(d));
    const detectedProvider = provider || (isOutlook ? "outlook" : "gmail");
    const detectedHost = imapHost || (isOutlook ? "outlook.office365.com" : "imap.gmail.com");

    const account = await EmailAccount.create({
      email,
      password,
      label: label || email,
      provider: detectedProvider,
      imapHost: detectedHost,
      imapPort: imapPort || 993,
    });

    const { password: _, ...safe } = account.toObject();
    res.status(201).json(safe);
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(409).json({ error: "Email account already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to add email account" });
  }
});

// DELETE /api/email-accounts/:id
router.delete("/email-accounts/:id", async (req: Request, res: Response) => {
  try {
    await EmailAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete email account" });
  }
});

// POST /api/email-accounts/:id/test — test IMAP connection
router.post("/email-accounts/:id/test", async (req: Request, res: Response) => {
  try {
    const account = await EmailAccount.findById(req.params.id);
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }

    const isOutlook = account.provider === "outlook";
    const client = new ImapFlow({
      host: account.imapHost || (isOutlook ? "outlook.office365.com" : "imap.gmail.com"),
      port: account.imapPort || 993,
      secure: true,
      auth: { user: account.email, pass: account.password },
      logger: false,
    });

    client.on("error", () => {});
    await client.connect();
    const status = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout();

    // Clear lastError on successful test
    await EmailAccount.findByIdAndUpdate(req.params.id, { lastError: null });
    res.json({ ok: true, message: `Connected. ${status.messages} messages, ${status.unseen} unread.` });
  } catch (err: any) {
    const msg = err.message?.includes("AUTHENTICATIONFAILED")
      ? "Authentication failed — check your app password"
      : `Connection failed: ${err.message}`;
    res.json({ ok: false, message: msg });
  }
});

// POST /api/email-accounts/test-credentials — test before saving
router.post("/email-accounts/test-credentials", async (req: Request, res: Response) => {
  try {
    const { email, password, imapHost, imapPort } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }

    const isOutlook = ["outlook.com", "hotmail.com", "live.com", "msn.com"].some((d) => email.includes(d));
    const host = imapHost || (isOutlook ? "outlook.office365.com" : "imap.gmail.com");

    const client = new ImapFlow({
      host,
      port: imapPort || 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    client.on("error", () => {});
    await client.connect();
    const status = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout();

    res.json({ ok: true, message: `Connected. ${status.messages} messages, ${status.unseen} unread.` });
  } catch (err: any) {
    const msg = err.message?.includes("AUTHENTICATIONFAILED")
      ? "Authentication failed — check your app password"
      : `Connection failed: ${err.message}`;
    res.json({ ok: false, message: msg });
  }
});

export { router as emailAccountsRouter };
