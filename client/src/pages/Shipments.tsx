import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockShipments, completedShipments, Shipment } from "../lib/mock-shipments";
import { Search, Filter, ChevronDown } from "lucide-react";

type StatusTab = "active" | "completed" | "all";
type ModeFilter = "all" | "ocean" | "air" | "haulage";

const allShipments = [...mockShipments, ...completedShipments];

export default function Shipments() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<StatusTab>("active");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [search, setSearch] = useState("");

  const activeCount = mockShipments.length;
  const completedCount = completedShipments.length;

  const filtered = (tab === "active" ? mockShipments : tab === "completed" ? completedShipments : allShipments)
    .filter(s => modeFilter === "all" || s.mode === modeFilter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.jobNumber.toLowerCase().includes(q)
        || s.customer.name.toLowerCase().includes(q)
        || s.commodity.toLowerCase().includes(q)
        || s.carrier.toLowerCase().includes(q)
        || s.vessel.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const order = { breached: 0, "at-risk": 1, "on-track": 2 };
      return (order[a.deadlineStatus] ?? 2) - (order[b.deadlineStatus] ?? 2);
    });

  // KPI calculations
  const active = mockShipments;
  const containersInMotion = active.reduce((s, x) => s + x.containers.count, 0);
  const onTrack = active.filter(s => s.deadlineStatus === "on-track").length;
  const atRisk = active.filter(s => s.deadlineStatus === "at-risk").length;
  const breached = active.filter(s => s.deadlineStatus === "breached").length;

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#f9faf9" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a2520", margin: 0, letterSpacing: -0.4 }}>Shipments</h1>
          <div style={{ fontSize: 12, color: "#6b7670", marginTop: 2 }}>Track and manage all active shipments</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#16a34a", fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
            Live · Updated 38s ago
          </span>
          <button style={{
            padding: "7px 14px", fontSize: 13, fontWeight: 500, background: "#16a34a", color: "#fff",
            border: "none", borderRadius: 7, cursor: "pointer",
          }}>+ New Shipment</button>
        </div>
      </div>

      {/* Status Tabs */}
      <div style={{ padding: "16px 28px 0", display: "flex", gap: 0, borderBottom: "1px solid #e8ebe7" }}>
        {([
          ["active", `Active (${activeCount})`],
          ["completed", `Completed (${completedCount})`],
          ["all", `All (${activeCount + completedCount})`],
        ] as [StatusTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: tab === key ? 600 : 400, cursor: "pointer",
              background: "none", border: "none", borderBottom: tab === key ? "2px solid #16a34a" : "2px solid transparent",
              color: tab === key ? "#1a2520" : "#6b7670", marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ padding: "16px 28px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Active Shipments", value: activeCount, color: "#1a2520" },
          { label: "Containers in Motion", value: containersInMotion, color: "#1a2520" },
          { label: "On Track", value: onTrack, color: "#16a34a" },
          { label: "At Risk", value: atRisk, color: "#ea8a1a" },
          { label: "Breached", value: breached, color: "#dc4f4f" },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, padding: "14px 16px",
          }}>
            <div style={{ fontSize: 11, color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, marginTop: 4, letterSpacing: -0.5 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: "0 28px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        {/* Mode filter */}
        <div style={{ display: "flex", gap: 0, border: "1px solid #d4d9d2", borderRadius: 7, overflow: "hidden" }}>
          {(["all", "ocean", "air", "haulage"] as ModeFilter[]).map(m => (
            <button key={m} onClick={() => setModeFilter(m)} style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: modeFilter === m ? "#1a2520" : "#fff", color: modeFilter === m ? "#fff" : "#6b7670",
              border: "none", borderRight: "1px solid #d4d9d2",
              textTransform: "capitalize",
            }}>{m === "all" ? "All Types" : m}</button>
          ))}
        </div>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#9aa39d" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Job, customer, container, vessel…"
            style={{
              width: "100%", padding: "7px 12px 7px 32px", fontSize: 12, border: "1px solid #d4d9d2",
              borderRadius: 7, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: "0 28px 60px" }}>
        <div style={{ background: "#fff", border: "1px solid #e8ebe7", borderRadius: 10, overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "140px 150px 120px 180px 90px 1fr 90px 80px 80px",
            background: "#f9faf9", padding: "11px 12px", fontSize: 11, fontWeight: 600,
            color: "#6b7670", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #e8ebe7",
          }}>
            <div>Job #</div>
            <div>Customer</div>
            <div>Commodity</div>
            <div>Route</div>
            <div>Containers</div>
            <div>Current Milestone</div>
            <div>Deadline</div>
            <div>Health</div>
            <div>Owner</div>
          </div>

          {/* Rows */}
          {filtered.map(s => (
            <ShipmentRow key={s.id} shipment={s} onClick={() => navigate(`/shipments/view/${s.id}`)} onCustomerClick={(name) => navigate(`/customers/${encodeURIComponent(name)}`)} />
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#9aa39d", fontSize: 13 }}>
              No shipments match your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShipmentRow({ shipment: s, onClick, onCustomerClick }: { shipment: Shipment; onClick: () => void; onCustomerClick: (name: string) => void }) {
  const statusColor = s.deadlineStatus === "breached" ? "#dc4f4f" : s.deadlineStatus === "at-risk" ? "#ea8a1a" : "transparent";
  const modeBadgeColor = s.mode === "ocean" ? "#2563eb" : s.mode === "air" ? "#8b5cf6" : "#d97706";
  const modeBadgeBg = s.mode === "ocean" ? "#eff4ff" : s.mode === "air" ? "#f3eeff" : "#fef3e6";

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "140px 150px 120px 180px 90px 1fr 90px 80px 80px",
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
      onMouseEnter={e => { e.currentTarget.style.background = "#f9faf9"; }}
      onMouseLeave={e => {
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

      {/* Customer */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          onClick={(e) => { e.stopPropagation(); onCustomerClick(s.customer.name); }}
          style={{ fontWeight: 500, fontSize: 12, color: "#16a34a", cursor: "pointer" }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = "underline"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = "none"; }}
        >{s.customer.name}</span>
        {s.customer.tier <= 2 && (
          <span style={{ fontSize: 9, color: "#d4a017", fontWeight: 600 }}>★ Tier {s.customer.tier}</span>
        )}
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
