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

type Tab = "companies" | "contacts";

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

  useEffect(() => {
    api.get("/companies").then((res) => setCompanies(res.data.companies || [])).catch(() => {});
    api.get("/contacts").then((res) => setContacts(res.data.contacts || [])).catch(() => {});
  }, []);

  const loadCompanyDetail = async (c: Company) => {
    try {
      const res = await api.get(`/companies/${c._id}`);
      setSelectedCompany(res.data);
    } catch {}
  };

  const loadContactDetail = async (c: Contact) => {
    try {
      const res = await api.get(`/contacts/${c._id}`);
      setSelectedContact(res.data);
    } catch {}
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard value={companies.length} label="Companies" note="active accounts" />
        <StatCard value={contacts.length} label="Contacts" note="total people" />
        <StatCard value={companies.filter((c) => c.status === "lead").length} label="Leads" note="potential clients" noteType="warn" />
        <StatCard value={companies.filter((c) => c.status === "active").length} label="Active" note="customers" />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", background: "var(--surface)", borderRadius: "10px 10px 0 0", overflow: "hidden" }}>
        {(["companies", "contacts"] as Tab[]).map((t) => (
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
      </div>
    </div>
  );
}
