import React, { useEffect, useState } from "react";
import api from "../lib/api";
import DataTable from "../components/DataTable";

interface Quote {
  _id: string;
  quoteRef: string;
  customerName?: string;
  pol?: string;
  pod?: string;
  status: string;
  totalCostUSD?: number;
  sellPriceUSD?: number;
  createdAt: string;
}

function statusBadge(status: string) {
  const cls = status === "sent" ? "b-ok" : status === "draft" ? "b-wait" : "b-gray";
  return <span className={`badge ${cls}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/quotes").then((res) => {
      setQuotes(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const columns = [
    { key: "quoteRef", header: "Quote Ref", render: (q: Quote) => <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 500, color: "var(--text)" }}>{q.quoteRef}</span> },
    { key: "customerName", header: "Customer", render: (q: Quote) => q.customerName || "—" },
    { key: "route", header: "Route", render: (q: Quote) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{q.pol || "—"} → {q.pod || "—"}</span> },
    { key: "sellPriceUSD", header: "Price (USD)", render: (q: Quote) => q.sellPriceUSD ? `$${q.sellPriceUSD.toLocaleString()}` : "—" },
    { key: "status", header: "Status", render: (q: Quote) => statusBadge(q.status) },
    { key: "createdAt", header: "Created", render: (q: Quote) => new Date(q.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) },
  ];

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Quotes</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Customer quote management</div>
      </div>

      <DataTable
        columns={columns}
        data={quotes}
        emptyMessage={loading ? "Loading quotes..." : "No quotes yet"}
        title={`All Quotes (${quotes.length})`}
      />
    </div>
  );
}
