// @ts-nocheck
import React, { useEffect, useState } from "react";
import api from "../lib/api";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";

interface Company {
  _id: string;
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
  status: string;
  contactCount?: number;
  rfqCount?: number;
  quoteCount?: number;
}

interface Contact {
  _id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  source: string;
  isPrimary: boolean;
}

type Tab = "companies" | "contacts" | "opportunities";

interface Opportunity {
  id: string;
  title: string;
  company: string;
  contact: string;
  value: number;
  currency: "USD" | "NGN";
  stage: string;
  source: "email" | "whatsapp" | "web" | "manual";
  rfqRef?: string;
  jobNumber?: string;
  owner: string;
  probability: number;
  createdAt: string;
  updatedAt: string;
  closeReason?: string;
  notes?: string;
  freightMode?: string;
  route?: string;
}

const DEAL_STAGES = [
  { key: "new-lead", label: "New Lead", color: "#6b7670" },
  { key: "qualified", label: "Qualified", color: "#2563eb" },
  { key: "proposal-sent", label: "Proposal Sent", color: "#8b5cf6" },
  { key: "negotiation", label: "Negotiation", color: "#ea8a1a" },
  { key: "closed-won", label: "Closed Won", color: "#16a34a" },
  { key: "closed-lost", label: "Closed Lost", color: "#dc4f4f" },
];

const MOCK_OPPS: Opportunity[] = [
  { id: "o1", title: "Cocoa beans export — 2x40HC Lagos to Antwerp", company: "BUA Foods", contact: "Aliyu Bashir", value: 12250, currency: "USD", stage: "negotiation", source: "email", rfqRef: "RFQ-2605-1001", owner: "Tola Adeyemi", probability: 75, createdAt: "2026-05-29", updatedAt: "2026-05-30", freightMode: "Ocean", route: "NGAPP → BEANR" },
  { id: "o2", title: "Cement clinker to Ghana — 6x40HC", company: "Dangote Industries", contact: "Chidi Okonkwo", value: 18500, currency: "USD", stage: "proposal-sent", source: "whatsapp", rfqRef: "RFQ-2605-1002", owner: "Tola Adeyemi", probability: 60, createdAt: "2026-05-29", updatedAt: "2026-05-29", freightMode: "Ocean", route: "NGAPP → GHTEM" },
  { id: "o3", title: "Wheat import from Rotterdam", company: "Flour Mills Nigeria", contact: "Fatima Abdullahi", value: 28400, currency: "USD", stage: "qualified", source: "email", rfqRef: "RFQ-2605-1003", owner: "C. Nwosu", probability: 40, createdAt: "2026-05-28", updatedAt: "2026-05-29", freightMode: "Ocean", route: "NLRTM → NGAPP" },
  { id: "o4", title: "Reefer containers — processed cocoa", company: "Nestlé Nigeria", contact: "Emmanuel Eze", value: 11400, currency: "USD", stage: "negotiation", source: "email", rfqRef: "RFQ-2605-1004", owner: "Tola Adeyemi", probability: 80, createdAt: "2026-05-28", updatedAt: "2026-05-30", freightMode: "Ocean", route: "NGAPP → BEANR" },
  { id: "o5", title: "Sesame seeds to Hamburg — 4x40HC", company: "Olam Agri", contact: "Adaeze Nwankwo", value: 14200, currency: "USD", stage: "closed-won", source: "email", rfqRef: "RFQ-2605-1005", jobNumber: "ZELOS26050138", owner: "C. Nwosu", probability: 100, createdAt: "2026-05-27", updatedAt: "2026-05-29", freightMode: "Ocean", route: "NGAPP → DEHAM" },
  { id: "o6", title: "Gypsum import from UAE — 4x20GP", company: "Lafarge Africa", contact: "Ibrahim Musa", value: 16800, currency: "USD", stage: "closed-won", source: "whatsapp", rfqRef: "RFQ-2605-1006", jobNumber: "ZILOS26050094", owner: "C. Nwosu", probability: 100, createdAt: "2026-05-27", updatedAt: "2026-05-28", freightMode: "Ocean", route: "AEJEA → NGTCN" },
  { id: "o7", title: "Noodles export to Tema", company: "Dufil Prima Foods", contact: "Grace Okoro", value: 7600, currency: "USD", stage: "proposal-sent", source: "email", rfqRef: "RFQ-2605-1007", owner: "C. Nwosu", probability: 50, createdAt: "2026-05-26", updatedAt: "2026-05-28", freightMode: "Ocean", route: "NGAPP → GHTEM" },
  { id: "o8", title: "Cement export to Kenya", company: "BUA Cement", contact: "Yusuf Bello", value: 9200, currency: "USD", stage: "new-lead", source: "web", owner: "Tola Adeyemi", probability: 20, createdAt: "2026-05-25", updatedAt: "2026-05-25", freightMode: "Ocean", route: "NGAPP → KEMBA" },
  { id: "o9", title: "Air freight cosmetics London–Lagos", company: "PZ Cussons", contact: "Samuel Ojo", value: 4200, currency: "USD", stage: "qualified", source: "web", rfqRef: "RFQ-2605-1010", owner: "C. Nwosu", probability: 35, createdAt: "2026-05-24", updatedAt: "2026-05-26", freightMode: "Air", route: "LHR → LOS" },
  { id: "o10", title: "Malt extract import — 6x20GP", company: "Nigerian Breweries", contact: "Ngozi Adekunle", value: 22000, currency: "USD", stage: "closed-lost", source: "email", owner: "Tola Adeyemi", probability: 0, createdAt: "2026-05-20", updatedAt: "2026-05-25", closeReason: "Customer chose competitor — lower rate from PIL direct", freightMode: "Ocean", route: "NLRTM → NGAPP" },
  { id: "o11", title: "Packaging materials import", company: "Cadbury Nigeria", contact: "Amina Yusuf", value: 8500, currency: "USD", stage: "new-lead", source: "manual", owner: "C. Nwosu", probability: 15, createdAt: "2026-05-22", updatedAt: "2026-05-22", freightMode: "Ocean", route: "CNSHA → NGAPP", notes: "Referred by existing customer" },
];

function statusBadge(status: string) {
  const cls = status === "active" ? "b-ok" : status === "lead" ? "b-wait" : "b-gray";
  return <span className={`badge ${cls}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function sourceBadge(source: string) {
  const cls = source === "whatsapp" ? "b-ok" : source === "manual" ? "b-gray" : "b-rate";
  return <span className={`badge ${cls}`}>{source.charAt(0).toUpperCase() + source.slice(1)}</span>;
}

export default function CRM() {
  const [tab, setTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [opps, setOpps] = useState(MOCK_OPPS);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [oppView, setOppView] = useState<"pipeline" | "list">("pipeline");
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [newOpp, setNewOpp] = useState({ title: "", company: "", contact: "", value: "", currency: "USD" as "USD" | "NGN", stage: "new-lead", source: "manual" as Opportunity["source"], owner: "", freightMode: "", route: "", notes: "" });

  const DUMMY_COMPANIES: Company[] = [
    { _id: "dc1", name: "BUA Foods Plc", domain: "buafoods.com", industry: "FMCG · Agro-processing", country: "Nigeria", status: "active", contactCount: 3, rfqCount: 8, quoteCount: 5 },
    { _id: "dc2", name: "Dangote Industries", domain: "dangote.com", industry: "Manufacturing · Cement", country: "Nigeria", status: "active", contactCount: 4, rfqCount: 12, quoteCount: 7 },
    { _id: "dc3", name: "Flour Mills Nigeria", domain: "fmnplc.com", industry: "FMCG · Food processing", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 6, quoteCount: 4 },
    { _id: "dc4", name: "Nestlé Nigeria", domain: "nestle-cwa.com", industry: "FMCG · Food & Beverage", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 5, quoteCount: 3 },
    { _id: "dc5", name: "Olam Agri", domain: "olamagri.com", industry: "Agriculture · Trading", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 4, quoteCount: 3 },
    { _id: "dc6", name: "Lafarge Africa", domain: "lafarge.com.ng", industry: "Manufacturing · Building materials", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 3, quoteCount: 2 },
    { _id: "dc7", name: "Dufil Prima Foods", domain: "dufil.com", industry: "FMCG · Food processing", country: "Nigeria", status: "active", contactCount: 1, rfqCount: 2, quoteCount: 1 },
    { _id: "dc8", name: "BUA Cement", domain: "buacement.com", industry: "Manufacturing · Cement", country: "Nigeria", status: "lead", contactCount: 1, rfqCount: 1, quoteCount: 0 },
    { _id: "dc9", name: "Nigerian Breweries", domain: "nbplc.com", industry: "FMCG · Beverages", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 3, quoteCount: 2 },
    { _id: "dc10", name: "PZ Cussons", domain: "pzcussons.com", industry: "FMCG · Personal care", country: "Nigeria", status: "lead", contactCount: 1, rfqCount: 1, quoteCount: 0 },
    { _id: "dc11", name: "Cadbury Nigeria", domain: "cadbury.com.ng", industry: "FMCG · Confectionery", country: "Nigeria", status: "active", contactCount: 1, rfqCount: 2, quoteCount: 1 },
    { _id: "dc12", name: "Honeywell Flour", domain: "honeywellflour.com", industry: "FMCG · Food processing", country: "Nigeria", status: "active", contactCount: 1, rfqCount: 2, quoteCount: 2 },
    { _id: "dc13", name: "Friesland Campina", domain: "frieslandcampina.com.ng", industry: "FMCG · Dairy", country: "Nigeria", status: "active", contactCount: 1, rfqCount: 1, quoteCount: 1 },
    { _id: "dc14", name: "Unilever Nigeria", domain: "unilever.com.ng", industry: "FMCG · Consumer goods", country: "Nigeria", status: "active", contactCount: 2, rfqCount: 3, quoteCount: 2 },
  ];

  const DUMMY_CONTACTS: Contact[] = [
    { _id: "ct1", firstName: "Aliyu", lastName: "Bashir", email: "aliyu.bashir@buafoods.com", companyName: "BUA Foods Plc", source: "email", isPrimary: true },
    { _id: "ct2", firstName: "Chidi", lastName: "Okonkwo", email: "c.okonkwo@dangote.com", companyName: "Dangote Industries", source: "whatsapp", isPrimary: true },
    { _id: "ct3", firstName: "Aminu", lastName: "Dantata", email: "a.dantata@dangote.com", companyName: "Dangote Industries", source: "email", isPrimary: false },
    { _id: "ct4", firstName: "Fatima", lastName: "Abdullahi", email: "fatima@flourmills.com", companyName: "Flour Mills Nigeria", source: "email", isPrimary: true },
    { _id: "ct5", firstName: "Emmanuel", lastName: "Eze", email: "e.eze@nestle.com", companyName: "Nestlé Nigeria", source: "email", isPrimary: true },
    { _id: "ct6", firstName: "Adaeze", lastName: "Nwankwo", email: "a.nwankwo@olamagri.com", companyName: "Olam Agri", source: "email", isPrimary: true },
    { _id: "ct7", firstName: "Ibrahim", lastName: "Musa", email: "i.musa@lafarge.com", companyName: "Lafarge Africa", source: "whatsapp", isPrimary: true },
    { _id: "ct8", firstName: "Grace", lastName: "Okoro", email: "g.okoro@dufil.com", companyName: "Dufil Prima Foods", source: "email", isPrimary: true },
    { _id: "ct9", firstName: "Yusuf", lastName: "Bello", email: "y.bello@buacement.com", companyName: "BUA Cement", source: "web", isPrimary: true },
    { _id: "ct10", firstName: "Ngozi", lastName: "Adekunle", email: "n.adekunle@nbplc.com", companyName: "Nigerian Breweries", source: "email", isPrimary: true },
    { _id: "ct11", firstName: "Samuel", lastName: "Ojo", email: "s.ojo@pzcussons.com", companyName: "PZ Cussons", source: "web", isPrimary: true },
    { _id: "ct12", firstName: "Amina", lastName: "Yusuf", email: "a.yusuf@cadbury.com", companyName: "Cadbury Nigeria", source: "email", isPrimary: true },
    { _id: "ct13", firstName: "Tunde", lastName: "Bakare", email: "t.bakare@honeywellflour.com", companyName: "Honeywell Flour", source: "email", isPrimary: true },
    { _id: "ct14", firstName: "Kemi", lastName: "Adesanya", email: "k.adesanya@friesland.com", companyName: "Friesland Campina", source: "whatsapp", isPrimary: true },
    { _id: "ct15", firstName: "Obinna", lastName: "Nwoye", email: "o.nwoye@unilever.com", companyName: "Unilever Nigeria", source: "email", isPrimary: true },
    { _id: "ct16", firstName: "Hauwa", lastName: "Mohammed", email: "h.mohammed@dangote.com", companyName: "Dangote Industries", source: "manual", isPrimary: false },
  ];

  useEffect(() => {
    api.get("/companies").then((res) => {
      const c = (res.data as any).companies || [];
      setCompanies(c.length > 0 ? c : DUMMY_COMPANIES);
    }).catch(() => setCompanies(DUMMY_COMPANIES));
    api.get("/contacts").then((res) => {
      const c = (res.data as any).contacts || [];
      setContacts(c.length > 0 ? c : DUMMY_CONTACTS);
    }).catch(() => setContacts(DUMMY_CONTACTS));
  }, []);

  const loadCompanyDetail = async (c: Company) => {
    try {
      const res = await api.get(`/companies/${c._id}`);
      setSelectedCompany(res.data);
    } catch {
      // Fallback for dummy data
      const dummyContacts = DUMMY_CONTACTS.filter(ct => ct.companyName === c.name);
      setSelectedCompany({
        company: c,
        contacts: dummyContacts,
        stats: { totalRfqs: c.rfqCount || 0, activeRfqs: Math.min(c.rfqCount || 0, 3), totalQuotes: c.quoteCount || 0 },
      });
    }
  };

  const loadContactDetail = async (c: Contact) => {
    try {
      const res = await api.get(`/contacts/${c._id}`);
      setSelectedContact(res.data);
    } catch {
      const comp = DUMMY_COMPANIES.find(co => co.name === c.companyName);
      setSelectedContact({
        contact: { ...c, phone: "+234 80X XXX XXXX", whatsappPhone: "+234 80X XXX XXXX", jobTitle: "Procurement Manager", source: c.source },
        company: comp ? { name: comp.name } : null,
        stats: { totalRfqs: Math.floor(Math.random() * 5) + 1, totalQuotes: Math.floor(Math.random() * 3) + 1 },
      });
    }
  };

  const filteredCompanies = search
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.domain && c.domain.toLowerCase().includes(search.toLowerCase())))
    : companies;

  const filteredContacts = search
    ? contacts.filter((c) => `${c.firstName} ${c.lastName || ""}`.toLowerCase().includes(search.toLowerCase()) || (c.email && c.email.toLowerCase().includes(search.toLowerCase())))
    : contacts;

  const companyColumns = [
    { key: "name", header: "Company", render: (c: Company) => <span style={{ fontWeight: 500, color: "var(--text)" }}>{c.name}</span> },
    { key: "domain", header: "Domain", render: (c: Company) => <span style={{ fontSize: 11, color: "var(--text3)" }}>{c.domain || "—"}</span> },
    { key: "contactCount", header: "Contacts", render: (c: Company) => c.contactCount ?? 0 },
    { key: "rfqCount", header: "RFQs", render: (c: Company) => c.rfqCount ?? 0 },
    { key: "status", header: "Status", render: (c: Company) => statusBadge(c.status) },
  ];

  const contactColumns = [
    { key: "name", header: "Name", render: (c: Contact) => <span style={{ fontWeight: 500, color: "var(--text)" }}>{c.firstName} {c.lastName || ""}{c.isPrimary ? <span className="badge b-ok" style={{ marginLeft: 4, fontSize: 9 }}>Primary</span> : ""}</span> },
    { key: "companyName", header: "Company", render: (c: Contact) => c.companyName || "—" },
    { key: "email", header: "Email", render: (c: Contact) => <span style={{ fontSize: 11, color: "var(--text3)" }}>{c.email || "—"}</span> },
    { key: "source", header: "Source", render: (c: Contact) => sourceBadge(c.source) },
  ];

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>CRM</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Manage companies, contacts, and deals</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        <StatCard value={companies.length || 8} label="Companies" note="active accounts" />
        <StatCard value={contacts.length || 14} label="Contacts" note="total people" />
        <StatCard value={opps.filter(o => !o.stage.startsWith("closed")).length} label="Open Deals" note={`$${Math.round(opps.filter(o => !o.stage.startsWith("closed")).reduce((s, o) => s + o.value, 0) / 1000)}K pipeline`} noteType="warn" />
        <StatCard value={opps.filter(o => o.stage === "closed-won").length} label="Won" note={`$${Math.round(opps.filter(o => o.stage === "closed-won").reduce((s, o) => s + o.value, 0) / 1000)}K revenue`} />
        <StatCard value={Math.round(opps.filter(o => o.stage === "closed-won").length / Math.max(opps.filter(o => o.stage.startsWith("closed")).length, 1) * 100)} label="Win Rate" note="closed deals %" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", background: "var(--surface)", borderRadius: "10px 10px 0 0", overflow: "hidden" }}>
        {(["companies", "contacts", "opportunities"] as Tab[]).map((t) => (
          <div
            key={t}
            onClick={() => { setTab(t); setSearch(""); }}
            style={{
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: 600,
              color: tab === t ? "var(--accent-dark)" : "var(--text3)",
              cursor: "pointer",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, outline: "none", fontFamily: "Inter, sans-serif", background: "var(--bg)" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 10, flex: 1, overflow: "hidden", minHeight: 400 }}>
        {tab === "companies" ? (
          <>
            <DataTable
              columns={companyColumns}
              data={filteredCompanies}
              onRowClick={loadCompanyDetail}
              selectedId={selectedCompany?.company?._id}
              emptyMessage="No companies found"
            />
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {selectedCompany ? (
                <>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "#f8faf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>{selectedCompany.company.name}</span>
                    {statusBadge(selectedCompany.company.status)}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 6px" }}>Details</div>
                    {[["Domain", selectedCompany.company.domain], ["Industry", selectedCompany.company.industry], ["Country", selectedCompany.company.country], ["Phone", selectedCompany.company.phone]].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{k}</span>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{v || "—"}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Activity</div>
                    {[["Total RFQs", selectedCompany.stats?.totalRfqs], ["Active RFQs", selectedCompany.stats?.activeRfqs], ["Quotes", selectedCompany.stats?.totalQuotes]].map(([k, v]) => (
                      <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{k}</span>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{v ?? 0}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Contacts ({selectedCompany.contacts?.length || 0})</div>
                    {(selectedCompany.contacts || []).map((ct: any) => (
                      <div key={ct._id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text)" }}>{ct.firstName} {ct.lastName || ""}</span>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{ct.email || ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
                  Select a company to view details
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <DataTable
              columns={contactColumns}
              data={filteredContacts}
              onRowClick={loadContactDetail}
              selectedId={selectedContact?.contact?._id}
              emptyMessage="No contacts found"
            />
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {selectedContact ? (
                <>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "#f8faf8" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>{selectedContact.contact.firstName} {selectedContact.contact.lastName || ""}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 6px" }}>Details</div>
                    {[["Email", selectedContact.contact.email], ["Phone", selectedContact.contact.phone], ["WhatsApp", selectedContact.contact.whatsappPhone], ["Job Title", selectedContact.contact.jobTitle], ["Source", selectedContact.contact.source]].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{k}</span>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{v || "—"}</span>
                      </div>
                    ))}
                    {selectedContact.company && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Company</div>
                        <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{selectedContact.company.name}</div>
                      </>
                    )}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Activity</div>
                    {[["Total RFQs", selectedContact.stats?.totalRfqs], ["Quotes", selectedContact.stats?.totalQuotes]].map(([k, v]) => (
                      <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{k}</span>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{v ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
                  Select a contact to view details
                </div>
              )}
            </div>
          </>
        )}

        {/* Opportunities */}
        {tab === "opportunities" && (
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setOppView("pipeline")} style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: oppView === "pipeline" ? 600 : 400,
                  background: oppView === "pipeline" ? "var(--text)" : "var(--surface)", color: oppView === "pipeline" ? "#fff" : "var(--text3)",
                  border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                }}>Pipeline</button>
                <button onClick={() => setOppView("list")} style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: oppView === "list" ? 600 : 400,
                  background: oppView === "list" ? "var(--text)" : "var(--surface)", color: oppView === "list" ? "#fff" : "var(--text3)",
                  border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                }}>List</button>
              </div>
              <button onClick={() => setShowAddOpp(!showAddOpp)} style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 500, background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 6, cursor: "pointer",
              }}>+ Add Opportunity</button>
            </div>

            {/* Add form */}
            {showAddOpp && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, borderLeft: "3px solid var(--accent)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Title *</label>
                    <input value={newOpp.title} onChange={e => setNewOpp({ ...newOpp, title: e.target.value })} placeholder="e.g. Cocoa export 2x40HC" style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Company *</label>
                    <input value={newOpp.company} onChange={e => setNewOpp({ ...newOpp, company: e.target.value })} placeholder="Company name" style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Contact</label>
                    <input value={newOpp.contact} onChange={e => setNewOpp({ ...newOpp, contact: e.target.value })} placeholder="Contact name" style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Currency</label>
                    <select value={newOpp.currency} onChange={e => setNewOpp({ ...newOpp, currency: e.target.value as "USD" | "NGN" })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="USD">USD</option><option value="NGN">NGN</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Value *</label>
                    <input type="number" value={newOpp.value} onChange={e => setNewOpp({ ...newOpp, value: e.target.value })} placeholder="0" style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Stage</label>
                    <select value={newOpp.stage} onChange={e => setNewOpp({ ...newOpp, stage: e.target.value })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      {DEAL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Source</label>
                    <select value={newOpp.source} onChange={e => setNewOpp({ ...newOpp, source: e.target.value as Opportunity["source"] })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="web">Web</option><option value="manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Owner</label>
                    <input value={newOpp.owner} onChange={e => setNewOpp({ ...newOpp, owner: e.target.value })} placeholder="Sales rep" style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowAddOpp(false)} style={{ padding: "5px 12px", fontSize: 11, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text3)" }}>Cancel</button>
                  <button onClick={() => {
                    if (newOpp.title && newOpp.company && newOpp.value) {
                      setOpps([{ ...newOpp, id: `o${Date.now()}`, value: parseFloat(newOpp.value), probability: 20, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) }, ...opps]);
                      setNewOpp({ title: "", company: "", contact: "", value: "", currency: "USD", stage: "new-lead", source: "manual", owner: "", freightMode: "", route: "", notes: "" });
                      setShowAddOpp(false);
                    }
                  }} style={{ padding: "5px 12px", fontSize: 11, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Create</button>
                </div>
              </div>
            )}

            {/* Pipeline view */}
            {oppView === "pipeline" && (
              <div style={{ display: "flex", gap: 10, overflow: "auto", paddingBottom: 8 }}>
                {DEAL_STAGES.map(stage => {
                  const stageOpps = opps.filter(o => o.stage === stage.key);
                  const stageValue = stageOpps.reduce((s, o) => s + o.value, 0);
                  return (
                    <div key={stage.key} style={{ minWidth: 220, flex: 1, display: "flex", flexDirection: "column" }}>
                      {/* Stage header */}
                      <div style={{
                        padding: "8px 10px", borderRadius: "8px 8px 0 0", borderBottom: `3px solid ${stage.color}`,
                        background: "var(--surface)", border: "1px solid var(--border)", borderBottomColor: stage.color,
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: stage.color }}>{stage.label}</div>
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>{stageOpps.length} deals · ${stageValue.toLocaleString()}</div>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: stage.color }}>{stageOpps.length}</span>
                      </div>
                      {/* Cards */}
                      <div style={{ flex: 1, background: "#f9faf9", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 6, display: "flex", flexDirection: "column", gap: 6, minHeight: 100 }}>
                        {stageOpps.map(opp => (
                          <div key={opp.id} onClick={() => setSelectedOpp(selectedOpp?.id === opp.id ? null : opp)} style={{
                            background: selectedOpp?.id === opp.id ? "#eef6e6" : "var(--surface)", border: selectedOpp?.id === opp.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                            borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontSize: 11,
                          }}>
                            <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 3, lineHeight: 1.3 }}>{opp.title}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "var(--text3)" }}>{opp.company}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "monospace" }}>${opp.value.toLocaleString()}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: opp.source === "email" ? "#eef6e6" : opp.source === "whatsapp" ? "#dcfce7" : opp.source === "web" ? "#fef3e6" : "#f3f5f3", color: "var(--text2)" }}>{opp.source}</span>
                              {opp.rfqRef && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#eef6e6", color: "var(--accent)", fontFamily: "monospace" }}>{opp.rfqRef}</span>}
                              <span style={{ fontSize: 8, color: "var(--text3)", marginLeft: "auto" }}>{opp.owner.split(" ")[0]}</span>
                            </div>
                          </div>
                        ))}
                        {stageOpps.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text3)", fontSize: 10 }}>No deals</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {oppView === "list" && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 120px 80px 90px 80px 80px 80px 80px",
                  padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "var(--text3)",
                  textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", background: "var(--bg)",
                }}>
                  <div>Deal</div><div>Company</div><div>Value</div><div>Stage</div><div>Source</div><div>Owner</div><div>Prob.</div><div>Updated</div>
                </div>
                {opps.map(opp => {
                  const stage = DEAL_STAGES.find(s => s.key === opp.stage)!;
                  return (
                    <div key={opp.id} onClick={() => setSelectedOpp(selectedOpp?.id === opp.id ? null : opp)} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 80px 90px 80px 80px 80px 80px",
                      padding: "8px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 11,
                      background: selectedOpp?.id === opp.id ? "#eef6e6" : "var(--surface)",
                    }}
                      onMouseEnter={e => { if (selectedOpp?.id !== opp.id) e.currentTarget.style.background = "var(--bg)"; }}
                      onMouseLeave={e => { if (selectedOpp?.id !== opp.id) e.currentTarget.style.background = "var(--surface)"; }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>{opp.title}</div>
                        {opp.rfqRef && <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "monospace" }}>{opp.rfqRef}</span>}
                      </div>
                      <div style={{ color: "var(--text2)" }}>{opp.company}</div>
                      <div style={{ fontWeight: 600, fontFamily: "monospace" }}>${opp.value.toLocaleString()}</div>
                      <div><span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8, background: `${stage.color}18`, color: stage.color }}>{stage.label}</span></div>
                      <div style={{ fontSize: 10 }}>{opp.source === "whatsapp" ? "💬" : opp.source === "web" ? "🌐" : opp.source === "manual" ? "✏️" : "✉️"} {opp.source}</div>
                      <div style={{ fontSize: 10, color: "var(--text2)" }}>{opp.owner.split(" ")[0]}</div>
                      <div style={{ fontSize: 10, color: opp.probability >= 70 ? "var(--accent)" : opp.probability >= 40 ? "var(--warn)" : "var(--text3)", fontWeight: 600 }}>{opp.probability}%</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>{opp.updatedAt.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected opportunity detail */}
            {selectedOpp && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{selectedOpp.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{selectedOpp.company} · {selectedOpp.contact}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* Stage changer */}
                    <select value={selectedOpp.stage} onChange={e => {
                      const newStage = e.target.value;
                      setOpps(opps.map(o => o.id === selectedOpp.id ? { ...o, stage: newStage, updatedAt: new Date().toISOString().slice(0, 10), probability: newStage === "closed-won" ? 100 : newStage === "closed-lost" ? 0 : o.probability } : o));
                      setSelectedOpp({ ...selectedOpp, stage: newStage, updatedAt: new Date().toISOString().slice(0, 10) });
                    }} style={{
                      padding: "4px 8px", fontSize: 10, border: "1px solid var(--border)", borderRadius: 4,
                      outline: "none", fontFamily: "inherit", background: "var(--surface)", color: "var(--text)", fontWeight: 600,
                    }}>
                      {DEAL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button onClick={() => setSelectedOpp(null)} style={{ padding: "4px 8px", fontSize: 10, background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text3)" }}>Close</button>
                  </div>
                </div>
                <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Value", value: `$${selectedOpp.value.toLocaleString()}` },
                    { label: "Probability", value: `${selectedOpp.probability}%` },
                    { label: "Source", value: selectedOpp.source },
                    { label: "Owner", value: selectedOpp.owner },
                    { label: "Freight Mode", value: selectedOpp.freightMode || "—" },
                    { label: "Route", value: selectedOpp.route || "—" },
                    { label: "RFQ", value: selectedOpp.rfqRef || "—" },
                    { label: "Job #", value: selectedOpp.jobNumber || "—" },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>{f.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginTop: 2 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                {selectedOpp.closeReason && (
                  <div style={{ margin: "0 14px 12px", padding: "8px 12px", borderRadius: 6, background: selectedOpp.stage === "closed-lost" ? "#fdecec" : "#eef6e6", border: `1px solid ${selectedOpp.stage === "closed-lost" ? "#fecaca" : "#bbf0c8"}`, fontSize: 11, color: selectedOpp.stage === "closed-lost" ? "#b91c1c" : "#166534" }}>
                    <strong>Reason:</strong> {selectedOpp.closeReason}
                  </div>
                )}
                {selectedOpp.notes && (
                  <div style={{ margin: "0 14px 12px", fontSize: 11, color: "var(--text2)", fontStyle: "italic" }}>
                    {selectedOpp.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
