import React, { useEffect, useState } from "react";
import api from "../lib/api";
import DataTable from "../components/DataTable";

interface Rate {
  _id: string;
  carrier: string;
  polCode: string;
  podCode: string;
  amount20ft?: number;
  amount40ft?: number;
  amount40hc?: number;
  currency: string;
  expiryDate: string;
  equipmentType: string;
}

export default function Rates() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/rates/ocean").then((res) => {
      setRates(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const columns = [
    { key: "carrier", header: "Carrier", render: (r: Rate) => <span style={{ fontWeight: 500, color: "var(--text)" }}>{r.carrier}</span> },
    { key: "lane", header: "Trade Lane", render: (r: Rate) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{r.polCode} → {r.podCode}</span> },
    { key: "amount20ft", header: "20FT", render: (r: Rate) => r.amount20ft ? `$${r.amount20ft.toLocaleString()}` : "—" },
    { key: "amount40ft", header: "40FT", render: (r: Rate) => r.amount40ft ? `$${r.amount40ft.toLocaleString()}` : "—" },
    { key: "amount40hc", header: "40HC", render: (r: Rate) => r.amount40hc ? `$${r.amount40hc.toLocaleString()}` : "—" },
    { key: "currency", header: "Currency" },
    { key: "expiryDate", header: "Expires", render: (r: Rate) => new Date(r.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) },
  ];

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Rates</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Ocean freight rate database</div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rates}
        emptyMessage={loading ? "Loading rates..." : "No rates yet"}
        title={`Ocean Freight Rates (${rates.length})`}
      />
    </div>
  );
}
