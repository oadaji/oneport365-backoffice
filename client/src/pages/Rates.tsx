import React, { useEffect, useState, useMemo } from "react";
import { Plus, Download, X } from "lucide-react";
import api from "../lib/api";

type Tab = "ocean" | "import" | "export" | "other";

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

interface OtherCharge {
  _id: string; itemName: string; itemCategory: string;
  shipmentType?: string; commodityType?: string; country?: string;
  currency?: string; price?: number; asPerReceipt?: boolean;
  expiryDate?: string; archived?: boolean;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function expiryStatus(d?: string): { cls: string; label: string } {
  if (!d) return { cls: "", label: "" };
  const days = (new Date(d).getTime() - Date.now()) / 86400000;
  if (days < 0) return { cls: "row-expired", label: "expired" };
  if (days < 30) return { cls: "row-expiring", label: "expiring" };
  return { cls: "", label: "" };
}

function LocodeBadge({ code }: { code: string }) {
  return (
    <span style={{
      background: "#dcfce7", color: "#166534", padding: "1px 6px",
      borderRadius: 4, fontSize: 11, fontFamily: "monospace", fontWeight: 600,
    }}>{code}</span>
  );
}

export default function Rates() {
  const [tab, setTab] = useState<Tab>("ocean");
  const [ocean, setOcean] = useState<OceanRate[]>([]);
  const [haulImport, setHaulImport] = useState<HaulageRate[]>([]);
  const [haulExport, setHaulExport] = useState<HaulageRate[]>([]);
  const [other, setOther] = useState<OtherCharge[]>([]);
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

  useEffect(() => {
    Promise.all([
      api.get("/rates/ocean").then(r => setOcean(r.data || [])),
      api.get("/rates/haulage-import").then(r => setHaulImport(r.data || [])),
      api.get("/rates/haulage-export").then(r => setHaulExport(r.data || [])),
      api.get("/rates/other-charges").then(r => setOther(r.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

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

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const applySearch = (text: string) => !s || text.toLowerCase().includes(s);

    if (tab === "ocean") {
      return ocean.filter(r => {
        const text = `${r.carrier} ${r.polCode} ${r.podCode} ${r.originCountry || ""} ${r.destCountry || ""}`;
        if (!applySearch(text)) return false;
        if (equipFilter && r.equipmentType !== equipFilter) return false;
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
    }
    if (tab === "import") {
      return haulImport.filter(r => applySearch(`${r.terminalName} ${r.destLga || ""} ${r.destCity || ""} ${r.destState || ""}`));
    }
    if (tab === "export") {
      return haulExport.filter(r => applySearch(`${r.terminalName} ${r.originLga || ""} ${r.originCity || ""} ${r.originState || ""}`));
    }
    return other.filter(r => applySearch(`${r.itemName} ${r.itemCategory}`));
  }, [tab, ocean, haulImport, haulExport, other, search, equipFilter, rateTypeFilter, carrierFilter, origCountryFilter, destCountryFilter, statusFilter]);

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

  const tabs: { key: Tab; label: string; icon: string; count: number }[] = [
    { key: "ocean", label: "Ocean Freight", icon: "🚢", count: ocean.length },
    { key: "import", label: "Haulage — Import", icon: "🚛", count: haulImport.length },
    { key: "export", label: "Haulage — Export", icon: "🚛", count: haulExport.length },
    { key: "other", label: "Other Charges", icon: "📋", count: other.length },
  ];

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 12, border: "1px solid var(--border2)",
    borderRadius: 6, fontFamily: "Inter, sans-serif", outline: "none", color: "var(--text)",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, background: "var(--surface)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", padding: "0 16px" }}>
        {tabs.map(t => (
          <div
            key={t.key}
            onClick={() => { setTab(t.key); clearFilters(); }}
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Download size={12} /> Export CSV
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
          <input placeholder="Carrier, port, country..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        {tab === "ocean" && (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Equipment</div>
              <select value={equipFilter} onChange={e => setEquipFilter(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                <option value="20ft">20FT</option>
                <option value="40ft">40FT</option>
                <option value="40hc">40HC</option>
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

      {/* Count */}
      <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--text3)", background: "var(--bg)" }}>
        {filtered.length} rate{filtered.length !== 1 ? "s" : ""}
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
                {tab === "ocean" && (
                  <>
                    <th style={thStyle}>Carrier</th>
                    <th style={thStyle}>POL</th>
                    <th style={thStyle}>Origin</th>
                    <th style={thStyle}>POD</th>
                    <th style={thStyle}>Dest</th>
                    <th style={thStyle}>Equip</th>
                    <th style={thStyle}>Rate Type</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>20FT</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>40FT</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>40HC</th>
                    <th style={thStyle}>Transit</th>
                    <th style={thStyle}>Expiry</th>
                    <th style={thStyle}></th>
                  </>
                )}
                {tab === "import" && (
                  <>
                    <th style={thStyle}>Terminal</th>
                    <th style={thStyle}>Port</th>
                    <th style={thStyle}>Dest City</th>
                    <th style={thStyle}>Dest LGA</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>Equip</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Price (NGN)</th>
                    <th style={thStyle}></th>
                  </>
                )}
                {tab === "export" && (
                  <>
                    <th style={thStyle}>Terminal</th>
                    <th style={thStyle}>Port</th>
                    <th style={thStyle}>Origin City</th>
                    <th style={thStyle}>Origin LGA</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>Equip</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Price (NGN)</th>
                    <th style={thStyle}></th>
                  </>
                )}
                {tab === "other" && (
                  <>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Currency</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                    <th style={thStyle}>As Per Receipt</th>
                    <th style={thStyle}>Expiry</th>
                    <th style={thStyle}></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "ocean" && (filtered as OceanRate[]).map(r => {
                const exp = expiryStatus(r.expiryDate);
                return (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border)", ...(exp.label === "expired" ? { background: "#fef2f2" } : exp.label === "expiring" ? { background: "#fffbeb" } : {}) }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8faf8"}
                    onMouseLeave={e => e.currentTarget.style.background = exp.label === "expired" ? "#fef2f2" : exp.label === "expiring" ? "#fffbeb" : ""}
                  >
                    <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.carrier}</span></td>
                    <td style={tdStyle}><LocodeBadge code={r.polCode} /></td>
                    <td style={tdStyle}>{r.originCountry || "—"}</td>
                    <td style={tdStyle}><LocodeBadge code={r.podCode} /></td>
                    <td style={tdStyle}>{r.destCountry || "—"}</td>
                    <td style={tdStyle}>{r.equipmentType || "—"}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10 }}>{r.rateType || "—"}</span></td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>{r.amount20ft ? `USD ${r.amount20ft.toLocaleString()}` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>{r.amount40ft ? `USD ${r.amount40ft.toLocaleString()}` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{r.amount40hc ? `USD ${r.amount40hc.toLocaleString()}` : "—"}</td>
                    <td style={tdStyle}>{r.transitTime || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ color: exp.label === "expired" ? "var(--danger)" : exp.label === "expiring" ? "var(--warn)" : "var(--text)" }}>
                        {exp.label ? (exp.label === "expired" ? "● " : "▲ ") : ""}{r.expiryDate ? fmtDate(r.expiryDate) : "—"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openModal("ocean", r)} style={iconBtn} title="Edit">✏️</button>
                        <button onClick={() => deleteRate("ocean", r._id)} style={iconBtn} title="Delete"><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tab === "import" && (filtered as HaulageRate[]).map(r => (
                <tr key={r._id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.terminalName}</span></td>
                  <td style={tdStyle}><LocodeBadge code={r.portCode} /></td>
                  <td style={tdStyle}>{r.destCity || "—"}</td>
                  <td style={tdStyle}>{r.destLga || "—"}</td>
                  <td style={tdStyle}>{r.destState || "—"}</td>
                  <td style={tdStyle}>{r.equipmentType || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>₦{r.price?.toLocaleString()}</td>
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
                  <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.terminalName}</span></td>
                  <td style={tdStyle}><LocodeBadge code={r.portCode} /></td>
                  <td style={tdStyle}>{r.originCity || "—"}</td>
                  <td style={tdStyle}>{r.originLga || "—"}</td>
                  <td style={tdStyle}>{r.originState || "—"}</td>
                  <td style={tdStyle}>{r.equipmentType || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>₦{r.price?.toLocaleString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openModal("export", r)} style={iconBtn}>✏️</button>
                      <button onClick={() => deleteRate("export", r._id)} style={iconBtn}><X size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tab === "other" && (filtered as OtherCharge[]).map(r => {
                const exp = expiryStatus(r.expiryDate);
                return (
                  <tr key={r._id} style={{ borderBottom: "1px solid var(--border)", ...(exp.label === "expired" ? { background: "#fef2f2" } : {}) }}>
                    <td style={tdStyle}><span style={{ fontWeight: 500 }}>{r.itemName}</span></td>
                    <td style={tdStyle}>{r.itemCategory}</td>
                    <td style={tdStyle}>{r.shipmentType || "both"}</td>
                    <td style={tdStyle}>{r.currency || "NGN"}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                      {r.asPerReceipt ? "As per receipt" : r.price ? `${r.currency === "USD" ? "$" : "₦"}${r.price.toLocaleString()}` : "—"}
                    </td>
                    <td style={tdStyle}>{r.asPerReceipt ? "✓" : ""}</td>
                    <td style={tdStyle}>{r.expiryDate ? fmtDate(r.expiryDate) : "—"}</td>
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
