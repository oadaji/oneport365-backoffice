import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, Send, FileText, Trash2 } from "lucide-react";
import api from "../lib/api";

interface Quote {
  _id: string;
  quoteRef: string;
  rfqRef?: string;
  status: string;
  customerName?: string;
  companyName?: string;
  customerEmail?: string;
  pol?: string;
  pod?: string;
  polCode?: string;
  podCode?: string;
  commodity?: string;
  containerType?: string;
  containerQty: number;
  carrier?: string;
  oceanLine?: any;
  originCharges?: any[];
  destCharges?: any[];
  haulage?: any;
  hasSuggestedHaulage?: boolean;
  exchangeRate: number;
  marginPct: number;
  totalCostUSD?: number;
  sellPriceUSD?: number;
  aiNotes?: string;
  notes?: string;
  sentAt?: string;
  createdAt: string;
}

type Filter = "all" | "draft" | "sent" | "approved";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function statusBadge(status: string) {
  const cls = status === "sent" ? "b-ok" : status === "approved" ? "b-rate" : "b-wait";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/quotes").then((res) => {
      const data = res.data || [];
      setQuotes(data);
      setLoading(false);
      // Auto-select quote if ?id= param is present
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("id");
      if (targetId) {
        const match = data.find((q: Quote) => q._id === targetId);
        if (match) setSelected(match);
        window.history.replaceState({}, "", "/quotes");
      }
    }).catch(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? quotes : quotes.filter((q) => q.status === filter);

  const deleteQuote = async (id: string) => {
    if (!window.confirm("Delete this quote?")) return;
    await api.delete(`/quotes/${id}`);
    setQuotes(quotes.filter((q) => q._id !== id));
    setSelected(null);
  };

  const oceanAmount = selected?.oceanLine?.amount || selected?.totalCostUSD || 0;
  const originTotal = (selected?.originCharges || []).reduce((s: number, c: any) => s + (c.asPerReceipt ? 0 : (c.amount || 0)), 0);
  const destTotal = (selected?.destCharges || []).reduce((s: number, c: any) => s + (c.asPerReceipt ? 0 : (c.amount || 0)), 0);
  const haulageAmount = selected?.haulage?.amount || 0;
  const subTotalUSD = oceanAmount * (selected?.containerQty || 1);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ===== LEFT: QUOTE LIST ===== */}
      <div style={{ width: 290, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>All Quotes</span>
          <button className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> New
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["all", "draft", "sent", "approved"] as Filter[]).map((f) => (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 600, cursor: "pointer",
                color: filter === f ? "var(--accent-dark)" : "var(--text3)",
                borderBottom: filter === f ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>No quotes</div>
          ) : (
            filtered.map((q) => {
              const isSelected = selected?._id === q._id;
              return (
                <div
                  key={q._id}
                  onClick={() => setSelected(q)}
                  style={{
                    padding: "10px 12px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                    background: isSelected ? "#eef6e6" : "var(--surface)",
                    borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8faf8"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface)"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "var(--accent-dark)" }}>{q.quoteRef}</span>
                    {statusBadge(q.status)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", marginBottom: 2 }}>
                    {q.companyName || q.customerName || "Unknown"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>
                    {q.pol || "—"} → {q.pod || "—"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)" }}>
                    <span>{q.containerType} × {q.containerQty}</span>
                    <span>{fmtDate(q.createdAt)}</span>
                  </div>
                  {q.hasSuggestedHaulage && (
                    <div style={{ marginTop: 4 }}>
                      <span className="badge b-ok" style={{ fontSize: 9 }}>🚛 Haulage included</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ===== RIGHT: QUOTE DOCUMENT ===== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
        {selected ? (
          <>
            {/* Action bar */}
            <div style={{ padding: "8px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginRight: 4 }}>{selected.quoteRef}</span>
              <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>
                {selected.customerName} · {selected.companyName} · {selected.pol} → {selected.pod}
              </span>
              {statusBadge(selected.status)}
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, borderColor: "var(--accent)", color: "var(--accent-dark)" }}>
                QB Sync
              </button>
              <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, background: "#eef6e6", color: "var(--accent-dark)", borderColor: "#c8e6a0" }}>
                <RefreshCw size={11} /> Regenerate
              </button>
              <button className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Send size={11} /> Send to customer
              </button>
              <button className="btn btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <FileText size={11} /> PDF
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteQuote(selected._id)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>

            {/* Quote document */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 40px" }}>
              <div style={{ maxWidth: 900, margin: "0 auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>

                {/* Letterhead */}
                <div style={{ padding: "20px 30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid var(--accent)" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--dark-green)" }}>
                      <span style={{ color: "var(--accent)" }}>One</span>Port 365
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4, lineHeight: 1.6 }}>
                      Meydan Grandstand, 6th floor, Meydan Road,<br />
                      Nad Al Sheba, Dubai, U.A.E
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-dark)" }}>{selected.quoteRef}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                      Issued: {fmtDate(selected.createdAt)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>Valid for 7 days</div>
                  </div>
                </div>

                {/* Booking Details */}
                <div style={{ padding: "16px 30px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Booking Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px 20px" }}>
                    {[
                      ["Company Name", selected.companyName || "—"],
                      ["Customer Name", selected.customerName || "—"],
                      ["Email Address", selected.customerEmail || "—"],
                      ["Commodity", selected.commodity || "—"],
                      ["RFQ Reference", selected.rfqRef || "—"],
                      ["Port of Loading", `${selected.pol || "—"} (${selected.polCode || ""})`],
                      ["Destination Port", `${selected.pod || "—"} (${selected.podCode || ""})`],
                      ["Container", `${selected.containerType || "—"} × ${selected.containerQty}`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ocean Freight */}
                <div style={{ padding: "16px 30px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Ocean Freight</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["", "Basis", "Unit", "20FT", "Amount (USD)", "Description", "Transit", "Free Days", "Comments"].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid var(--border)", fontSize: 9, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "8px", fontWeight: 700, color: "var(--text)" }}>{selected.carrier || "—"}</td>
                        <td style={{ padding: "8px", fontSize: 10 }}>{selected.pol} → {selected.pod}</td>
                        <td style={{ padding: "8px" }}>{selected.containerQty}</td>
                        <td style={{ padding: "8px", fontFamily: "monospace" }}>{oceanAmount ? oceanAmount.toLocaleString() : "—"}</td>
                        <td style={{ padding: "8px", fontFamily: "monospace", color: "var(--accent-dark)", fontWeight: 700 }}>${subTotalUSD.toLocaleString()}</td>
                        <td style={{ padding: "8px", fontSize: 10, color: "var(--text3)" }}>Per Container<br />All-in rate · USD</td>
                        <td style={{ padding: "8px", fontSize: 10 }}>{selected.oceanLine?.transitTime || "—"}</td>
                        <td style={{ padding: "8px", fontSize: 10 }}>{selected.oceanLine?.freeTime || "—"}</td>
                        <td style={{ padding: "8px", fontSize: 10, color: "var(--text3)" }}>Subject to vessel availability</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ textAlign: "right", marginTop: 12, fontSize: 13 }}>
                    <span style={{ color: "var(--text3)" }}>Sub Total: </span>
                    <span style={{ fontWeight: 700, fontFamily: "monospace", color: "var(--text)" }}>${subTotalUSD.toLocaleString()}</span>
                  </div>
                </div>

                {/* Origin Charges */}
                {(selected.originCharges?.length || 0) > 0 && (
                  <div style={{ padding: "16px 30px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Origin Charges</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr>
                          {["Item", "Basis", "Currency", "Amount"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid var(--border)", fontSize: 9, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.originCharges || []).map((c: any, i: number) => (
                          <tr key={i}>
                            <td style={{ padding: "6px 8px" }}>{c.itemName}</td>
                            <td style={{ padding: "6px 8px", fontSize: 10, color: "var(--text3)" }}>{c.basis || "Per Container"}</td>
                            <td style={{ padding: "6px 8px" }}>{c.currency || "NGN"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 600 }}>
                              {c.asPerReceipt ? "As per receipt" : (c.amount ? `${c.currency === "USD" ? "$" : "₦"}${c.amount.toLocaleString()}` : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ textAlign: "right", marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: "var(--text3)" }}>Origin Total: </span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>₦{originTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Destination Charges */}
                {(selected.destCharges?.length || 0) > 0 && (
                  <div style={{ padding: "16px 30px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Destination Charges</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr>
                          {["Item", "Basis", "Currency", "Amount"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid var(--border)", fontSize: 9, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selected.destCharges || []).map((c: any, i: number) => (
                          <tr key={i}>
                            <td style={{ padding: "6px 8px" }}>{c.itemName}</td>
                            <td style={{ padding: "6px 8px", fontSize: 10, color: "var(--text3)" }}>{c.basis || "Per Container"}</td>
                            <td style={{ padding: "6px 8px" }}>{c.currency || "NGN"}</td>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 600 }}>
                              {c.asPerReceipt ? "As per receipt" : (c.amount ? `${c.currency === "USD" ? "$" : "₦"}${c.amount.toLocaleString()}` : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ textAlign: "right", marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: "var(--text3)" }}>Destination Total: </span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>₦{destTotal.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Haulage */}
                {selected.hasSuggestedHaulage && selected.haulage && (
                  <div style={{ padding: "16px 30px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>🚛 Haulage</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 12 }}>
                      <div><span style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase" }}>Terminal</span><br />{selected.haulage.terminal || "—"}</div>
                      <div><span style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase" }}>Destination</span><br />{selected.haulage.destCity || "—"}</div>
                      <div><span style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase" }}>Amount</span><br /><span style={{ fontFamily: "monospace", fontWeight: 700 }}>₦{haulageAmount.toLocaleString()}</span></div>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{ padding: "16px 30px", background: "#f8faf8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>Exchange Rate: ₦{selected.exchangeRate?.toLocaleString() || "1,600"}/USD</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>Margin: {selected.marginPct}%</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>Sell Price (USD)</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-dark)", fontFamily: "monospace" }}>
                        ${selected.sellPriceUSD?.toLocaleString() || subTotalUSD.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selected.aiNotes && (
                  <div style={{ padding: "12px 30px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>
                    AI Notes: {selected.aiNotes}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 13 }}>
            Select a quote to preview
          </div>
        )}
      </div>
    </div>
  );
}
