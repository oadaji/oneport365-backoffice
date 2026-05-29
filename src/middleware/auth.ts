import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const HMAC_SECRET = "oneport365-app-auth";

export function generateToken(password: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(password).digest("hex");
}

/**
 * Simple shared-password auth middleware.
 * Checks x-app-token header against APP_PASSWORD env var.
 * Skips auth for health checks and the login endpoint.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const appPassword = process.env.APP_PASSWORD;

  // If no password configured, skip auth entirely
  if (!appPassword) {
    next();
    return;
  }

  // Allow health check without auth (Railway needs this)
  if (req.path === "/api/health" || req.path === "/api/health/claude") {
    next();
    return;
  }

  // Allow login endpoint without auth
  if (req.path === "/api/auth/login" && req.method === "POST") {
    next();
    return;
  }

  // Check token
  const token = req.headers["x-app-token"] as string;
  const expectedToken = generateToken(appPassword);

  if (token === expectedToken) {
    next();
    return;
  }

  // For non-API requests (frontend static files), let them through
  // The frontend will handle showing the login screen
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
