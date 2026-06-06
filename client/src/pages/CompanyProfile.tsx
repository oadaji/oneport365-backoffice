import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

interface Contact {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isPrimary?: boolean;
}

interface Company {
  _id: string;
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
  phone?: string;
  status: "lead" | "active" | "inactive";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    contactCount: number;
    rfqCount: number;
    activeRfqCount: number;
    quoteCount: number;
  };
}

interface Opportunity {
  _id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  owner?: { _id: string; name: string };
  source: string;
  createdAt: string;
}

interface Activity {
  _id: string;
  type: "note" | "call" | "meeting" | "email" | "whatsapp" | "status_change";
  summary: string;
  body?: string;
  user?: string;
  createdAt: string;
}

interface Rfq {
  _id: string;
  subject: string;
  status: string;
  fields: { key: string; value: string; ok: boolean }[];
  createdAt: string;
}

type ProfileTab = "overview" | "contacts" | "opportunities" | "rfqs" | "activities";

function getInitials(name: string): string {
  return name
    .split(/[\s()]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatCurrency(value: number, currency: string = "USD"): string {
  const symbols: Record<string, string> = { USD: "$", NGN: "₦", GHS: "₵", KES: "KSh" };
  const symbol = symbols[currency] || currency + " ";
  if (value >= 1000000) return symbol + (value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return symbol + (value / 1000).toFixed(0) + "k";
  return symbol + value.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export default function CompanyProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityType, setActivityType] = useState<"note" | "call" | "meeting">("note");
  const [activitySummary, setActivitySummary] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/companies/${id}`),
      api.get(`/contacts?companyId=${id}`),
      api.get(`/opportunities?companyId=${id}`),
      api.get(`/activities?companyId=${id}`),
      api.get(`/rfqs?companyId=${id}`),
    ])
      .then(([compRes, contRes, oppRes, actRes, rfqRes]) => {
        setCompany(compRes.data);
        setContacts(contRes.data);
        setOpportunities(oppRes.data);
        setActivities(actRes.data);
        setRfqs(rfqRes.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Failed to load company");
        setLoading(false);
      });
  }, [id]);

  const saveActivity = async () => {
    if (!activitySummary.trim()) return;
    setSavingActivity(true);
    try {
      const res = await api.post("/activities", {
        companyId: id,
        type: activityType,
        summary: activitySummary,
        body: activityBody || undefined,
        user: "Current User",
      });
      setActivities([res.data, ...activities]);
      setActivitySummary("");
      setActivityBody("");
      setShowActivityForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save activity");
    } finally {
      setSavingActivity(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9faf9" }}>
        <div style={{ fontSize: 14, color: "#6b7670" }}>Loading company...</div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9faf9" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "#d4d9d2" }}>?</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#1a2520", marginBottom: 8 }}>Company not found</div>
          <div style={{ fontSize: 13, color: "#6b7670", marginBottom: 20 }}>{error || "No data available"}</div>
          <button
            onClick={() => navigate("/crm")}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 500, background: "#16a34a", color: "#fff",
              border: "none", borderRadius: 7, cursor: "pointer",
            }}
          >
            Back to CRM
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(company.name);
  const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];
  const openOpps = opportunities.filter((o) => !o.stage.startsWith("closed"));
  const wonOpps = opportunities.filter((o) => o.stage === "closed-won");
  const openValue = openOpps.reduce((s, o) => s + o.value, 0);
  const wonValue = wonOpps.reduce((s, o) => s + o.value, 0);

  const statusColors: Record<string, { bg: string; color: string }> = {
    lead: { bg: "#fef3e6", color: "#b45309" },
    active: { bg: "#e6f7ec", color: "#166534" },
    inactive: { bg: "#f3f5f3", color: "#6b7670" },
  };
  const statusStyle = statusColors[company.status] || statusColors.lead;

  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "contacts", label: "Contacts", count: contacts.length },
    { key: "opportunities", label: "Opportunities", count: opportunities.length },
    { key: "rfqs", label: "RFQs", count: rfqs.length },
    { key: "activities", label: "Activity", count: activities.length },
  ];

  const activityIcons: Record<string, string> = {
    note: "📝",
    call: "📞",
    meeting: "👥",
    email: "✉️",
    whatsapp: "💬",
    status_change: "🔄",
  };

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
      {/* Breadcrumb */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8ebe7", padding: "14px 28px",
        display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6b7670" }}>
          <span
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/crm")}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#16a34a"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#6b7670"; }}
          >CRM</span>
          <span style={{ color: "#9aa39d" }}>›</span>
          <span
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/crm")}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#16a34a"; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#6b7670"; }}
          >Companies</span>
          <span style={{ color: "#9aa39d" }}>›</span>
          <span style={{ color: "#1a2520", fontWeight: 600 }}>{company.name}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate(`/crm?edit=${company._id}`)}
          style={{
            padding: "7px 14px", border: "1px solid #d4d9d2", background: "#fff", borderRadius: 7,
            fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1a2520",
          }}
        >Edit Company</button>
      </div>

      <div style={{ padding: "24px 28px 80px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Hero Card */}
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
          <div style={{
            padding: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            gap: 20, borderBottom: "1px solid #e8ebe7",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: "linear-gradient(135deg, #16a34a, #15803d)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 800, letterSpacing: -0.5, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: "#1a2520" }}>{company.name}</div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: 0.4,
                    background: statusStyle.bg, color: statusStyle.color,
                  }}>
                    {company.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7670", display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {company.industry && <span>Industry: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{company.industry}</strong></span>}
                  {company.country && <span>Country: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{company.country}</strong></span>}
                  {company.domain && <span>Domain: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{company.domain}</strong></span>}
                  <span>Added: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{formatDate(company.createdAt)}</strong></span>
                </div>
                {primaryContact && (
                  <div style={{ fontSize: 12, color: "#6b7670", marginTop: 2 }}>
                    Primary: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{primaryContact.firstName} {primaryContact.lastName}</strong>
                    {primaryContact.email && <span> · {primaryContact.email}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", padding: "18px 22px" }}>
            {[
              { label: "Contacts", value: String(contacts.length), color: "#1a2520" },
              { label: "Open Deals", value: String(openOpps.length), color: "#1a2520" },
              { label: "Pipeline Value", value: formatCurrency(openValue), color: "#16a34a" },
              { label: "Won Deals", value: String(wonOpps.length), color: "#1a2520" },
              { label: "Won Revenue", value: formatCurrency(wonValue), color: "#16a34a" },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                padding: "0 16px",
                borderRight: i < 4 ? "1px solid #e8ebe7" : "none",
              }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e8ebe7", marginBottom: 24 }}>
          {tabs.map((t) => (
            <div
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "10px 16px", borderRadius: "8px 8px 0 0", fontSize: 13,
                color: activeTab === t.key ? "#166534" : "#6b7670",
                cursor: "pointer", borderBottom: activeTab === t.key ? "2px solid #16a34a" : "2px solid transparent",
                marginBottom: -1, whiteSpace: "nowrap", fontWeight: activeTab === t.key ? 600 : 500,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  background: activeTab === t.key ? "#e6f7ec" : "#f3f5f3",
                  padding: "0 6px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                  color: activeTab === t.key ? "#166534" : "#6b7670",
                }}>
                  {t.count}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Company Info */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2520", marginBottom: 16 }}>Company Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Name", value: company.name },
                  { label: "Industry", value: company.industry || "—" },
                  { label: "Country", value: company.country || "—" },
                  { label: "Domain", value: company.domain || "—" },
                  { label: "Phone", value: company.phone || "—" },
                  { label: "Status", value: company.status },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#6b7670" }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1a2520" }}>{item.value}</span>
                  </div>
                ))}
              </div>
              {company.notes && (
                <div style={{ marginTop: 16, padding: 12, background: "#f9faf9", borderRadius: 8, fontSize: 12, color: "#6b7670" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Notes</div>
                  {company.notes}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2520" }}>Recent Activity</div>
                <button
                  onClick={() => { setShowActivityForm(true); setActiveTab("activities"); }}
                  style={{
                    padding: "4px 10px", fontSize: 11, fontWeight: 500, background: "#16a34a",
                    color: "#fff", border: "none", borderRadius: 5, cursor: "pointer",
                  }}
                >+ Add</button>
              </div>
              {activities.slice(0, 5).map((a) => (
                <div key={a._id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f5f3" }}>
                  <span style={{ fontSize: 14 }}>{activityIcons[a.type] || "📌"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#1a2520" }}>{a.summary}</div>
                    <div style={{ fontSize: 10, color: "#9aa39d" }}>{timeAgo(a.createdAt)}{a.user && ` · ${a.user}`}</div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div style={{ fontSize: 12, color: "#9aa39d", textAlign: "center", padding: 20 }}>No activity yet</div>
              )}
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px",
              padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
              textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
            }}>
              <div>Name</div><div>Email</div><div>Phone</div><div>Role</div>
            </div>
            {contacts.map((c) => (
              <div key={c._id} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px",
                padding: "12px 16px", borderBottom: "1px solid #e8ebe7", fontSize: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 500, color: "#1a2520" }}>{c.firstName} {c.lastName}</span>
                  {c.isPrimary && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4, background: "#e6f7ec", color: "#16a34a" }}>Primary</span>
                  )}
                </div>
                <div style={{ color: "#6b7670" }}>{c.email || "—"}</div>
                <div style={{ color: "#6b7670" }}>{c.phone || "—"}</div>
                <div style={{ color: "#6b7670" }}>{c.jobTitle || "—"}</div>
              </div>
            ))}
            {contacts.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No contacts yet</div>
            )}
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === "opportunities" && (
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 100px 100px 100px 1fr 80px",
              padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
              textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
            }}>
              <div>Title</div><div>Value</div><div>Stage</div><div>Probability</div><div>Owner</div><div>Created</div>
            </div>
            {opportunities.map((o) => {
              const stageColors: Record<string, { bg: string; color: string }> = {
                "new-lead": { bg: "#eff4ff", color: "#2563eb" },
                "qualified": { bg: "#fef3e6", color: "#b45309" },
                "proposal-sent": { bg: "#f3eeff", color: "#7c3aed" },
                "negotiation": { bg: "#fef9e7", color: "#a16207" },
                "closed-won": { bg: "#e6f7ec", color: "#16a34a" },
                "closed-lost": { bg: "#fef2f2", color: "#dc2626" },
              };
              const stageStyle = stageColors[o.stage] || stageColors["new-lead"];
              return (
                <div key={o._id} style={{
                  display: "grid", gridTemplateColumns: "2fr 100px 100px 100px 1fr 80px",
                  padding: "12px 16px", borderBottom: "1px solid #e8ebe7", fontSize: 12, alignItems: "center",
                }}>
                  <div style={{ fontWeight: 500, color: "#1a2520" }}>{o.title}</div>
                  <div style={{ fontWeight: 600, color: "#16a34a" }}>{formatCurrency(o.value, o.currency)}</div>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      background: stageStyle.bg, color: stageStyle.color,
                    }}>{o.stage.replace("-", " ")}</span>
                  </div>
                  <div style={{ color: "#6b7670" }}>{o.probability}%</div>
                  <div style={{ color: "#6b7670" }}>{o.owner?.name || "—"}</div>
                  <div style={{ color: "#9aa39d", fontSize: 10 }}>{formatDate(o.createdAt)}</div>
                </div>
              );
            })}
            {opportunities.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No opportunities yet</div>
            )}
          </div>
        )}

        {/* RFQs Tab */}
        {activeTab === "rfqs" && (
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 100px 100px 100px",
              padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
              textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
            }}>
              <div>Subject</div><div>Status</div><div>Mode</div><div>Created</div>
            </div>
            {rfqs.map((r) => {
              const freightMode = r.fields.find((f) => f.key === "Freight Mode")?.value || "—";
              return (
                <div
                  key={r._id}
                  onClick={() => navigate(`/?rfq=${r._id}`)}
                  style={{
                    display: "grid", gridTemplateColumns: "2fr 100px 100px 100px",
                    padding: "12px 16px", borderBottom: "1px solid #e8ebe7", fontSize: 12, cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f9faf9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                >
                  <div style={{ fontWeight: 500, color: "#1a2520" }}>{r.subject}</div>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                      background: r.status === "replied" ? "#e6f7ec" : "#fef3e6",
                      color: r.status === "replied" ? "#16a34a" : "#b45309",
                    }}>{r.status}</span>
                  </div>
                  <div style={{ color: "#6b7670" }}>{freightMode}</div>
                  <div style={{ color: "#9aa39d", fontSize: 10 }}>{formatDate(r.createdAt)}</div>
                </div>
              );
            })}
            {rfqs.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No RFQs yet</div>
            )}
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === "activities" && (
          <div>
            {/* Add Activity Form */}
            {showActivityForm ? (
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2520", marginBottom: 12 }}>Log Activity</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {(["note", "call", "meeting"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActivityType(t)}
                      style={{
                        padding: "6px 12px", fontSize: 12, fontWeight: 500,
                        background: activityType === t ? "#1a2520" : "#fff",
                        color: activityType === t ? "#fff" : "#6b7670",
                        border: "1px solid #e8ebe7", borderRadius: 6, cursor: "pointer",
                      }}
                    >{activityIcons[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Summary (required)"
                  value={activitySummary}
                  onChange={(e) => setActivitySummary(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #e8ebe7",
                    borderRadius: 6, marginBottom: 10, outline: "none", boxSizing: "border-box",
                  }}
                />
                <textarea
                  placeholder="Details (optional)"
                  value={activityBody}
                  onChange={(e) => setActivityBody(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #e8ebe7",
                    borderRadius: 6, marginBottom: 12, outline: "none", resize: "vertical", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowActivityForm(false)}
                    style={{
                      padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "#fff",
                      border: "1px solid #e8ebe7", borderRadius: 6, cursor: "pointer", color: "#6b7670",
                    }}
                  >Cancel</button>
                  <button
                    onClick={saveActivity}
                    disabled={!activitySummary.trim() || savingActivity}
                    style={{
                      padding: "8px 14px", fontSize: 12, fontWeight: 500, background: "#16a34a",
                      border: "none", borderRadius: 6, cursor: "pointer", color: "#fff",
                      opacity: !activitySummary.trim() || savingActivity ? 0.6 : 1,
                    }}
                  >{savingActivity ? "Saving..." : "Save Activity"}</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowActivityForm(true)}
                style={{
                  padding: "10px 16px", fontSize: 13, fontWeight: 500, background: "#16a34a",
                  color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 16,
                }}
              >+ Log Activity</button>
            )}

            {/* Activity List */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
              {activities.map((a) => (
                <div key={a._id} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #e8ebe7" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: "#f9faf9",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
                  }}>
                    {activityIcons[a.type] || "📌"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2520", marginBottom: 2 }}>{a.summary}</div>
                    {a.body && <div style={{ fontSize: 12, color: "#6b7670", marginBottom: 4 }}>{a.body}</div>}
                    <div style={{ fontSize: 10, color: "#9aa39d" }}>
                      {formatDate(a.createdAt)}{a.user && ` · ${a.user}`}
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No activity yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
