import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { mockShipments, formatContractValue, contractValueUsdEquiv } from "../lib/mock-shipments";
import { ArrowLeft, Share2, AlertTriangle, Plus, MessageCircle, Upload, FileText, Download, Eye, MoreHorizontal, Clock, CheckCircle, XCircle, Send, UserPlus, X, Star } from "lucide-react";

const tabs = ["Overview", "Progress", "Containers", "Bills of Lading", "Documents", "Finance", "Communications", "Activity Log"];

// ── Milestone Templates ──

interface Milestone {
  id: string;
  name: string;
  phase: 1 | 2 | 3;
  scope: "JOB" | "CONT" | "BL";
  owner: string;
  slaText: string;
  trigger?: string;
  status: "completed" | "in-progress" | "blocked" | "not-started";
  completedAt?: string;
  sla?: string;
  detail?: string;
  deadline?: string;
}

const exportMilestones: Milestone[] = [
  // Phase 1: Pre-Shipment
  { id: "1A", name: "File entry & activation", phase: 1, scope: "JOB", owner: "Internal Control", slaText: "Same day", status: "completed", completedAt: "23 May 09:14", sla: "Met" },
  { id: "1B", name: "Pre-shipment docs verified", phase: 1, scope: "JOB", owner: "QA Officer", slaText: "Before clock starts", status: "completed", completedAt: "23 May 09:20", sla: "Met", detail: "CAC, NEPC, NXP, Proforma Invoice" },
  { id: "1C", name: "File assigned to Ops Officer", phase: 1, scope: "JOB", owner: "Ops Manager", slaText: "Same day", status: "completed", completedAt: "23 May 09:32", sla: "Met" },
  // Phase 2: Core Operations
  { id: "2A", name: "Booking placement", phase: 2, scope: "JOB", owner: "QA Officer", slaText: "1 working hour", trigger: "Order activation", status: "completed", completedAt: "23 May 10:08", sla: "Met", detail: "MSC-LGN-0029834" },
  { id: "2B", name: "Stuffing location decision", phase: 2, scope: "JOB", owner: "Ops Manager", slaText: "—", trigger: "Customer + feasibility", status: "completed", completedAt: "23 May 11:40", sla: "Met", detail: "Kachicares Terminal" },
  { id: "2C", name: "Empty container deployment", phase: 2, scope: "CONT", owner: "Transport Manager", slaText: "1 day (partner) / 2 days (outside)", trigger: "Booking placed", status: "in-progress", detail: "2 of 5 deployed · Target 26 May 18:00", deadline: "3h to deadline" },
  { id: "2D", name: "Clean CCI issued", phase: 2, scope: "CONT", owner: "Clearing Officer", slaText: "1 working day", trigger: "NESS payment", status: "blocked", detail: "Blocked — NESS payment pending" },
  { id: "2E", name: "Shipping instruction submitted", phase: 2, scope: "BL", owner: "CX Personnel", slaText: "1 working day", trigger: "Stuffing completed", status: "not-started" },
  { id: "2F", name: "Gate-in of cargo", phase: 2, scope: "CONT", owner: "Clearing Officer", slaText: "Apapa 3d / Lekki 2d / Kano 10d", trigger: "After stuffing", status: "not-started" },
  { id: "2G", name: "Inspection Act & planning", phase: 2, scope: "CONT", owner: "Clearing Officer", slaText: "1 working day", trigger: "After CCI", status: "not-started" },
  { id: "2H", name: "Planning confirmation (Liner)", phase: 2, scope: "JOB", owner: "QA Officer", slaText: "1 working day", trigger: "Docs submitted", status: "not-started" },
  { id: "2I", name: "Vessel confirmation to customer", phase: 2, scope: "JOB", owner: "CX Officer", slaText: "1 hour", trigger: "Liner confirms", status: "not-started" },
  { id: "2J", name: "Sailing confirmation to customer", phase: 2, scope: "JOB", owner: "CX Officer", slaText: "1 day", trigger: "Vessel departs", status: "not-started" },
  // Phase 3: Post-Shipment
  { id: "3A", name: "Post-shipment documentation", phase: 3, scope: "JOB", owner: "Doc Officer", slaText: "Per original order", trigger: "Vessel sails", status: "not-started" },
  { id: "3B", name: "OBL issuance", phase: 3, scope: "BL", owner: "Doc Officer", slaText: "3 working days", trigger: "Freight payment", status: "not-started" },
  { id: "3C", name: "Other docs (Phyto, Fumigation, COO)", phase: 3, scope: "BL", owner: "Doc Officer", slaText: "1 day", trigger: "Finance payment", status: "not-started" },
  { id: "3D", name: "Mark shipment completed", phase: 3, scope: "JOB", owner: "QA Personnel", slaText: "Same week", trigger: "Financial obligations met", status: "not-started" },
  { id: "3E", name: "Release documents to customer", phase: 3, scope: "JOB", owner: "Internal Control", slaText: "2 hours", trigger: "Full payment confirmed", status: "not-started" },
  { id: "3F", name: "Document dispatch", phase: 3, scope: "JOB", owner: "Admin", slaText: "—", trigger: "After release", status: "not-started" },
  { id: "3G", name: "File acknowledgement copy", phase: 3, scope: "JOB", owner: "QA Personnel", slaText: "—", trigger: "Customer receipt", status: "not-started" },
  { id: "3H", name: "Monthly SLA review", phase: 3, scope: "JOB", owner: "Ops Manager + BI", slaText: "1 week after month end", trigger: "Calendar", status: "not-started" },
];

const importMilestones: Milestone[] = [
  // Phase 1: Pre-Operations
  { id: "1A", name: "File entry & activation", phase: 1, scope: "JOB", owner: "Internal Control", slaText: "Same day", status: "completed", completedAt: "18 May 08:30", sla: "Met" },
  { id: "1B", name: "Pre-alert docs collected", phase: 1, scope: "JOB", owner: "Ops Manager", slaText: "Before clock starts", status: "completed", completedAt: "18 May 09:00", sla: "Met", detail: "Form M, OBL, CCVO, PAAR, SON, NAFDAC" },
  { id: "1C", name: "File assigned to Ops Officer", phase: 1, scope: "JOB", owner: "Ops Manager", slaText: "Same day", status: "completed", completedAt: "18 May 09:15", sla: "Met" },
  // Phase 2: Core Execution
  { id: "2A", name: "Pre-alert receipt & file opening", phase: 2, scope: "JOB", owner: "Ops Manager", slaText: "Same day", trigger: "Complete docs", status: "completed", completedAt: "18 May 09:30", sla: "Met" },
  { id: "2B", name: "Form M validation", phase: 2, scope: "JOB", owner: "Ops Manager", slaText: "1–2 days", trigger: "File opened", status: "completed", completedAt: "19 May 14:00", sla: "Met" },
  { id: "2C", name: "PAAR application", phase: 2, scope: "JOB", owner: "Ops Manager", slaText: "3–5 days", trigger: "Form M validated", status: "completed", completedAt: "22 May 11:00", sla: "Met" },
  { id: "2D", name: "Vessel registration number confirmed", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "3 days to arrival", trigger: "Vessel approaching", status: "completed", completedAt: "25 May 09:00", sla: "Met" },
  { id: "2E", name: "Draft assessment generated", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "2 hours", trigger: "Reg number confirmed", status: "in-progress", detail: "Awaiting customer review", deadline: "Due today" },
  { id: "2F", name: "Final assessment generated", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "2 hours", trigger: "Customer confirms draft", status: "not-started" },
  { id: "2G", name: "Import local charge & container deposit", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "3 days to arrival", trigger: "—", status: "not-started" },
  { id: "2H", name: "Terminal handling charges (THC)", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "1 day after arrival", trigger: "Vessel arrives", status: "not-started" },
  { id: "2I", name: "THC & local charge payment", phase: 2, scope: "JOB", owner: "Finance", slaText: "1 day", trigger: "Clearing officer submits", status: "not-started" },
  { id: "2J", name: "Book cargo examination", phase: 2, scope: "CONT", owner: "Clearing Officer", slaText: "2 working days", trigger: "Duty payment evidence", status: "not-started" },
  { id: "2K", name: "Liner DO & Terminal DO generated", phase: 2, scope: "JOB", owner: "Clearing Officer", slaText: "1 working day", trigger: "THC + local charge paid", status: "not-started" },
  { id: "2L", name: "Load-out from terminal", phase: 2, scope: "CONT", owner: "Transport Manager", slaText: "Apapa 2d / Lekki 1d", trigger: "DOs obtained", status: "not-started" },
  { id: "2M", name: "Delivery to customer warehouse", phase: 2, scope: "CONT", owner: "Transport Manager", slaText: "Lagos 1d / Kano 5d", trigger: "Load-out", status: "not-started" },
  { id: "2N", name: "Empty container return", phase: 2, scope: "CONT", owner: "Transport Manager", slaText: "Lagos 2d / Kano 5d", trigger: "After offloading", status: "not-started" },
  // Phase 3: Post-Operations
  { id: "3A", name: "Post-delivery documentation", phase: 3, scope: "JOB", owner: "Clearing Officer", slaText: "2 days", trigger: "Empty return", status: "not-started" },
  { id: "3B", name: "Mark shipment completed", phase: 3, scope: "JOB", owner: "QA Personnel", slaText: "Same week", trigger: "Full delivery completed", status: "not-started" },
  { id: "3C", name: "Release documents to customer", phase: 3, scope: "JOB", owner: "Internal Control", slaText: "2 hours", trigger: "Full payment confirmed", status: "not-started" },
  { id: "3D", name: "Document dispatch", phase: 3, scope: "JOB", owner: "Admin", slaText: "—", trigger: "After release", status: "not-started" },
  { id: "3E", name: "File acknowledgement copy", phase: 3, scope: "JOB", owner: "QA Personnel", slaText: "—", trigger: "Customer receipt", status: "not-started" },
  { id: "3F", name: "Monthly SLA review", phase: 3, scope: "JOB", owner: "Ops Manager + BI", slaText: "1 week after month end", trigger: "Calendar", status: "not-started" },
];

const carrierLogos: Record<string, { bg: string; color: string; abbr: string }> = {
  "MSC": { bg: "#1a1a2e", color: "#f5c518", abbr: "MSC" },
  "Maersk": { bg: "#00243d", color: "#4dc8f5", abbr: "MRK" },
  "CMA CGM": { bg: "#002b5c", color: "#e41e26", abbr: "CMA" },
  "Hapag-Lloyd": { bg: "#ff6600", color: "#fff", abbr: "HAP" },
  "PIL": { bg: "#003366", color: "#fff", abbr: "PIL" },
  "Evergreen": { bg: "#006633", color: "#fff", abbr: "EVG" },
  "COSCO": { bg: "#003399", color: "#fff", abbr: "COS" },
  "ONE": { bg: "#ff1493", color: "#fff", abbr: "ONE" },
  "ZIM": { bg: "#003399", color: "#ffd700", abbr: "ZIM" },
  "Lufthansa Cargo": { bg: "#05164d", color: "#ffc72c", abbr: "LH" },
};

function CarrierLogo({ carrier }: { carrier: string }) {
  const logo = carrierLogos[carrier] || { bg: "#6b7670", color: "#fff", abbr: carrier.slice(0, 3).toUpperCase() };
  return (
    <div style={{
      width: 32, height: 20, borderRadius: 3, background: logo.bg, display: "flex",
      alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800,
      color: logo.color, letterSpacing: 0.3, flexShrink: 0,
    }} title={carrier}>
      {logo.abbr}
    </div>
  );
}

const mockContainers = [
  { id: "C01", number: "MEDU 782314-5", size: "40HC", status: "deployed", location: "Kachicares Terminal", step: 2, milestone: "Empty deployed", carrier: "MSC" },
  { id: "C02", number: "MEDU 913527-8", size: "40HC", status: "deployed", location: "Kachicares Terminal", step: 2, milestone: "Empty deployed", carrier: "MSC" },
  { id: "C03", number: "—", size: "40HC", status: "pending", location: "KAC Depot, Ibafo", step: 1, milestone: "Awaiting dispatch", carrier: "MSC" },
  { id: "C04", number: "—", size: "40HC", status: "pending", location: "KAC Depot, Ibafo", step: 1, milestone: "Awaiting dispatch", carrier: "MSC" },
  { id: "C05", number: "—", size: "40HC", status: "pending", location: "KAC Depot, Ibafo", step: 1, milestone: "Awaiting dispatch", carrier: "MSC" },
];

interface TeamMember {
  initials: string;
  name: string;
  role: string;
  color: string;
  lead?: boolean;
}

const initialTeam: TeamMember[] = [
  { initials: "TA", name: "Tola Adeyemi", role: "Account Manager · Sales", color: "#d97706" },
  { initials: "KO", name: "K. Okafor", role: "Transport Manager · Ops", color: "#16a34a", lead: true },
  { initials: "BE", name: "B. Ezeh", role: "QA Officer", color: "#2563eb" },
  { initials: "AB", name: "A. Bello", role: "Clearing Officer", color: "#8b5cf6" },
  { initials: "FO", name: "F. Onuoha", role: "CX Officer", color: "#ec4899" },
  { initials: "SO", name: "S. Oluwatuyi", role: "Ops Manager", color: "#0d9488" },
];

const staffDirectory: TeamMember[] = [
  { initials: "TA", name: "Tola Adeyemi", role: "Account Manager · Sales", color: "#d97706" },
  { initials: "KO", name: "K. Okafor", role: "Transport Manager · Ops", color: "#16a34a" },
  { initials: "BE", name: "B. Ezeh", role: "QA Officer", color: "#2563eb" },
  { initials: "AB", name: "A. Bello", role: "Clearing Officer", color: "#8b5cf6" },
  { initials: "FO", name: "F. Onuoha", role: "CX Officer", color: "#ec4899" },
  { initials: "SO", name: "S. Oluwatuyi", role: "Ops Manager", color: "#0d9488" },
  { initials: "CN", name: "C. Nwosu", role: "Sales · Tier-2", color: "#0369a1" },
  { initials: "OA", name: "O. Adaji", role: "Operations Lead", color: "#7c3aed" },
  { initials: "IA", name: "I. Abubakar", role: "Finance Officer", color: "#be185d" },
  { initials: "JO", name: "J. Okonkwo", role: "Customs Broker", color: "#059669" },
  { initials: "NE", name: "N. Eze", role: "Documentation Officer", color: "#ca8a04" },
  { initials: "DA", name: "D. Adamu", role: "Haulage Coordinator", color: "#dc2626" },
];

interface ShipmentDoc {
  id: string;
  name: string;
  category: string;
  status: "uploaded" | "pending" | "requested" | "approved" | "rejected";
  uploadedBy?: string;
  uploadedAt?: string;
  requestedFrom?: string;
  requestedAt?: string;
  fileType?: string;
  fileSize?: string;
  notes?: string;
}

const mockDocuments: ShipmentDoc[] = [
  { id: "d1", name: "Commercial Invoice", category: "Export", status: "uploaded", uploadedBy: "Tola Adeyemi", uploadedAt: "23 May 10:14", fileType: "PDF", fileSize: "245 KB" },
  { id: "d2", name: "Packing List", category: "Export", status: "uploaded", uploadedBy: "Tola Adeyemi", uploadedAt: "23 May 10:15", fileType: "PDF", fileSize: "128 KB" },
  { id: "d3", name: "Booking Confirmation", category: "Carrier", status: "uploaded", uploadedBy: "K. Okafor", uploadedAt: "23 May 11:02", fileType: "PDF", fileSize: "312 KB" },
  { id: "d4", name: "NESS Certificate", category: "Compliance", status: "requested", requestedFrom: "B. Ezeh", requestedAt: "24 May 09:00", notes: "Required before gate-in" },
  { id: "d5", name: "Certificate of Origin", category: "Export", status: "pending", notes: "Awaiting Chamber of Commerce" },
  { id: "d6", name: "Phytosanitary Certificate", category: "Compliance", status: "approved", uploadedBy: "B. Ezeh", uploadedAt: "25 May 14:30", fileType: "PDF", fileSize: "180 KB" },
  { id: "d7", name: "Bill of Lading (Draft)", category: "Shipping", status: "requested", requestedFrom: "MSC Line", requestedAt: "26 May 08:00", notes: "Pending freight payment confirmation" },
  { id: "d8", name: "Container Inspection Report", category: "Operations", status: "uploaded", uploadedBy: "K. Okafor", uploadedAt: "24 May 16:45", fileType: "JPG", fileSize: "2.1 MB" },
];

const docCategories = ["All", "Export", "Carrier", "Compliance", "Shipping", "Operations"];

// ── Bills of Lading Data ──

interface BillOfLading {
  id: string;
  blNumber: string;
  type: "MBL" | "HBL"; // Master or House BL
  status: "draft" | "approved" | "original-issued" | "released" | "surrendered";
  shipper: { name: string; address: string };
  consignee: { name: string; address: string };
  notifyParty: { name: string; address: string };
  vessel: string;
  voyage: string;
  pol: string;
  pod: string;
  placeOfDelivery: string;
  containers: { number: string; seal: string; weight: string; packages: string }[];
  descriptionOfGoods: string;
  freightTerms: "Prepaid" | "Collect";
  issueDate?: string;
  issuedBy?: string;
  releaseType?: "Original" | "Telex" | "Seaway Bill";
  remarks?: string;
}

const mockBillsOfLading: BillOfLading[] = [
  {
    id: "bl1",
    blNumber: "MEDU-NGS-0029834",
    type: "MBL",
    status: "draft",
    shipper: { name: "OnePort 365 Limited", address: "Plot 42, Apapa-Oshodi Expressway, Lagos, Nigeria" },
    consignee: { name: "Ghana Trading Co. Ltd", address: "12 Independence Avenue, Accra, Ghana" },
    notifyParty: { name: "Same as Consignee", address: "" },
    vessel: "MSC OSCAR",
    voyage: "FN618R",
    pol: "Apapa, Nigeria (NGAPP)",
    pod: "Tema, Ghana (GHTEM)",
    placeOfDelivery: "Tema Port, Ghana",
    containers: [
      { number: "MEDU 782314-5", seal: "OP365-001", weight: "24,000 KG", packages: "1,200 Bags" },
      { number: "MEDU 913527-8", seal: "OP365-002", weight: "24,000 KG", packages: "1,200 Bags" },
    ],
    descriptionOfGoods: "Cement Clinker in 50kg bags. HS Code: 2523.10. Gross Weight: 48,000 KG",
    freightTerms: "Prepaid",
    remarks: "Pending freight payment confirmation from customer",
  },
  {
    id: "bl2",
    blNumber: "OP365-HBL-26050142",
    type: "HBL",
    status: "draft",
    shipper: { name: "BUA Cement Plc", address: "1, BUA Road, Sokoto, Nigeria" },
    consignee: { name: "Ghana Trading Co. Ltd", address: "12 Independence Avenue, Accra, Ghana" },
    notifyParty: { name: "GTC Logistics", address: "Tema Port Free Zone, Ghana" },
    vessel: "MSC OSCAR",
    voyage: "FN618R",
    pol: "Apapa, Nigeria (NGAPP)",
    pod: "Tema, Ghana (GHTEM)",
    placeOfDelivery: "Customer Warehouse, Accra",
    containers: [
      { number: "MEDU 782314-5", seal: "OP365-001", weight: "24,000 KG", packages: "1,200 Bags" },
      { number: "MEDU 913527-8", seal: "OP365-002", weight: "24,000 KG", packages: "1,200 Bags" },
    ],
    descriptionOfGoods: "Cement Clinker in 50kg bags. HS Code: 2523.10. Gross Weight: 48,000 KG. Shipper's Load, Stow & Count.",
    freightTerms: "Prepaid",
    remarks: "House BL for customer. Original required for cargo release.",
  },
];

function BillsOfLadingSection() {
  const [bls] = useState(mockBillsOfLading);
  const [selectedBL, setSelectedBL] = useState<BillOfLading | null>(null);
  const [blFilter, setBLFilter] = useState<"all" | "MBL" | "HBL">("all");

  const filtered = blFilter === "all" ? bls : bls.filter(bl => bl.type === blFilter);

  const statusBadge = (status: BillOfLading["status"]) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      draft: { bg: "#fef3e6", color: "#b45309", label: "Draft" },
      approved: { bg: "#eff4ff", color: "#2563eb", label: "Approved" },
      "original-issued": { bg: "#e6f7ec", color: "#166534", label: "Original Issued" },
      released: { bg: "#e6f7ec", color: "#16a34a", label: "Released" },
      surrendered: { bg: "#f3f5f3", color: "#6b7670", label: "Surrendered" },
    };
    const s = map[status] || { bg: "#f3f5f3", color: "#6b7670", label: status };
    return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const typeBadge = (type: "MBL" | "HBL") => {
    const map = {
      MBL: { bg: "#1a1a2e", color: "#f5c518", label: "Master BL" },
      HBL: { bg: "#16a34a", color: "#fff", label: "House BL" },
    };
    const t = map[type];
    return <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: t.bg, color: t.color }}>{t.label}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #e8ebe7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Bills of Lading ({bls.length})</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all", "MBL", "HBL"] as const).map(f => (
                <button key={f} onClick={() => setBLFilter(f)} style={{
                  padding: "4px 10px", fontSize: 10, fontWeight: 500, border: "none", borderRadius: 5, cursor: "pointer",
                  background: blFilter === f ? "#16a34a" : "#f3f5f3",
                  color: blFilter === f ? "#fff" : "#6b7670",
                }}>{f === "all" ? "All" : f}</button>
              ))}
            </div>
          </div>
          <button style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none",
            borderRadius: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 4,
          }}>
            <Plus size={12} /> Create BL
          </button>
        </div>

        {/* BL List */}
        <div style={{
          display: "grid", gridTemplateColumns: "140px 80px 1fr 100px 100px 80px",
          padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
          textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
        }}>
          <div>BL Number</div>
          <div>Type</div>
          <div>Shipper / Consignee</div>
          <div>Vessel</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {filtered.map(bl => (
          <div key={bl.id} onClick={() => setSelectedBL(bl)} style={{
            display: "grid", gridTemplateColumns: "140px 80px 1fr 100px 100px 80px",
            padding: "12px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
            cursor: "pointer", background: selectedBL?.id === bl.id ? "#f7faf7" : "#fff",
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600 }}>{bl.blNumber}</div>
            <div>{typeBadge(bl.type)}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#1a2520" }}>{bl.shipper.name}</div>
              <div style={{ fontSize: 10, color: "#6b7670" }}>To: {bl.consignee.name}</div>
            </div>
            <div style={{ fontSize: 11, color: "#6b7670" }}>{bl.vessel}</div>
            <div>{statusBadge(bl.status)}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); }} style={{
                padding: "4px 8px", fontSize: 10, background: "#f3f5f3", border: "none", borderRadius: 4, cursor: "pointer", color: "#6b7670",
              }}>
                <Eye size={12} />
              </button>
              <button onClick={e => { e.stopPropagation(); }} style={{
                padding: "4px 8px", fontSize: 10, background: "#f3f5f3", border: "none", borderRadius: 4, cursor: "pointer", color: "#6b7670",
              }}>
                <Download size={12} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No bills of lading found</div>
        )}
      </div>

      {/* BL Detail Panel */}
      {selectedBL && (
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #e8ebe7", background: "#f9faf9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selectedBL.blNumber}</span>
              {typeBadge(selectedBL.type)}
              {statusBadge(selectedBL.status)}
            </div>
            <button onClick={() => setSelectedBL(null)} style={{
              padding: "4px 8px", fontSize: 10, background: "#f3f5f3", border: "none", borderRadius: 4, cursor: "pointer", color: "#6b7670",
            }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: 16 }}>
            {/* Parties */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ background: "#f9faf9", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 6 }}>Shipper</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2520" }}>{selectedBL.shipper.name}</div>
                <div style={{ fontSize: 11, color: "#6b7670", marginTop: 4 }}>{selectedBL.shipper.address}</div>
              </div>
              <div style={{ background: "#f9faf9", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 6 }}>Consignee</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2520" }}>{selectedBL.consignee.name}</div>
                <div style={{ fontSize: 11, color: "#6b7670", marginTop: 4 }}>{selectedBL.consignee.address}</div>
              </div>
              <div style={{ background: "#f9faf9", padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 6 }}>Notify Party</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2520" }}>{selectedBL.notifyParty.name}</div>
                {selectedBL.notifyParty.address && <div style={{ fontSize: 11, color: "#6b7670", marginTop: 4 }}>{selectedBL.notifyParty.address}</div>}
              </div>
            </div>

            {/* Voyage Details */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 4 }}>Vessel / Voyage</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedBL.vessel} / {selectedBL.voyage}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 4 }}>Port of Loading</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedBL.pol}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 4 }}>Port of Discharge</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedBL.pod}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 4 }}>Place of Delivery</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedBL.placeOfDelivery}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 4 }}>Freight Terms</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{selectedBL.freightTerms}</div>
              </div>
            </div>

            {/* Containers */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 8 }}>Containers ({selectedBL.containers.length})</div>
              <div style={{ border: "1px solid #e8ebe7", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "150px 100px 100px 1fr",
                  padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#6b7670", background: "#f9faf9", borderBottom: "1px solid #e8ebe7",
                }}>
                  <div>Container No.</div>
                  <div>Seal No.</div>
                  <div>Weight</div>
                  <div>Packages</div>
                </div>
                {selectedBL.containers.map((c, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "150px 100px 100px 1fr",
                    padding: "10px 12px", fontSize: 12, borderBottom: i < selectedBL.containers.length - 1 ? "1px solid #e8ebe7" : "none",
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{c.number}</div>
                    <div style={{ fontSize: 11, color: "#6b7670" }}>{c.seal}</div>
                    <div style={{ fontSize: 11 }}>{c.weight}</div>
                    <div style={{ fontSize: 11, color: "#6b7670" }}>{c.packages}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description of Goods */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 6 }}>Description of Goods</div>
              <div style={{ fontSize: 12, color: "#1a2520", background: "#f9faf9", padding: 12, borderRadius: 8, lineHeight: 1.5 }}>
                {selectedBL.descriptionOfGoods}
              </div>
            </div>

            {/* Remarks */}
            {selectedBL.remarks && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", marginBottom: 6 }}>Remarks</div>
                <div style={{ fontSize: 12, color: "#b45309", background: "#fef3e6", padding: 12, borderRadius: 8 }}>
                  {selectedBL.remarks}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid #e8ebe7" }}>
              <button style={{
                padding: "8px 16px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2",
                borderRadius: 6, cursor: "pointer", color: "#6b7670", display: "flex", alignItems: "center", gap: 6,
              }}>
                <FileText size={14} /> Edit Draft
              </button>
              <button style={{
                padding: "8px 16px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2",
                borderRadius: 6, cursor: "pointer", color: "#6b7670", display: "flex", alignItems: "center", gap: 6,
              }}>
                <Download size={14} /> Download PDF
              </button>
              <button style={{
                padding: "8px 16px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none",
                borderRadius: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6,
              }}>
                <Send size={14} /> Request Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsSection() {
  const [docFilter, setDocFilter] = useState("All");
  const [showUpload, setShowUpload] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({ docName: "", requestFrom: "", notes: "", deadline: "" });
  const [docs, setDocs] = useState(mockDocuments);

  const filtered = docFilter === "All" ? docs : docs.filter(d => d.category === docFilter);
  const uploaded = docs.filter(d => d.status === "uploaded" || d.status === "approved").length;
  const pending = docs.filter(d => d.status === "pending" || d.status === "requested").length;

  const statusIcon = (status: ShipmentDoc["status"]) => {
    switch (status) {
      case "uploaded": return <CheckCircle size={14} color="#16a34a" />;
      case "approved": return <CheckCircle size={14} color="#2563eb" />;
      case "pending": return <Clock size={14} color="#ea8a1a" />;
      case "requested": return <Send size={14} color="#8b5cf6" />;
      case "rejected": return <XCircle size={14} color="#dc4f4f" />;
    }
  };

  const statusLabel = (status: ShipmentDoc["status"]) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      uploaded: { bg: "#e6f7ec", color: "#166534", label: "Uploaded" },
      approved: { bg: "#eff4ff", color: "#1d4ed8", label: "Approved" },
      pending: { bg: "#fef3e6", color: "#b45309", label: "Pending" },
      requested: { bg: "#f3eeff", color: "#6d28d9", label: "Requested" },
      rejected: { bg: "#fdecec", color: "#b91c1c", label: "Rejected" },
    };
    const s = map[status];
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Total Documents</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1a2520", marginTop: 4 }}>{docs.length}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Uploaded / Approved</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>{uploaded}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Pending / Requested</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#ea8a1a", marginTop: 4 }}>{pending}</div>
        </div>
      </div>

      {/* Actions + Filter bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 0, border: "1px solid #d4d9d2", borderRadius: 7, overflow: "hidden" }}>
          {docCategories.map(cat => (
            <button key={cat} onClick={() => setDocFilter(cat)} style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer",
              background: docFilter === cat ? "#1a2520" : "#fff", color: docFilter === cat ? "#fff" : "#6b7670",
              border: "none", borderRight: "1px solid #d4d9d2",
            }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowRequest(true); setShowUpload(false); }} style={{
            padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2",
            borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#6b7670",
          }}>
            <Send size={13} /> Request Document
          </button>
          <button onClick={() => { setShowUpload(true); setShowRequest(false); }} style={{
            padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#16a34a", border: "none",
            borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "#fff",
          }}>
            <Upload size={13} /> Upload Document
          </button>
        </div>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "20px", borderLeft: "3px solid #16a34a" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2520", marginBottom: 16 }}>Upload Document</div>
          <div style={{
            border: "2px dashed #d4d9d2", borderRadius: 10, padding: "32px", textAlign: "center",
            background: "#f9faf9", cursor: "pointer", marginBottom: 12,
          }}
            onDragOver={e => e.preventDefault()}
          >
            <Upload size={28} color="#9aa39d" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: "#6b7670", marginBottom: 4 }}>Drag & drop files here or click to browse</div>
            <div style={{ fontSize: 11, color: "#9aa39d" }}>PDF, JPG, PNG, XLSX — Max 25 MB</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Document Name</label>
              <input placeholder="e.g. Certificate of Origin" style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Category</label>
              <select style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff",
              }}>
                {docCategories.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowUpload(false)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", color: "#6b7670" }}>Cancel</button>
            <button style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#16a34a", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff" }}>Upload</button>
          </div>
        </div>
      )}

      {/* Request panel */}
      {showRequest && (
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "20px", borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2520", marginBottom: 16 }}>Request Document</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Document Name *</label>
              <input value={requestForm.docName} onChange={e => setRequestForm({ ...requestForm, docName: e.target.value })}
                placeholder="e.g. Bill of Lading" style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Request From *</label>
              <input value={requestForm.requestFrom} onChange={e => setRequestForm({ ...requestForm, requestFrom: e.target.value })}
                placeholder="Person, team, or carrier" style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Deadline</label>
              <input type="date" value={requestForm.deadline} onChange={e => setRequestForm({ ...requestForm, deadline: e.target.value })}
                style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 4 }}>Notes</label>
              <input value={requestForm.notes} onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })}
                placeholder="Additional context" style={{
                width: "100%", padding: "8px 12px", fontSize: 12, border: "1px solid #d4d9d2",
                borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowRequest(false)} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", color: "#6b7670" }}>Cancel</button>
            <button onClick={() => {
              if (requestForm.docName && requestForm.requestFrom) {
                setDocs([...docs, {
                  id: `d${docs.length + 1}`,
                  name: requestForm.docName,
                  category: "Export",
                  status: "requested",
                  requestedFrom: requestForm.requestFrom,
                  requestedAt: "Just now",
                  notes: requestForm.notes || undefined,
                }]);
                setRequestForm({ docName: "", requestFrom: "", notes: "", deadline: "" });
                setShowRequest(false);
              }
            }} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, background: "#8b5cf6", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff" }}>
              Send Request
            </button>
          </div>
        </div>
      )}

      {/* Documents table */}
      <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 100px 100px 140px 100px 60px",
          padding: "10px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
          textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
        }}>
          <div>Document</div><div>Category</div><div>Status</div><div>By / From</div><div>Date</div><div></div>
        </div>
        {filtered.map(doc => (
          <div key={doc.id} style={{
            display: "grid", gridTemplateColumns: "1fr 100px 100px 140px 100px 60px",
            padding: "12px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {statusIcon(doc.status)}
              <div>
                <div style={{ fontWeight: 500 }}>{doc.name}</div>
                {doc.notes && <div style={{ fontSize: 10, color: "#6b7670", marginTop: 1 }}>{doc.notes}</div>}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: "#f3f5f3", color: "#6b7670" }}>
                {doc.category}
              </span>
            </div>
            <div>{statusLabel(doc.status)}</div>
            <div style={{ fontSize: 11, color: "#6b7670" }}>
              {doc.uploadedBy || doc.requestedFrom || "—"}
            </div>
            <div style={{ fontSize: 11, color: "#9aa39d" }}>
              {doc.uploadedAt || doc.requestedAt || "—"}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(doc.status === "uploaded" || doc.status === "approved") && (
                <>
                  <button style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#6b7670" }} title="View"><Eye size={14} /></button>
                  <button style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "#6b7670" }} title="Download"><Download size={14} /></button>
                </>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>No documents in this category</div>
        )}
      </div>
    </div>
  );
}

interface FinanceItem {
  id: string;
  description: string;
  vendor: string;
  currency: "USD" | "NGN";
  amount: number;
  status: "paid" | "unpaid" | "partial" | "overdue";
  dueDate: string;
  paidDate?: string;
  invoiceRef?: string;
  category: string;
}

const initialReceivables: FinanceItem[] = [
  { id: "r1", description: "Freight charge — ocean export", vendor: "BUA Foods Plc", currency: "USD", amount: 7500, status: "paid", dueDate: "2026-05-25", paidDate: "2026-05-24", invoiceRef: "INV-2605-001", category: "Freight" },
  { id: "r2", description: "Documentation & handling fee", vendor: "BUA Foods Plc", currency: "USD", amount: 1250, status: "unpaid", dueDate: "2026-06-05", invoiceRef: "INV-2605-002", category: "Handling" },
  { id: "r3", description: "THC & terminal charges", vendor: "BUA Foods Plc", currency: "USD", amount: 2100, status: "unpaid", dueDate: "2026-06-10", invoiceRef: "INV-2605-003", category: "Terminal" },
  { id: "r4", description: "Insurance premium", vendor: "BUA Foods Plc", currency: "USD", amount: 1400, status: "partial", dueDate: "2026-06-01", invoiceRef: "INV-2605-004", category: "Insurance" },
];

const initialPayables: FinanceItem[] = [
  { id: "p1", description: "MSC ocean freight + booking", vendor: "MSC Mediterranean Shipping", currency: "USD", amount: 7500, status: "unpaid", dueDate: "2026-05-30", invoiceRef: "MSC-0029834", category: "Carrier" },
  { id: "p2", description: "Haulage — KAC Depot to Apapa", vendor: "KAC Logistics", currency: "NGN", amount: 1800000, status: "unpaid", dueDate: "2026-05-28", invoiceRef: "KAC-0612", category: "Transport" },
  { id: "p3", description: "Terminal gate-in + THC", vendor: "Apapa Terminal (APM)", currency: "NGN", amount: 1125000, status: "unpaid", dueDate: "2026-06-02", category: "Terminal" },
  { id: "p4", description: "NESS inspection fee", vendor: "SON / NESS", currency: "NGN", amount: 510000, status: "overdue", dueDate: "2026-05-26", invoiceRef: "NESS-4521", category: "Compliance" },
  { id: "p5", description: "Clearing agent docs & processing", vendor: "Kobo Clearing Ltd", currency: "NGN", amount: 600000, status: "paid", dueDate: "2026-05-24", paidDate: "2026-05-24", invoiceRef: "KCL-1187", category: "Clearing" },
];

interface BudgetLine {
  id: string;
  description: string;
  vendor: string;
  category: string;
  currency: "USD" | "NGN";
  budgeted: number;
  committed: number;
  paid: number;
  notes?: string;
}

const initialBudgetLines: BudgetLine[] = [
  { id: "b1", description: "MSC ocean freight + booking", vendor: "MSC Mediterranean Shipping", category: "Carrier", currency: "USD", budgeted: 7500, committed: 7500, paid: 0 },
  { id: "b2", description: "Haulage — KAC Depot to Apapa", vendor: "KAC Logistics", category: "Transport", currency: "NGN", budgeted: 1800000, committed: 1800000, paid: 0 },
  { id: "b3", description: "Terminal gate-in + THC", vendor: "Apapa Terminal (APM)", category: "Terminal", currency: "NGN", budgeted: 1200000, committed: 0, paid: 0, notes: "Forecast ₦1.125M — ₦75K saving" },
  { id: "b4", description: "NESS inspection fee", vendor: "SON / NESS", category: "Compliance", currency: "NGN", budgeted: 510000, committed: 510000, paid: 0 },
  { id: "b5", description: "Clearing agent docs & processing", vendor: "Kobo Clearing Ltd", category: "Clearing", currency: "NGN", budgeted: 600000, committed: 600000, paid: 600000 },
  { id: "b6", description: "Contingency (10% buffer)", vendor: "—", category: "Contingency", currency: "NGN", budgeted: 510000, committed: 0, paid: 0, notes: "Reserved for unplanned costs" },
];

function FinanceSection({ contractValue }: { contractValue: { amount: number; currency: "USD" | "NGN" }[] }) {
  const [finTab, setFinTab] = useState<"summary" | "budget" | "receivables" | "payables" | "margin" | "cashflow">("summary");
  const [receivables, setReceivables] = useState(initialReceivables);
  const [payables, setPayables] = useState(initialPayables);
  const [budgetLines, setBudgetLines] = useState(initialBudgetLines);
  const [showAddForm, setShowAddForm] = useState<"receivable" | "payable" | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [newBudget, setNewBudget] = useState({ description: "", vendor: "", category: "", currency: "USD" as "USD" | "NGN", budgeted: "", notes: "" });
  const [newItem, setNewItem] = useState({ description: "", vendor: "", currency: "USD" as "USD" | "NGN", amount: "", dueDate: "", category: "", invoiceRef: "" });

  const fmtMoney = (amount: number, currency: string) =>
    currency === "USD" ? `$${amount.toLocaleString()}` : `₦${amount.toLocaleString()}`;

  const totalReceivable = receivables.reduce((s, r) => s + (r.currency === "USD" ? r.amount : r.amount / 1500), 0);
  const receivedUsd = receivables.filter(r => r.status === "paid").reduce((s, r) => s + (r.currency === "USD" ? r.amount : r.amount / 1500), 0);
  const totalPayable = payables.reduce((s, p) => s + (p.currency === "USD" ? p.amount : p.amount / 1500), 0);
  const paidUsd = payables.filter(p => p.status === "paid").reduce((s, p) => s + (p.currency === "USD" ? p.amount : p.amount / 1500), 0);
  const margin = totalReceivable - totalPayable;
  const marginPct = totalReceivable > 0 ? ((margin / totalReceivable) * 100).toFixed(1) : "0";
  const overdueCount = payables.filter(p => p.status === "overdue").length;

  const confirmPaid = (list: FinanceItem[], setList: (l: FinanceItem[]) => void, id: string) => {
    setList(list.map(item => item.id === id ? { ...item, status: "paid", paidDate: new Date().toISOString().slice(0, 10) } : item));
  };

  const removeItem = (list: FinanceItem[], setList: (l: FinanceItem[]) => void, id: string) => {
    setList(list.filter(item => item.id !== id));
  };

  const addItem = (type: "receivable" | "payable") => {
    if (!newItem.description || !newItem.vendor || !newItem.amount) return;
    const item: FinanceItem = {
      id: `${type[0]}${Date.now()}`,
      description: newItem.description,
      vendor: newItem.vendor,
      currency: newItem.currency,
      amount: parseFloat(newItem.amount),
      status: "unpaid",
      dueDate: newItem.dueDate || "TBD",
      invoiceRef: newItem.invoiceRef || undefined,
      category: newItem.category || "Other",
    };
    if (type === "receivable") setReceivables([...receivables, item]);
    else setPayables([...payables, item]);
    setNewItem({ description: "", vendor: "", currency: "USD", amount: "", dueDate: "", category: "", invoiceRef: "" });
    setShowAddForm(null);
  };

  const statusBadge = (status: FinanceItem["status"]) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      paid: { bg: "#e6f7ec", color: "#166534", label: "Paid" },
      unpaid: { bg: "#f3f5f3", color: "#6b7670", label: "Unpaid" },
      partial: { bg: "#fef3e6", color: "#b45309", label: "Partial" },
      overdue: { bg: "#fdecec", color: "#b91c1c", label: "Overdue" },
    };
    const s = map[status];
    return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const renderTable = (items: FinanceItem[], setItems: (l: FinanceItem[]) => void, type: "receivable" | "payable") => (
    <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e8ebe7" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {type === "receivable" ? "Receivables" : "Payables"} ({items.length})
        </div>
        <button onClick={() => setShowAddForm(showAddForm === type ? null : type)} style={{
          padding: "5px 10px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none",
          borderRadius: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 4,
        }}>
          <Plus size={12} /> Add {type === "receivable" ? "Invoice" : "Payable"}
        </button>
      </div>

      {showAddForm === type && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8ebe7", background: "#f9faf9" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Description *</label>
              <input value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="e.g. Ocean freight" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>{type === "receivable" ? "Customer" : "Vendor"} *</label>
              <input value={newItem.vendor} onChange={e => setNewItem({ ...newItem, vendor: e.target.value })}
                placeholder={type === "receivable" ? "Customer name" : "Vendor name"} style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Invoice Ref</label>
              <input value={newItem.invoiceRef} onChange={e => setNewItem({ ...newItem, invoiceRef: e.target.value })}
                placeholder="INV-XXXX" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Currency</label>
              <select value={newItem.currency} onChange={e => setNewItem({ ...newItem, currency: e.target.value as "USD" | "NGN" })}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }}>
                <option value="USD">USD</option><option value="NGN">NGN</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Amount *</label>
              <input type="number" value={newItem.amount} onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                placeholder="0.00" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Due Date</label>
              <input type="date" value={newItem.dueDate} onChange={e => setNewItem({ ...newItem, dueDate: e.target.value })}
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Category</label>
              <input value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                placeholder="e.g. Carrier" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAddForm(null)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", color: "#6b7670" }}>Cancel</button>
            <button onClick={() => addItem(type)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff" }}>Add</button>
          </div>
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 140px 80px 90px 80px 80px 120px",
        padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
        textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
      }}>
        <div>Description</div>
        <div>{type === "receivable" ? "Customer" : "Vendor"}</div>
        <div>Currency</div>
        <div>Amount</div>
        <div>Due</div>
        <div>Status</div>
        <div>Actions</div>
      </div>

      {/* Rows */}
      {items.map(item => (
        <div key={item.id} style={{
          display: "grid", gridTemplateColumns: "1fr 140px 80px 90px 80px 80px 120px",
          padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
          borderLeft: item.status === "overdue" ? "3px solid #dc4f4f" : item.status === "paid" ? "3px solid #16a34a" : "3px solid transparent",
        }}>
          <div>
            <div style={{ fontWeight: 500 }}>{item.description}</div>
            {item.invoiceRef && <div style={{ fontSize: 10, color: "#9aa39d", fontFamily: "'JetBrains Mono', monospace" }}>{item.invoiceRef}</div>}
            {item.category && <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3, background: "#f3f5f3", color: "#6b7670" }}>{item.category}</span>}
          </div>
          <div style={{ fontSize: 11, color: "#6b7670" }}>{item.vendor}</div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{item.currency}</div>
          <div style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
            {fmtMoney(item.amount, item.currency)}
          </div>
          <div style={{ fontSize: 10, color: item.status === "overdue" ? "#b91c1c" : "#6b7670" }}>
            {item.dueDate}
          </div>
          <div>{statusBadge(item.status)}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {item.status !== "paid" && (
              <button onClick={() => confirmPaid(items, setItems, item.id)} title="Confirm Paid" style={{
                padding: "3px 8px", fontSize: 10, fontWeight: 500, background: "#e6f7ec", border: "1px solid #bbf0c8",
                borderRadius: 4, cursor: "pointer", color: "#166534", display: "flex", alignItems: "center", gap: 3,
              }}>
                <CheckCircle size={11} /> Paid
              </button>
            )}
            {item.status === "paid" && item.paidDate && (
              <span style={{ fontSize: 10, color: "#16a34a" }}>✓ {item.paidDate}</span>
            )}
            <button onClick={() => removeItem(items, setItems, item.id)} title="Remove" style={{
              padding: "3px 6px", fontSize: 10, background: "none", border: "1px solid #e8ebe7",
              borderRadius: 4, cursor: "pointer", color: "#dc4f4f",
            }}>
              <XCircle size={12} />
            </button>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "#9aa39d", fontSize: 12 }}>No items</div>
      )}

      {/* Totals row */}
      {items.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 140px 80px 90px 80px 80px 120px",
          padding: "10px 16px", fontSize: 12, background: "#f9faf9", fontWeight: 600, borderTop: "2px solid #e8ebe7",
        }}>
          <div>Total ({items.length} items)</div>
          <div></div>
          <div></div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {items.some(i => i.currency === "USD") && <div>${items.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0).toLocaleString()}</div>}
            {items.some(i => i.currency === "NGN") && <div>₦{items.filter(i => i.currency === "NGN").reduce((s, i) => s + i.amount, 0).toLocaleString()}</div>}
          </div>
          <div></div>
          <div>
            <span style={{ fontSize: 10, color: "#16a34a" }}>{items.filter(i => i.status === "paid").length} paid</span>
          </div>
          <div></div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Margin summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Revenue (Receivables)", value: `$${Math.round(totalReceivable).toLocaleString()}`, color: "#1a2520" },
          { label: "Received", value: `$${Math.round(receivedUsd).toLocaleString()}`, color: "#16a34a" },
          { label: "Costs (Payables)", value: `$${Math.round(totalPayable).toLocaleString()}`, color: "#1a2520" },
          { label: "Gross Margin", value: `$${Math.round(margin).toLocaleString()} (${marginPct}%)`, color: parseFloat(marginPct) >= 18 ? "#16a34a" : "#ea8a1a" },
          { label: "Overdue", value: `${overdueCount}`, color: overdueCount > 0 ? "#dc4f4f" : "#16a34a" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: kpi.color, marginTop: 4, letterSpacing: -0.3 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* FX note */}
      <div style={{ fontSize: 10, color: "#6b7670", background: "#eff4ff", padding: "6px 12px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
        FX conversion rate: ₦1,500 = $1 USD — applied to NGN items for USD-equivalent totals
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e8ebe7" }}>
        {([
          { key: "summary" as const, label: "Summary" },
          { key: "budget" as const, label: "Budget" },
          { key: "receivables" as const, label: `Receivables (${receivables.length})` },
          { key: "payables" as const, label: `Payables (${payables.length})` },
          { key: "margin" as const, label: "Margin Tracker" },
          { key: "cashflow" as const, label: "Cash Flow" },
        ]).map(t => (
          <button key={t.key} onClick={() => setFinTab(t.key)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: finTab === t.key ? 600 : 400, cursor: "pointer",
            background: "none", border: "none", borderBottom: finTab === t.key ? "2px solid #16a34a" : "2px solid transparent",
            color: finTab === t.key ? "#1a2520" : "#6b7670", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Summary */}
      {finTab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {renderTable(receivables, setReceivables, "receivable")}
          {renderTable(payables, setPayables, "payable")}
        </div>
      )}

      {/* Budget */}
      {finTab === "budget" && (() => {
        const budgetUsd = budgetLines.filter(b => b.currency === "USD").reduce((s, b) => s + b.budgeted, 0);
        const budgetNgn = budgetLines.filter(b => b.currency === "NGN").reduce((s, b) => s + b.budgeted, 0);
        const committedUsd = budgetLines.filter(b => b.currency === "USD").reduce((s, b) => s + b.committed, 0);
        const committedNgn = budgetLines.filter(b => b.currency === "NGN").reduce((s, b) => s + b.committed, 0);
        const paidUsdAmt = budgetLines.filter(b => b.currency === "USD").reduce((s, b) => s + b.paid, 0);
        const paidNgnAmt = budgetLines.filter(b => b.currency === "NGN").reduce((s, b) => s + b.paid, 0);
        const totalBudgetEq = budgetUsd + budgetNgn / 1500;
        const totalCommittedEq = committedUsd + committedNgn / 1500;
        const totalPaidEq = paidUsdAmt + paidNgnAmt / 1500;
        const forecastEq = budgetLines.reduce((s, b) => s + (b.currency === "USD" ? Math.max(b.committed, b.paid) : Math.max(b.committed, b.paid) / 1500), 0);
        const varianceEq = totalBudgetEq - forecastEq;
        const usedPct = totalBudgetEq > 0 ? Math.round((totalPaidEq / totalBudgetEq) * 100) : 0;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Budget summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "Total Budget", value: `$${Math.round(totalBudgetEq).toLocaleString()}`, sub: budgetNgn > 0 ? `$${budgetUsd.toLocaleString()} + ₦${budgetNgn.toLocaleString()}` : `$${budgetUsd.toLocaleString()}`, color: "#1a2520" },
                { label: "Committed", value: `$${Math.round(totalCommittedEq).toLocaleString()}`, sub: committedNgn > 0 ? `$${committedUsd.toLocaleString()} + ₦${committedNgn.toLocaleString()}` : `$${committedUsd.toLocaleString()}`, color: "#ea8a1a" },
                { label: "Paid to Date", value: `$${Math.round(totalPaidEq).toLocaleString()}`, sub: `${usedPct}% of budget`, color: "#16a34a" },
                { label: "Variance", value: `${varianceEq >= 0 ? "-" : "+"}$${Math.round(Math.abs(varianceEq)).toLocaleString()}`, sub: varianceEq >= 0 ? "Under budget" : "Over budget", color: varianceEq >= 0 ? "#16a34a" : "#dc4f4f" },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>{kpi.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginTop: 4, letterSpacing: -0.3 }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, color: "#6b7670", marginTop: 2 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Budget usage bar */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Budget Utilisation</div>
              <div style={{ height: 32, background: "#f3f5f3", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${Math.min(usedPct, 100)}%`, background: "#16a34a", borderRadius: "8px 0 0 8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", transition: "width 0.3s" }}>
                  {usedPct > 8 ? `${usedPct}% Paid` : ""}
                </div>
                {totalBudgetEq > 0 && <div style={{ width: `${Math.min((totalCommittedEq - totalPaidEq) / totalBudgetEq * 100, 100 - usedPct)}%`, background: "#86efac", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#166534" }}>
                  Committed
                </div>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "#6b7670" }}>
                <span>Paid: ${Math.round(totalPaidEq).toLocaleString()}</span>
                <span>Committed: ${Math.round(totalCommittedEq).toLocaleString()}</span>
                <span>Remaining: ${Math.round(Math.max(0, totalBudgetEq - totalCommittedEq)).toLocaleString()}</span>
              </div>
            </div>

            {/* Budget lines table */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e8ebe7" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Budget Lines ({budgetLines.length})</div>
                <button onClick={() => setShowBudgetForm(!showBudgetForm)} style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none",
                  borderRadius: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <Plus size={12} /> Add Budget Line
                </button>
              </div>

              {/* Add budget form */}
              {showBudgetForm && (
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8ebe7", background: "#f9faf9" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Description *</label>
                      <input value={newBudget.description} onChange={e => setNewBudget({ ...newBudget, description: e.target.value })}
                        placeholder="e.g. Terminal handling charges" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Vendor *</label>
                      <input value={newBudget.vendor} onChange={e => setNewBudget({ ...newBudget, vendor: e.target.value })}
                        placeholder="Vendor or service provider" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Category</label>
                      <select value={newBudget.category} onChange={e => setNewBudget({ ...newBudget, category: e.target.value })}
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }}>
                        <option value="">Select...</option>
                        {["Carrier", "Transport", "Terminal", "Compliance", "Clearing", "Insurance", "Documentation", "Contingency", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Currency</label>
                      <select value={newBudget.currency} onChange={e => setNewBudget({ ...newBudget, currency: e.target.value as "USD" | "NGN" })}
                        style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }}>
                        <option value="USD">USD</option><option value="NGN">NGN</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Budget Amount *</label>
                      <input type="number" value={newBudget.budgeted} onChange={e => setNewBudget({ ...newBudget, budgeted: e.target.value })}
                        placeholder="0.00" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 500, color: "#6b7670", display: "block", marginBottom: 3 }}>Notes</label>
                      <input value={newBudget.notes} onChange={e => setNewBudget({ ...newBudget, notes: e.target.value })}
                        placeholder="Optional notes" style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d4d9d2", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setShowBudgetForm(false)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", color: "#6b7670" }}>Cancel</button>
                    <button onClick={() => {
                      if (newBudget.description && newBudget.vendor && newBudget.budgeted) {
                        setBudgetLines([...budgetLines, {
                          id: `b${Date.now()}`,
                          description: newBudget.description,
                          vendor: newBudget.vendor,
                          category: newBudget.category || "Other",
                          currency: newBudget.currency,
                          budgeted: parseFloat(newBudget.budgeted),
                          committed: 0,
                          paid: 0,
                          notes: newBudget.notes || undefined,
                        }]);
                        setNewBudget({ description: "", vendor: "", category: "", currency: "USD", budgeted: "", notes: "" });
                        setShowBudgetForm(false);
                      }
                    }} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 500, background: "#16a34a", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff" }}>Add Line</button>
                  </div>
                </div>
              )}

              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px 80px 90px",
                padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
                textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
              }}>
                <div>Line Item</div><div>Budgeted</div><div>Committed</div><div>Paid</div><div>Variance</div><div>Status</div><div>Actions</div>
              </div>

              {/* USD section */}
              {budgetLines.filter(b => b.currency === "USD").length > 0 && (
                <>
                  <div style={{ padding: "6px 16px", fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff4ff", textTransform: "uppercase", letterSpacing: 0.5 }}>USD Costs</div>
                  {budgetLines.filter(b => b.currency === "USD").map(b => {
                    const forecast = Math.max(b.committed, b.paid);
                    const variance = b.budgeted - forecast;
                    const pct = b.budgeted > 0 ? Math.round((b.paid / b.budgeted) * 100) : 0;
                    return (
                      <div key={b.id} style={{
                        display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px 80px 90px",
                        padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500 }}>{b.description}</div>
                          <div style={{ fontSize: 10, color: "#9aa39d" }}>{b.vendor}</div>
                          {b.notes && <div style={{ fontSize: 9, color: "#6b7670", fontStyle: "italic", marginTop: 2 }}>{b.notes}</div>}
                          <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3, background: "#f3f5f3", color: "#6b7670" }}>{b.category}</span>
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>${b.budgeted.toLocaleString()}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: b.committed > 0 ? "#1a2520" : "#9aa39d" }}>{b.committed > 0 ? `$${b.committed.toLocaleString()}` : "—"}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: b.paid > 0 ? "#16a34a" : "#9aa39d" }}>{b.paid > 0 ? `$${b.paid.toLocaleString()}` : "—"}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: variance >= 0 ? "#16a34a" : "#dc4f4f" }}>{variance >= 0 ? "-" : "+"}${Math.abs(variance).toLocaleString()}</div>
                        <div>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8,
                            background: b.paid >= b.budgeted ? "#e6f7ec" : b.committed > 0 ? "#fef3e6" : "#f3f5f3",
                            color: b.paid >= b.budgeted ? "#166534" : b.committed > 0 ? "#b45309" : "#6b7670",
                          }}>{b.paid >= b.budgeted ? "Paid" : b.committed > 0 ? "Committed" : "Budgeted"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 3 }}>
                          {b.paid < b.budgeted && b.committed === 0 && (
                            <button onClick={() => setBudgetLines(budgetLines.map(x => x.id === b.id ? { ...x, committed: x.budgeted } : x))} title="Mark Committed" style={{
                              padding: "2px 6px", fontSize: 9, fontWeight: 500, background: "#fef3e6", border: "1px solid #fde68a",
                              borderRadius: 4, cursor: "pointer", color: "#b45309",
                            }}>Commit</button>
                          )}
                          {b.committed > 0 && b.paid < b.committed && (
                            <button onClick={() => setBudgetLines(budgetLines.map(x => x.id === b.id ? { ...x, paid: x.committed } : x))} title="Mark Paid" style={{
                              padding: "2px 6px", fontSize: 9, fontWeight: 500, background: "#e6f7ec", border: "1px solid #bbf0c8",
                              borderRadius: 4, cursor: "pointer", color: "#166534",
                            }}>Paid</button>
                          )}
                          <button onClick={() => setBudgetLines(budgetLines.filter(x => x.id !== b.id))} title="Remove" style={{
                            padding: "2px 4px", fontSize: 9, background: "none", border: "1px solid #e8ebe7",
                            borderRadius: 4, cursor: "pointer", color: "#dc4f4f",
                          }}><XCircle size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* NGN section */}
              {budgetLines.filter(b => b.currency === "NGN").length > 0 && (
                <>
                  <div style={{ padding: "6px 16px", fontSize: 10, fontWeight: 600, color: "#16a34a", background: "#e6f7ec", textTransform: "uppercase", letterSpacing: 0.5 }}>NGN Costs (Local Services)</div>
                  {budgetLines.filter(b => b.currency === "NGN").map(b => {
                    const forecast = Math.max(b.committed, b.paid);
                    const variance = b.budgeted - forecast;
                    return (
                      <div key={b.id} style={{
                        display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px 80px 90px",
                        padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500 }}>{b.description}</div>
                          <div style={{ fontSize: 10, color: "#9aa39d" }}>{b.vendor}</div>
                          {b.notes && <div style={{ fontSize: 9, color: "#6b7670", fontStyle: "italic", marginTop: 2 }}>{b.notes}</div>}
                          <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3, background: "#f3f5f3", color: "#6b7670" }}>{b.category}</span>
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>₦{b.budgeted.toLocaleString()}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: b.committed > 0 ? "#1a2520" : "#9aa39d" }}>{b.committed > 0 ? `₦${b.committed.toLocaleString()}` : "—"}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: b.paid > 0 ? "#16a34a" : "#9aa39d" }}>{b.paid > 0 ? `₦${b.paid.toLocaleString()}` : "—"}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: variance >= 0 ? "#16a34a" : "#dc4f4f" }}>{variance >= 0 ? "-" : "+"}₦{Math.abs(variance).toLocaleString()}</div>
                        <div>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 8,
                            background: b.paid >= b.budgeted ? "#e6f7ec" : b.committed > 0 ? "#fef3e6" : "#f3f5f3",
                            color: b.paid >= b.budgeted ? "#166534" : b.committed > 0 ? "#b45309" : "#6b7670",
                          }}>{b.paid >= b.budgeted ? "Paid" : b.committed > 0 ? "Committed" : "Budgeted"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 3 }}>
                          {b.paid < b.budgeted && b.committed === 0 && (
                            <button onClick={() => setBudgetLines(budgetLines.map(x => x.id === b.id ? { ...x, committed: x.budgeted } : x))} title="Mark Committed" style={{
                              padding: "2px 6px", fontSize: 9, fontWeight: 500, background: "#fef3e6", border: "1px solid #fde68a",
                              borderRadius: 4, cursor: "pointer", color: "#b45309",
                            }}>Commit</button>
                          )}
                          {b.committed > 0 && b.paid < b.committed && (
                            <button onClick={() => setBudgetLines(budgetLines.map(x => x.id === b.id ? { ...x, paid: x.committed } : x))} title="Mark Paid" style={{
                              padding: "2px 6px", fontSize: 9, fontWeight: 500, background: "#e6f7ec", border: "1px solid #bbf0c8",
                              borderRadius: 4, cursor: "pointer", color: "#166534",
                            }}>Paid</button>
                          )}
                          <button onClick={() => setBudgetLines(budgetLines.filter(x => x.id !== b.id))} title="Remove" style={{
                            padding: "2px 4px", fontSize: 9, background: "none", border: "1px solid #e8ebe7",
                            borderRadius: 4, cursor: "pointer", color: "#dc4f4f",
                          }}><XCircle size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* FX + Total */}
              <div style={{ padding: "6px 16px", fontSize: 10, color: "#6b7670", background: "#eff4ff", textAlign: "center", borderBottom: "1px solid #e8ebe7" }}>
                ↓ Converted at FX rate ₦1,500 = $1 ↓
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 90px 90px 90px 90px 80px 90px",
                padding: "10px 16px", fontSize: 12, fontWeight: 700, background: "#f9faf9",
              }}>
                <div>Total USD-equivalent</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>${Math.round(totalBudgetEq).toLocaleString()}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>${Math.round(totalCommittedEq).toLocaleString()}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#16a34a" }}>${Math.round(totalPaidEq).toLocaleString()}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: varianceEq >= 0 ? "#16a34a" : "#dc4f4f" }}>${Math.round(Math.abs(varianceEq)).toLocaleString()}</div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receivables */}
      {finTab === "receivables" && renderTable(receivables, setReceivables, "receivable")}

      {/* Payables */}
      {finTab === "payables" && renderTable(payables, setPayables, "payable")}

      {/* Margin Tracker */}
      {finTab === "margin" && (() => {
        const targetMarginPct = 18;
        const actualMarginPct = parseFloat(marginPct);
        const marginGap = actualMarginPct - targetMarginPct;
        const revenueByMonth = [
          { month: "Week 1", revenue: Math.round(receivedUsd * 0.4), costs: Math.round(paidUsd * 0.3) },
          { month: "Week 2", revenue: Math.round(receivedUsd * 0.6), costs: Math.round(paidUsd * 0.5) },
          { month: "Week 3", revenue: Math.round(receivedUsd * 0.8), costs: Math.round(paidUsd * 0.7) },
          { month: "Current", revenue: Math.round(totalReceivable), costs: Math.round(totalPayable) },
        ];
        const maxVal = Math.max(...revenueByMonth.map(r => Math.max(r.revenue, r.costs)), 1);

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Margin KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Current Margin</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: actualMarginPct >= targetMarginPct ? "#16a34a" : "#ea8a1a", marginTop: 4 }}>{marginPct}%</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Target Margin</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#1a2520", marginTop: 4 }}>{targetMarginPct}%</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Gap to Target</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: marginGap >= 0 ? "#16a34a" : "#dc4f4f", marginTop: 4 }}>{marginGap > 0 ? "+" : ""}{marginGap.toFixed(1)} pts</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Margin Amount</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#1a2520", marginTop: 4 }}>${Math.round(margin).toLocaleString()}</div>
              </div>
            </div>

            {/* Margin position bar */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Margin Position</div>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", height: 36, borderRadius: 8, overflow: "hidden", fontSize: 10, fontWeight: 600 }}>
                  <div style={{ width: `${Math.round(paidUsd / totalReceivable * 100)}%`, background: "#166534", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                    Paid
                  </div>
                  <div style={{ width: `${Math.round((totalPayable - paidUsd) / totalReceivable * 100)}%`, background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                    Committed
                  </div>
                  <div style={{ width: `${Math.max(0, parseFloat(marginPct))}%`, background: "#e6f7ec", display: "flex", alignItems: "center", justifyContent: "center", color: "#166534" }}>
                    Margin {marginPct}%
                  </div>
                </div>
                {/* Target line */}
                <div style={{ position: "absolute", left: `${100 - targetMarginPct}%`, top: -4, bottom: -4, width: 2, background: "#ea8a1a", borderRadius: 1 }} />
                <div style={{ position: "absolute", left: `${100 - targetMarginPct}%`, top: -18, transform: "translateX(-50%)", fontSize: 9, fontWeight: 600, color: "#ea8a1a", whiteSpace: "nowrap" }}>
                  Target {targetMarginPct}%
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 10, color: "#6b7670" }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#166534", marginRight: 4 }} />Paid ${Math.round(paidUsd).toLocaleString()}</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#16a34a", marginRight: 4 }} />Committed ${Math.round(totalPayable - paidUsd).toLocaleString()}</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#e6f7ec", marginRight: 4 }} />Margin ${Math.round(margin).toLocaleString()}</span>
                <span><span style={{ display: "inline-block", width: 8, height: 2, background: "#ea8a1a", marginRight: 4 }} />Target {targetMarginPct}%</span>
              </div>
              {/* Insight */}
              {marginGap < 0 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef3e6", borderRadius: 8, border: "1px solid #fde68a", fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                  Margin tracking {Math.abs(marginGap).toFixed(1)} pts below target. Review uncommitted costs for savings opportunities. Current costs are ${Math.round(totalPayable).toLocaleString()} against revenue of ${Math.round(totalReceivable).toLocaleString()}.
                </div>
              )}
              {marginGap >= 0 && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#e6f7ec", borderRadius: 8, border: "1px solid #bbf0c8", fontSize: 11, color: "#166534", lineHeight: 1.5 }}>
                  Margin is on or above target. Revenue ${Math.round(totalReceivable).toLocaleString()} vs costs ${Math.round(totalPayable).toLocaleString()} — healthy position.
                </div>
              )}
            </div>

            {/* Revenue vs Cost chart */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Revenue vs Costs Over Time</div>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height: 140, padding: "0 8px" }}>
                {revenueByMonth.map((r, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 120 }}>
                      <div style={{ width: 20, height: `${(r.revenue / maxVal) * 100}%`, background: "#16a34a", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                      <div style={{ width: 20, height: `${(r.costs / maxVal) * 100}%`, background: "#dc4f4f", borderRadius: "4px 4px 0 0", minHeight: 4, opacity: 0.7 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7670", fontWeight: 500 }}>{r.month}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "#6b7670", justifyContent: "center" }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#16a34a", marginRight: 4 }} />Revenue</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#dc4f4f", opacity: 0.7, marginRight: 4 }} />Costs</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cash Flow */}
      {finTab === "cashflow" && (() => {
        const cashIn = receivables.filter(r => r.status === "paid").reduce((s, r) => s + (r.currency === "USD" ? r.amount : r.amount / 1500), 0);
        const cashOut = payables.filter(p => p.status === "paid").reduce((s, p) => s + (p.currency === "USD" ? p.amount : p.amount / 1500), 0);
        const netCash = cashIn - cashOut;
        const pendingIn = receivables.filter(r => r.status !== "paid").reduce((s, r) => s + (r.currency === "USD" ? r.amount : r.amount / 1500), 0);
        const pendingOut = payables.filter(p => p.status !== "paid").reduce((s, p) => s + (p.currency === "USD" ? p.amount : p.amount / 1500), 0);
        const projectedNet = netCash + pendingIn - pendingOut;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Cash flow KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Cash In</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>${Math.round(cashIn).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#6b7670", marginTop: 2 }}>Received from customer</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Cash Out</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#dc4f4f", marginTop: 4 }}>${Math.round(cashOut).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#6b7670", marginTop: 2 }}>Paid to vendors</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Net Cash Position</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: netCash >= 0 ? "#16a34a" : "#dc4f4f", marginTop: 4 }}>{netCash >= 0 ? "+" : ""}${Math.round(netCash).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#6b7670", marginTop: 2 }}>Current balance</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>Projected Net</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: projectedNet >= 0 ? "#16a34a" : "#dc4f4f", marginTop: 4 }}>{projectedNet >= 0 ? "+" : ""}${Math.round(projectedNet).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: "#6b7670", marginTop: 2 }}>When all settled</div>
              </div>
            </div>

            {/* Cash flow waterfall */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Cash Flow Waterfall</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { label: "Cash In (Received)", amount: cashIn, color: "#16a34a", direction: "in" as const },
                  { label: "Cash Out (Paid)", amount: -cashOut, color: "#dc4f4f", direction: "out" as const },
                  { label: "= Net Position", amount: netCash, color: netCash >= 0 ? "#16a34a" : "#dc4f4f", direction: "net" as const },
                  { label: "Pending In", amount: pendingIn, color: "#86efac", direction: "in" as const },
                  { label: "Pending Out", amount: -pendingOut, color: "#fca5a5", direction: "out" as const },
                  { label: "= Projected Net", amount: projectedNet, color: projectedNet >= 0 ? "#16a34a" : "#dc4f4f", direction: "net" as const },
                ].map((item, i) => {
                  const maxAmt = Math.max(cashIn, totalReceivable, totalPayable, 1);
                  const barWidth = Math.abs(item.amount) / maxAmt * 100;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px", alignItems: "center", gap: 12, padding: "4px 0", borderTop: item.direction === "net" ? "2px solid #e8ebe7" : "none" }}>
                      <div style={{ fontSize: 11, fontWeight: item.direction === "net" ? 700 : 400, color: item.direction === "net" ? "#1a2520" : "#6b7670" }}>{item.label}</div>
                      <div style={{ height: 16, borderRadius: 4, overflow: "hidden", background: "#f3f5f3" }}>
                        <div style={{ width: `${Math.min(barWidth, 100)}%`, height: "100%", background: item.color, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: item.color, textAlign: "right" }}>
                        {item.amount >= 0 ? "+" : ""}${Math.round(Math.abs(item.amount)).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending transactions */}
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #e8ebe7" }}>Pending Transactions</div>
              <div style={{
                display: "grid", gridTemplateColumns: "60px 1fr 140px 80px 90px 80px",
                padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
                textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
              }}>
                <div>Type</div><div>Description</div><div>Counterparty</div><div>Currency</div><div>Amount</div><div>Due</div>
              </div>
              {[
                ...receivables.filter(r => r.status !== "paid").map(r => ({ ...r, type: "IN" as const })),
                ...payables.filter(p => p.status !== "paid").map(p => ({ ...p, type: "OUT" as const })),
              ].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(item => (
                <div key={item.id} style={{
                  display: "grid", gridTemplateColumns: "60px 1fr 140px 80px 90px 80px",
                  padding: "8px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7",
                }}>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: item.type === "IN" ? "#e6f7ec" : "#fdecec",
                      color: item.type === "IN" ? "#166534" : "#b91c1c",
                    }}>{item.type}</span>
                  </div>
                  <div style={{ fontSize: 11 }}>{item.description}</div>
                  <div style={{ fontSize: 11, color: "#6b7670" }}>{item.vendor}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{item.currency}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: item.type === "IN" ? "#16a34a" : "#dc4f4f" }}>
                    {item.type === "IN" ? "+" : "-"}{fmtMoney(item.amount, item.currency)}
                  </div>
                  <div style={{ fontSize: 10, color: item.status === "overdue" ? "#b91c1c" : "#6b7670" }}>{item.dueDate}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Overview");
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [showAddMember, setShowAddMember] = useState(false);

  const shipment = mockShipments.find(s => s.id === id);
  if (!shipment) return <div style={{ padding: 40, textAlign: "center", color: "#6b7670" }}>Shipment not found</div>;

  const s = shipment;
  const modeBadgeColor = s.mode === "ocean" ? "#2563eb" : s.mode === "air" ? "#8b5cf6" : "#d97706";
  const modeBadgeBg = s.mode === "ocean" ? "#eff4ff" : s.mode === "air" ? "#f3eeff" : "#fef3e6";
  const statusColor = s.deadlineStatus === "breached" ? "#dc4f4f" : s.deadlineStatus === "at-risk" ? "#ea8a1a" : "#16a34a";
  const statusBg = s.deadlineStatus === "breached" ? "#fdecec" : s.deadlineStatus === "at-risk" ? "#fef3e6" : "#e6f7ec";
  const statusText = s.deadlineStatus === "breached" ? "#b91c1c" : s.deadlineStatus === "at-risk" ? "#b45309" : "#166534";
  const progressPct = Math.round((s.daysActive / s.totalDays) * 100);

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f9faf9" }}>
      {/* Breadcrumb */}
      <div style={{ padding: "12px 28px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#6b7670" }}>
        <span onClick={() => navigate("/shipments")} style={{ cursor: "pointer", color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Shipments
        </span>
        <span>›</span>
        <span style={{ color: "#1a2520", fontWeight: 500 }}>{s.jobNumber}</span>
      </div>

      {/* Hero Card */}
      <div style={{ margin: "0 28px 16px", background: "#fff", border: "1px solid #e8ebe7", borderRadius: 12, overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
              background: modeBadgeBg, color: modeBadgeColor, textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              {s.mode} · {s.direction}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: "#1a2520", letterSpacing: -0.3 }}>
              {s.jobNumber}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 14,
              background: statusBg, color: statusText, display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />
              {s.status === "active" ? "In Progress" : "Completed"} · {s.deadlineStatus === "on-track" ? "On Track" : s.deadlineStatus === "at-risk" ? "At Risk" : "Breached"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#6b7670" }}>
              <Share2 size={12} /> Share
            </button>
            <button style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#ea8a1a" }}>
              <AlertTriangle size={12} /> Escalate
            </button>
            <button style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, background: "#16a34a", border: "none", borderRadius: 6, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Add Update
            </button>
          </div>
        </div>

        {/* Route visualization */}
        <div style={{ padding: "0 22px 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2520" }}>{s.origin.port}</div>
            <div style={{ fontSize: 10, color: "#6b7670" }}>{s.origin.portCode}, {s.origin.country}</div>
          </div>
          <div style={{ flex: 1, position: "relative", height: 4, background: "#e8ebe7", borderRadius: 2 }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#16a34a", borderRadius: 2 }} />
            <div style={{
              position: "absolute", left: `${progressPct}%`, top: -10, transform: "translateX(-50%)",
              fontSize: 16,
            }}>
              {s.mode === "ocean" ? "🚢" : s.mode === "air" ? "✈️" : "🚚"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a2520" }}>{s.destination.port}</div>
            <div style={{ fontSize: 10, color: "#6b7670" }}>{s.destination.portCode}, {s.destination.country}</div>
          </div>
        </div>

        {/* Info row */}
        <div style={{ padding: "8px 22px 12px", fontSize: 11, color: "#6b7670", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>{s.incoterms}</span>
          <span>{s.commodity}, {(s.weightKg / 1000).toFixed(0)} MT</span>
          <span>{s.vessel}, Voyage {s.voyage}</span>
          <span>ETD {s.etd}</span>
          <span>ETA {s.eta}</span>
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid #e8ebe7" }}>
          {[
            { label: "Customer", value: s.customer.name, sub: `Tier ${s.customer.tier}` },
            { label: "Containers", value: `${s.containers.count}×${s.containers.size}`, sub: `${mockContainers.filter(c => c.status === "deployed").length} deployed, ${mockContainers.filter(c => c.status === "pending").length} pending` },
            { label: "Contract Value", value: formatContractValue(s.contractValue), sub: `${s.paidPercent}% paid` },
            { label: "Days Active", value: `${s.daysActive} of ${s.totalDays}`, sub: `Since ${s.activatedAt}` },
          ].map(m => (
            <div key={m.label} style={{ padding: "14px 22px", borderRight: "1px solid #e8ebe7" }}>
              <div style={{ fontSize: 10, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2520", marginTop: 2 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: "#6b7670", marginTop: 1 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Assigned row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px", background: "#f9faf9", borderTop: "1px solid #e8ebe7" }}>
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                {s.accountManager.initials}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{s.accountManager.name}</div>
                <div style={{ fontSize: 10, color: "#6b7670" }}>Account Manager · {s.accountManager.role}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                {s.opsOfficer.initials}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{s.opsOfficer.name} <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 4px", borderRadius: 3, background: "#e6f7ec", color: "#166534" }}>LEAD</span></div>
                <div style={{ fontSize: 10, color: "#6b7670" }}>{s.opsOfficer.role} · Ops</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#6b7670" }}>
              <MessageCircle size={11} /> Message team
            </button>
            <button style={{ padding: "5px 10px", fontSize: 11, fontWeight: 500, background: "#fff", border: "1px solid #d4d9d2", borderRadius: 6, cursor: "pointer", color: "#6b7670" }}>
              Reassign
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 28px", display: "flex", gap: 0, borderBottom: "1px solid #e8ebe7", background: "#fff", marginLeft: 28, marginRight: 28, borderRadius: "10px 10px 0 0", borderTop: "1px solid #e8ebe7", borderLeft: "1px solid #e8ebe7", borderRight: "1px solid #e8ebe7" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "10px 14px", fontSize: 12, fontWeight: activeTab === t ? 600 : 400, cursor: "pointer",
            background: "none", border: "none", borderBottom: activeTab === t ? "2px solid #16a34a" : "2px solid transparent",
            color: activeTab === t ? "#1a2520" : "#6b7670", marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {/* Content grid: main + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, padding: "0 28px 60px" }}>
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
          {/* Documents tab */}
          {activeTab === "Documents" && <DocumentsSection />}

          {/* Bills of Lading tab */}
          {activeTab === "Bills of Lading" && <BillsOfLadingSection />}

          {/* Finance tab */}
          {activeTab === "Finance" && <FinanceSection contractValue={s.contractValue} />}

          {(activeTab === "Overview" || activeTab === "Containers" || activeTab === "Progress") && <>
          {/* Containers table */}
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #e8ebe7" }}>
              Containers ({mockContainers.length})
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "50px 80px 140px 50px 100px 1fr 100px",
              padding: "8px 16px", fontSize: 10, fontWeight: 600, color: "#6b7670",
              textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7", background: "#f9faf9",
            }}>
              <div>ID</div><div>Liner</div><div>Number</div><div>Size</div><div>Status</div><div>Location</div><div>Progress</div>
            </div>
            {mockContainers.map(c => (
              <div key={c.id} style={{
                display: "grid", gridTemplateColumns: "50px 80px 140px 50px 100px 1fr 100px",
                padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #e8ebe7", alignItems: "center",
              }}>
                <div style={{ fontWeight: 600 }}>{c.id}</div>
                <div><CarrierLogo carrier={c.carrier} /></div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{c.number}</div>
                <div style={{ fontSize: 11, color: "#6b7670" }}>{c.size}</div>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    background: c.status === "deployed" ? "#e6f7ec" : "#fef3e6",
                    color: c.status === "deployed" ? "#166534" : "#b45309",
                  }}>{c.milestone}</span>
                </div>
                <div style={{ fontSize: 11, color: "#6b7670" }}>{c.location}</div>
                <div style={{ display: "flex", gap: 2 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map(step => (
                    <div key={step} style={{
                      width: 12, height: 4, borderRadius: 2,
                      background: step <= c.step ? "#16a34a" : "#e8ebe7",
                    }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Progress timeline */}
          {(() => {
            const milestones = s.direction === "export" ? exportMilestones : importMilestones;
            const phaseLabels: Record<number, [string, string]> = s.direction === "export"
              ? { 1: ["Pre-Shipment", "Docs & activation"], 2: ["Core Operations", "Booking → Sailing"], 3: ["Post-Shipment", "Docs & closure"] }
              : { 1: ["Pre-Operations", "Docs & activation"], 2: ["Core Execution", "Assessment → Delivery"], 3: ["Post-Operations", "Docs & closure"] };
            const totalCompleted = milestones.filter(m => m.status === "completed").length;
            const totalSteps = milestones.length;

            return (
              <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #e8ebe7" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Progress Timeline</span>
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                      background: s.direction === "export" ? "#eff4ff" : "#f3eeff",
                      color: s.direction === "export" ? "#2563eb" : "#6d28d9",
                    }}>{s.direction === "export" ? "EXPORT" : "IMPORT"}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7670" }}>{totalCompleted}/{totalSteps} steps</span>
                </div>
                {/* Overall progress bar */}
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #e8ebe7" }}>
                  <div style={{ height: 6, background: "#f3f5f3", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(totalCompleted / totalSteps) * 100}%`, height: "100%", background: "#16a34a", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                </div>
                <div style={{ padding: "16px" }}>
                  {([1, 2, 3] as const).map(phase => {
                    const phaseMilestones = milestones.filter(m => m.phase === phase);
                    const completed = phaseMilestones.filter(m => m.status === "completed").length;
                    const [label, sub] = phaseLabels[phase];
                    return (
                      <div key={phase} style={{ marginBottom: phase < 3 ? 24 : 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1a2520" }}>Phase {phase} — {label}</span>
                            <span style={{ fontSize: 10, color: "#9aa39d", marginLeft: 8 }}>{sub}</span>
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                            background: completed === phaseMilestones.length ? "#e6f7ec" : "#f3f5f3",
                            color: completed === phaseMilestones.length ? "#16a34a" : "#6b7670",
                          }}>
                            {completed}/{phaseMilestones.length}
                          </span>
                        </div>
                        {phaseMilestones.map((m, mi) => (
                          <div key={m.id} style={{ display: "flex", gap: 12, marginBottom: mi < phaseMilestones.length - 1 ? 2 : 0, alignItems: "stretch" }}>
                            {/* Timeline line + dot */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 700,
                                background: m.status === "completed" ? "#16a34a" : m.status === "in-progress" ? "#ea8a1a" : m.status === "blocked" ? "#dc4f4f" : "#e8ebe7",
                                color: m.status === "not-started" ? "#9aa39d" : "#fff",
                              }}>
                                {m.status === "completed" ? "✓" : m.status === "blocked" ? "!" : m.status === "in-progress" ? "●" : "○"}
                              </div>
                              {mi < phaseMilestones.length - 1 && (
                                <div style={{ width: 2, flex: 1, minHeight: 12, background: m.status === "completed" ? "#16a34a" : "#e8ebe7" }} />
                              )}
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, paddingBottom: mi < phaseMilestones.length - 1 ? 10 : 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: m.status === "not-started" ? "#9aa39d" : "#1a2520" }}>{m.name}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "#f3f5f3", color: "#6b7670", fontFamily: "'JetBrains Mono', monospace" }}>{m.scope}·{m.id}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, color: "#6b7670" }}>{m.owner}</span>
                                <span style={{ fontSize: 10, color: "#9aa39d" }}>·</span>
                                <span style={{ fontSize: 10, color: "#9aa39d" }}>SLA: {m.slaText}</span>
                                {m.trigger && <>
                                  <span style={{ fontSize: 10, color: "#9aa39d" }}>·</span>
                                  <span style={{ fontSize: 10, color: "#9aa39d" }}>Trigger: {m.trigger}</span>
                                </>}
                              </div>
                              {m.detail && <div style={{ fontSize: 11, color: "#6b7670", marginTop: 3 }}>{m.detail}</div>}
                              {m.completedAt && <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>✓ {m.completedAt} · SLA {m.sla}</div>}
                              {m.deadline && (
                                <div style={{ fontSize: 10, color: "#b45309", marginTop: 2, fontWeight: 600 }}>⚠ {m.deadline}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          </>}

          {/* Placeholder for other tabs */}
          {!["Overview", "Containers", "Progress", "Finance", "Documents", "Bills of Lading"].includes(activeTab) && (
            <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>
              {activeTab} section — coming soon
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 }}>
          {/* Current Focus */}
          {s.deadlineStatus !== "on-track" && (
            <div style={{
              background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden",
              borderTop: `3px solid ${statusColor}`,
            }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: statusText, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  ⚠ Current Focus
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2520", marginBottom: 4 }}>{s.currentMilestone}</div>
                <div style={{ fontSize: 11, color: "#6b7670", marginBottom: 12 }}>{s.milestoneDetail}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: statusColor, fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.deadlineStatus === "breached" ? "Overdue" : `Breach in ${s.deadlineLabel}`}
                </div>
              </div>
            </div>
          )}

          {/* Team */}
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e8ebe7" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Team ({team.length})</div>
              <button onClick={() => setShowAddMember(!showAddMember)} style={{
                padding: "3px 8px", fontSize: 10, fontWeight: 500, background: showAddMember ? "#f3f5f3" : "#16a34a",
                border: "none", borderRadius: 5, cursor: "pointer", color: showAddMember ? "#6b7670" : "#fff",
                display: "flex", alignItems: "center", gap: 3,
              }}>
                {showAddMember ? <><X size={10} /> Close</> : <><UserPlus size={10} /> Add</>}
              </button>
            </div>

            {/* Add member dropdown */}
            {showAddMember && (
              <div style={{ borderBottom: "1px solid #e8ebe7", maxHeight: 200, overflowY: "auto" }}>
                <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 600, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Staff Directory
                </div>
                {staffDirectory
                  .filter(s => !team.some(t => t.initials === s.initials))
                  .map(s => (
                    <div key={s.initials}
                      onClick={() => { setTeam([...team, s]); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f9faf9"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: s.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 8, fontWeight: 700, flexShrink: 0,
                      }}>{s.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: 9, color: "#6b7670" }}>{s.role}</div>
                      </div>
                      <Plus size={12} color="#16a34a" />
                    </div>
                  ))}
                {staffDirectory.filter(s => !team.some(t => t.initials === s.initials)).length === 0 && (
                  <div style={{ padding: "12px 16px", fontSize: 11, color: "#9aa39d", textAlign: "center" }}>All staff assigned</div>
                )}
              </div>
            )}

            <div style={{ padding: "4px 16px 8px" }}>
              {team.map(t => (
                <div key={t.initials} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", background: t.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>{t.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                      {t.name}
                      {t.lead && <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 4px", borderRadius: 3, background: "#e6f7ec", color: "#166534" }}>LEAD</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7670" }}>{t.role}</div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {!t.lead && (
                      <button onClick={() => setTeam(team.map(m => ({ ...m, lead: m.initials === t.initials ? true : false })))}
                        title="Set as Lead" style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "#9aa39d", opacity: 0.5 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; }}
                      ><Star size={12} /></button>
                    )}
                    <button onClick={() => setTeam(team.filter(m => m.initials !== t.initials))}
                      title="Remove from team" style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "#9aa39d", opacity: 0.5 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#dc4f4f"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = "#9aa39d"; }}
                    ><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #e8ebe7" }}>
              Quick stats
            </div>
            <div style={{ padding: "8px 16px" }}>
              {[
                { label: "Bills of Lading", value: "2" },
                { label: "Documents", value: "8" },
                { label: "Open invoices", value: "1" },
                { label: "Open payables", value: "4" },
                { label: "Comms (7d)", value: "12" },
              ].map(stat => (
                <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}>
                  <span style={{ color: "#6b7670" }}>{stat.label}</span>
                  <span style={{ fontWeight: 600 }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
