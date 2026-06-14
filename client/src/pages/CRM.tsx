// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  _id: string;
  title: string;
  companyId?: { _id: string; name: string };
  contactId?: { _id: string; firstName: string; lastName?: string };
  value: number;
  currency: "USD" | "NGN" | "GHS" | "KES";
  stage: string;
  source: "email" | "whatsapp" | "web" | "manual" | "rfq-auto";
  linkedRfqIds?: string[];
  ownerId?: { _id: string; name: string };
  probability: number;
  createdAt: string;
  updatedAt: string;
  closeReason?: string;
  notes?: string;
  freightMode?: string;
  route?: string;
  wonAt?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Activity {
  _id: string;
  companyId?: string;
  contactId?: string;
  opportunityId?: string;
  type: "note" | "call" | "meeting" | "email" | "whatsapp" | "status_change";
  summary: string;
  body?: string;
  user?: string;
  createdAt: string;
}

const ACTIVITY_ICONS: Record<string, string> = {
  note: "📝",
  call: "📞",
  meeting: "📅",
  email: "✉️",
  whatsapp: "💬",
  status_change: "🔄",
};

const DEAL_STAGES = [
  { key: "new-lead", label: "New Lead", color: "#6b7670" },
  { key: "qualified", label: "Qualified", color: "#2563eb" },
  { key: "proposal-sent", label: "Proposal Sent", color: "#8b5cf6" },
  { key: "negotiation", label: "Negotiation", color: "#ea8a1a" },
  { key: "closed-won", label: "Closed Won", color: "#16a34a" },
  { key: "closed-lost", label: "Closed Lost", color: "#dc4f4f" },
];

function statusBadge(status: string) {
  const cls = status === "active" ? "b-ok" : status === "lead" ? "b-wait" : "b-gray";
  return <span className={`badge ${cls}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function sourceBadge(source: string) {
  const cls = source === "whatsapp" ? "b-ok" : source === "manual" ? "b-gray" : "b-rate";
  return <span className={`badge ${cls}`}>{source.charAt(0).toUpperCase() + source.slice(1)}</span>;
}

interface CompanyForm {
  name: string;
  domain: string;
  industry: string;
  country: string;
  phone: string;
  status: string;
  notes: string;
}

const emptyCompanyForm: CompanyForm = {
  name: "",
  domain: "",
  industry: "",
  country: "",
  phone: "",
  status: "lead",
  notes: "",
};

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsappPhone: string;
  jobTitle: string;
  companyId: string;
  isPrimary: boolean;
  source: string;
}

const emptyContactForm: ContactForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  whatsappPhone: "",
  jobTitle: "",
  companyId: "",
  isPrimary: false,
  source: "manual",
};

export default function CRM() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [oppView, setOppView] = useState<"pipeline" | "list">("pipeline");
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [newOpp, setNewOpp] = useState({ title: "", companyId: "", contactId: "", value: "", currency: "USD" as Opportunity["currency"], stage: "new-lead", source: "manual" as Opportunity["source"], ownerId: "", freightMode: "", route: "", notes: "" });
  const [oppSaving, setOppSaving] = useState(false);
  const [draggedOpp, setDraggedOpp] = useState<string | null>(null);

  // Company modal state
  const [companyModal, setCompanyModal] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError] = useState("");

  // Contact modal state
  const [contactModal, setContactModal] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState("");

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newActivity, setNewActivity] = useState({ type: "note" as Activity["type"], summary: "" });
  const [activitySaving, setActivitySaving] = useState(false);

  // Sorting and filtering state
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

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

  const loadCompanies = async () => {
    try {
      const res = await api.get("/companies");
      const c = (res.data as any).companies || [];
      setCompanies(c.length > 0 ? c : DUMMY_COMPANIES);
    } catch {
      setCompanies(DUMMY_COMPANIES);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await api.get("/contacts");
      const c = (res.data as any).contacts || [];
      setContacts(c.length > 0 ? c : DUMMY_CONTACTS);
    } catch {
      setContacts(DUMMY_CONTACTS);
    }
  };

  const loadOpportunities = async () => {
    try {
      const res = await api.get("/opportunities");
      setOpps((res.data as any).opportunities || []);
    } catch {
      setOpps([]);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers((res.data as any).users || []);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadCompanies();
    loadContacts();
    loadOpportunities();
    loadUsers();
  }, []);

  const openCompanyModal = (mode: "create" | "edit", company?: any) => {
    setCompanyError("");
    if (mode === "edit" && company) {
      setCompanyForm({
        name: company.name || "",
        domain: company.domain || "",
        industry: company.industry || "",
        country: company.country || "",
        phone: company.phone || "",
        status: company.status || "lead",
        notes: company.notes || "",
      });
      setCompanyModal({ mode: "edit", id: company._id });
    } else {
      setCompanyForm(emptyCompanyForm);
      setCompanyModal({ mode: "create" });
    }
  };

  const saveCompany = async () => {
    if (!companyForm.name.trim()) {
      setCompanyError("Company name is required");
      return;
    }
    setCompanySaving(true);
    setCompanyError("");
    try {
      if (companyModal?.mode === "edit" && companyModal.id) {
        await api.patch(`/companies/${companyModal.id}`, companyForm);
        // Refresh detail panel if the edited company is selected
        if (selectedCompany?.company?._id === companyModal.id) {
          const res = await api.get(`/companies/${companyModal.id}`);
          setSelectedCompany(res.data);
        }
      } else {
        await api.post("/companies", companyForm);
      }
      await loadCompanies();
      setCompanyModal(null);
    } catch (err: any) {
      setCompanyError(err.response?.data?.error || "Failed to save company");
    } finally {
      setCompanySaving(false);
    }
  };

  const openContactModal = (mode: "create" | "edit", contact?: any) => {
    setContactError("");
    if (mode === "edit" && contact) {
      setContactForm({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        email: contact.email || "",
        phone: contact.phone || "",
        whatsappPhone: contact.whatsappPhone || "",
        jobTitle: contact.jobTitle || "",
        companyId: contact.companyId || "",
        isPrimary: contact.isPrimary || false,
        source: contact.source || "manual",
      });
      setContactModal({ mode: "edit", id: contact._id });
    } else {
      setContactForm(emptyContactForm);
      setContactModal({ mode: "create" });
    }
  };

  const saveContact = async () => {
    if (!contactForm.firstName.trim()) {
      setContactError("First name is required");
      return;
    }
    setContactSaving(true);
    setContactError("");
    try {
      const payload = {
        ...contactForm,
        companyId: contactForm.companyId || undefined,
      };
      if (contactModal?.mode === "edit" && contactModal.id) {
        await api.patch(`/contacts/${contactModal.id}`, payload);
        // Refresh detail panel if the edited contact is selected
        if (selectedContact?.contact?._id === contactModal.id) {
          const res = await api.get(`/contacts/${contactModal.id}`);
          setSelectedContact(res.data);
        }
      } else {
        await api.post("/contacts", payload);
      }
      await loadContacts();
      await loadCompanies(); // Refresh company contact counts
      setContactModal(null);
    } catch (err: any) {
      setContactError(err.response?.data?.error || "Failed to save contact");
    } finally {
      setContactSaving(false);
    }
  };

  const loadActivities = async (companyId: string) => {
    try {
      const res = await api.get(`/activities?companyId=${companyId}`);
      setActivities((res.data as any).activities || []);
    } catch {
      setActivities([]);
    }
  };

  const saveActivity = async (companyId: string) => {
    if (!newActivity.summary.trim()) return;
    setActivitySaving(true);
    try {
      await api.post("/activities", {
        companyId,
        type: newActivity.type,
        summary: newActivity.summary,
        user: "User", // In a real app, this would come from auth
      });
      await loadActivities(companyId);
      setNewActivity({ type: "note", summary: "" });
    } catch (err) {
      console.error("Failed to save activity:", err);
    } finally {
      setActivitySaving(false);
    }
  };

  // Drag and drop handlers for pipeline
  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    setDraggedOpp(oppId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (!draggedOpp) return;

    const opp = opps.find((o) => o._id === draggedOpp);
    if (!opp || opp.stage === targetStage) {
      setDraggedOpp(null);
      return;
    }

    // Optimistic update
    setOpps(opps.map((o) => (o._id === draggedOpp ? { ...o, stage: targetStage } : o)));

    try {
      await api.patch(`/opportunities/${draggedOpp}`, { stage: targetStage });
      await loadOpportunities(); // Refresh to get updated data
    } catch (err) {
      console.error("Failed to update stage:", err);
      // Revert on error
      await loadOpportunities();
    }

    setDraggedOpp(null);
  };

  const loadCompanyDetail = (c: Company) => {
    navigate(`/crm/companies/${c._id}`);
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

  // Sorting helper
  const sortData = <T extends Record<string, any>>(data: T[], key: string, dir: "asc" | "desc"): T[] => {
    return [...data].sort((a, b) => {
      const aVal = a[key] ?? "";
      const bVal = b[key] ?? "";
      if (typeof aVal === "string" && typeof bVal === "string") {
        return dir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  };

  // Toggle sort
  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  // Filter and sort companies
  let filteredCompanies = companies;
  if (search) {
    filteredCompanies = filteredCompanies.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.domain && c.domain.toLowerCase().includes(search.toLowerCase()))
    );
  }
  if (statusFilter !== "all") {
    filteredCompanies = filteredCompanies.filter((c) => c.status === statusFilter);
  }
  filteredCompanies = sortData(filteredCompanies, sortKey, sortDir);

  // Paginate companies
  const totalCompanyPages = Math.ceil(filteredCompanies.length / pageSize);
  const paginatedCompanies = filteredCompanies.slice((page - 1) * pageSize, page * pageSize);

  // Filter and sort contacts
  let filteredContacts = contacts;
  if (search) {
    filteredContacts = filteredContacts.filter((c) =>
      `${c.firstName} ${c.lastName || ""}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );
  }
  filteredContacts = sortData(filteredContacts, sortKey === "name" ? "firstName" : sortKey, sortDir);

  // Paginate contacts
  const totalContactPages = Math.ceil(filteredContacts.length / pageSize);
  const paginatedContacts = filteredContacts.slice((page - 1) * pageSize, page * pageSize);

  const SortHeader = ({ label, colKey }: { label: string; colKey: string }) => (
    <span
      onClick={() => toggleSort(colKey)}
      style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
    >
      {label}
      {sortKey === colKey && (
        <span style={{ fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
      )}
    </span>
  );

  const companyColumns = [
    { key: "name", header: <SortHeader label="Company" colKey="name" />, render: (c: Company) => <Link to={`/crm/companies/${c._id}`} style={{ fontWeight: 500, color: "var(--text)", textDecoration: "none" }}>{c.name}</Link> },
    { key: "domain", header: <SortHeader label="Domain" colKey="domain" />, render: (c: Company) => <span style={{ fontSize: 11, color: "var(--text3)" }}>{c.domain || "—"}</span> },
    { key: "contactCount", header: <SortHeader label="Contacts" colKey="contactCount" />, render: (c: Company) => c.contactCount ?? 0 },
    { key: "rfqCount", header: <SortHeader label="RFQs" colKey="rfqCount" />, render: (c: Company) => c.rfqCount ?? 0 },
    { key: "status", header: <SortHeader label="Status" colKey="status" />, render: (c: Company) => statusBadge(c.status) },
  ];

  const contactColumns = [
    { key: "firstName", header: <SortHeader label="Name" colKey="firstName" />, render: (c: Contact) => <span style={{ fontWeight: 500, color: "var(--text)" }}>{c.firstName} {c.lastName || ""}{c.isPrimary ? <span className="badge b-ok" style={{ marginLeft: 4, fontSize: 9 }}>Primary</span> : ""}</span> },
    { key: "companyName", header: <SortHeader label="Company" colKey="companyName" />, render: (c: Contact) => c.companyName || "—" },
    { key: "email", header: <SortHeader label="Email" colKey="email" />, render: (c: Contact) => <span style={{ fontSize: 11, color: "var(--text3)" }}>{c.email || "—"}</span> },
    { key: "source", header: <SortHeader label="Source" colKey="source" />, render: (c: Contact) => sourceBadge(c.source) },
  ];

  // Pagination component
  const Pagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 11 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)",
            cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1,
          }}
        >
          Prev
        </button>
        <span style={{ color: "var(--text3)" }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)",
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1,
          }}
        >
          Next
        </button>
      </div>
    );
  };

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

      {/* Search + Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, outline: "none", fontFamily: "Inter, sans-serif", background: "var(--bg)" }}
        />
        {tab === "companies" && (
          <>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                padding: "6px 10px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 6,
                outline: "none", fontFamily: "inherit", background: "var(--surface)", color: "var(--text)",
              }}
            >
              <option value="all">All Status</option>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => openCompanyModal("create")}
              style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 500, background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              + New Company
            </button>
          </>
        )}
        {tab === "contacts" && (
          <button
            onClick={() => openContactModal("create")}
            style={{
              padding: "6px 14px", fontSize: 11, fontWeight: 500, background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            + New Contact
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 10, flex: 1, overflow: "hidden", minHeight: 400 }}>
        {tab === "companies" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <DataTable
                columns={companyColumns}
                data={paginatedCompanies}
                onRowClick={loadCompanyDetail}
                selectedId={selectedCompany?.company?._id}
                emptyMessage="No companies found"
              />
              <Pagination currentPage={page} totalPages={totalCompanyPages} onPageChange={setPage} />
              <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", paddingBottom: 4 }}>
                {filteredCompanies.length} companies
              </div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {selectedCompany ? (
                <>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "#f8faf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>{selectedCompany.company.name}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {statusBadge(selectedCompany.company.status)}
                      <button
                        onClick={() => openCompanyModal("edit", selectedCompany.company)}
                        style={{
                          padding: "3px 8px", fontSize: 10, background: "var(--surface)", border: "1px solid var(--border)",
                          borderRadius: 4, cursor: "pointer", color: "var(--text3)",
                        }}
                      >
                        Edit
                      </button>
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                      <span style={{ color: "var(--text3)", fontSize: 10 }}>Total RFQs</span>
                      <a
                        href={`/rfq-inbox?company=${selectedCompany.company._id}`}
                        style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none", cursor: "pointer" }}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/rfq-inbox?company=${selectedCompany.company._id}`;
                        }}
                      >
                        {selectedCompany.stats?.totalRfqs ?? 0} →
                      </a>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                      <span style={{ color: "var(--text3)", fontSize: 10 }}>Active RFQs</span>
                      <span style={{ color: "var(--text)", fontWeight: 500 }}>{selectedCompany.stats?.activeRfqs ?? 0}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                      <span style={{ color: "var(--text3)", fontSize: 10 }}>Quotes</span>
                      <a
                        href={`/quotes?company=${selectedCompany.company._id}`}
                        style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none", cursor: "pointer" }}
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/quotes?company=${selectedCompany.company._id}`;
                        }}
                      >
                        {selectedCompany.stats?.totalQuotes ?? 0} →
                      </a>
                    </div>
                    {selectedCompany.stats?.totalRevenue > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>Total Revenue</span>
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>${selectedCompany.stats.totalRevenue.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Contacts ({selectedCompany.contacts?.length || 0})</div>
                    {(selectedCompany.contacts || []).map((ct: any) => (
                      <div key={ct._id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--text)" }}>{ct.firstName} {ct.lastName || ""}</span>
                        <span style={{ color: "var(--text3)", fontSize: 10 }}>{ct.email || ""}</span>
                      </div>
                    ))}

                    {/* Activity Timeline */}
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>
                      Activity
                    </div>

                    {/* Add Activity Form */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      <select
                        value={newActivity.type}
                        onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as Activity["type"] })}
                        style={{
                          padding: "4px 6px", fontSize: 10, border: "1px solid var(--border)", borderRadius: 4,
                          outline: "none", fontFamily: "inherit", background: "var(--surface)", width: 80,
                        }}
                      >
                        <option value="note">Note</option>
                        <option value="call">Call</option>
                        <option value="meeting">Meeting</option>
                      </select>
                      <input
                        value={newActivity.summary}
                        onChange={(e) => setNewActivity({ ...newActivity, summary: e.target.value })}
                        placeholder="Add a note, log a call..."
                        style={{
                          flex: 1, padding: "4px 6px", fontSize: 10, border: "1px solid var(--border)",
                          borderRadius: 4, outline: "none", fontFamily: "inherit",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newActivity.summary.trim()) {
                            saveActivity(selectedCompany.company._id);
                          }
                        }}
                      />
                      <button
                        onClick={() => saveActivity(selectedCompany.company._id)}
                        disabled={activitySaving || !newActivity.summary.trim()}
                        style={{
                          padding: "4px 8px", fontSize: 10, background: "var(--accent)", color: "#fff",
                          border: "none", borderRadius: 4, cursor: activitySaving ? "not-allowed" : "pointer",
                          opacity: activitySaving || !newActivity.summary.trim() ? 0.5 : 1,
                        }}
                      >
                        {activitySaving ? "..." : "+"}
                      </button>
                    </div>

                    {/* Activity List */}
                    {activities.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {activities.slice(0, 10).map((act) => (
                          <div key={act._id} style={{
                            padding: "6px 8px", borderRadius: 4, background: "var(--bg)",
                            border: "1px solid var(--border)", fontSize: 10,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 500, color: "var(--text)" }}>
                                {ACTIVITY_ICONS[act.type] || "📌"} {act.summary}
                              </span>
                              <span style={{ color: "var(--text3)", fontSize: 9 }}>
                                {new Date(act.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {act.user && (
                              <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2 }}>
                                by {act.user}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "var(--text3)", fontStyle: "italic" }}>
                        No activity recorded yet
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
                  Select a company to view details
                </div>
              )}
            </div>
          </>
        ) : tab === "contacts" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <DataTable
                columns={contactColumns}
                data={paginatedContacts}
                onRowClick={loadContactDetail}
                selectedId={selectedContact?.contact?._id}
                emptyMessage="No contacts found"
              />
              <Pagination currentPage={page} totalPages={totalContactPages} onPageChange={setPage} />
              <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", paddingBottom: 4 }}>
                {filteredContacts.length} contacts
              </div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {selectedContact ? (
                <>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "#f8faf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>{selectedContact.contact.firstName} {selectedContact.contact.lastName || ""}</span>
                    <button
                      onClick={() => openContactModal("edit", selectedContact.contact)}
                      style={{
                        padding: "3px 8px", fontSize: 10, background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 4, cursor: "pointer", color: "var(--text3)",
                      }}
                    >
                      Edit
                    </button>
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
        ) : null}

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
                    <select value={newOpp.companyId} onChange={e => setNewOpp({ ...newOpp, companyId: e.target.value })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="">Select company...</option>
                      {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Contact</label>
                    <select value={newOpp.contactId} onChange={e => setNewOpp({ ...newOpp, contactId: e.target.value })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="">Select contact...</option>
                      {contacts.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName || ""}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 3 }}>Currency</label>
                    <select value={newOpp.currency} onChange={e => setNewOpp({ ...newOpp, currency: e.target.value as Opportunity["currency"] })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="USD">USD</option><option value="NGN">NGN</option><option value="GHS">GHS</option><option value="KES">KES</option>
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
                    <select value={newOpp.ownerId} onChange={e => setNewOpp({ ...newOpp, ownerId: e.target.value })} style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "var(--surface)" }}>
                      <option value="">Select owner...</option>
                      {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setShowAddOpp(false)} style={{ padding: "5px 12px", fontSize: 11, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text3)" }}>Cancel</button>
                  <button
                    disabled={oppSaving}
                    onClick={async () => {
                      if (newOpp.title && newOpp.companyId && newOpp.value) {
                        setOppSaving(true);
                        try {
                          await api.post("/opportunities", {
                            title: newOpp.title,
                            companyId: newOpp.companyId,
                            contactId: newOpp.contactId || undefined,
                            value: parseFloat(newOpp.value),
                            currency: newOpp.currency,
                            stage: newOpp.stage,
                            source: newOpp.source,
                            ownerId: newOpp.ownerId || undefined,
                            freightMode: newOpp.freightMode || undefined,
                            route: newOpp.route || undefined,
                            notes: newOpp.notes || undefined,
                          });
                          await loadOpportunities();
                          setNewOpp({ title: "", companyId: "", contactId: "", value: "", currency: "USD", stage: "new-lead", source: "manual", ownerId: "", freightMode: "", route: "", notes: "" });
                          setShowAddOpp(false);
                        } catch (err) {
                          console.error("Failed to create opportunity:", err);
                        } finally {
                          setOppSaving(false);
                        }
                      }
                    }}
                    style={{ padding: "5px 12px", fontSize: 11, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 4, cursor: oppSaving ? "not-allowed" : "pointer", opacity: oppSaving ? 0.7 : 1 }}
                  >
                    {oppSaving ? "Creating..." : "Create"}
                  </button>
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
                    <div
                      key={stage.key}
                      style={{ minWidth: 220, flex: 1, display: "flex", flexDirection: "column" }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, stage.key)}
                    >
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
                      <div style={{ flex: 1, background: draggedOpp ? "#f5f7f5" : "#f9faf9", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 6, display: "flex", flexDirection: "column", gap: 6, minHeight: 100, transition: "background 0.2s" }}>
                        {stageOpps.map(opp => (
                          <div
                            key={opp._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, opp._id)}
                            onDragEnd={() => setDraggedOpp(null)}
                            onClick={() => setSelectedOpp(selectedOpp?._id === opp._id ? null : opp)}
                            style={{
                              background: selectedOpp?._id === opp._id ? "#eef6e6" : draggedOpp === opp._id ? "#e8f4e8" : "var(--surface)",
                              border: selectedOpp?._id === opp._id ? "1px solid var(--accent)" : draggedOpp === opp._id ? "1px dashed var(--accent)" : "1px solid var(--border)",
                              borderRadius: 6, padding: "8px 10px", cursor: "grab", fontSize: 11,
                              opacity: draggedOpp === opp._id ? 0.5 : 1,
                              transition: "all 0.2s",
                            }}
                          >
                            <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 3, lineHeight: 1.3 }}>{opp.title}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "var(--text3)" }}>{opp.companyId?.name || "—"}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", fontFamily: "monospace" }}>${opp.value.toLocaleString()}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: opp.source === "email" ? "#eef6e6" : opp.source === "whatsapp" ? "#dcfce7" : opp.source === "web" ? "#fef3e6" : opp.source === "rfq-auto" ? "#e6f0ff" : "#f3f5f3", color: "var(--text2)" }}>{opp.source}</span>
                              {opp.linkedRfqIds && opp.linkedRfqIds.length > 0 && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#eef6e6", color: "var(--accent)", fontFamily: "monospace" }}>{opp.linkedRfqIds.length} RFQ</span>}
                              <span style={{ fontSize: 8, color: "var(--text3)", marginLeft: "auto" }}>{opp.ownerId?.name?.split(" ")[0] || "—"}</span>
                            </div>
                          </div>
                        ))}
                        {stageOpps.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text3)", fontSize: 10 }}>Drop deals here</div>}
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
                    <div key={opp._id} onClick={() => setSelectedOpp(selectedOpp?._id === opp._id ? null : opp)} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 80px 90px 80px 80px 80px 80px",
                      padding: "8px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: 11,
                      background: selectedOpp?._id === opp._id ? "#eef6e6" : "var(--surface)",
                    }}
                      onMouseEnter={e => { if (selectedOpp?._id !== opp._id) e.currentTarget.style.background = "var(--bg)"; }}
                      onMouseLeave={e => { if (selectedOpp?._id !== opp._id) e.currentTarget.style.background = "var(--surface)"; }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>{opp.title}</div>
                        {opp.linkedRfqIds && opp.linkedRfqIds.length > 0 && <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "monospace" }}>{opp.linkedRfqIds.length} RFQ linked</span>}
                      </div>
                      <div style={{ color: "var(--text2)" }}>{opp.companyId?.name || "—"}</div>
                      <div style={{ fontWeight: 600, fontFamily: "monospace" }}>${opp.value.toLocaleString()}</div>
                      <div><span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8, background: `${stage.color}18`, color: stage.color }}>{stage.label}</span></div>
                      <div style={{ fontSize: 10 }}>{opp.source === "whatsapp" ? "💬" : opp.source === "web" ? "🌐" : opp.source === "manual" ? "✏️" : opp.source === "rfq-auto" ? "🤖" : "✉️"} {opp.source}</div>
                      <div style={{ fontSize: 10, color: "var(--text2)" }}>{opp.ownerId?.name?.split(" ")[0] || "—"}</div>
                      <div style={{ fontSize: 10, color: opp.probability >= 70 ? "var(--accent)" : opp.probability >= 40 ? "var(--warn)" : "var(--text3)", fontWeight: 600 }}>{opp.probability}%</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>{opp.updatedAt?.slice(5, 10) || "—"}</div>
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
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                      {selectedOpp.companyId?.name || "—"} · {selectedOpp.contactId ? `${selectedOpp.contactId.firstName} ${selectedOpp.contactId.lastName || ""}` : "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* Stage changer */}
                    <select value={selectedOpp.stage} onChange={async (e) => {
                      const newStage = e.target.value;
                      try {
                        await api.patch(`/opportunities/${selectedOpp._id}`, { stage: newStage });
                        await loadOpportunities();
                        setSelectedOpp({ ...selectedOpp, stage: newStage });
                      } catch (err) {
                        console.error("Failed to update stage:", err);
                      }
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
                    { label: "Owner", value: selectedOpp.ownerId?.name || "—" },
                    { label: "Freight Mode", value: selectedOpp.freightMode || "—" },
                    { label: "Route", value: selectedOpp.route || "—" },
                    { label: "Linked RFQs", value: selectedOpp.linkedRfqIds?.length ? `${selectedOpp.linkedRfqIds.length} RFQ(s)` : "—" },
                    { label: "Won At", value: selectedOpp.wonAt ? new Date(selectedOpp.wonAt).toLocaleDateString() : "—" },
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

      {/* Company Modal */}
      {companyModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setCompanyModal(null); }}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 12, width: 480, maxHeight: "80vh",
            overflow: "auto", padding: "24px 28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {companyModal.mode === "edit" ? "Edit Company" : "New Company"}
              </span>
              <button
                onClick={() => setCompanyModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text3)" }}
              >
                ×
              </button>
            </div>

            {companyError && (
              <div style={{
                padding: "8px 12px", marginBottom: 12, borderRadius: 6,
                background: "#fdecec", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 11,
              }}>
                {companyError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Company Name *
                </label>
                <input
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="e.g. Acme Logistics Ltd"
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Domain
                  </label>
                  <input
                    value={companyForm.domain}
                    onChange={(e) => setCompanyForm({ ...companyForm, domain: e.target.value })}
                    placeholder="e.g. acmelogistics.com"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Industry
                  </label>
                  <input
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    placeholder="e.g. Manufacturing"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Country
                  </label>
                  <input
                    value={companyForm.country}
                    onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                    placeholder="e.g. Nigeria"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Phone
                  </label>
                  <input
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    placeholder="e.g. +234 801 234 5678"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Status
                </label>
                <select
                  value={companyForm.status}
                  onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value })}
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    background: "var(--surface)",
                  }}
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Notes
                </label>
                <textarea
                  value={companyForm.notes}
                  onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                  placeholder="Add any notes about this company..."
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setCompanyModal(null)}
                  style={{
                    padding: "8px 16px", fontSize: 12, background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text3)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveCompany}
                  disabled={companySaving}
                  style={{
                    padding: "8px 16px", fontSize: 12, background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: 6, cursor: companySaving ? "not-allowed" : "pointer",
                    opacity: companySaving ? 0.7 : 1,
                  }}
                >
                  {companySaving ? "Saving..." : (companyModal.mode === "edit" ? "Save Changes" : "Create Company")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {contactModal && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setContactModal(null); }}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 12, width: 520, maxHeight: "85vh",
            overflow: "auto", padding: "24px 28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {contactModal.mode === "edit" ? "Edit Contact" : "New Contact"}
              </span>
              <button
                onClick={() => setContactModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text3)" }}
              >
                ×
              </button>
            </div>

            {contactError && (
              <div style={{
                padding: "8px 12px", marginBottom: 12, borderRadius: 6,
                background: "#fdecec", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 11,
              }}>
                {contactError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    First Name *
                  </label>
                  <input
                    value={contactForm.firstName}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    placeholder="e.g. John"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Last Name
                  </label>
                  <input
                    value={contactForm.lastName}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                    placeholder="e.g. Doe"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="e.g. john.doe@company.com"
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Phone
                  </label>
                  <input
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="e.g. +234 801 234 5678"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    WhatsApp
                  </label>
                  <input
                    value={contactForm.whatsappPhone}
                    onChange={(e) => setContactForm({ ...contactForm, whatsappPhone: e.target.value })}
                    placeholder="e.g. +234 801 234 5678"
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Job Title
                </label>
                <input
                  value={contactForm.jobTitle}
                  onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })}
                  placeholder="e.g. Procurement Manager"
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                  Company
                </label>
                <select
                  value={contactForm.companyId}
                  onChange={(e) => setContactForm({ ...contactForm, companyId: e.target.value })}
                  style={{
                    width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                    borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                    background: "var(--surface)",
                  }}
                >
                  <option value="">— No company —</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", display: "block", marginBottom: 4 }}>
                    Source
                  </label>
                  <select
                    value={contactForm.source}
                    onChange={(e) => setContactForm({ ...contactForm, source: e.target.value })}
                    style={{
                      width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid var(--border)",
                      borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                      background: "var(--surface)",
                    }}
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web">Web</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", paddingTop: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                      style={{ width: 14, height: 14, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--text2)" }}>Primary contact</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setContactModal(null)}
                  style={{
                    padding: "8px 16px", fontSize: 12, background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text3)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveContact}
                  disabled={contactSaving}
                  style={{
                    padding: "8px 16px", fontSize: 12, background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: 6, cursor: contactSaving ? "not-allowed" : "pointer",
                    opacity: contactSaving ? 0.7 : 1,
                  }}
                >
                  {contactSaving ? "Saving..." : (contactModal.mode === "edit" ? "Save Changes" : "Create Contact")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
