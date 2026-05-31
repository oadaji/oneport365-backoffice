// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Mail, RefreshCw, Trash2, X, ChevronRight, MessageCircle, Globe } from "lucide-react";
import api from "../lib/api";

interface Rfq {
  _id: string;
  ref: string;
  status: string;
  emailType: string;
  source?: "email" | "whatsapp" | "web";
  fields: { k: string; v: string; ok: boolean; suggested?: boolean }[];
  missingFields: string[];
  followUpDraft?: string;
  notes?: string;
  resolvedSenderName?: string;
  resolvedSenderEmail?: string;
  email?: { fromName: string; fromEmail: string; subject: string; body: string; receivedAt: string; receivedInbox?: string };
  company?: { _id: string; name: string };
  contact?: { _id: string; firstName: string; lastName?: string; email?: string };
  createdAt: string;
}

interface EmailAccount {
  _id?: string;
  id?: string;
  label: string;
  email: string;
  provider: "gmail" | "outlook" | "imap";
  authType?: "password" | "oauth2";
  shared?: boolean;
  active: boolean;
  lastSyncedAt?: string;
  lastError?: string;
}

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

function EmailMonitoringModal({ onClose }: { onClose: () => void }) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectMode, setConnectMode] = useState<"" | "gmail" | "outlook">("");
  const [gmailForm, setGmailForm] = useState({ email: "", password: "" });
  const [sharedEmail, setSharedEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  const fetchAccounts = async () => {
    try {
      const { data } = await api.get("/email-accounts");
      setAccounts(data as EmailAccount[]);
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    api.get("/email-accounts/oauth/redirect-uri").then(({ data }) => setRedirectUri((data as any).redirectUri)).catch(() => {});
  }, []);

  const removeAccount = async (acc: EmailAccount) => {
    const id = acc._id || acc.id;
    if (!window.confirm(`Remove ${acc.email}?`)) return;
    try {
      await api.delete(`/email-accounts/${id}`);
      setAccounts((prev) => prev.filter((a) => (a._id || a.id) !== id));
    } catch (err) {
      console.error("Failed to remove", err);
    }
  };

  const testCredentials = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post("/email-accounts/test-credentials", {
        email: gmailForm.email,
        password: gmailForm.password,
      });
      setTestResult(data as any);
    } catch {
      setTestResult({ ok: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const saveGmail = async () => {
    setSaving(true);
    try {
      await api.post("/email-accounts", {
        email: gmailForm.email,
        password: gmailForm.password,
        label: gmailForm.email,
        provider: "gmail",
      });
      setGmailForm({ email: "", password: "" });
      setConnectMode("");
      setTestResult(null);
      await fetchAccounts();
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.error || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const connectOutlook = async () => {
    try {
      const { data } = await api.get(`/auth/microsoft/url?t=${Date.now()}`);
      if ((data as any).url) window.location.href = (data as any).url;
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to start Microsoft login");
    }
  };

  const connectSharedMailbox = async () => {
    if (!sharedEmail) return;
    setSaving(true);
    try {
      await api.post("/email-accounts/shared", { email: sharedEmail, label: sharedEmail });
      setSharedEmail("");
      setConnectMode("");
      alert(`Shared mailbox ${sharedEmail} connected successfully!`);
      await fetchAccounts();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Failed to connect shared mailbox";
      alert(`Error: ${msg}`);
      setTestResult({ ok: false, message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface)", borderRadius: 14, width: 560, maxHeight: "80vh",
        overflow: "auto", padding: "24px 28px", position: "relative",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Email Monitoring</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4, lineHeight: 1.5 }}>
              Connect Gmail & Outlook inboxes to monitor for RFQs. Emails sent to multiple addresses are captured once.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 4,
              color: "var(--text3)", fontSize: 18, lineHeight: 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Connected Inboxes */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          Connected Inboxes
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: 20 }}>Loading...</div>
        ) : accounts.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", padding: 24 }}>
            No inboxes connected yet.
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {accounts.map((acc) => {
              const id = acc._id || acc.id;
              const synced = !!acc.lastSyncedAt;
              const hasError = !!acc.lastError;
              return (
                <div
                  key={id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Provider icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: acc.provider === "outlook" ? "#f5f5f5" : "#fef2f2",
                    border: `1px solid ${acc.provider === "outlook" ? "#e0e0e0" : "#fecaca"}`,
                  }}>
                    {acc.provider === "outlook" ? (
                      <svg width="20" height="20" viewBox="0 0 21 21"><rect x="0" y="0" width="10" height="10" fill="#F25022"/><rect x="11" y="0" width="10" height="10" fill="#7FBA00"/><rect x="0" y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F4F4F4"/><path d="M22 6l-10 7L2 6" fill="none" stroke="#EA4335" strokeWidth="1.5"/><path d="M2 6h20" fill="none" stroke="#EA4335" strokeWidth="0"/><path d="M2 6l10 7" stroke="#F6B72A" strokeWidth="1.5" fill="none"/><path d="M22 6l-10 7" stroke="#4285F4" strokeWidth="1.5" fill="none"/><path d="M2 6v12h4V10l6 4.5L18 10v8h4V6" fill="none" stroke="#0F9D58" strokeWidth="0"/><rect x="2" y="4" width="4" height="16" rx="0" fill="#4285F4"/><rect x="18" y="4" width="4" height="16" rx="0" fill="#4285F4"/><path d="M2 6l10 7L22 6" fill="none" stroke="#D94F3F" strokeWidth="2"/></svg>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{acc.email}</span>
                      {acc.shared && <span className="badge b-ok" style={{ fontSize: 10 }}>shared</span>}
                      {acc.authType === "oauth2" && <span className="badge b-rate" style={{ fontSize: 10 }}>OAuth</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      {acc.provider === "outlook" ? "Outlook" : "Gmail"} &middot;{" "}
                      {hasError ? (
                        <span style={{ color: "var(--danger)" }}>error</span>
                      ) : synced ? (
                        `synced ${timeSince(acc.lastSyncedAt!)}`
                      ) : (
                        <span className="badge b-wait" style={{ fontSize: 9, padding: "1px 6px" }}>not yet synced</span>
                      )}
                    </div>
                  </div>

                  {/* Status dot */}
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                    background: hasError ? "#dc2626" : synced ? "#16a34a" : "#d97706",
                  }} />

                  {/* Default label or Remove */}
                  <button className="btn btn-sm btn-danger" onClick={() => removeAccount(acc)}>Remove</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Connect a new inbox */}
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          Connect a new inbox
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: connectMode ? 16 : 0 }}>
          <button
            className="btn"
            onClick={() => { setConnectMode(connectMode === "gmail" ? "" : "gmail"); setTestResult(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", fontSize: 13,
              ...(connectMode === "gmail" ? { borderColor: "var(--accent)", background: "var(--accent-light)" } : {}),
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6z" fill="#F4F4F4"/><rect x="2" y="4" width="4" height="16" fill="#4285F4"/><rect x="18" y="4" width="4" height="16" fill="#4285F4"/><path d="M2 6l10 7L22 6" fill="none" stroke="#D94F3F" strokeWidth="2"/></svg>
            Gmail
          </button>

          <button
            className="btn"
            onClick={() => { setConnectMode(connectMode === "outlook" ? "" : "outlook"); setTestResult(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", fontSize: 13,
              ...(connectMode === "outlook" ? { borderColor: "#0078D4", background: "#e8f0fe", color: "#0078D4" } : {}),
            }}
          >
            <svg width="20" height="20" viewBox="0 0 21 21"><rect width="10" height="10" fill="#F25022"/><rect x="11" width="10" height="10" fill="#7FBA00"/><rect y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>
            Outlook
          </button>
        </div>

        {connectMode === "gmail" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              fontSize: 12, color: "var(--text3)", background: "var(--bg)", padding: "10px 14px",
              borderRadius: 8, lineHeight: 1.5,
            }}>
              Use a Gmail App Password (not your account password). Enable it at myaccount.google.com &rarr; Security &rarr; 2-Step Verification &rarr; App passwords.
            </div>
            <input
              type="email"
              placeholder="your@email.com"
              value={gmailForm.email}
              onChange={(e) => setGmailForm({ ...gmailForm, email: e.target.value })}
              style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "1px solid var(--border2)", borderRadius: 8, fontFamily: "Inter, sans-serif", outline: "none", color: "var(--text)" }}
            />
            <input
              type="password"
              placeholder="App password (no spaces)"
              value={gmailForm.password}
              onChange={(e) => setGmailForm({ ...gmailForm, password: e.target.value })}
              style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: "1px solid var(--border2)", borderRadius: 8, fontFamily: "Inter, sans-serif", outline: "none", color: "var(--text)" }}
            />
            {testResult && (
              <div style={{
                fontSize: 12, padding: "8px 12px", borderRadius: 8,
                background: testResult.ok ? "#dcfce7" : "#fee2e2",
                color: testResult.ok ? "#166534" : "#991b1b",
              }}>
                {testResult.message}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={testCredentials} disabled={!gmailForm.email || !gmailForm.password || testing}>
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button className="btn btn-primary" onClick={saveGmail} disabled={!gmailForm.email || !gmailForm.password || saving}>
                {saving ? "Saving..." : "Connect"}
              </button>
            </div>
          </div>
        )}

        {connectMode === "outlook" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Sign in with Microsoft */}
            <button
              className="btn"
              onClick={connectOutlook}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "12px 20px", fontSize: 14, fontWeight: 500, width: "100%",
                border: "1px solid var(--border2)", borderRadius: 8,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 21 21"><rect width="10" height="10" fill="#F25022"/><rect x="11" width="10" height="10" fill="#7FBA00"/><rect y="11" width="10" height="10" fill="#00A4EF"/><rect x="11" y="11" width="10" height="10" fill="#FFB900"/></svg>
              Sign in with Microsoft
            </button>

            {/* Shared mailbox divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text3)" }}>or connect a shared mailbox</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* Shared mailbox input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                placeholder="commercial@oneport365.com"
                value={sharedEmail}
                onChange={(e) => setSharedEmail(e.target.value)}
                style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "1px solid var(--border2)", borderRadius: 8, fontFamily: "Inter, sans-serif", outline: "none", color: "var(--text)" }}
              />
              <button
                className="btn"
                onClick={connectSharedMailbox}
                disabled={!sharedEmail || saving}
                style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, background: "#1a2d1c", color: "#fff", border: "none", borderRadius: 8 }}
              >
                {saving ? "..." : "Connect"}
              </button>
            </div>

            <div style={{
              fontSize: 11, color: "#166534", background: "#dcfce7", padding: "8px 12px",
              borderRadius: 8, lineHeight: 1.5,
            }}>
              <strong>No password needed.</strong> Sign in with Microsoft above first, then type the shared mailbox email here and click Connect — it uses the same login automatically.
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>
          Only shipping-related emails are synced — personal emails are never accessed.
        </div>
      </div>
    </div>
  );
}

const QUOTE_REQUIRED = ["Company", "Customer", "Email", "Commodity", "HS Code", "Weight", "Volume", "POL", "POD", "Container"];

/**
 * Read resolved sender from server-computed fields.
 * Falls back to email from/name if not yet backfilled.
 */
function getSender(rfq: Rfq): { name: string; email: string } {
  if (rfq.resolvedSenderName && rfq.resolvedSenderEmail) {
    return { name: rfq.resolvedSenderName, email: rfq.resolvedSenderEmail };
  }
  const em = rfq.email;
  if (!em) return { name: "Unknown", email: "" };
  return { name: em.fromName || em.fromEmail, email: em.fromEmail };
}

type RfqField = { k: string; v: string; ok: boolean; suggested?: boolean };

function fieldVal(fields: RfqField[], key: string): string {
  const f = fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
  return f?.v && f.v !== "not specified" ? f.v : "";
}

function fieldObj(fields: RfqField[], key: string) {
  return fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string) {
  if (status === "ready") return { cls: "b-ok", text: "ready" };
  if (status === "replied") return { cls: "b-wait", text: "replied" };
  if (status === "partial") return { cls: "b-wait", text: "partial reply" };
  if (status === "stuck") return { cls: "b-miss", text: "stalled" };
  if (status === "archived") return { cls: "b-gray", text: "archived" };
  return { cls: "b-miss", text: "info needed" };
}

function detectDirection(fields: { k: string; v: string; ok: boolean }[]): string {
  const pod = fieldVal(fields, "pod").toLowerCase();
  const pol = fieldVal(fields, "pol").toLowerCase();
  if (pod.includes("nigeria") || pod.includes("ngapp") || pod.includes("ngtcn") || pod.includes("ngone") || pod.includes("lagos") || pod.includes("apapa") || pod.includes("tin can") || pod.includes("onne") || pod.includes("warri")) return "Import → Nigeria";
  if (pol.includes("nigeria") || pol.includes("ngapp") || pol.includes("ngtcn") || pol.includes("ngone") || pol.includes("lagos")) return "Export ← Nigeria";
  return "Cross-trade";
}

const DUMMY_RFQS: Rfq[] = [
  { _id: "d1", ref: "RFQ-2605-1001", status: "info_needed", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Aliyu Bashir", ok: true }, { k: "Company", v: "BUA Foods Plc", ok: true },
    { k: "Email", v: "aliyu.bashir@buafoods.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Lagos (NGAPP)", ok: true }, { k: "POD", v: "Antwerp (BEANR)", ok: true },
    { k: "Commodity", v: "Cocoa beans", ok: true }, { k: "Weight", v: "12 MT", ok: true },
    { k: "Container", v: "2×40HC", ok: true },
  ], missingFields: ["HS Code"], followUpDraft: "Hi Aliyu,\n\nThank you for your enquiry. Could you please confirm the HS Code for the cocoa beans?",
    email: { fromName: "Aliyu Bashir", fromEmail: "aliyu.bashir@buafoods.com", subject: "Rate Request: Cocoa beans Lagos to Antwerp", body: "Good morning,\n\nPlease send me rates for shipping 12MT of cocoa beans from Lagos to Antwerp. We need 2x40HC containers. FOB terms.\n\nRegards,\nAliyu", receivedAt: "2026-05-29T08:14:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-29T08:14:00Z" },
  { _id: "d2", ref: "RFQ-2605-1002", status: "info_needed", emailType: "customer-rfq", source: "whatsapp", fields: [
    { k: "Customer", v: "Chidi Okonkwo", ok: true }, { k: "Company", v: "Dangote Industries", ok: true },
    { k: "Email", v: "c.okonkwo@dangote.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Apapa (NGAPP)", ok: true }, { k: "POD", v: "Tema (GHTEM)", ok: true },
    { k: "Commodity", v: "Cement clinker", ok: true }, { k: "Weight", v: "24 MT", ok: true },
  ], missingFields: ["HS Code", "Container", "Volume"],
    email: { fromName: "Chidi Okonkwo", fromEmail: "c.okonkwo@dangote.com", subject: "URGENT: Cement clinker shipment to Ghana", body: "Hello,\n\nWe need to ship 24MT of cement clinker from Apapa to Tema urgently. Please advise on rates and container availability.\n\nChidi", receivedAt: "2026-05-29T07:30:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-29T07:30:00Z" },
  { _id: "d3", ref: "RFQ-2605-1003", status: "info_needed", emailType: "customer-rfq", source: "web", fields: [
    { k: "Customer", v: "Fatima Abdullahi", ok: true }, { k: "Email", v: "fatima@flourmills.com", ok: true },
    { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Rotterdam (NLRTM)", ok: true }, { k: "POD", v: "Lagos (NGAPP)", ok: true },
    { k: "Commodity", v: "Wheat grain", ok: true },
  ], missingFields: ["Company", "HS Code", "Weight", "Volume", "Container"],
    email: { fromName: "Fatima Abdullahi", fromEmail: "fatima@flourmills.com", subject: "Wheat import from Rotterdam", body: "Hi team,\n\nCan you provide rates for importing wheat grain from Rotterdam to Lagos? We are looking at a regular monthly shipment.\n\nFatima", receivedAt: "2026-05-28T14:20:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-28T14:20:00Z" },
  { _id: "d4", ref: "RFQ-2605-1004", status: "info_needed", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Emmanuel Eze", ok: true }, { k: "Company", v: "Nestlé Nigeria", ok: true },
    { k: "Email", v: "e.eze@nestle.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Lagos (NGAPP)", ok: true }, { k: "POD", v: "Antwerp (BEANR)", ok: true },
    { k: "Commodity", v: "Processed cocoa", ok: true }, { k: "Container", v: "2×40RF", ok: true },
    { k: "Weight", v: "8 MT", ok: true }, { k: "HS Code", v: "1806.20 (suggested)", ok: false, suggested: true },
  ], missingFields: [],
    email: { fromName: "Emmanuel Eze", fromEmail: "e.eze@nestle.com", subject: "Reefer container for processed cocoa export", body: "Good day,\n\nWe need 2x40RF reefer containers for exporting processed cocoa to Antwerp. 8MT total. Please provide rates including pre-cooling.\n\nEmmanuel", receivedAt: "2026-05-28T11:45:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-28T11:45:00Z" },
  { _id: "d5", ref: "RFQ-2605-1005", status: "replied", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Adaeze Nwankwo", ok: true }, { k: "Company", v: "Olam Agri", ok: true },
    { k: "Email", v: "a.nwankwo@olamagri.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Lagos (NGAPP)", ok: true }, { k: "POD", v: "Hamburg (DEHAM)", ok: true },
    { k: "Commodity", v: "Sesame seeds", ok: true }, { k: "Weight", v: "16 MT", ok: true },
    { k: "Container", v: "4×40HC", ok: true }, { k: "HS Code", v: "1207.40", ok: true },
  ], missingFields: [],
    email: { fromName: "Adaeze Nwankwo", fromEmail: "a.nwankwo@olamagri.com", subject: "Sesame seeds export to Hamburg", body: "Hello,\n\nPlease quote for 4x40HC of sesame seeds Lagos to Hamburg. FOB. HS Code 1207.40. 16MT total.\n\nAdaeze", receivedAt: "2026-05-27T09:00:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-27T09:00:00Z" },
  { _id: "d6", ref: "RFQ-2605-1006", status: "replied", emailType: "customer-rfq", source: "whatsapp", fields: [
    { k: "Customer", v: "Ibrahim Musa", ok: true }, { k: "Company", v: "Lafarge Africa", ok: true },
    { k: "Email", v: "i.musa@lafarge.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Jebel Ali (AEJEA)", ok: true }, { k: "POD", v: "Tin Can (NGTCN)", ok: true },
    { k: "Commodity", v: "Gypsum", ok: true }, { k: "Weight", v: "22 MT", ok: true },
    { k: "Container", v: "4×20GP", ok: true }, { k: "HS Code", v: "2520.10", ok: true },
  ], missingFields: [],
    email: { fromName: "Ibrahim Musa", fromEmail: "i.musa@lafarge.com", subject: "Gypsum import from UAE", body: "Dear team,\n\nKindly provide rates for 4x20GP of gypsum from Jebel Ali to Tin Can Island. CIF terms. 22MT.\n\nIbrahim", receivedAt: "2026-05-27T06:15:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-27T06:15:00Z" },
  { _id: "d7", ref: "RFQ-2605-1007", status: "stuck", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Grace Okoro", ok: true }, { k: "Company", v: "Dufil Prima Foods", ok: true },
    { k: "Email", v: "g.okoro@dufil.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Lagos (NGAPP)", ok: true }, { k: "POD", v: "Tema (GHTEM)", ok: true },
    { k: "Commodity", v: "Instant noodles", ok: true }, { k: "Weight", v: "14 MT", ok: true },
    { k: "Container", v: "4×20FT", ok: true }, { k: "HS Code", v: "1902.30", ok: true },
  ], missingFields: [],
    email: { fromName: "Grace Okoro", fromEmail: "g.okoro@dufil.com", subject: "Noodles export to Ghana - need rates", body: "Good morning,\n\nWe need rates for 4x20FT of instant noodles from Lagos to Tema. FOB. 14MT.\n\nGrace", receivedAt: "2026-05-26T10:30:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-26T10:30:00Z" },
  { _id: "d8", ref: "RFQ-2605-1008", status: "stuck", emailType: "customer-rfq", source: "web", fields: [
    { k: "Customer", v: "Yusuf Bello", ok: true }, { k: "Company", v: "BUA Cement", ok: true },
    { k: "Email", v: "y.bello@buacement.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Apapa (NGAPP)", ok: true }, { k: "POD", v: "Mombasa (KEMBA)", ok: true },
    { k: "Commodity", v: "Cement bags", ok: true }, { k: "Weight", v: "20 MT", ok: true },
    { k: "Container", v: "5×20GP", ok: true }, { k: "HS Code", v: "2523.29", ok: true },
  ], missingFields: [],
    email: { fromName: "Yusuf Bello", fromEmail: "y.bello@buacement.com", subject: "Cement export to Kenya", body: "Hi,\n\nPlease provide ocean freight rates for 5x20GP of cement bags from Apapa to Mombasa.\n\nYusuf", receivedAt: "2026-05-25T15:00:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-25T15:00:00Z" },
  { _id: "d9", ref: "RFQ-2605-1009", status: "stuck", emailType: "customer-rfq", source: "whatsapp", fields: [
    { k: "Customer", v: "Ngozi Adekunle", ok: true }, { k: "Company", v: "Nigerian Breweries", ok: true },
    { k: "Email", v: "n.adekunle@nbplc.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Rotterdam (NLRTM)", ok: true }, { k: "POD", v: "Lagos (NGAPP)", ok: true },
    { k: "Commodity", v: "Malt extract", ok: true }, { k: "Weight", v: "30 MT", ok: true },
    { k: "Container", v: "6×20GP", ok: true }, { k: "HS Code", v: "1901.90", ok: true },
  ], missingFields: [],
    email: { fromName: "Ngozi Adekunle", fromEmail: "n.adekunle@nbplc.com", subject: "Malt extract import from Netherlands", body: "Dear OnePort,\n\nWe require rates for importing 30MT of malt extract from Rotterdam to Lagos. 6x20GP. CIF.\n\nNgozi", receivedAt: "2026-05-25T08:45:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-25T08:45:00Z" },
  { _id: "d10", ref: "RFQ-2605-1010", status: "stuck", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Samuel Ojo", ok: true }, { k: "Company", v: "PZ Cussons", ok: true },
    { k: "Email", v: "s.ojo@pzcussons.com", ok: true }, { k: "Freight Mode", v: "Air", ok: true },
    { k: "POL", v: "London (LHR)", ok: true }, { k: "POD", v: "Lagos (LOS)", ok: true },
    { k: "Commodity", v: "Cosmetics raw materials", ok: true }, { k: "Weight", v: "2 MT", ok: true },
    { k: "HS Code", v: "3304.99", ok: true },
  ], missingFields: ["Container", "Volume"],
    email: { fromName: "Samuel Ojo", fromEmail: "s.ojo@pzcussons.com", subject: "Air freight London to Lagos - cosmetics", body: "Hello,\n\nNeed air freight rates for 2MT of cosmetics raw materials from London to Lagos. Urgent.\n\nSamuel", receivedAt: "2026-05-24T16:20:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-24T16:20:00Z" },
  { _id: "d11", ref: "RFQ-2605-1011", status: "ready", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Amina Yusuf", ok: true }, { k: "Company", v: "Cadbury Nigeria", ok: true },
    { k: "Email", v: "a.yusuf@cadbury.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Lagos (NGAPP)", ok: true }, { k: "POD", v: "Rotterdam (NLRTM)", ok: true },
    { k: "Commodity", v: "Cocoa butter", ok: true }, { k: "Weight", v: "10 MT", ok: true },
    { k: "Container", v: "2×40RF", ok: true }, { k: "HS Code", v: "1804.00", ok: true },
  ], missingFields: [],
    email: { fromName: "Amina Yusuf", fromEmail: "a.yusuf@cadbury.com", subject: "Cocoa butter export - reefer needed", body: "Good day,\n\nPlease provide rates for 2x40RF reefer containers for cocoa butter export to Rotterdam. 10MT. FOB.\n\nAmina", receivedAt: "2026-05-26T12:00:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-26T12:00:00Z" },
  { _id: "d12", ref: "RFQ-2605-1012", status: "ready", emailType: "customer-rfq", source: "web", fields: [
    { k: "Customer", v: "Tunde Bakare", ok: true }, { k: "Company", v: "Honeywell Flour", ok: true },
    { k: "Email", v: "t.bakare@honeywellflour.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Shanghai (CNSHA)", ok: true }, { k: "POD", v: "Apapa (NGAPP)", ok: true },
    { k: "Commodity", v: "Wheat flour mill parts", ok: true }, { k: "Weight", v: "5 MT", ok: true },
    { k: "Container", v: "1×40HC", ok: true }, { k: "HS Code", v: "8437.80", ok: true },
  ], missingFields: [],
    email: { fromName: "Tunde Bakare", fromEmail: "t.bakare@honeywellflour.com", subject: "Mill parts import from China", body: "Hello OnePort,\n\nWe need to import flour mill spare parts from Shanghai to Apapa. 1x40HC, 5MT. CIF terms. HS 8437.80.\n\nTunde", receivedAt: "2026-05-25T11:30:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-25T11:30:00Z" },
  { _id: "d13", ref: "RFQ-2605-1013", status: "ready", emailType: "customer-rfq", source: "whatsapp", fields: [
    { k: "Customer", v: "Kemi Adesanya", ok: true }, { k: "Company", v: "Friesland Campina", ok: true },
    { k: "Email", v: "k.adesanya@friesland.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Tin Can (NGTCN)", ok: true }, { k: "POD", v: "Mombasa (KEMBA)", ok: true },
    { k: "Commodity", v: "Evaporated milk", ok: true }, { k: "Weight", v: "6 MT", ok: true },
    { k: "Container", v: "1×40RF", ok: true }, { k: "HS Code", v: "0402.91", ok: true },
  ], missingFields: [],
    email: { fromName: "Kemi Adesanya", fromEmail: "k.adesanya@friesland.com", subject: "Evaporated milk to Kenya - reefer", body: "Hi,\n\nPlease quote for 1x40RF reefer of evaporated milk from Tin Can to Mombasa. 6MT. FOB.\n\nKemi", receivedAt: "2026-05-24T09:15:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-24T09:15:00Z" },
  { _id: "d14", ref: "RFQ-2605-1014", status: "ready", emailType: "customer-rfq", source: "email", fields: [
    { k: "Customer", v: "Obinna Nwoye", ok: true }, { k: "Company", v: "Unilever Nigeria", ok: true },
    { k: "Email", v: "o.nwoye@unilever.com", ok: true }, { k: "Freight Mode", v: "Ocean", ok: true },
    { k: "POL", v: "Hamburg (DEHAM)", ok: true }, { k: "POD", v: "Lagos (NGAPP)", ok: true },
    { k: "Commodity", v: "Personal care products", ok: true }, { k: "Weight", v: "18 MT", ok: true },
    { k: "Container", v: "3×40HC", ok: true }, { k: "HS Code", v: "3401.19", ok: true },
  ], missingFields: [],
    email: { fromName: "Obinna Nwoye", fromEmail: "o.nwoye@unilever.com", subject: "Import personal care products from Germany", body: "Dear OnePort 365,\n\nKindly provide CIF rates for 3x40HC of personal care products from Hamburg to Lagos. 18MT total. HS 3401.19.\n\nObinna", receivedAt: "2026-05-23T14:00:00Z", receivedInbox: "commercial@oneport365.com" },
    createdAt: "2026-05-23T14:00:00Z" },
];

export default function RfqInbox() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReply, setShowReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [showEmailMonitor, setShowEmailMonitor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [threadReplies, setThreadReplies] = useState<any[]>([]);
  const [reExtracting, setReExtracting] = useState(false);
  const [replyFrom, setReplyFrom] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [senderAccounts, setSenderAccounts] = useState<string[]>([]);
  const [view, setView] = useState<"dashboard" | "inbox">("dashboard");
  const [dashFilter, setDashFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "email" | "whatsapp" | "web">("all");
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(300);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const [composeHeight, setComposeHeight] = useState(320);
  const [composeDragging, setComposeDragging] = useState(false);
  const composeColRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
    const startX = e.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (side === "left") {
        const newW = Math.max(200, Math.min(450, startLeft + (ev.clientX - startX)));
        setLeftWidth(newW);
      } else {
        const newW = Math.max(220, Math.min(500, startRight - (ev.clientX - startX)));
        setRightWidth(newW);
      }
    };
    const onMouseUp = () => {
      setDragging(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleComposeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setComposeDragging(true);
    const startY = e.clientY;
    const startH = composeHeight;
    const colH = composeColRef.current?.clientHeight || 600;
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newH = Math.max(160, Math.min(Math.round(colH * 0.78), startH + delta));
      setComposeHeight(newH);
    };
    const onMouseUp = () => {
      setComposeDragging(false);
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    loadRfqs(true);
    api.get("/email-accounts").then(({ data }) => {
      const emails = (data as any[]).filter((a: any) => a.active).map((a: any) => a.email);
      setSenderAccounts(emails);
      if (emails.length > 0) setReplyFrom(emails[0]);
    }).catch(() => {});
  }, []);

  const loadRfqs = (autoSelect = false) => {
    setLoading(true);
    api.get("/rfqs").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      const filtered = data.filter((r: Rfq) => r.emailType === "customer-rfq" || r.emailType === "internal-rfq");
      const result = filtered.length > 0 ? filtered : DUMMY_RFQS;
      setRfqs(result);
      setLoading(false);
      if (autoSelect && result.length > 0 && !selected) {
        setSelected(result[0]);
      }
    }).catch(() => {
      setRfqs(DUMMY_RFQS);
      setLoading(false);
    });
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      await api.post("/gmail/sync");
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
      loadRfqs();
    }
  };

  const selectRfq = async (r: Rfq) => {
    setSelected(r);
    setBriefOpen(false);
    setThreadReplies([]);
    if (r.followUpDraft) setReplyDraft(r.followUpDraft);
    else setReplyDraft("");

    // Auto-open compose for info_needed with a draft
    if (r.status === "info_needed" && r.followUpDraft) {
      setShowReply(true);
    } else {
      setShowReply(false);
    }

    // Load thread replies
    try {
      const { data } = await api.get(`/rfqs/${r._id}/thread`);
      const replies = data.replies || [];
      setThreadReplies(replies);

      // Auto re-extract if replies exist
      if (replies.length > 0) {
        setReExtracting(true);
        try {
          const { data: updated } = await api.post(`/rfqs/${r._id}/re-extract`);
          if (updated) {
            setSelected(updated);
            if (updated.followUpDraft && !showReply) setReplyDraft(updated.followUpDraft);
          }
        } catch {}
        setReExtracting(false);
        loadRfqs(); // refresh inbox badges
      }
    } catch {}
  };

  const archiveRfq = async (id: string) => {
    await api.patch(`/rfqs/${id}`, { status: "archived" });
    loadRfqs();
    setSelected(null);
  };


  const generateQuote = async (rfqId: string) => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/quotes/generate/${rfqId}`);
      window.location.href = `/quotes?id=${data._id}`;
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to generate quote");
    } finally {
      setGenerating(false);
    }
  };

  // Quote readiness score
  const getReadiness = (fields: { k: string; v: string; ok: boolean }[]) => {
    let filled = 0;
    QUOTE_REQUIRED.forEach((key) => {
      const f = fieldObj(fields, key);
      if (f && f.ok) filled++;
    });
    return { filled, total: QUOTE_REQUIRED.length };
  };

  // Source-filtered RFQs for pipeline
  const sourceRfqs = sourceFilter === "all" ? rfqs : rfqs.filter(r => (r.source || "email") === sourceFilter);

  // Pipeline stage counts (respect source filter)
  const newCount = sourceRfqs.filter(r => r.status === "info_needed" || (!r.status || r.status === "new")).length;
  const respondedCount = sourceRfqs.filter(r => r.status === "replied" || r.status === "partial").length;
  const awaitingRatesCount = sourceRfqs.filter(r => r.status === "stuck").length;
  const quoteIssuedCount = sourceRfqs.filter(r => r.status === "ready").length;

  // Source counts
  const emailCount = rfqs.filter(r => (r.source || "email") === "email").length;
  const waCount = rfqs.filter(r => r.source === "whatsapp").length;
  const webCount = rfqs.filter(r => r.source === "web").length;

  const pipelineStages = [
    { key: "new", label: "New", count: newCount, color: "#2563eb", bg: "#eff4ff" },
    { key: "responded", label: "Responded", count: respondedCount, color: "#8b5cf6", bg: "#f3eeff" },
    { key: "awaiting", label: "Awaiting Rates", count: awaitingRatesCount, color: "#ea8a1a", bg: "#fef3e6" },
    { key: "quoted", label: "Quote Issued", count: quoteIssuedCount, color: "#16a34a", bg: "#e6f7ec" },
  ];

  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const filterByStage = (stageKey: string) => {
    if (stageKey === "quoted") {
      window.location.href = "/quotes";
      return;
    }
    setExpandedStage(expandedStage === stageKey ? null : stageKey);
  };

  const stageRfqs = (stageKey: string) => {
    return sourceRfqs.filter(r => {
      if (stageKey === "new") return r.status === "info_needed" || !r.status || r.status === "new";
      if (stageKey === "responded") return r.status === "replied" || r.status === "partial";
      if (stageKey === "awaiting") return r.status === "stuck";
      if (stageKey === "quoted") return r.status === "ready";
      return false;
    });
  };

  // Apply dashboard filter to inbox
  const filteredRfqs = dashFilter
    ? rfqs.filter(r => {
        if (dashFilter === "new") return r.status === "info_needed" || !r.status || r.status === "new";
        if (dashFilter === "responded") return r.status === "replied" || r.status === "partial";
        if (dashFilter === "awaiting") return r.status === "stuck";
        if (dashFilter === "quoted") return r.status === "ready";
        return true;
      })
    : rfqs;

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: "column", userSelect: dragging ? "none" : "auto" }}>

      {/* ===== DASHBOARD VIEW ===== */}
      {view === "dashboard" && (
        <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
          <div style={{ padding: "20px 28px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>RFQ</h1>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Track and manage all quote requests</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { key: "all" as const, label: "All", icon: null, count: rfqs.length, activeColor: "var(--text)" },
                  { key: "email" as const, label: "Email", icon: <Mail size={14} />, count: emailCount, activeColor: "var(--accent)" },
                  { key: "whatsapp" as const, label: "WhatsApp", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>, count: waCount, activeColor: "#25D366" },
                  { key: "web" as const, label: "Web", icon: <Globe size={14} />, count: webCount, activeColor: "#d97706" },
                ]).map(s => {
                  const active = sourceFilter === s.key;
                  return (
                    <button key={s.key} onClick={() => setSourceFilter(active && s.key !== "all" ? "all" : s.key)} style={{
                      padding: "6px 12px", fontSize: 11, fontWeight: active ? 600 : 400,
                      background: active ? s.activeColor : "var(--surface)",
                      border: active ? "none" : "1px solid var(--border)", borderRadius: 6,
                      cursor: "pointer", color: active ? "#fff" : "var(--text2)",
                      display: "flex", alignItems: "center", gap: 5, fontFamily: "Inter, sans-serif",
                    }}>
                      {s.icon} {s.label} <span style={{ fontSize: 10, opacity: 0.8 }}>({s.count})</span>
                    </button>
                  );
                })}
                <button onClick={syncEmails} disabled={syncing} style={{
                  padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "var(--accent)",
                  border: "none", borderRadius: 6, cursor: "pointer", color: "#fff",
                  display: "flex", alignItems: "center", gap: 5, fontFamily: "Inter, sans-serif",
                }}>
                  <RefreshCw size={13} style={syncing ? { animation: "spin 1s linear infinite" } : undefined} />
                  {syncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>

            {/* Pipeline Bars */}
            {(() => {
              const maxCount = Math.max(...pipelineStages.map(s => s.count), 1);
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pipelineStages.map(stage => {
                      const barPct = (stage.count / maxCount) * 100;
                      const isActive = expandedStage === stage.key;
                      return (
                        <div key={stage.key}
                          onClick={() => filterByStage(stage.key)}
                          style={{
                            display: "grid", gridTemplateColumns: "120px 1fr 40px 20px",
                            alignItems: "center", gap: 12, cursor: "pointer", padding: "7px 4px",
                            borderRadius: 6, transition: "background 0.1s",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{
                            fontSize: 11, fontWeight: isActive ? 700 : 500,
                            color: isActive ? stage.color : "var(--text)",
                            textTransform: "uppercase", letterSpacing: 0.3,
                          }}>{stage.label}</div>
                          <div style={{ height: 24, background: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${Math.max(barPct, stage.count > 0 ? 8 : 0)}%`,
                              background: isActive ? stage.color : `${stage.color}cc`,
                              borderRadius: 4, transition: "width 0.3s",
                              display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8,
                            }}>
                              {barPct > 20 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{stage.count}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: stage.color, textAlign: "right" }}>{stage.count}</div>
                          <ChevronRight size={13} color={isActive ? stage.color : "var(--border2)"} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Expanded stage table */}
            {expandedStage && expandedStage !== "quoted" && (() => {
              const stage = pipelineStages.find(s => s.key === expandedStage)!;
              const items = stageRfqs(expandedStage);
              return (
                <div style={{ background: "var(--surface)", border: `1px solid ${stage.color}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: stage.bg }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: stage.color }}>{stage.label} ({items.length})</span>
                    <button onClick={() => setExpandedStage(null)} style={{
                      padding: "3px 8px", fontSize: 10, background: "none", border: "1px solid var(--border)",
                      borderRadius: 4, cursor: "pointer", color: "var(--text3)", fontFamily: "Inter, sans-serif",
                    }}>Close</button>
                  </div>
                  {items.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>No RFQs in this stage</div>
                  ) : (
                    <>
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 80px 80px",
                        padding: "8px 14px", fontSize: 10, fontWeight: 600, color: "var(--text3)",
                        textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", background: "var(--bg)",
                      }}>
                        <div>Subject</div><div>Customer</div><div>Date</div><div>Direction</div><div>Readiness</div><div></div>
                      </div>
                      {items.map(r => {
                        const readiness = getReadiness(r.fields || []);
                        const direction = detectDirection(r.fields || []);
                        return (
                          <div key={r._id} onClick={() => { setSelected(r); setDashFilter(null); setView("inbox"); }} style={{
                            display: "grid", gridTemplateColumns: "1fr 140px 120px 100px 80px 80px",
                            padding: "9px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 12,
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                          >
                            <div>
                              <div style={{ fontWeight: 500, color: "var(--text)" }}>{r.email?.subject || "No subject"}</div>
                              <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace", marginTop: 2 }}>{r.ref}</div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text2)" }}>{r.email?.fromName || "Unknown"}</div>
                            <div style={{ fontSize: 11, color: "var(--text2)" }}>{r.email?.receivedAt ? fmtDate(r.email.receivedAt) : ""}</div>
                            <div style={{ fontSize: 10, color: "var(--text2)" }}>{direction.split(" ")[0]}</div>
                            <div style={{ fontSize: 11, color: readiness.filled >= 8 ? "var(--accent)" : readiness.filled >= 5 ? "var(--warn)" : "var(--danger)", fontWeight: 600 }}>
                              {readiness.filled}/{readiness.total}
                            </div>
                            <div>
                              <button onClick={(e) => { e.stopPropagation(); setSelected(r); setDashFilter(null); setView("inbox"); }} style={{
                                padding: "3px 8px", fontSize: 10, fontWeight: 500, background: stage.bg, border: `1px solid ${stage.color}`,
                                borderRadius: 4, cursor: "pointer", color: stage.color, fontFamily: "Inter, sans-serif",
                              }}>Open</button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Recent RFQs quick list */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 12, borderBottom: "1px solid var(--border)" }}>
                Recent Requests ({sourceRfqs.length})
              </div>
              {loading ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading...</div>
              ) : sourceRfqs.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  {sourceFilter !== "all" ? `No RFQs from ${sourceFilter}` : "No RFQs yet. Click Sync to fetch emails."}
                </div>
              ) : (
                <div>
                  {sourceRfqs.slice(0, 10).map(r => {
                    const st = statusLabel(r.status);
                    const readiness = getReadiness(r.fields || []);
                    const direction = detectDirection(r.fields || []);
                    const src = r.source || "email";
                    const srcIcon = src === "whatsapp" ? <svg width={12} height={12} viewBox="0 0 24 24" fill="#25D366" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      : src === "web" ? <Globe size={12} color="#d97706" />
                      : <Mail size={12} color="var(--accent)" />;
                    return (
                      <div key={r._id} onClick={() => { setSelected(r); setDashFilter(null); setView("inbox"); }} style={{
                        display: "grid", gridTemplateColumns: "20px 1fr 140px 100px 80px 80px",
                        padding: "9px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 12,
                        alignItems: "center",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                      >
                        <div title={src} style={{ display: "flex", alignItems: "center" }}>{srcIcon}</div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text)" }}>{r.email?.subject || "No subject"}</div>
                          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{r.email?.fromName || "Unknown"}</div>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>{r.email?.receivedAt ? fmtDate(r.email.receivedAt) : ""}</div>
                        <div><span className={`badge ${st.cls}`} style={{ fontSize: 10 }}>{st.text}</span></div>
                        <div style={{ fontSize: 10, color: "var(--text2)" }}>{direction.split(" ")[0]}</div>
                        <div style={{ fontSize: 10, color: readiness.filled >= 8 ? "var(--accent)" : readiness.filled >= 5 ? "var(--warn)" : "var(--danger)", fontWeight: 600 }}>
                          {readiness.filled}/{readiness.total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== INBOX VIEW ===== */}
      {view === "inbox" && (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ===== LEFT: INBOX SIDEBAR ===== */}
      <div style={{ width: leftWidth, borderRight: "none", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => { setView("dashboard"); setDashFilter(null); }} style={{
              padding: "2px 6px", fontSize: 10, fontWeight: 500, background: "none", border: "1px solid var(--border)",
              borderRadius: 4, cursor: "pointer", color: "var(--text3)",
            }}>← RFQ</button>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {dashFilter ? pipelineStages.find(s => s.key === dashFilter)?.label || "Inbox" : "All Inbox"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm" style={{ padding: "3px 6px", display: "flex", alignItems: "center", gap: 4 }} title="Inboxes" onClick={() => setShowEmailMonitor(true)}>
              <Mail size={12} /> ...
            </button>
            <button
              className="btn btn-sm"
              style={{ padding: "3px 6px" }}
              onClick={syncEmails}
              disabled={syncing}
              title={syncing ? "Syncing emails..." : "Sync emails"}
            >
              <RefreshCw size={12} style={syncing ? { animation: "spin 1s linear infinite" } : undefined} />
            </button>
          </div>
        </div>

        <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer Requests</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>Loading inbox...</div>
              <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTop: "2px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
            </div>
          ) : filteredRfqs.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)", marginBottom: 4 }}>{dashFilter ? "No RFQs in this stage" : "No RFQs yet"}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12, lineHeight: 1.5 }}>
                {dashFilter ? "Try a different filter or view all." : "Connect an inbox and click sync to start processing shipping emails."}
              </div>
              {!dashFilter && <button className="btn btn-primary btn-sm" onClick={syncEmails} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
              </button>}
            </div>
          ) : (
            filteredRfqs.map((r) => {
              const isSelected = selected?._id === r._id;
              const st = statusLabel(r.status);
              return (
                <div
                  key={r._id}
                  onClick={() => selectRfq(r)}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: isSelected ? "#eef6e6" : "var(--surface)",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                    transition: "all 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8faf8"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                      {getSender(r).name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", flexShrink: 0 }}>
                      {r.email?.receivedAt ? fmtDate(r.email.receivedAt) : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                    {r.email?.subject || "No subject"}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span className="badge b-rate" style={{ fontSize: 9 }}>Customer RFQ</span>
                    <span className={`badge ${st.cls}`} style={{ fontSize: 9 }}>
                      {st.text === "info needed" ? "⚠ " : st.text === "ready" ? "✓ " : ""}{st.text}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Left divider */}
      <div onMouseDown={handleMouseDown("left")} style={{
        width: 4, cursor: "col-resize", background: dragging === "left" ? "var(--accent)" : "var(--border)",
        flexShrink: 0, transition: dragging ? "none" : "background 0.15s",
      }}
        onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = "var(--accent)"; }}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = "var(--border)"; }}
      />

      {/* ===== CENTER: EMAIL BODY ===== */}
      <div ref={composeColRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
        {selected ? (
          <>
            {/* Email header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 6 }}>
                {selected.email?.subject || "No subject"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--text2)", fontWeight: 500 }}>{getSender(selected).name}</span>
                <span className="badge b-rate">Customer RFQ</span>
                {selected.status === "info_needed" && <span className="badge b-miss">Missing info</span>}
                {selected.status === "ready" && <span className="badge b-ok">Ready</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                {selected.email?.receivedAt ? `${fmtDate(selected.email.receivedAt)} · ${fmtTime(selected.email.receivedAt)}` : ""}
                {selected.email?.receivedInbox ? ` · ${selected.email.receivedInbox}` : ""}
              </div>
            </div>

            {/* Thread brief — collapsible */}
            {(() => {
              const f = selected.fields || [];
              const get = (key: string) => f.find((x: any) => x.k?.toLowerCase().includes(key.toLowerCase()));
              const pol = get("pol");
              const pod = get("pod");
              const commodity = get("commodity");
              const container = get("container");
              const freightMode = get("freight mode");
              const weight = get("weight");
              const missing = selected.missingFields || [];

              const modeStr = freightMode?.ok ? (freightMode.v.toLowerCase().includes("air") ? "air freight" : "ocean freight") : "freight";
              const polStr = pol?.ok ? pol.v : "origin";
              const podStr = pod?.ok ? pod.v : "destination";
              const commodityStr = commodity?.ok ? commodity.v : "";
              const summary = `Customer RFQ${commodityStr ? ` for ${commodityStr}` : ""} from ${polStr} to ${podStr} via ${modeStr}.`;

              const bullets: string[] = [];
              if (freightMode?.ok) bullets.push(freightMode.v.includes("Air") ? "Air Freight shipment" : "Ocean Freight shipment");
              if (pol?.ok && pod?.ok) bullets.push(`Route: ${pol.v} → ${pod.v}`);
              if (container?.ok) bullets.push(`Container: ${container.v}`);
              if (weight?.ok) bullets.push(`Weight: ${weight.v}`);
              if (missing.length > 0) bullets.push(`${missing.length} field${missing.length > 1 ? "s" : ""} missing — follow-up needed`);
              else bullets.push("All required fields present — ready to quote");

              return (
                <div style={{ borderBottom: "1px solid #86efac", background: "#e8f5ee" }}>
                  {/* Header — always visible, clickable */}
                  <div
                    onClick={() => setBriefOpen(!briefOpen)}
                    style={{ padding: "10px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, flexShrink: 0 }}>✦</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0b3a2e" }}>Thread Brief</span>
                    <div style={{ display: "flex", gap: 6, flex: 1 }}>
                      <span className="badge b-rate">Customer RFQ</span>
                      <span className={`badge ${statusLabel(selected.status).cls}`}>
                        {statusLabel(selected.status).text === "info needed" ? "Missing info" : statusLabel(selected.status).text === "ready" ? "Ready" : statusLabel(selected.status).text}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, color: "var(--text3)", flexShrink: 0 }}>{briefOpen ? "▴" : "▾"}</span>
                  </div>

                  {/* Body — collapsible */}
                  {briefOpen && (
                    <div style={{ padding: "0 20px 12px 20px" }}>
                      <div style={{ fontSize: 13, color: "#0b3a2e", lineHeight: 1.5, marginBottom: 8 }}>
                        {summary}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {bullets.map((b, i) => (
                          <div key={i} style={{ fontSize: 12, color: "#0b3a2e", display: "flex", alignItems: "flex-start", gap: 6 }}>
                            <span style={{ color: "var(--accent)", marginTop: 2 }}>●</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>

                      {selected.followUpDraft && missing.length > 0 && (
                        <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 6, border: "1px solid #fde68a" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>→ NEXT STEP</div>
                          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                            {selected.followUpDraft.slice(0, 200)}{selected.followUpDraft.length > 200 ? "..." : ""}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Email body + thread replies */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {/* Thread replies (newest first) */}
              {threadReplies.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {[...threadReplies].reverse().map((reply: any, i: number) => (
                    <div key={reply._id || i} style={{
                      padding: "12px 16px", marginBottom: 8, background: "#f0fdf4",
                      border: "1px solid #86efac", borderRadius: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span className="badge b-ok" style={{ fontSize: 9 }}>
                          Customer reply{threadReplies.length > 1 ? ` ${threadReplies.length - i}` : ""}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>
                          {reply.fromName || reply.fromEmail} &middot; {reply.receivedAt ? `${fmtDate(reply.receivedAt)} ${fmtTime(reply.receivedAt)}` : ""}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {reply.body || ""}
                      </div>
                    </div>
                  ))}

                  {/* Original message divider */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12, margin: "16px 0",
                    color: "var(--text3)", fontSize: 11,
                  }}>
                    <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
                    <span>Original message</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
                  </div>
                </div>
              )}

              {/* Re-extracting indicator */}
              {reExtracting && (
                <div style={{ fontSize: 11, color: "var(--accent-dark)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 12, border: "2px solid var(--border)", borderTop: "2px solid var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  Re-extracting with full thread...
                </div>
              )}

              {/* Original email body */}
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxWidth: 700 }}>
                {selected.email?.body || "No email body available."}
              </div>
            </div>

            {/* Reply compose tray */}
            {showReply && (() => {
              const isResend = selected.status === "replied";
              return (
              <div style={{ height: composeHeight, flexShrink: 0, display: "flex", flexDirection: "column", background: "#f8faf8" }}>
                {/* Resize handle */}
                <div
                  onMouseDown={handleComposeMouseDown}
                  style={{
                    height: 12, cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center",
                    background: composeDragging ? "var(--accent-light)" : "#eef2ee", borderTop: "2px solid var(--accent)",
                    flexShrink: 0, transition: composeDragging ? "none" : "background 0.15s",
                  }}
                  onMouseEnter={e => { if (!composeDragging) e.currentTarget.style.background = "var(--accent-light)"; }}
                  onMouseLeave={e => { if (!composeDragging) e.currentTarget.style.background = "#eef2ee"; }}
                >
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0,1,2,3,4].map(i => (
                      <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text3)" }} />
                    ))}
                  </div>
                </div>
              <div style={{ padding: "12px 20px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                    {isResend ? "↩ Send Again" : "← Reply"}
                  </div>
                  <button onClick={() => setShowReply(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text3)" }}>×</button>
                </div>
                {isResend && (
                  <div style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", marginBottom: 10, lineHeight: 1.5 }}>
                    A follow-up was already sent to this customer. Edit the draft below and send another.
                  </div>
                )}
                {/* From */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, width: 36 }}>FROM</span>
                  <select
                    value={replyFrom}
                    onChange={(e) => setReplyFrom(e.target.value)}
                    style={{ flex: 1, padding: "4px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", color: "var(--text)", background: "var(--surface)" }}
                  >
                    {senderAccounts.map((email) => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>
                {/* To */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, width: 36 }}>TO</span>
                  <span style={{ color: "var(--text)" }}>{getSender(selected).email}</span>
                </div>
                {/* CC */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, width: 36 }}>CC</span>
                  <input
                    type="text"
                    value={replyCc}
                    onChange={(e) => setReplyCc(e.target.value)}
                    placeholder="email@example.com, another@example.com"
                    style={{ flex: 1, padding: "4px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", color: "var(--text)", fontFamily: "Inter, sans-serif" }}
                  />
                </div>
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  style={{ width: "100%", flex: 1, minHeight: 60, padding: 10, fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, fontFamily: "Inter, sans-serif", resize: "none", outline: "none", color: "var(--text)" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                    disabled={sendingReply || !replyFrom}
                    onClick={async () => {
                      if (!selected || !replyDraft.trim()) return;
                      setSendingReply(true);
                      try {
                        await api.post(`/rfqs/${selected._id}/send-followup`, {
                          draft: replyDraft,
                          fromEmail: replyFrom,
                          cc: replyCc || undefined,
                        });
                        setShowReply(false);
                        setReplyCc("");
                        loadRfqs();
                      } catch (err: any) {
                        alert(err.response?.data?.error || "Failed to send");
                      } finally {
                        setSendingReply(false);
                      }
                    }}
                  >
                    {sendingReply ? "Sending..." : isResend ? "↩ Send Again" : "▸ Send"}
                  </button>
                  <button className="btn btn-sm" onClick={() => setShowReply(false)}>Discard</button>
                  {!isResend && selected.status === "info_needed" && (
                    <span style={{ fontSize: 10, color: "var(--text3)", marginLeft: "auto" }}>Review and send when ready</span>
                  )}
                </div>
              </div>
              </div>
              );
            })()}

            {/* Action bar */}
            <div style={{ padding: "8px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "#f8faf8" }}>
              <button className="btn btn-sm" onClick={() => { setShowReply(true); if (selected.followUpDraft) setReplyDraft(selected.followUpDraft); }}>
                {selected.status === "replied" ? "↩ Send Again" : "← Reply"}
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => archiveRfq(selected._id)}>
                <Trash2 size={12} style={{ marginRight: 4 }} /> Not RFQ
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 13 }}>
            Select an email from the inbox to view
          </div>
        )}
      </div>

      {/* Right divider */}
      <div onMouseDown={handleMouseDown("right")} style={{
        width: 4, cursor: "col-resize", background: dragging === "right" ? "var(--accent)" : "var(--border)",
        flexShrink: 0, transition: dragging ? "none" : "background 0.15s",
      }}
        onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = "var(--accent)"; }}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = "var(--border)"; }}
      />

      {/* ===== RIGHT: EXTRACTION PANEL ===== */}
      <div style={{ width: rightWidth, borderLeft: "none", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0, overflow: "hidden", height: "100%" }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Extracted Details</span>
              <span className="badge b-ok" style={{ fontFamily: "monospace", fontSize: 10 }}>{selected.ref}</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              {/* Freight mode + direction badges */}
              {(() => {
                const mode = fieldVal(selected.fields || [], "freight mode");
                const isAir = mode.toLowerCase().includes("air");
                const isOcean = mode.toLowerCase().includes("ocean");
                const modeIcon = isAir ? "✈" : "🚢";
                const modeText = isAir ? "Air Freight" : isOcean ? "Ocean Freight" : "Not specified";
                const modeCls = (isAir || isOcean) ? "b-ok" : "b-gray";
                return (
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <span className={`badge ${modeCls}`}>{modeIcon} {modeText}</span>
                    <span className="badge b-ok">🔻 {detectDirection(selected.fields || [])}</span>
                  </div>
                );
              })()}

              {/* Quote readiness */}
              {(() => {
                const { filled, total } = getReadiness(selected.fields || []);
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quote Readiness</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: filled === total ? "var(--accent-dark)" : "var(--warn)" }}>{filled}/{total}</span>
                    </div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(filled / total) * 100}%`, background: filled === total ? "var(--accent)" : "var(--warn)", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })()}

              {/* Field checklist */}
              {QUOTE_REQUIRED.map((key) => {
                const f = fieldObj(selected.fields || [], key);
                const hasValue = f && f.ok;
                const isSuggested = f?.suggested === true;
                const value = f?.v || "";
                const isMissing = !hasValue;

                return (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      marginBottom: 2,
                      borderRadius: 6,
                      background: isMissing ? "#fffbeb" : isSuggested ? "#fef9c3" : "transparent",
                      border: isMissing ? "1px solid #fde68a" : isSuggested ? "1px solid #fde68a" : "1px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : "var(--text3)", fontWeight: 500 }}>{key}</span>
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : isSuggested ? "#92400e" : "var(--text)", fontWeight: 500, textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isMissing ? "⚠ missing" : isSuggested ? `AI ${value}` : `✓ ${value}`}
                    </span>
                  </div>
                );
              })}


              {/* Additional details */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Additional Details</div>
              {(selected.fields || [])
                .filter((f) => !QUOTE_REQUIRED.some((rk) => f.k.toLowerCase().includes(rk.toLowerCase())))
                .map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                    <span style={{ color: "var(--text3)", fontSize: 10 }}>{f.k}</span>
                    <span style={{ color: f.ok ? "var(--text)" : "var(--warn)", fontWeight: 500, fontStyle: f.ok ? "normal" : "italic" }}>
                      {f.ok ? f.v : "not specified"}
                    </span>
                  </div>
                ))}

              {/* Notes */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Notes</div>
              <textarea
                defaultValue={selected.notes || ""}
                onBlur={(e) => api.patch(`/rfqs/${selected._id}`, { notes: e.target.value })}
                placeholder="Add notes..."
                style={{ width: "100%", minHeight: 50, padding: 8, fontSize: 11, border: "1px solid var(--border)", borderRadius: 6, fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none", color: "var(--text)", background: "var(--bg)" }}
              />

              {/* Generate Quote */}
              <button
                className="btn btn-primary"
                onClick={() => generateQuote(selected._id)}
                disabled={generating}
                style={{
                  width: "100%", marginTop: 16, padding: "10px 0", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {generating ? "Generating..." : "Generate Quote"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
            No RFQ selected
          </div>
        )}
      </div>

      {/* Email Monitoring Modal */}
      {/* Email Monitoring Modal */}
      {showEmailMonitor && <EmailMonitoringModal onClose={() => setShowEmailMonitor(false)} />}
    </div>
      )}

    </div>
  );
}
