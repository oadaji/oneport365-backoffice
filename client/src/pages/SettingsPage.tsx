import React, { useEffect, useState } from "react";
import { Mail, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import api from "../lib/api";

interface EmailAccount {
  _id?: string;
  id?: string;
  label: string;
  email: string;
  provider: "gmail" | "outlook" | "imap";
  authType?: "password" | "oauth2";
  active: boolean;
  shared?: boolean;
  isEnvAccount?: boolean;
  lastSyncedAt?: string;
  lastError?: string;
}

const GMAIL_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="#4285F4" strokeWidth="2" fill="none"/>
  </svg>
);

const OUTLOOK_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2" stroke="#0078D4" strokeWidth="2" fill="none"/>
    <path d="M2 6l10 7 10-7" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectMode, setConnectMode] = useState<"" | "gmail" | "outlook">("");
  const [gmailForm, setGmailForm] = useState({ email: "", password: "", label: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Check URL params for OAuth callback status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("outlook") === "connected") {
      // Clean up URL
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("outlook") === "error") {
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get("/email-accounts");
      setAccounts(data);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const removeAccount = async (acc: EmailAccount) => {
    if (acc.isEnvAccount) return;
    const id = acc._id || acc.id;
    if (!window.confirm(`Remove ${acc.email}?`)) return;
    try {
      await api.delete(`/email-accounts/${id}`);
      setAccounts((prev) => prev.filter((a) => (a._id || a.id) !== id));
    } catch (err) {
      console.error("Failed to remove account", err);
    }
  };

  const testGmailCredentials = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/email-accounts/test-credentials", {
        email: gmailForm.email,
        password: gmailForm.password,
      });
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const saveGmailAccount = async () => {
    setSaving(true);
    try {
      await api.post("/email-accounts", {
        email: gmailForm.email,
        password: gmailForm.password,
        label: gmailForm.label || gmailForm.email,
        provider: "gmail",
      });
      setGmailForm({ email: "", password: "", label: "" });
      setConnectMode("");
      setTestResult(null);
      await fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to save";
      setTestResult({ ok: false, message: msg });
    } finally {
      setSaving(false);
    }
  };

  const connectOutlook = (shared = false) => {
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5001/api";
    window.location.href = `${baseUrl}/auth/microsoft${shared ? "?shared=true" : ""}`;
  };

  const getSyncStatus = (acc: EmailAccount) => {
    if (acc.lastError) return { color: "#dc2626", label: "error", icon: <AlertCircle size={10} /> };
    if (!acc.lastSyncedAt) return { color: "#d97706", label: "not yet synced", icon: <Clock size={10} /> };
    return { color: "#16a34a", label: `synced ${timeSince(acc.lastSyncedAt)}`, icon: <CheckCircle size={10} /> };
  };

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    border: "1px solid var(--border2)",
    borderRadius: 7,
    fontFamily: "Inter, sans-serif",
    outline: "none",
  };

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Email Monitoring</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          Connect Gmail & Outlook inboxes to monitor for RFQs. Emails sent to multiple addresses are captured once.
        </div>
      </div>

      {/* Connected Inboxes */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          Connected Inboxes
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text3)", padding: 20, textAlign: "center" }}>Loading...</div>
        ) : accounts.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text3)", padding: 20, textAlign: "center" }}>
            No inboxes connected yet. Add one below.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {accounts.map((acc) => {
              const status = getSyncStatus(acc);
              const id = acc._id || acc.id;
              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Provider Icon */}
                  <div style={{ flexShrink: 0 }}>
                    {acc.provider === "outlook" ? OUTLOOK_ICON : GMAIL_ICON}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {acc.email}
                      </span>
                      {acc.shared && (
                        <span className="badge b-ok">shared</span>
                      )}
                      {acc.authType === "oauth2" && (
                        <span className="badge b-rate">OAuth</span>
                      )}
                      {acc.isEnvAccount && (
                        <span className="badge b-gray">default</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      {acc.provider === "outlook" ? "Outlook" : "Gmail"} &middot;{" "}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {acc.lastSyncedAt ? (
                          status.label
                        ) : (
                          <span className="badge b-wait" style={{ fontSize: 9, padding: "1px 6px" }}>pending</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Status dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: status.color,
                      flexShrink: 0,
                    }}
                  />

                  {/* Remove */}
                  {!acc.isEnvAccount && (
                    <button className="btn btn-sm btn-danger" onClick={() => removeAccount(acc)}>
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect New Inbox */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          Connect a new inbox
        </div>

        {/* Provider Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: connectMode ? 16 : 0 }}>
          <button
            className="btn"
            onClick={() => { setConnectMode(connectMode === "gmail" ? "" : "gmail"); setTestResult(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              ...(connectMode === "gmail" ? { borderColor: "var(--accent)", background: "var(--accent-light)" } : {}),
            }}
          >
            {GMAIL_ICON}
            <span style={{ fontWeight: 500 }}>Gmail</span>
          </button>

          <button
            className="btn"
            onClick={() => connectOutlook(false)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
          >
            {OUTLOOK_ICON}
            <span style={{ fontWeight: 500 }}>Outlook</span>
          </button>

          <button
            className="btn"
            onClick={() => connectOutlook(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px" }}
          >
            {OUTLOOK_ICON}
            <span style={{ fontWeight: 500 }}>Outlook (Shared)</span>
          </button>
        </div>

        {/* Gmail Form */}
        {connectMode === "gmail" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg)", padding: "10px 12px", borderRadius: 7 }}>
              Use a Gmail App Password (not your account password). Enable it at myaccount.google.com &rarr; Security &rarr; 2-Step Verification &rarr; App passwords.
            </div>

            <input
              type="email"
              placeholder="your@email.com"
              value={gmailForm.email}
              onChange={(e) => setGmailForm({ ...gmailForm, email: e.target.value })}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="App password"
              value={gmailForm.password}
              onChange={(e) => setGmailForm({ ...gmailForm, password: e.target.value })}
              style={inputStyle}
            />

            {testResult && (
              <div
                style={{
                  fontSize: 12,
                  padding: "8px 12px",
                  borderRadius: 7,
                  background: testResult.ok ? "#dcfce7" : "#fee2e2",
                  color: testResult.ok ? "#166534" : "#991b1b",
                }}
              >
                {testResult.message}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn"
                onClick={testGmailCredentials}
                disabled={!gmailForm.email || !gmailForm.password || testing}
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                className="btn btn-primary"
                onClick={saveGmailAccount}
                disabled={!gmailForm.email || !gmailForm.password || saving}
              >
                {saving ? "Saving..." : "Connect"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
