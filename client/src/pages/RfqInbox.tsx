import React, { useEffect, useState } from "react";
import api from "../lib/api";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";

interface Rfq {
  _id: string;
  ref: string;
  status: string;
  emailType: string;
  fields: { k: string; v: string; ok: boolean }[];
  missingFields: string[];
  followUpDraft?: string;
  notes?: string;
  email?: { fromName: string; fromEmail: string; subject: string; body: string; receivedAt: string };
  company?: { name: string };
  contact?: { firstName: string; lastName?: string; email?: string };
  createdAt: string;
}

function fieldVal(fields: { k: string; v: string; ok: boolean }[], key: string): string {
  const f = fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
  return f?.v && f.v !== "not specified" ? f.v : "—";
}

function statusBadge(status: string) {
  const cls = status === "ready" ? "b-ok" : status === "replied" ? "b-wait" : status === "archived" ? "b-gray" : "b-miss";
  const label = status === "ready" ? "Ready" : status === "replied" ? "Replied" : status === "archived" ? "Archived" : "Info needed";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RfqInbox() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/rfqs").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setRfqs(data.filter((r: Rfq) => r.emailType === "customer-rfq" || r.emailType === "internal-rfq"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const customerRfqs = rfqs;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = customerRfqs.filter((r) => r.email?.receivedAt && new Date(r.email.receivedAt) >= today).length;
  const readyCount = customerRfqs.filter((r) => r.status === "ready").length;
  const infoCount = customerRfqs.filter((r) => r.status === "info_needed").length;

  const columns = [
    { key: "ref", header: "RFQ No.", render: (r: Rfq) => <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 500, color: "var(--text)" }}>{r.ref}</span> },
    { key: "customer", header: "Customer", render: (r: Rfq) => <span style={{ fontWeight: 500, color: "var(--text)" }}>{r.email?.fromName || "—"}</span> },
    { key: "route", header: "Route", render: (r: Rfq) => { const pol = fieldVal(r.fields || [], "pol"); const pod = fieldVal(r.fields || [], "pod"); return <span style={{ fontFamily: "monospace", fontSize: 11 }}>{pol} → {pod}</span>; } },
    { key: "commodity", header: "Commodity", render: (r: Rfq) => fieldVal(r.fields || [], "commodity") },
    { key: "status", header: "Stage", render: (r: Rfq) => statusBadge(r.status) },
    { key: "received", header: "Received", render: (r: Rfq) => r.email?.receivedAt ? timeAgo(r.email.receivedAt) : "—" },
  ];

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>RFQ Inbox</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Incoming freight quote requests</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard value={loading ? "—" : customerRfqs.length} label="Total RFQs" note="all time" />
        <StatCard value={loading ? "—" : readyCount} label="Ready" note="for quoting" />
        <StatCard value={loading ? "—" : infoCount} label="Info Needed" note="awaiting customer" noteType="warn" />
        <StatCard value={loading ? "—" : todayCount} label="Today" note="received" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 10, flex: 1, overflow: "hidden", minHeight: 400 }}>
        <DataTable
          columns={columns}
          data={customerRfqs}
          onRowClick={(r) => setSelected(r)}
          selectedId={selected?._id}
          emptyMessage={loading ? "Loading RFQs..." : "No RFQs yet — sync Gmail to pull in requests."}
          title="All RFQs"
        />

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selected ? (
            <>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "#f8faf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>{selected.ref}</span>
                {statusBadge(selected.status)}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 6px" }}>Shipment Details</div>
                {(selected.fields || []).map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 85 }}>{f.k}</span>
                    <span style={{ fontSize: 11, color: f.ok ? "var(--text)" : "var(--danger)", textAlign: "right", flex: 1, fontStyle: f.ok ? "normal" : "italic" }}>{f.v}</span>
                  </div>
                ))}

                {selected.missingFields?.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--warn)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Missing Information</div>
                    {selected.missingFields.map((m, i) => (
                      <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "4px 8px", background: "#fffbeb", borderLeft: "3px solid var(--warn)", marginBottom: 4, borderRadius: "0 4px 4px 0" }}>
                        {typeof m === "string" ? m : (m as any).k || JSON.stringify(m)}
                      </div>
                    ))}
                  </>
                )}

                {selected.company && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Company</div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>{selected.company.name}</div>
                  </>
                )}

                {selected.contact && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Contact</div>
                    <div style={{ fontSize: 12, color: "var(--text)" }}>{selected.contact.firstName} {selected.contact.lastName || ""}</div>
                    {selected.contact.email && <div style={{ fontSize: 11, color: "var(--text3)" }}>{selected.contact.email}</div>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
              Select an RFQ to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
