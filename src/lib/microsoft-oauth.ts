import * as msal from "@azure/msal-node";
import crypto from "crypto";
import axios from "axios";

const clientId = process.env.MICROSOFT_CLIENT_ID || "";
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
const tenantId = "4142fdca-ff6c-4f47-b52e-054abe525951";
const redirectUri =
  process.env.MICROSOFT_REDIRECT_URI ||
  "http://localhost:5001/api/auth/microsoft/callback";

const SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Read.Shared",
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
      authority: `https://login.microsoftonline.com/${tenantId}`,
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

/** Exchange authorization code for tokens — raw HTTP to get refresh_token */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
  name: string;
}> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: SCOPES.join(" "),
  });

  const { data } = await axios.post(tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!data.access_token) throw new Error("Token exchange failed — no access_token");

  // Decode the id_token to get email/name
  let email = "";
  let name = "";
  if (data.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64").toString());
      email = payload.preferred_username || payload.email || payload.upn || "";
      name = payload.name || "";
    } catch {}
  }

  console.log(`[OUTLOOK] Token exchange success — email=${email}, hasRefresh=${!!data.refresh_token}, expiresIn=${data.expires_in}s`);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    email: email.toLowerCase(),
    name,
  };
}

/** Refresh an expired access token — raw HTTP */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES.join(" "),
  });

  const { data } = await axios.post(tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!data.access_token) throw new Error("Token refresh failed");

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
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
