import * as msal from "@azure/msal-node";
import crypto from "crypto";

const clientId = process.env.MICROSOFT_CLIENT_ID || "";
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
const redirectUri =
  process.env.MICROSOFT_REDIRECT_URI ||
  "http://localhost:5001/api/auth/microsoft/callback";

const SCOPES = [
  "https://outlook.office365.com/IMAP.AccessAsUser.All",
  "offline_access",
  "openid",
  "email",
  "profile",
];

function getClient(): msal.ConfidentialClientApplication {
  return new msal.ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: "https://login.microsoftonline.com/4142fdca-ff6c-4f47-b52e-054abe525951",
    },
  });
}

/** Generate the Azure AD login URL */
export async function getAuthUrl(state?: string): Promise<string> {
  const client = getClient();
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri,
    state: state || "",
    prompt: "select_account",
    correlationId: crypto.randomUUID(),
  });
}

/** Exchange authorization code for tokens */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
  name: string;
}> {
  const client = getClient();
  const result = await client.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri,
  });

  if (!result) throw new Error("Token exchange failed");

  const claims = result.idTokenClaims as Record<string, any>;
  const email =
    claims?.preferred_username ||
    claims?.email ||
    result.account?.username ||
    "";

  return {
    accessToken: result.accessToken,
    refreshToken: (result as any).refreshToken || "",
    expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
    email: email.toLowerCase(),
    name: claims?.name || email,
  };
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const client = getClient();
  const result = await client.acquireTokenByRefreshToken({
    refreshToken,
    scopes: SCOPES,
  });

  if (!result) throw new Error("Token refresh failed");

  return {
    accessToken: result.accessToken,
    refreshToken: (result as any).refreshToken || refreshToken,
    expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
  };
}

/** Get a valid access token for an account, refreshing if needed */
export async function getValidToken(account: {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}): Promise<string> {
  if (!account.refreshToken) {
    throw new Error("No refresh token available — user must re-authenticate");
  }

  // If token is still valid (with 5 min buffer), return it
  if (
    account.accessToken &&
    account.tokenExpiresAt &&
    new Date(account.tokenExpiresAt).getTime() > Date.now() + 5 * 60 * 1000
  ) {
    return account.accessToken;
  }

  // Refresh
  const refreshed = await refreshAccessToken(account.refreshToken);
  return refreshed.accessToken;
}
