import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Download, X, Zap, Mail, ChevronDown, Database } from "lucide-react";
import api from "../lib/api";

type Tab = "ocean" | "import" | "export" | "other";
type SortDir = "asc" | "desc";

interface OceanRate {
  _id: string; carrier: string; polCode: string; podCode: string;
  originCountry?: string; destCountry?: string; commodityType?: string;
  equipmentType?: string; rateType?: string; inclusionType?: string;
  transitTime?: string; freeTime?: string; currency?: string;
  amount20ft?: number; amount40ft?: number; amount40hc?: number;
  expiryDate?: string; partnerId?: any; archived?: boolean;
}

interface HaulageRate {
  _id: string; terminalName: string; portCode: string;
  destCity?: string; destLga?: string; destState?: string;
  originCity?: string; originLga?: string; originState?: string;
  shipmentType?: string; equipmentType?: string; commodityType?: string;
  currency?: string; price: number; archived?: boolean;
}

interface OtherChargeItem {
  _id: string; itemName: string; itemCategory: string;
  shipmentType?: string; commodityType?: string; country?: string;
  currency?: string; price?: number; asPerReceipt?: boolean;
  expiryDate?: string; archived?: boolean;
}

interface Benchmark {
  _id: string; laneName: string; rate40ft?: number; waAdjustmentPct?: number; source?: string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function expiryStatus(d?: string): { label: string; color: string; dot: string } {
  if (!d) return { label: "", color: "", dot: "" };
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  if (days < 0) return { label: "expired", color: "#dc2626", dot: "#dc2626" };
  if (days < 30) return { label: "expiring", color: "#d97706", dot: "#d97706" };
  return { label: "", color: "var(--text)", dot: "" };
}

function PolBadge({ code }: { code: string }) {
  return (
    <span style={{
      background: "#dcfce7", color: "#166534", padding: "2px 7px",
      borderRadius: 4, fontSize: 11, fontFamily: "monospace", fontWeight: 600,
    }}>{code}</span>
  );
}

function PodBadge({ code }: { code: string }) {
  return (
    <span style={{
      background: "#fef3c7", color: "#92400e", padding: "2px 7px",
      borderRadius: 4, fontSize: 11, fontFamily: "monospace", fontWeight: 600,
    }}>{code}</span>
  );
}

function RateTypePill({ type }: { type?: string }) {
  if (!type) return <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>;
  const label = type.replace(/_/g, " ");
  const bg = type === "all_in" ? "#dbeafe" : type === "spot" ? "#fef3c7" : "#f3f4f6";
  const color = type === "all_in" ? "#1d4ed8" : type === "spot" ? "#92400e" : "#374151";
  return (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 500, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

const carriers = ["MSC", "Maersk", "CMA CGM", "Hapag-Lloyd", "PIL", "Evergreen", "COSCO", "ONE", "ZIM"];
const lanes: [string, string, string, string, string, string][] = [
  ["NGAPP", "NLRTM", "Nigeria", "Netherlands", "21 days", "14 days"],
  ["NGAPP", "BEANR", "Nigeria", "Belgium", "18 days", "14 days"],
  ["NGAPP", "GHTEM", "Nigeria", "Ghana", "5 days", "7 days"],
  ["NGAPP", "DEHAM", "Nigeria", "Germany", "20 days", "14 days"],
  ["NGAPP", "KEMBA", "Nigeria", "Kenya", "18 days", "10 days"],
  ["NGAPP", "SGSIN", "Nigeria", "Singapore", "28 days", "14 days"],
  ["NGAPP", "CNSHA", "Nigeria", "China", "32 days", "14 days"],
  ["NLRTM", "NGAPP", "Netherlands", "Nigeria", "19 days", "14 days"],
  ["CNSHA", "NGAPP", "China", "Nigeria", "35 days", "14 days"],
  ["CNTAO", "NGAPP", "China", "Nigeria", "33 days", "14 days"],
  ["AEJEA", "NGTCN", "UAE", "Nigeria", "16 days", "10 days"],
  ["AEJEA", "NGAPP", "UAE", "Nigeria", "17 days", "10 days"],
  ["DEHAM", "NGAPP", "Germany", "Nigeria", "20 days", "14 days"],
  ["TRIST", "NGAPP", "Turkey", "Nigeria", "14 days", "14 days"],
  ["NGONE", "NLRTM", "Nigeria", "Netherlands", "22 days", "14 days"],
  ["NGTCN", "KEMBA", "Nigeria", "Kenya", "19 days", "10 days"],
  ["CNNGB", "NGAPP", "China", "Nigeria", "34 days", "14 days"],
];
const rateTypes = ["all_in", "spot", "contract", "spot", "all_in", "contract", "spot", "all_in"];
const equips = ["20GP", "40HC", "40HC", "20GP", "40RF", "40HC", "20FT", "40HC"];
const commodities = ["General", "Agri", "FMCG", "General", "Reefer", "DG", "General", "Agri", "FMCG"];
const inclusions = ["THC+BAF", "THC+BAF+ISPS", "THC only", "THC+BAF+PTI", "", "THC+BAF", "THC+BAF+ISPS"];

const DUMMY_OCEAN: OceanRate[] = Array.from({ length: 50 }, (_, i) => {
  const lane = lanes[i % lanes.length];
  const rt = rateTypes[i % rateTypes.length];
  const base20 = 800 + Math.floor(Math.random() * 2500);
  const expDays = rt === "contract" ? 90 + Math.floor(Math.random() * 90) : 10 + Math.floor(Math.random() * 50);
  const expDate = new Date(Date.now() + expDays * 86400000).toISOString().slice(0, 10);
  return {
    _id: `r${i + 1}`,
    carrier: carriers[i % carriers.length],
    polCode: lane[0], podCode: lane[1],
    originCountry: lane[2], destCountry: lane[3],
    commodityType: commodities[i % commodities.length],
    equipmentType: equips[i % equips.length],
    rateType: rt,
    inclusionType: inclusions[i % inclusions.length] || undefined,
    transitTime: lane[4], freeTime: lane[5],
    currency: "USD",
    amount20ft: base20,
    amount40ft: Math.round(base20 * 1.45),
    amount40hc: Math.round(base20 * 1.55),
    expiryDate: expDate,
  };
});

const DUMMY_HAUL_IMPORT: HaulageRate[] = [
  { _id: "hi1", terminalName: "Apapa (APMT)", portCode: "NGAPP", destCity: "Ikeja", destState: "Lagos", shipmentType: "import", equipmentType: "40HC", currency: "NGN", price: 450000 },
  { _id: "hi2", terminalName: "Apapa (APMT)", portCode: "NGAPP", destCity: "Kano", destState: "Kano", shipmentType: "import", equipmentType: "40HC", currency: "NGN", price: 2400000 },
  { _id: "hi3", terminalName: "Tin Can (TICT)", portCode: "NGTCN", destCity: "Ikorodu", destState: "Lagos", shipmentType: "import", equipmentType: "20GP", currency: "NGN", price: 280000 },
  { _id: "hi4", terminalName: "Lekki Deep Sea", portCode: "NGLKI", destCity: "Lekki FTZ", destState: "Lagos", shipmentType: "import", equipmentType: "40HC", currency: "NGN", price: 350000 },
  { _id: "hi5", terminalName: "Apapa (APMT)", portCode: "NGAPP", destCity: "Ibadan", destState: "Oyo", shipmentType: "import", equipmentType: "20GP", currency: "NGN", price: 650000 },
];

const DUMMY_HAUL_EXPORT: HaulageRate[] = [
  { _id: "he1", terminalName: "KAC Depot (Ibafo)", portCode: "IBAFO", originCity: "Ibafo", originState: "Ogun", destCity: "Apapa", destState: "Lagos", shipmentType: "export", equipmentType: "40HC", currency: "NGN", price: 380000 },
  { _id: "he2", terminalName: "Kachicares Terminal", portCode: "KACHI", originCity: "Oshodi", originState: "Lagos", destCity: "Apapa", destState: "Lagos", shipmentType: "export", equipmentType: "40HC", currency: "NGN", price: 180000 },
  { _id: "he3", terminalName: "Customer Warehouse", portCode: "CUST", originCity: "Kano", originState: "Kano", destCity: "Apapa", destState: "Lagos", shipmentType: "export", equipmentType: "20GP", currency: "NGN", price: 2200000 },
  { _id: "he4", terminalName: "Lekki FTZ", portCode: "NGLKI", originCity: "Lekki", originState: "Lagos", destCity: "Lekki Deep Sea", destState: "Lagos", shipmentType: "export", equipmentType: "40HC", currency: "NGN", price: 250000 },
];

const DUMMY_OTHER: OtherChargeItem[] = [
  { _id: "oc1", itemName: "NESS Inspection Fee", itemCategory: "Compliance", shipmentType: "export", country: "Nigeria", currency: "NGN", price: 510000 },
  { _id: "oc2", itemName: "NXP Processing", itemCategory: "Compliance", shipmentType: "export", country: "Nigeria", currency: "NGN", price: 25000 },
  { _id: "oc3", itemName: "Terminal Handling Charge (THC)", itemCategory: "Terminal", shipmentType: "import", country: "Nigeria", currency: "NGN", price: 185000 },
  { _id: "oc4", itemName: "Container Deposit (40HC)", itemCategory: "Terminal", shipmentType: "import", currency: "USD", price: 1500 },
  { _id: "oc5", itemName: "Customs Examination Fee", itemCategory: "Customs", shipmentType: "import", country: "Nigeria", currency: "NGN", price: 350000 },
  { _id: "oc6", itemName: "Phytosanitary Certificate", itemCategory: "Compliance", shipmentType: "export", country: "Nigeria", currency: "NGN", price: 75000 },
  { _id: "oc7", itemName: "Fumigation Certificate", itemCategory: "Compliance", shipmentType: "export", country: "Nigeria", currency: "NGN", price: 120000 },
  { _id: "oc8", itemName: "Certificate of Origin (COO)", itemCategory: "Documentation", shipmentType: "export", country: "Nigeria", currency: "NGN", price: 50000 },
  { _id: "oc9", itemName: "Bill of Lading Fee", itemCategory: "Documentation", shipmentType: "export", currency: "USD", price: 75 },
  { _id: "oc10", itemName: "Agency Fee", itemCategory: "Service", commodityType: "General", currency: "NGN", price: 150000 },
];

export default function Rates() {
  const [tab, setTab] = useState<Tab>("ocean");
  const [ocean, setOcean] = useState<OceanRate[]>([]);
  const [haulImport, setHaulImport] = useState<HaulageRate[]>([]);
  const [haulExport, setHaulExport] = useState<HaulageRate[]>([]);
  const [other, setOther] = useState<OtherChargeItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [equipFilter, setEquipFilter] = useState("");
  const [rateTypeFilter, setRateTypeFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [origCountryFilter, setOrigCountryFilter] = useState("");
  const [destCountryFilter, setDestCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<{ tab: Tab; item: any | null } | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [partnerDropdown, setPartnerDropdown] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/rates/ocean").then(r => { const d = r.data || []; setOcean(d.length > 0 ? d : DUMMY_OCEAN); }).catch(() => setOcean(DUMMY_OCEAN)),
      api.get("/rates/haulage-import").then(r => { const d = r.data || []; setHaulImport(d.length > 0 ? d : DUMMY_HAUL_IMPORT); }).catch(() => setHaulImport(DUMMY_HAUL_IMPORT)),
      api.get("/rates/haulage-export").then(r => { const d = r.data || []; setHaulExport(d.length > 0 ? d : DUMMY_HAUL_EXPORT); }).catch(() => setHaulExport(DUMMY_HAUL_EXPORT)),
      api.get("/rates/other-charges").then(r => { const d = r.data || []; setOther(d.length > 0 ? d : DUMMY_OTHER); }).catch(() => setOther(DUMMY_OTHER)),
      api.get("/rates/benchmarks").then(r => setBenchmarks(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const reload = async (t: Tab) => {
    const endpoints: Record<Tab, string> = {
      ocean: "/rates/ocean", import: "/rates/haulage-import",
      export: "/rates/haulage-export", other: "/rates/other-charges",
    };
    const { data } = await api.get(endpoints[t]);
    if (t === "ocean") setOcean(data || []);
    if (t === "import") setHaulImport(data || []);
    if (t === "export") setHaulExport(data || []);
    if (t === "other") setOther(data || []);
  };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const applySorting = (data: any[], col: string, dir: SortDir) => {
    if (!col) return data;
    return [...data].sort((a, b) => {
      let va = a[col], vb = b[col];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const applySearch = (text: string) => !s || text.toLowerCase().includes(s);

    let result: any[];
    if (tab === "ocean") {
      result = ocean.filter(r => {
        const text = `${r.carrier} ${r.polCode} ${r.podCode} ${r.originCountry || ""} ${r.destCountry || ""}`;
        if (!applySearch(text)) return false;
        if (equipFilter && (r.equipmentType || "").toUpperCase() !== equipFilter.toUpperCase()) return false;
        if (rateTypeFilter && r.rateType !== rateTypeFilter) return false;
        if (carrierFilter && !(r.carrier || "").toLowerCase().includes(carrierFilter.toLowerCase())) return false;
        if (origCountryFilter && !(r.originCountry || "").toLowerCase().includes(origCountryFilter.toLowerCase())) return false;
        if (destCountryFilter && !(r.destCountry || "").toLowerCase().includes(destCountryFilter.toLowerCase())) return false;
        if (statusFilter) {
          const exp = expiryStatus(r.expiryDate);
          if (statusFilter === "valid" && exp.label) return false;
          if (statusFilter === "expiring" && exp.label !== "expiring") return false;
          if (statusFilter === "expired" && exp.label !== "expired") return false;
        }
        return true;
      });
    } else if (tab === "import") {
      result = haulImport.filter(r => applySearch(`${r.terminalName} ${r.destLga || ""} ${r.destCity || ""} ${r.destState || ""}`));
    } else if (tab === "export") {
      result = haulExport.filter(r => applySearch(`${r.terminalName} ${r.originLga || ""} ${r.originCity || ""} ${r.originState || ""}`));
    } else {
      result = other.filter(r => applySearch(`${r.itemName} ${r.itemCategory}`));
    }
    return applySorting(result, sortCol, sortDir);
  }, [tab, ocean, haulImport, haulExport, other, search, equipFilter, rateTypeFilter, carrierFilter, origCountryFilter, destCountryFilter, statusFilter, sortCol, sortDir]);

  const clearFilters = () => { setSearch(""); setEquipFilter(""); setRateTypeFilter(""); setCarrierFilter(""); setOrigCountryFilter(""); setDestCountryFilter(""); setStatusFilter(""); };

  const deleteRate = async (t: Tab, id: string) => {
    if (!window.confirm("Archive this rate?")) return;
    const endpoints: Record<Tab, string> = {
      ocean: "/rates/ocean", import: "/rates/haulage-import",
      export: "/rates/haulage-export", other: "/rates/other-charges",
    };
    await api.delete(`${endpoints[t]}/${id}`);
    await reload(t);
  };

  const openModal = (t: Tab, item: any | null) => {
    setModal({ tab: t, item });
    setFormData(item ? { ...item } : {});
  };

  const saveRate = async () => {
    if (!modal) return;
    const endpoints: Record<Tab, string> = {
      ocean: "/rates/ocean", import: "/rates/haulage-import",
      export: "/rates/haulage-export", other: "/rates/other-charges",
    };
    const base = endpoints[modal.tab];
    if (modal.item?._id) {
      await api.patch(`${base}/${modal.item._id}`, formData);
    } else {
      await api.post(base, formData);
    }
    setModal(null);
    await reload(modal.tab);
  };

  const exportCsv = () => {
    const data = filtered as any[];
    if (!data.length) { alert("No data to export."); return; }
    const keys = Object.keys(data[0]).filter(k => k !== "archived" && k !== "__v");
    const rows = [keys.join(","), ...data.map(r => keys.map(k => `"${(r[k] ?? "").toString().replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oneport365-${tab}-rates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const loadSampleData = async () => {
    setSeeding(true);
    try {
      await api.post("/seed/reset");
      await api.post("/seed");
      loadAll();
    } catch { alert("Failed to load sample data"); }
    finally { setSeeding(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filtered.map((r: any) => r._id);
    if (ids.every(id => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(ids));
  };

  const allSelected = filtered.length > 0 && filtered.every((r: any) => selected.has(r._id));

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "ocean", label: "Ocean Freight", icon: "\u{1F6A2}", count: ocean.length },
    { key: "import", label: "Haulage \u2014 Import", icon: "\u{1F69B}", count: haulImport.length },
    { key: "export", label: "Haulage \u2014 Export", icon: "\u{1F69B}", count: haulExport.length },
    { key: "other", label: "Other Charges", icon: "\u{1F4CB}", count: other.length },
  ];

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 12, border: "1px solid var(--border2)",
    borderRadius: 6, fontFamily: "Inter, sans-serif", outline: "none", color: "var(--text)",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, background: "var(--surface)" };

  const partnerName = (r: OceanRate) => {
    if (!r.partnerId) return null;
    if (typeof r.partnerId === "object" && r.partnerId.name) return r.partnerId.name;
    return null;
  };

  const SortHeader = ({ col, children, align }: { col: string; children: React.ReactNode; align?: string }) => (
    <th
      style={{ ...thStyle, textAlign: (align as any) || "left", cursor: "pointer", userSelect: "none" }}
      onClick={() => toggleSort(col)}
    >
      {children}
      {sortCol === col && <span style={{ marginLeft: 3, fontSize: 8 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Tab bar + Load sample data */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", background: "var(--surface)", padding: "0 16px" }}>
        <div style={{ display: "flex" }}>
          {tabs.map(t => (
            <div
              key={t.key}
              onClick={() => { setTab(t.key); clearFilters(); setSelected(new Set()); setSortCol(""); }}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                color: tab === t.key ? "var(--accent-dark)" : "var(--text3)",
                borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>{t.icon}</span> {t.label}
              <span style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                background: tab === t.key ? "var(--accent-light)" : "var(--bg)",
                color: tab === t.key ? "var(--accent-dark)" : "var(--text3)",
              }}>{t.count}</span>
            </div>
          ))}
        </div>
        <button
          className="btn btn-sm"
          onClick={loadSampleData}
          disabled={seeding}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
        >
          <Database size={11} /> {seeding ? "Loading..." : "Load sample data"}
        </button>
      </div>

      {/* Market rate ticker */}
      {benchmarks.length > 0 && (
        <div style={{
          display: "flex", gap: 0, overflowX: "auto", background: "#f8faf8",
          borderBottom: "1px solid var(--border)", padding: "0", flexShrink: 0,
        }}>
          {benchmarks.map(b => (
            <div key={b._id} style={{
              padding: "8px 16px", borderRight: "1px solid var(--border)",
              minWidth: 140, flexShrink: 0,
            }}>
              <div style={{ fontSize: 10, color: "var(--text3)", whiteSpace: "nowrap" }}>{b.laneName}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                  ${b.rate40ft?.toLocaleString()}
                </span>
                {b.waAdjustmentPct ? (
                  <span style={{ fontSize: 10, color: "#d97706", fontWeight: 500 }}>
                    (+{b.waAdjustmentPct}% WA)
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 9, color: "var(--text3)" }}>{b.source}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header + actions */}
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {tabs.find(t => t.key === tab)?.label} Rates
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            International sea freight rates between ports — per container type
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          {/* Contact Partner */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex" }}>
              <button
                className="btn btn-sm"
                onClick={() => setPartnerDropdown(!partnerDropdown)}
                style={{ display: "flex", alignItems: "center", gap: 4, border: "1.5px solid var(--accent)", color: "var(--accent-dark)", borderRadius: "6px 0 0 6px", borderRight: "none" }}
              >
                <Mail size={12} /> Contact Partner
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setPartnerDropdown(!partnerDropdown)}
                style={{ border: "1.5px solid var(--accent)", color: "var(--accent-dark)", borderRadius: "0 6px 6px 0", padding: "4px 6px" }}
              >
                <ChevronDown size={12} />
              </button>
            </div>
            {partnerDropdown && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, padding: 8, minWidth: 200, zIndex: 100,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}>
                <div style={{ fontSize: 11, color: "var(--text3)", padding: "4px 8px" }}>
                  Select rates first, then contact partners for updated pricing.
                </div>
                <button className="btn btn-sm" onClick={() => setPartnerDropdown(false)} style={{ marginTop: 4, width: "100%" }}>Close</button>
              </div>
            )}
          </div>

          <button className="btn btn-sm" onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={12} /> Export CSV
          </button>
          <button
            className="btn btn-sm"
            onClick={() => { const item: any = { rateType: "spot" }; openModal("ocean", null); setFormData(item); }}
            style={{ display: "flex", alignItems: "center", gap: 4, border: "1.5px solid var(--accent)", color: "var(--accent-dark)" }}
          >
            <Zap size={12} /> Spot Rate
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal(tab, null)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Add Rate
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: "10px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Search</div>
          <input placeholder="Carrier, port, cour..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        {tab === "ocean" && (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Equipment</div>
              <select value={equipFilter} onChange={e => setEquipFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                <option value="20GP">20GP</option>
                <option value="20FT">20FT</option>
                <option value="40HC">40HC</option>
                <option value="40RF">40RF</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Rate Type</div>
              <select value={rateTypeFilter} onChange={e => setRateTypeFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                <option value="all_in">All-in</option>
                <option value="freight_only">Freight only</option>
                <option value="spot">Spot</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Carrier</div>
              <input placeholder="e.g. MSC" value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Origin Country</div>
              <input placeholder="e.g. Nigeria" value={origCountryFilter} onChange={e => setOrigCountryFilter(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Dest Country</div>
              <input placeholder="e.g. China" value={destCountryFilter} onChange={e => setDestCountryFilter(e.target.value)} style={{ ...inputStyle, width: 120 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Status</div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                <option value="valid">Valid</option>
                <option value="expiring">Expiring soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </>
        )}
        <button className="btn btn-sm" onClick={clearFilters} style={{ alignSelf: "flex-end", marginBottom: 1 }}>Clear</button>
      </div>

      {/* Count + sort legend */}
      <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--text3)", background: "var(--bg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span><strong>{filtered.length}</strong> rate{filtered.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 10 }}>
          Click column header to sort &middot;{" "}
          <span style={{ color: "#d97706" }}>{"\u25A0"}</span> expiring soon &middot;{" "}
          <span style={{ color: "#dc2626" }}>{"\u25A0"}</span> expired
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading rates...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>No rates match filters</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg)" }}>
                <th style={{ ...thStyle, width: 30 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
                </th>
                {tab === "ocean" && (
                  <>
                    <SortHeader col="carrier">Carrier</SortHeader>
                    <SortHeader col="polCode">POL</SortHeader>
                    <SortHeader col="originCountry">Origin</SortHeader>
                    <SortHeader col="podCode">POD</SortHeader>
                    <SortHeader col="destCountry">Dest</SortHeader>
                    <SortHeader col="equipmentType">Equip</SortHeader>
                    <SortHeader col="rateType">Rate Type</SortHeader>
                    <SortHeader col="amount20ft" align="right">20FT</SortHeader>
                    <SortHeader col="amount40ft" align="right">40FT</SortHeader>
                    <SortHeader col="amount40hc" align="right">40HC</SortHeader>
                    <SortHeader col="transitTime">Transit</SortHeader>
                    <SortHeader col="expiryDate">Expiry</SortHeader>
                    <th style={thStyle}>Partner</th>
                    <th style={thStyle}>Vs Market</th>
                  </>
                )}
                {tab === "import" && (
                  <>
                    <SortHeader col="terminalName">Terminal</SortHeader>
                    <SortHeader col="portCode">Port</SortHeader>
                    <SortHeader col="destCity">Dest City</SortHeader>
                    <SortHeader col="destLga">Dest LGA</SortHeader>
                    <SortHeader col="destState">State</SortHeader>
                    <SortHeader col="equipmentType">Equip</SortHeader>
                    <SortHeader col="price" align="right">Price (NGN)</SortHeader>
                    <th style={thStyle}></th>
                  </>
                )}
                {tab === "export" && (
                  <>
                    <SortHeader col="terminalName">Terminal</SortHeader>
                    <SortHeader col="portCode">Port</SortHeader>
                    <SortHeader col="originCity">Origin City</SortHeader>
                    <SortHeader col="originLga">Origin LGA</SortHeader>
                    <SortHeader col="originState">State</SortHeader>
                    <SortHeader col="equipmentType">Equip</SortHeader>
                    <SortHeader col="price" align="right">Price (NGN)</SortHeader>
                    <th style={thStyle}></th>
                  </>
                )}
                {tab === "other" && (
                  <>
                    <SortHeader col="itemName">Item</SortHeader>
                    <SortHeader col="itemCategory">Category</SortHeader>
                    <SortHeader col="shipmentType">Type</SortHeader>
                    <SortHeader col="currency">Currency</SortHeader>
                    <SortHeader col="price" align="right">Price</SortHeader>
                    <th style={thStyle}>As Per Receipt</th>
                    <SortHeader col="expiryDate">Expiry</SortHeader>
                    <th style={thStyle}></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "ocean" && (filtered as OceanRate[]).map(r => {
                const exp = expiryStatus(r.expiryDate);
                const partner = partnerName(r);
                return (
                  <tr
                    key={r._id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      ...(exp.label === "expired" ? { background: "#fef2f2" } : exp.label === "expiring" ? { background: "#fffbeb" } : {}),
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8faf8"}
                    onMouseLeave={e => e.currentTarget.style.background = exp.label === "expired" ? "#fef2f2" : exp.label === "expiring" ? "#fffbeb" : ""}
                  >
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.carrier}</span></td>
                    <td style={tdStyle}><PolBadge code={r.polCode} /></td>
                    <td style={tdStyle}>{r.originCountry || "\u2014"}</td>
                    <td style={tdStyle}><PodBadge code={r.podCode} /></td>
                    <td style={tdStyle}>{r.destCountry || "\u2014"}</td>
                    <td style={tdStyle}>{(r.equipmentType || "").toUpperCase() || "\u2014"}</td>
                    <td style={tdStyle}><RateTypePill type={r.rateType} /></td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>{r.amount20ft ? `USD ${r.amount20ft.toLocaleString()}` : "\u2014"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>{r.amount40ft ? `USD ${r.amount40ft.toLocaleString()}` : "\u2014"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{r.amount40hc ? `USD ${r.amount40hc.toLocaleString()}` : "\u2014"}</td>
                    <td style={tdStyle}>{r.transitTime || "\u2014"}</td>
                    <td style={tdStyle}>
                      <span style={{ color: exp.color || "var(--text)", display: "flex", alignItems: "center", gap: 4 }}>
                        {exp.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: exp.dot, display: "inline-block", flexShrink: 0 }} />}
                        {r.expiryDate ? fmtDate(r.expiryDate) : "\u2014"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {partner ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                          <Zap size={10} style={{ color: "var(--accent)" }} /> {partner}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td style={tdStyle}><span style={{ color: "var(--text3)" }}>{"\u2014"}</span></td>
                  </tr>
                );
              })}
              {tab === "import" && (filtered as HaulageRate[]).map(r => (
                <tr key={r._id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.terminalName}</span></td>
                  <td style={tdStyle}><PolBadge code={r.portCode} /></td>
                  <td style={tdStyle}>{r.destCity || "\u2014"}</td>
                  <td style={tdStyle}>{r.destLga || "\u2014"}</td>
                  <td style={tdStyle}>{r.destState || "\u2014"}</td>
                  <td style={tdStyle}>{(r.equipmentType || "").toUpperCase() || "\u2014"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{"\u20A6"}{r.price?.toLocaleString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openModal("import", r)} style={iconBtn}>✏️</button>
                      <button onClick={() => deleteRate("import", r._id)} style={iconBtn}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tab === "export" && (filtered as HaulageRate[]).map(r => (
                <tr key={r._id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}>
                    <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.terminalName}</span></td>
                  <td style={tdStyle}><PolBadge code={r.portCode} /></td>
                  <td style={tdStyle}>{r.originCity || "\u2014"}</td>
                  <td style={tdStyle}>{r.originLga || "\u2014"}</td>
                  <td style={tdStyle}>{r.originState || "\u2014"}</td>
                  <td style={tdStyle}>{(r.equipmentType || "").toUpperCase() || "\u2014"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{"\u20A6"}{r.price?.toLocaleString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openModal("export", r)} style={iconBtn}>✏️</button>
                      <button onClick={() => deleteRate("export", r._id)} style={iconBtn}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tab === "other" && (filtered as OtherChargeItem[]).map(r => {
                const exp = expiryStatus(r.expiryDate);
                return (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border)", ...(exp.label === "expired" ? { background: "#fef2f2" } : {}) }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggleSelect(r._id)} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.itemName}</span></td>
                    <td style={tdStyle}>{r.itemCategory}</td>
                    <td style={tdStyle}>{r.shipmentType || "both"}</td>
                    <td style={tdStyle}>{r.currency || "NGN"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                      {r.asPerReceipt ? "As per receipt" : r.price ? `${r.currency === "USD" ? "$" : "\u20A6"}${r.price.toLocaleString()}` : "\u2014"}
                    </td>
                    <td style={tdStyle}>{r.asPerReceipt ? "\u2713" : ""}</td>
                    <td style={tdStyle}>
                      <span style={{ color: exp.color || "var(--text)", display: "flex", alignItems: "center", gap: 4 }}>
                        {exp.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: exp.dot, display: "inline-block", flexShrink: 0 }} />}
                        {r.expiryDate ? fmtDate(r.expiryDate) : "\u2014"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openModal("other", r)} style={iconBtn}>✏️</button>
                        <button onClick={() => deleteRate("other", r._id)} style={iconBtn}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{
            background: "var(--surface)", borderRadius: 12, width: 500, maxHeight: "80vh",
            overflow: "auto", padding: "24px 28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{modal.item ? "Edit Rate" : "Add Rate"}</span>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text3)" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {modal.tab === "ocean" && (
                <>
                  {modalInput("carrier", "Carrier *", "e.g. MSC")}
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("polCode", "POL Code *", "e.g. CNSHA", { flex: 1 })}
                    {modalInput("originCountry", "Origin Country", "e.g. CN", { flex: 1 })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("podCode", "POD Code *", "e.g. NGAPP", { flex: 1 })}
                    {modalInput("destCountry", "Dest Country", "e.g. NG", { flex: 1 })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalSelect("equipmentType", "Equipment", [["20ft","20FT"],["40ft","40FT"],["40hc","40HC"],["mixed","Mixed"]], { flex: 1 })}
                    {modalSelect("rateType", "Rate Type", [["all_in","All-in"],["freight_only","Freight only"],["spot","Spot"]], { flex: 1 })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("amount20ft", "20FT Rate", "USD", { flex: 1, type: "number" })}
                    {modalInput("amount40ft", "40FT Rate", "USD", { flex: 1, type: "number" })}
                    {modalInput("amount40hc", "40HC Rate", "USD", { flex: 1, type: "number" })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("transitTime", "Transit Time", "e.g. 22 days", { flex: 1 })}
                    {modalInput("freeTime", "Free Time", "e.g. 14 days", { flex: 1 })}
                  </div>
                  {modalInput("expiryDate", "Expiry Date *", "", { type: "date" })}
                </>
              )}
              {modal.tab === "import" && (
                <>
                  {modalInput("terminalName", "Terminal Name *", "e.g. APM Terminals")}
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("portCode", "Port Code *", "e.g. NGAPP", { flex: 1 })}
                    {modalInput("destLga", "Dest LGA *", "e.g. Ikeja", { flex: 1 })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("destCity", "Dest City", "", { flex: 1 })}
                    {modalInput("destState", "Dest State", "", { flex: 1 })}
                  </div>
                  {modalInput("price", "Price (NGN) *", "", { type: "number" })}
                </>
              )}
              {modal.tab === "export" && (
                <>
                  {modalInput("terminalName", "Terminal Name *", "e.g. Apapa")}
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("portCode", "Port Code *", "e.g. NGAPP", { flex: 1 })}
                    {modalInput("originLga", "Origin LGA *", "e.g. Ikeja", { flex: 1 })}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {modalInput("originCity", "Origin City", "", { flex: 1 })}
                    {modalInput("originState", "Origin State *", "", { flex: 1 })}
                  </div>
                  {modalInput("price", "Price (NGN) *", "", { type: "number" })}
                </>
              )}
              {modal.tab === "other" && (
                <>
                  {modalInput("itemName", "Item Name *", "e.g. Terminal Handling")}
                  {modalInput("itemCategory", "Category *", "e.g. Port Charges")}
                  {modalSelect("shipmentType", "Shipment Type", [["both","Both"],["import","Import"],["export","Export"]])}
                  {modalSelect("currency", "Currency", [["NGN","NGN"],["USD","USD"]])}
                  {modalInput("price", "Price", "", { type: "number" })}
                  {modalInput("expiryDate", "Expiry Date", "", { type: "date" })}
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveRate}>
                  {modal.item ? "Save Changes" : "Add Rate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function modalInput(key: string, label: string, placeholder: string, opts: any = {}) {
    return (
      <div style={opts.flex ? { flex: opts.flex } : undefined}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
        <input
          type={opts.type || "text"}
          placeholder={placeholder}
          value={formData[key] ?? ""}
          onChange={e => setFormData({ ...formData, [key]: opts.type === "number" ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value })}
          style={{ ...inputStyle, width: "100%" }}
        />
      </div>
    );
  }

  function modalSelect(key: string, label: string, options: string[][], opts: any = {}) {
    return (
      <div style={opts.flex ? { flex: opts.flex } : undefined}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
        <select value={formData[key] ?? ""} onChange={e => setFormData({ ...formData, [key]: e.target.value })} style={{ ...selectStyle, width: "100%" }}>
          <option value="">—</option>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    );
  }
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 600,
  color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.03em",
  borderBottom: "2px solid var(--border)", whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap",
};

const iconBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 2,
  fontSize: 12, color: "var(--text3)", borderRadius: 4,
};
