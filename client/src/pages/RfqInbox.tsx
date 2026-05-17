import React, { useEffect, useState } from "react";
import { Mail, RefreshCw, Archive, Trash2, X } from "lucide-react";
import api from "../lib/api";

interface Rfq {
  _id: string;
  ref: string;
  status: string;
  emailType: string;
  fields: { k: string; v: string; ok: boolean }[];
  missingFields: string[];
  followUpDraft?: string;
  notes?: string;
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
    const id = acc._id || acc.id;
    if (!window.confirm(`Remove ${acc.email}?`)) return;
    try {
      await api.delete(`/email-accounts/${id}`);
      setAccounts((prev) => prev.filter((a) => (a._id || a.id) !== id));
    } catch (err) {
      console.error("Failed to remove", err);
    }
  };

  const connectGmail = () => {
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5001/api";
    window.location.href = `${baseUrl}/auth/google`;
  };

  const connectOutlook = (shared = false) => {
    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5001/api";
    window.location.href = `${baseUrl}/auth/microsoft${shared ? "?shared=true" : ""}`;
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 13,
    border: "1px solid var(--border2)",
    borderRadius: 8,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    color: "var(--text)",
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
                    background: acc.provider === "outlook" ? "#e8f0fe" : "#fef2f2",
                    border: `1px solid ${acc.provider === "outlook" ? "#bdd4f7" : "#fecaca"}`,
                  }}>
                    {acc.provider === "outlook" ? (
                      <img src="https://img.icons8.com/color/48/microsoft-outlook-2019--v2.png" alt="Outlook" width="22" height="22" style={{ objectFit: "contain" }} />
                    ) : (
                      <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_20dp.png" alt="Gmail" width="22" height="22" style={{ objectFit: "contain" }} />
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

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn"
            onClick={connectGmail}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", fontSize: 13 }}
          >
            <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_20dp.png" alt="Gmail" width="20" height="20" style={{ objectFit: "contain" }} />
            Connect Gmail
          </button>

          <button
            className="btn"
            onClick={() => connectOutlook(false)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", fontSize: 13 }}
          >
            <img src="https://img.icons8.com/color/48/microsoft-outlook-2019--v2.png" alt="Outlook" width="20" height="20" style={{ objectFit: "contain" }} />
            Connect Outlook
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>
          Sign in with your Google or Microsoft account. Only shipping-related emails are synced — personal emails are never accessed.
        </div>
      </div>
    </div>
  );
}

const QUOTE_REQUIRED = ["Company", "Contact", "Email", "Commodity", "HS Code", "Tonnage", "Volume", "POL", "POD", "Container"];

function fieldVal(fields: { k: string; v: string; ok: boolean }[], key: string): string {
  const f = fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
  return f?.v && f.v !== "not specified" ? f.v : "";
}

function fieldObj(fields: { k: string; v: string; ok: boolean }[], key: string) {
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

export default function RfqInbox() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReply, setShowReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [showEmailMonitor, setShowEmailMonitor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadRfqs();
  }, []);

  const loadRfqs = () => {
    setLoading(true);
    api.get("/rfqs").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      const filtered = data.filter((r: Rfq) => r.emailType === "customer-rfq" || r.emailType === "internal-rfq");
      setRfqs(filtered);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      await api.post("/emails/sync");
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
      loadRfqs();
    }
  };

  const selectRfq = (r: Rfq) => {
    setSelected(r);
    setShowReply(false);
    if (r.followUpDraft) setReplyDraft(r.followUpDraft);
    else setReplyDraft("");
  };

  const archiveRfq = async (id: string) => {
    await api.patch(`/rfqs/${id}`, { status: "archived" });
    loadRfqs();
    setSelected(null);
  };

  const deleteRfq = async (id: string) => {
    if (!window.confirm("Delete this RFQ permanently?")) return;
    await api.delete(`/rfqs/${id}`);
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

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ===== LEFT: INBOX SIDEBAR ===== */}
      <div style={{ width: 280, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Inbox</div>
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
            <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading...</div>
          ) : rfqs.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>No RFQs yet</div>
          ) : (
            rfqs.map((r) => {
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
                      {r.email?.fromName || r.email?.fromEmail || "Unknown"}
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

      {/* ===== CENTER: EMAIL BODY ===== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
        {selected ? (
          <>
            {/* Email header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 6 }}>
                {selected.email?.subject || "No subject"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--text2)", fontWeight: 500 }}>{selected.email?.fromName}</span>
                <span className="badge b-rate">Customer RFQ</span>
                {selected.status === "info_needed" && <span className="badge b-miss">Missing info</span>}
                {selected.status === "ready" && <span className="badge b-ok">Ready</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                {selected.email?.receivedAt ? `${fmtDate(selected.email.receivedAt)} · ${fmtTime(selected.email.receivedAt)}` : ""}
                {selected.email?.receivedInbox ? ` · ${selected.email.receivedInbox}` : ""}
              </div>
            </div>

            {/* Thread brief */}
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "#f0fdf4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>+</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-dark)" }}>Thread Brief</span>
                <span className="badge b-rate">Customer RFQ</span>
                <span className={`badge ${statusLabel(selected.status).cls}`}>{statusLabel(selected.status).text === "info needed" ? "Missing info" : statusLabel(selected.status).text}</span>
              </div>
            </div>

            {/* Email body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxWidth: 700 }}>
                {selected.email?.body || "No email body available."}
              </div>
            </div>

            {/* Reply compose tray */}
            {showReply && (
              <div style={{ borderTop: "2px solid var(--accent)", padding: "12px 20px", background: "#f8faf8" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                    ← Reply
                  </div>
                  <button onClick={() => setShowReply(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text3)" }}>×</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>TO</span>&nbsp;&nbsp;{selected.email?.fromEmail}
                </div>
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  style={{ width: "100%", minHeight: 100, padding: 10, fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none", color: "var(--text)" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <button className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    ▸ Send
                  </button>
                  <button className="btn btn-sm" onClick={() => setShowReply(false)}>Discard</button>
                </div>
              </div>
            )}

            {/* Action bar */}
            <div style={{ padding: "8px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "#f8faf8" }}>
              <button className="btn btn-sm" onClick={() => { setShowReply(true); if (selected.followUpDraft) setReplyDraft(selected.followUpDraft); }}>
                ← Reply
              </button>
              <button className="btn btn-sm" onClick={() => archiveRfq(selected._id)}>
                <Archive size={12} style={{ marginRight: 4 }} /> Archive
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteRfq(selected._id)}>
                <Trash2 size={12} style={{ marginRight: 4 }} /> Remove
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 13 }}>
            Select an email from the inbox to view
          </div>
        )}
      </div>

      {/* ===== RIGHT: EXTRACTION PANEL ===== */}
      <div style={{ width: 300, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0, overflow: "hidden" }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Extracted Details</span>
              <span className="badge b-ok" style={{ fontFamily: "monospace", fontSize: 10 }}>{selected.ref}</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              {/* Direction badge */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span className="badge b-gray">🚢 Not specified</span>
                <span className="badge b-ok">🔻 {detectDirection(selected.fields || [])}</span>
              </div>

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
                      background: isMissing ? "#fffbeb" : "transparent",
                      border: isMissing ? "1px solid #fde68a" : "1px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : "var(--text3)", fontWeight: 500 }}>{key}</span>
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : "var(--text)", fontWeight: 500, textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isMissing ? "⚠ missing" : `✓ ${value}`}
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
      {showEmailMonitor && <EmailMonitoringModal onClose={() => setShowEmailMonitor(false)} />}
    </div>
  );
}
