import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mockShipments, completedShipments, Shipment, contractValueUsdEquiv, formatContractValue } from "../lib/mock-shipments";

// --------------- Mock customer data ---------------

interface CustomerData {
  name: string;
  tier: number;
  industry: string;
  customerSince: string;
  primaryContact: { name: string; email: string };
  accountManager: { name: string; initials: string; role: string };
  stats: {
    activeJobs: number;
    completedYTD: number;
    valueYTD: number;
    slaMet: number;
    outstanding: number;
  };
  logoColor: string;
}

const mockCustomers: Record<string, CustomerData> = {
  "Dangote Industries": {
    name: "Dangote Industries",
    tier: 1,
    industry: "Manufacturing · Cement",
    customerSince: "Jan 2021",
    primaryContact: { name: "Aminu Dantata", email: "a.dantata@dangote.com" },
    accountManager: { name: "Tola Adeyemi", initials: "TA", role: "Sales · Tier-1 accounts" },
    stats: { activeJobs: 1, completedYTD: 32, valueYTD: 412000, slaMet: 96, outstanding: 18500 },
    logoColor: "linear-gradient(135deg, #1d4ed8, #1e40af)",
  },
  "Flour Mills Nigeria": {
    name: "Flour Mills Nigeria",
    tier: 1,
    industry: "FMCG · Flour milling",
    customerSince: "Mar 2020",
    primaryContact: { name: "Kehinde Ojo", email: "k.ojo@fmnplc.com" },
    accountManager: { name: "Tola Adeyemi", initials: "TA", role: "Sales · Tier-1 accounts" },
    stats: { activeJobs: 1, completedYTD: 28, valueYTD: 368000, slaMet: 92, outstanding: 28400 },
    logoColor: "linear-gradient(135deg, #dc2626, #b91c1c)",
  },
  "Olam Agri": {
    name: "Olam Agri",
    tier: 2,
    industry: "Agriculture · Trading",
    customerSince: "Sep 2022",
    primaryContact: { name: "Chidi Nweze", email: "c.nweze@olamagri.com" },
    accountManager: { name: "C. Nwosu", initials: "CN", role: "Sales · Mid-market" },
    stats: { activeJobs: 1, completedYTD: 18, valueYTD: 196000, slaMet: 89, outstanding: 14200 },
    logoColor: "linear-gradient(135deg, #16a34a, #15803d)",
  },
  "BUA Foods": {
    name: "BUA Foods",
    tier: 1,
    industry: "FMCG · Agro-processing",
    customerSince: "Jun 2022",
    primaryContact: { name: "Aliyu Bashir", email: "aliyu.bashir@buafoods.com" },
    accountManager: { name: "Tola Adeyemi", initials: "TA", role: "Sales · Tier-1 accounts" },
    stats: { activeJobs: 3, completedYTD: 24, valueYTD: 284500, slaMet: 94, outstanding: 12250 },
    logoColor: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  "Lafarge Africa": {
    name: "Lafarge Africa",
    tier: 1,
    industry: "Manufacturing · Building materials",
    customerSince: "Nov 2021",
    primaryContact: { name: "Folake Adekunle", email: "f.adekunle@lafarge.com.ng" },
    accountManager: { name: "C. Nwosu", initials: "CN", role: "Sales · Tier-1 accounts" },
    stats: { activeJobs: 1, completedYTD: 15, valueYTD: 218000, slaMet: 91, outstanding: 16800 },
    logoColor: "linear-gradient(135deg, #0ea5e9, #0284c7)",
  },
  "Dufil Prima (Indomie)": {
    name: "Dufil Prima (Indomie)",
    tier: 2,
    industry: "FMCG · Noodles",
    customerSince: "Feb 2023",
    primaryContact: { name: "Yusuf Abubakar", email: "y.abubakar@dufil.com" },
    accountManager: { name: "C. Nwosu", initials: "CN", role: "Sales · Mid-market" },
    stats: { activeJobs: 1, completedYTD: 12, valueYTD: 98000, slaMet: 88, outstanding: 7600 },
    logoColor: "linear-gradient(135deg, #e11d48, #be123c)",
  },
  "Nestlé Nigeria": {
    name: "Nestlé Nigeria",
    tier: 1,
    industry: "FMCG · Food & beverage",
    customerSince: "Apr 2021",
    primaryContact: { name: "Ngozi Obi", email: "ngozi.obi@ng.nestle.com" },
    accountManager: { name: "Tola Adeyemi", initials: "TA", role: "Sales · Tier-1 accounts" },
    stats: { activeJobs: 1, completedYTD: 20, valueYTD: 245000, slaMet: 97, outstanding: 11400 },
    logoColor: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  },
  "Friesland Campina": {
    name: "Friesland Campina",
    tier: 2,
    industry: "FMCG · Dairy",
    customerSince: "Aug 2023",
    primaryContact: { name: "Emeka Eze", email: "e.eze@frieslandcampina.com.ng" },
    accountManager: { name: "C. Nwosu", initials: "CN", role: "Sales · Mid-market" },
    stats: { activeJobs: 1, completedYTD: 8, valueYTD: 62000, slaMet: 85, outstanding: 5200 },
    logoColor: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  },
};

// --------------- Helper ---------------

function getInitials(name: string): string {
  return name
    .split(/[\s()]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatUsd(val: number): string {
  if (val >= 1000) return "$" + (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + "k";
  return "$" + val.toLocaleString();
}

function formatUsdFull(val: number): string {
  return "$" + val.toLocaleString();
}

type ProfileTab = "rfqs" | "jobs" | "quotes" | "invoices" | "contacts" | "documents" | "communications" | "notes";
type JobsSubTab = "active" | "completed" | "all";

// --------------- Component ---------------

export default function CustomerProfile() {
  const { name: encodedName } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const customerName = decodeURIComponent(encodedName || "");

  const customer = mockCustomers[customerName];

  const [activeTab, setActiveTab] = useState<ProfileTab>("jobs");
  const [jobsSubTab, setJobsSubTab] = useState<JobsSubTab>("active");
  const [showAmPicker, setShowAmPicker] = useState(false);

  const amOptions = [
    { name: "Tola Adeyemi", initials: "TA", role: "Sales · Tier-1 accounts" },
    { name: "C. Nwosu", initials: "CN", role: "Sales · Mid-market" },
    { name: "O. Adaji", initials: "OA", role: "Sales · Enterprise" },
    { name: "I. Abubakar", initials: "IA", role: "Sales · New business" },
    { name: "D. Adamu", initials: "DA", role: "Sales · Regional" },
  ];
  const [accountMgr, setAccountMgr] = useState(customer ? customer.accountManager : amOptions[0]);

  // Get shipments for this customer
  const activeJobs = mockShipments.filter((s) => s.customer.name === customerName);
  const completedJobs = completedShipments.filter((s) => s.customer.name === customerName);
  const allJobs = [...activeJobs, ...completedJobs];

  const displayedJobs =
    jobsSubTab === "active" ? activeJobs : jobsSubTab === "completed" ? completedJobs : allJobs;

  if (!customer) {
    return (
      <div style={{ flex: 1, overflow: "auto", background: "#f9faf9", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: "#d4d9d2" }}>?</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#1a2520", marginBottom: 8 }}>Customer not found</div>
          <div style={{ fontSize: 13, color: "#6b7670", marginBottom: 20 }}>No profile data for "{customerName}"</div>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 500, background: "#16a34a", color: "#fff",
              border: "none", borderRadius: 7, cursor: "pointer",
            }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(customer.name);

  // Stats for active jobs summary
  const atRiskCount = activeJobs.filter((s) => s.deadlineStatus === "at-risk").length;
  const onTrackCount = activeJobs.filter((s) => s.deadlineStatus === "on-track").length;
  const breachedCount = activeJobs.filter((s) => s.deadlineStatus === "breached").length;
  const totalContainers = activeJobs.reduce((s, x) => s + x.containers.count, 0);
  const totalActiveValue = activeJobs.reduce((s, x) => s + contractValueUsdEquiv(x.contractValue), 0);

  // Mock RFQs for this customer
  const customerRfqs = [
    { ref: "RFQ-2605-1001", subject: "Rate Request: Cocoa beans Lagos to Antwerp", status: "info_needed", source: "email" as const, freightMode: "Ocean", pol: "NGAPP", pod: "BEANR", commodity: "Cocoa beans", readiness: 9, date: "29 May" },
    { ref: "RFQ-2604-0892", subject: "Cement clinker export to Tema", status: "ready", source: "whatsapp" as const, freightMode: "Ocean", pol: "NGAPP", pod: "GHTEM", commodity: "Cement clinker", readiness: 10, date: "18 Apr" },
    { ref: "RFQ-2604-0756", subject: "Gypsum import from UAE", status: "replied", source: "email" as const, freightMode: "Ocean", pol: "AEJEA", pod: "NGTCN", commodity: "Gypsum", readiness: 10, date: "02 Apr" },
    { ref: "RFQ-2603-0611", subject: "Air freight spare parts London", status: "ready", source: "web" as const, freightMode: "Air", pol: "LHR", pod: "LOS", commodity: "Spare parts", readiness: 10, date: "12 Mar" },
  ].filter(() => customer.name !== "placeholder");

  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: "rfqs", label: "RFQs", count: customerRfqs.length },
    { key: "jobs", label: "Jobs", count: allJobs.length || customer.stats.activeJobs + customer.stats.completedYTD },
    { key: "quotes", label: "Quotes", count: Math.floor(Math.random() * 5) + 2 },
    { key: "invoices", label: "Invoices", count: Math.floor(Math.random() * 10) + 4 },
    { key: "contacts", label: "Contacts", count: Math.floor(Math.random() * 4) + 2 },
    { key: "documents", label: "Documents", count: Math.floor(Math.random() * 30) + 10 },
    { key: "communications", label: "Communications", count: Math.floor(Math.random() * 50) + 20 },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
      {/* Topbar / Breadcrumb */}
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
          >Customers</span>
          <span style={{ color: "#9aa39d" }}>›</span>
          <span style={{ color: "#1a2520", fontWeight: 600 }}>{customer.name}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          padding: "7px 14px", border: "1px solid #d4d9d2", background: "#fff", borderRadius: 7,
          fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1a2520",
        }}>Edit Profile</button>
        <button style={{
          padding: "7px 14px", border: "1px solid #d4d9d2", background: "#fff", borderRadius: 7,
          fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1a2520",
        }}>Send Message</button>
        <button style={{
          padding: "7px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 7,
          fontSize: 13, cursor: "pointer", fontWeight: 500,
        }}>+ New Quote</button>
      </div>

      {/* Page content */}
      <div style={{ padding: "24px 28px 80px", maxWidth: 1480, margin: "0 auto" }}>

        {/* HERO CARD */}
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
          {/* Top section */}
          <div style={{
            padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 20, borderBottom: "1px solid #e8ebe7",
          }}>
            {/* Left: identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12, background: customer.logoColor,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 800, letterSpacing: -0.5, flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: "#1a2520" }}>{customer.name}</div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                    background: "#fef9e7", color: "#a16207", display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    ★ Tier {customer.tier}
                  </span>
                  <span style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: 0.4,
                    background: "#e6f7ec", color: "#166534",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />
                    Active relationship
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7670", display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <span>Customer since <strong style={{ color: "#1a2520", fontWeight: 500 }}>{customer.customerSince}</strong></span>
                  <span>Primary contact: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{customer.primaryContact.name}</strong> · {customer.primaryContact.email}</span>
                  <span>Industry: <strong style={{ color: "#1a2520", fontWeight: 500 }}>{customer.industry}</strong></span>
                </div>
              </div>
            </div>

            {/* Right: account manager (editable) */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14, padding: "10px 14px",
              background: "#f9faf9", border: "1px solid #e8ebe7", borderRadius: 10, flexShrink: 0,
              position: "relative",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ fontSize: 9, color: "#6b7670", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Account Manager</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2520" }}>{accountMgr.name}</div>
                <div style={{ fontSize: 10, color: "#6b7670" }}>{accountMgr.role}</div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #d97706, #b45309)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
              }}>
                {accountMgr.initials}
              </div>
              <button onClick={() => setShowAmPicker(!showAmPicker)} style={{
                position: "absolute", top: 6, right: 6, padding: "2px 6px", fontSize: 9, fontWeight: 500,
                background: "#fff", border: "1px solid #e8ebe7", borderRadius: 4, cursor: "pointer",
                color: "#6b7670",
              }}>Change</button>
              {showAmPicker && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 20,
                  background: "#fff", border: "1px solid #e8ebe7", borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)", width: 240, overflow: "hidden",
                }}>
                  <div style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7" }}>
                    Assign Account Manager
                  </div>
                  {amOptions.map(am => (
                    <div key={am.initials} onClick={() => { setAccountMgr(am); setShowAmPicker(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer",
                        background: accountMgr.initials === am.initials ? "#eef6e6" : "#fff",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f9faf9"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = accountMgr.initials === am.initials ? "#eef6e6" : "#fff"; }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: "linear-gradient(135deg, #d97706, #b45309)",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, flexShrink: 0,
                      }}>{am.initials}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1a2520" }}>{am.name}</div>
                        <div style={{ fontSize: 10, color: "#6b7670" }}>{am.role}</div>
                      </div>
                      {accountMgr.initials === am.initials && <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: 12 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", padding: "18px 22px" }}>
            {[
              { label: "Active Jobs", value: String(customer.stats.activeJobs), color: "#1a2520", sub: `${activeJobs.length} from shipments data` },
              { label: "Completed YTD", value: String(customer.stats.completedYTD), color: "#1a2520", sub: "Across multiple routes" },
              { label: "Value YTD", value: formatUsdFull(customer.stats.valueYTD), color: "#1a2520", sub: "All shipment types" },
              { label: "SLA Met", value: customer.stats.slaMet + "%", color: "#16a34a", sub: "Last 90 days" },
              { label: "Outstanding", value: formatUsdFull(customer.stats.outstanding), color: "#ea8a1a", sub: "Pending invoices" },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                padding: "0 16px",
                borderRight: i < 4 ? "1px solid #e8ebe7" : "none",
                ...(i === 0 ? { paddingLeft: 0 } : {}),
                ...(i === 4 ? { paddingRight: 0 } : {}),
              }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#6b7670", marginTop: 2 }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TABS BAR */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e8ebe7", marginBottom: 24, overflowX: "auto" }}>
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

        {/* TAB CONTENT */}

        {/* RFQs Tab */}
        {activeTab === "rfqs" && (
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{
              padding: "10px 16px", borderBottom: "1px solid #e8ebe7", fontSize: 12, color: "#6b7670",
            }}>
              <strong style={{ color: "#1a2520" }}>{customerRfqs.length} requests</strong> · {customerRfqs.filter(r => r.status === "ready").length} quote-ready · {customerRfqs.filter(r => r.status === "info_needed").length} pending info
            </div>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 80px 70px 70px 60px",
              padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
              textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
            }}>
              <div>RFQ #</div><div>Subject</div><div>Source</div><div>Mode</div><div>Route</div><div>Readiness</div><div>Status</div><div>Date</div>
            </div>
            {/* Rows */}
            {customerRfqs.map(r => {
              const stColor = r.status === "ready" ? "#16a34a" : r.status === "replied" ? "#8b5cf6" : "#ea8a1a";
              const stBg = r.status === "ready" ? "#e6f7ec" : r.status === "replied" ? "#f3eeff" : "#fef3e6";
              const stLabel = r.status === "ready" ? "Quote Ready" : r.status === "replied" ? "Responded" : "Info Needed";
              const srcIcon = r.source === "whatsapp" ? "💬" : r.source === "web" ? "🌐" : "✉️";
              return (
                <div key={r.ref} style={{
                  display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 80px 70px 70px 60px",
                  padding: "10px 16px", borderBottom: "1px solid #e8ebe7", fontSize: 12, alignItems: "center",
                  cursor: "pointer",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f9faf9"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                >
                  <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "#16a34a" }}>{r.ref}</div>
                  <div>
                    <div style={{ fontWeight: 500, color: "#1a2520" }}>{r.subject}</div>
                    <div style={{ fontSize: 10, color: "#9aa39d", marginTop: 1 }}>{r.commodity}</div>
                  </div>
                  <div style={{ fontSize: 11 }}>{srcIcon} {r.source}</div>
                  <div style={{ fontSize: 11, color: "#6b7670" }}>{r.freightMode}</div>
                  <div style={{ fontSize: 11 }}>
                    <span style={{ fontWeight: 500 }}>{r.pol}</span>
                    <span style={{ color: "#9aa39d" }}> → </span>
                    <span style={{ fontWeight: 500 }}>{r.pod}</span>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: r.readiness >= 8 ? "#16a34a" : r.readiness >= 5 ? "#ea8a1a" : "#dc4f4f",
                  }}>{r.readiness}/10</div>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8,
                      background: stBg, color: stColor,
                    }}>{stLabel}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7670" }}>{r.date}</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "jobs" && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e8ebe7", marginBottom: 16 }}>
              {([
                { key: "active" as JobsSubTab, label: "Active", count: activeJobs.length },
                { key: "completed" as JobsSubTab, label: "Completed", count: completedJobs.length + customer.stats.completedYTD },
                { key: "all" as JobsSubTab, label: "All", count: activeJobs.length + completedJobs.length + customer.stats.completedYTD },
              ]).map((st) => (
                <div
                  key={st.key}
                  onClick={() => setJobsSubTab(st.key)}
                  style={{
                    padding: "10px 16px", cursor: "pointer",
                    borderBottom: jobsSubTab === st.key ? "2px solid #16a34a" : "2px solid transparent",
                    marginBottom: -1, fontSize: 13,
                    color: jobsSubTab === st.key ? "#166534" : "#6b7670",
                    display: "flex", alignItems: "center", gap: 8,
                    fontWeight: jobsSubTab === st.key ? 600 : 500,
                  }}
                >
                  {st.label}
                  <span style={{
                    background: jobsSubTab === st.key ? "#e6f7ec" : "#f3f5f3",
                    padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                    color: jobsSubTab === st.key ? "#166534" : "#6b7670",
                  }}>
                    {st.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary banner */}
            {jobsSubTab === "active" && activeJobs.length > 0 && (
              <div style={{
                padding: "10px 16px", background: "#f9faf9", border: "1px solid #e8ebe7",
                borderBottom: 0, borderRadius: "10px 10px 0 0", fontSize: 12, color: "#6b7670",
                display: "flex", alignItems: "center", gap: 16,
              }}>
                <div><strong style={{ color: "#1a2520" }}>{activeJobs.length} active job{activeJobs.length !== 1 ? "s" : ""}</strong> · {atRiskCount > 0 ? `${atRiskCount} at risk` : ""}{breachedCount > 0 ? `${atRiskCount > 0 ? " · " : ""}${breachedCount} breached` : ""}{onTrackCount > 0 ? `${atRiskCount > 0 || breachedCount > 0 ? " · " : ""}${onTrackCount} on track` : ""}</div>
                <div>·</div>
                <div>{totalContainers} active container{totalContainers !== 1 ? "s" : ""} across all jobs</div>
                <div>·</div>
                <div>Total active value <strong style={{ color: "#1a2520" }}>{formatUsdFull(totalActiveValue)}</strong></div>
              </div>
            )}

            {/* Jobs table */}
            <div style={{
              background: "#fff", border: "1px solid #e8ebe7",
              borderRadius: jobsSubTab === "active" && activeJobs.length > 0 ? "0 0 10px 10px" : 10,
              overflow: "hidden",
            }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "140px 140px 180px 90px 1fr 90px 80px 80px",
                background: "#f9faf9", padding: "11px 12px", fontSize: 10, fontWeight: 700,
                color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7",
              }}>
                <div>Job #</div>
                <div>Commodity</div>
                <div>Route</div>
                <div>Containers</div>
                <div>Current Milestone</div>
                <div>Deadline</div>
                <div>Health</div>
                <div>Owner</div>
              </div>

              {/* Rows */}
              {displayedJobs.map((s) => (
                <JobRow key={s.id} shipment={s} onClick={() => navigate(`/shipments/view/${s.id}`)} />
              ))}

              {displayedJobs.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>
                  No {jobsSubTab} jobs for this customer
                </div>
              )}
            </div>
          </>
        )}

        {/* Communications Tab */}
        {activeTab === "communications" && <CommunicationsTab customerName={customer.name} />}

        {/* Other tabs placeholder */}
        {!["jobs", "rfqs", "communications"].includes(activeTab) && (
          <div style={{
            background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10,
            padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13,
          }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab coming soon
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- Communications Tab ---------------

interface CommMessage {
  id: string;
  channel: "email" | "whatsapp";
  direction: "inbound" | "outbound";
  from: string;
  fromRole?: string;
  subject?: string;
  body: string;
  date: string;
  time: string;
  jobNumber?: string;
  assignedTo?: string;
  read: boolean;
}

const mockComms: CommMessage[] = [
  { id: "c1", channel: "email", direction: "inbound", from: "Aliyu Bashir", subject: "Rate Request: Cocoa beans Lagos to Antwerp", body: "Good morning,\n\nPlease send me rates for shipping 12MT of cocoa beans from Lagos to Antwerp. We need 2x40HC containers. FOB terms.", date: "29 May", time: "08:14", jobNumber: "ZELOS26050151", assignedTo: "Tola Adeyemi", read: true },
  { id: "c2", channel: "email", direction: "outbound", from: "Tola Adeyemi", fromRole: "Sales", subject: "Re: Rate Request: Cocoa beans Lagos to Antwerp", body: "Hi Aliyu,\n\nThank you for your enquiry. Could you please confirm the HS Code for the cocoa beans? We'll have rates ready within 24hrs once confirmed.", date: "29 May", time: "09:30", jobNumber: "ZELOS26050151", assignedTo: "Tola Adeyemi", read: true },
  { id: "c3", channel: "whatsapp", direction: "inbound", from: "Chidi Okonkwo", body: "Hello, we need urgent shipping for cement clinker to Ghana. 6 containers. Please advise ASAP.", date: "29 May", time: "07:30", jobNumber: "ZELOS26050142", assignedTo: "K. Okafor", read: true },
  { id: "c4", channel: "whatsapp", direction: "outbound", from: "K. Okafor", fromRole: "Transport Mgr", body: "Hi Chidi, noted. We have availability for 6x40HC on MSC Oscar departing 26 May from Apapa. Shall I proceed with booking?", date: "29 May", time: "08:00", jobNumber: "ZELOS26050142", assignedTo: "K. Okafor", read: true },
  { id: "c5", channel: "email", direction: "inbound", from: "Aliyu Bashir", subject: "Re: Re: Rate Request: Cocoa beans", body: "HS Code is 1801.00. Also, can you confirm if pre-cooling is available at the terminal?", date: "29 May", time: "11:45", jobNumber: "ZELOS26050151", assignedTo: "Tola Adeyemi", read: false },
  { id: "c6", channel: "email", direction: "inbound", from: "Finance Dept", subject: "Invoice INV-2605-001 Payment Confirmation", body: "Please find attached the payment confirmation for invoice INV-2605-001 ($7,500 freight charge). Wire ref: NGN-BUA-29052026.", date: "28 May", time: "16:00", assignedTo: "Tola Adeyemi", read: true },
  { id: "c7", channel: "whatsapp", direction: "inbound", from: "Aliyu Bashir", body: "Any update on the vessel schedule for our Antwerp shipment?", date: "28 May", time: "14:20", jobNumber: "ZELOS26050151", assignedTo: "F. Onuoha", read: true },
  { id: "c8", channel: "email", direction: "outbound", from: "F. Onuoha", fromRole: "CX Officer", subject: "Vessel Schedule Update — ZELOS26050147", body: "Dear Aliyu,\n\nPlease note the vessel MSC SHANGHAI (voyage FN620R) is confirmed for ETD 30 May. We will share the booking confirmation shortly.", date: "28 May", time: "15:10", jobNumber: "ZELOS26050147", assignedTo: "F. Onuoha", read: true },
];

function CommunicationsTab({ customerName }: { customerName: string }) {
  const [comms] = useState(mockComms);
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [selectedComm, setSelectedComm] = useState<CommMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  const filtered = channelFilter === "all" ? comms : comms.filter(c => c.channel === channelFilter);
  const emailCount = comms.filter(c => c.channel === "email").length;
  const waCount = comms.filter(c => c.channel === "whatsapp").length;
  const unreadCount = comms.filter(c => !c.read).length;

  // Group by job
  const jobs = Array.from(new Set(comms.filter(c => c.jobNumber).map(c => c.jobNumber!)));

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left: Message list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Filters */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {([
              { key: "all" as const, label: `All (${comms.length})` },
              { key: "email" as const, label: `Email (${emailCount})` },
              { key: "whatsapp" as const, label: `WhatsApp (${waCount})` },
            ]).map(f => (
              <button key={f.key} onClick={() => setChannelFilter(f.key)} style={{
                padding: "5px 10px", fontSize: 11, fontWeight: channelFilter === f.key ? 600 : 400,
                background: channelFilter === f.key ? "#1a2520" : "#fff", color: channelFilter === f.key ? "#fff" : "#6b7670",
                border: "1px solid #e8ebe7", borderRadius: 6, cursor: "pointer",
              }}>{f.label}</button>
            ))}
          </div>
          {unreadCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#dc4f4f", color: "#fff" }}>{unreadCount} unread</span>
          )}
        </div>

        {/* Message list */}
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
          {filtered.map(c => {
            const isSelected = selectedComm?.id === c.id;
            return (
              <div key={c.id} onClick={() => { setSelectedComm(c); setShowReply(false); }} style={{
                padding: "10px 14px", borderBottom: "1px solid #e8ebe7", cursor: "pointer",
                background: isSelected ? "#eef6e6" : !c.read ? "#fffbeb" : "#fff",
                borderLeft: isSelected ? "3px solid #16a34a" : "3px solid transparent",
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f9faf9"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? "#eef6e6" : !c.read ? "#fffbeb" : "#fff"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{c.channel === "whatsapp" ? "💬" : c.direction === "outbound" ? "↗️" : "✉️"}</span>
                    <span style={{ fontSize: 12, fontWeight: c.read ? 500 : 700, color: "#1a2520" }}>{c.from}</span>
                    {c.fromRole && <span style={{ fontSize: 9, color: "#6b7670", fontWeight: 500 }}>({c.fromRole})</span>}
                    {!c.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />}
                  </div>
                  <span style={{ fontSize: 10, color: "#9aa39d" }}>{c.date} {c.time}</span>
                </div>
                {c.subject && <div style={{ fontSize: 11, fontWeight: 500, color: "#1a2520", marginBottom: 2 }}>{c.subject}</div>}
                <div style={{ fontSize: 11, color: "#6b7670", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.body.split("\n")[0]}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {c.jobNumber && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "#e6f7ec", color: "#16a34a", fontFamily: "monospace" }}>{c.jobNumber}</span>
                  )}
                  {c.assignedTo && (
                    <span style={{ fontSize: 9, color: "#9aa39d" }}>→ {c.assignedTo}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Message detail + reply */}
      <div style={{ width: 400, flexShrink: 0, display: "flex", flexDirection: "column" }}>
        {selectedComm ? (
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8ebe7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{selectedComm.channel === "whatsapp" ? "💬" : "✉️"}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1a2520" }}>{selectedComm.from}</span>
                  {selectedComm.fromRole && <span style={{ fontSize: 10, color: "#6b7670" }}>· {selectedComm.fromRole}</span>}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: selectedComm.direction === "outbound" ? "#e6f7ec" : "#eff4ff",
                  color: selectedComm.direction === "outbound" ? "#16a34a" : "#2563eb",
                }}>{selectedComm.direction === "outbound" ? "Sent" : "Received"}</span>
              </div>
              {selectedComm.subject && <div style={{ fontSize: 13, fontWeight: 500, color: "#1a2520" }}>{selectedComm.subject}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, color: "#9aa39d" }}>
                <span>{selectedComm.date} at {selectedComm.time}</span>
                <span>via {selectedComm.channel}</span>
                {selectedComm.assignedTo && <span>· Assigned: {selectedComm.assignedTo}</span>}
              </div>
              {selectedComm.jobNumber && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#e6f7ec", color: "#16a34a", fontFamily: "monospace", cursor: "pointer" }}>
                    Job: {selectedComm.jobNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: "16px", overflowY: "auto", fontSize: 13, color: "#1a2520", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {selectedComm.body}
            </div>

            {/* Reply area */}
            {showReply ? (
              <div style={{ borderTop: "2px solid #16a34a", padding: "12px 16px", background: "#f8faf8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#1a2520" }}>
                    Reply via {selectedComm.channel === "whatsapp" ? "WhatsApp" : "Email"}
                  </span>
                  <span style={{ fontSize: 10, color: "#9aa39d" }}>to {selectedComm.from}</span>
                </div>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={`Type your ${selectedComm.channel === "whatsapp" ? "message" : "reply"}...`}
                  style={{
                    width: "100%", minHeight: 80, padding: 10, fontSize: 12, border: "1px solid #e8ebe7",
                    borderRadius: 6, fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none",
                    color: "#1a2520", boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowReply(false)} style={{
                    padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#fff",
                    border: "1px solid #e8ebe7", borderRadius: 6, cursor: "pointer", color: "#6b7670",
                  }}>Cancel</button>
                  <button onClick={() => { setReplyText(""); setShowReply(false); }} style={{
                    padding: "6px 12px", fontSize: 11, fontWeight: 500,
                    background: selectedComm.channel === "whatsapp" ? "#25D366" : "#16a34a",
                    border: "none", borderRadius: 6, cursor: "pointer", color: "#fff",
                  }}>{selectedComm.channel === "whatsapp" ? "Send WhatsApp" : "Send Email"}</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px 16px", borderTop: "1px solid #e8ebe7", display: "flex", gap: 6 }}>
                <button onClick={() => setShowReply(true)} style={{
                  padding: "6px 14px", fontSize: 11, fontWeight: 500, background: "#16a34a",
                  border: "none", borderRadius: 6, cursor: "pointer", color: "#fff",
                }}>Reply</button>
                <button style={{
                  padding: "6px 14px", fontSize: 11, fontWeight: 500, background: "#fff",
                  border: "1px solid #e8ebe7", borderRadius: 6, cursor: "pointer", color: "#6b7670",
                }}>Forward</button>
                <select style={{
                  padding: "4px 8px", fontSize: 10, border: "1px solid #e8ebe7", borderRadius: 4,
                  outline: "none", color: "#6b7670", background: "#fff", marginLeft: "auto",
                }}>
                  <option>Assign to...</option>
                  <option>Tola Adeyemi (Sales)</option>
                  <option>K. Okafor (Transport)</option>
                  <option>F. Onuoha (CX)</option>
                  <option>A. Bello (Clearing)</option>
                </select>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
            color: "#9aa39d", fontSize: 12,
          }}>
            Select a message to view
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- Job row (same as Shipments but without Customer column) ---------------

function JobRow({ shipment: s, onClick }: { shipment: Shipment; onClick: () => void }) {
  const statusColor = s.deadlineStatus === "breached" ? "#dc4f4f" : s.deadlineStatus === "at-risk" ? "#ea8a1a" : "transparent";
  const modeBadgeColor = s.mode === "ocean" ? "#2563eb" : s.mode === "air" ? "#8b5cf6" : "#d97706";
  const modeBadgeBg = s.mode === "ocean" ? "#eff4ff" : s.mode === "air" ? "#f3eeff" : "#fef3e6";

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "140px 140px 180px 90px 1fr 90px 80px 80px",
        padding: "12px",
        borderBottom: "1px solid #e8ebe7",
        cursor: "pointer",
        fontSize: 13,
        color: "#1a2520",
        background: s.deadlineStatus === "breached"
          ? "linear-gradient(to right, #fdecec 0%, transparent 8px)"
          : s.deadlineStatus === "at-risk"
          ? "linear-gradient(to right, #fef3e6 0%, transparent 8px)"
          : "#fff",
        borderLeft: statusColor !== "transparent" ? `3px solid ${statusColor}` : "3px solid transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#f9faf9"; }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = s.deadlineStatus === "breached"
          ? "linear-gradient(to right, #fdecec 0%, transparent 8px)"
          : s.deadlineStatus === "at-risk"
          ? "linear-gradient(to right, #fef3e6 0%, transparent 8px)"
          : "#fff";
      }}
    >
      {/* Job # */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
          {s.jobNumber}
        </span>
        <span style={{
          display: "inline-block", fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
          background: modeBadgeBg, color: modeBadgeColor, textTransform: "uppercase", width: "fit-content",
        }}>
          {s.mode} · {s.direction}
        </span>
      </div>

      {/* Commodity */}
      <div style={{ fontSize: 12, color: "#6b7670" }}>
        {s.commodity}
        <div style={{ fontSize: 10, color: "#9aa39d" }}>{(s.weightKg / 1000).toFixed(0)} MT</div>
      </div>

      {/* Route */}
      <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontWeight: 500 }}>{s.origin.portCode}</span>
        <span style={{ color: "#9aa39d" }}>→</span>
        <span style={{ fontWeight: 500 }}>{s.destination.portCode}</span>
        <span style={{ fontSize: 10, color: "#9aa39d", marginLeft: 4 }}>{s.origin.country.slice(0, 3)}-{s.destination.country.slice(0, 3)}</span>
      </div>

      {/* Containers */}
      <div style={{ fontSize: 12 }}>
        {s.containers.count}×{s.containers.size}
      </div>

      {/* Current Milestone */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{s.currentMilestone}</span>
        <span style={{ fontSize: 10, color: "#6b7670" }}>{s.milestoneDetail}</span>
      </div>

      {/* Deadline */}
      <div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
          background: s.deadlineStatus === "breached" ? "#fdecec" : s.deadlineStatus === "at-risk" ? "#fef3e6" : "#e6f7ec",
          color: s.deadlineStatus === "breached" ? "#b91c1c" : s.deadlineStatus === "at-risk" ? "#b45309" : "#166534",
        }}>
          {s.deadlineLabel}
        </span>
      </div>

      {/* Health */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, justifyContent: "center" }}>
        <div style={{ width: 48, height: 5, background: "#f3f5f3", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${s.healthScore}%`, height: "100%", borderRadius: 3,
            background: s.healthScore >= 75 ? "#16a34a" : s.healthScore >= 50 ? "#ea8a1a" : "#dc4f4f",
          }} />
        </div>
        <span style={{ fontSize: 10, color: "#6b7670" }}>{s.healthScore}%</span>
      </div>

      {/* Owner */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 24, height: 24, borderRadius: "50%", background: "#16a34a",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 9, fontWeight: 700,
        }}>
          {s.opsOfficer.initials}
        </div>
      </div>
    </div>
  );
}
