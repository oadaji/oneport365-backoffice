import React, { useState } from "react";
import { Send, MessageCircle } from "lucide-react";

interface WaContact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  date: string;
  status: string;
  unread?: boolean;
  messages: WaMessage[];
  fields: { k: string; v: string; ok: boolean }[];
  missingFields: string[];
  ref: string;
}

interface WaMessage {
  id: string;
  text: string;
  time: string;
  from: "customer" | "agent";
}

const QUOTE_REQUIRED = ["Company", "Contact", "Email", "Commodity", "HS Code", "Tonnage", "Volume", "POL", "POD", "Container"];

// Demo data
const DEMO_CONTACTS: WaContact[] = [
  {
    id: "1", name: "Amaka Obi", phone: "+234 801 234 5678", lastMessage: "pls I need rate for china to lagos 2 containers", date: "26 Apr",
    status: "info_needed", ref: "RFQ-2605-0905",
    messages: [
      { id: "m1", text: "Hello good morning", time: "02:44", from: "customer" },
      { id: "m2", text: "pls I need rate for china to lagos 2 containers", time: "02:45", from: "customer" },
      { id: "m3", text: "my goods are in guangzhou, ceramic tiles", time: "02:46", from: "customer" },
      { id: "m4", text: "i want to use 40ft, when can you give me price?", time: "02:47", from: "customer" },
    ],
    fields: [
      { k: "Contact", v: "Amaka Obi", ok: true },
      { k: "Email", v: "23480123...", ok: true },
      { k: "Commodity", v: "Ceramic tiles", ok: true },
      { k: "POL", v: "Guangzhou, China (CNSHA)", ok: true },
      { k: "POD", v: "Lagos, Nigeria (NGAPP)", ok: true },
      { k: "Container", v: "40FT × 2", ok: true },
      { k: "Cargo class", v: "General Cargo", ok: true },
      { k: "Phone", v: "+234 801 234 5678", ok: true },
    ],
    missingFields: ["Company", "HS Code", "Tonnage", "Volume", "Pick-up", "Incoterm"],
  },
  {
    id: "2", name: "Bello Musa", phone: "+234 802 345 6789", lastMessage: "Good morning, how much to ship...", date: "26 Apr",
    status: "info_needed", ref: "RFQ-2605-0906",
    messages: [
      { id: "m1", text: "Good morning", time: "08:10", from: "customer" },
      { id: "m2", text: "how much to ship 20ft container from Shanghai to Apapa?", time: "08:11", from: "customer" },
    ],
    fields: [
      { k: "Contact", v: "Bello Musa", ok: true },
      { k: "POL", v: "Shanghai (CNSHA)", ok: true },
      { k: "POD", v: "Apapa (NGAPP)", ok: true },
      { k: "Container", v: "20FT", ok: true },
    ],
    missingFields: ["Company", "Email", "Commodity", "HS Code", "Tonnage", "Volume"],
  },
  {
    id: "3", name: "Fatima Al-Hassan", phone: "+234 803 456 7890", lastMessage: "Hello OnePort team I want to ship...", date: "26 Apr",
    status: "ready", ref: "RFQ-2605-0907",
    messages: [
      { id: "m1", text: "Hello OnePort team I want to ship electronics from Shenzhen to Tin Can", time: "10:20", from: "customer" },
      { id: "m2", text: "40HC container, about 25 tonnes, HS code 8471.30", time: "10:21", from: "customer" },
      { id: "m3", text: "Hi Fatima! Thanks for reaching out. Let me get a rate for you. Can you confirm the pickup address in Shenzhen?", time: "10:35", from: "agent" },
      { id: "m4", text: "Yes pickup from Futian Free Trade Zone", time: "10:40", from: "customer" },
    ],
    fields: [
      { k: "Company", v: "Al-Hassan Electronics", ok: true },
      { k: "Contact", v: "Fatima Al-Hassan", ok: true },
      { k: "Email", v: "fatima@alhassan.ng", ok: true },
      { k: "Commodity", v: "Electronics", ok: true },
      { k: "HS Code", v: "8471.30", ok: true },
      { k: "Tonnage", v: "25 MT", ok: true },
      { k: "Volume", v: "65 CBM", ok: true },
      { k: "POL", v: "Shenzhen, China (CNSHA)", ok: true },
      { k: "POD", v: "Tin Can (NGTCN)", ok: true },
      { k: "Container", v: "40HC", ok: true },
      { k: "Pick-up", v: "Futian Free Trade Zone", ok: true },
    ],
    missingFields: [],
  },
  {
    id: "4", name: "Chukwuemeka Eze", phone: "+234 804 567 8901", lastMessage: "good morning how much to ship ...", date: "25 Apr",
    status: "info_needed", ref: "RFQ-2605-0908",
    messages: [
      { id: "m1", text: "good morning how much to ship building materials from Turkey to Lagos", time: "09:15", from: "customer" },
    ],
    fields: [
      { k: "Contact", v: "Chukwuemeka Eze", ok: true },
      { k: "Commodity", v: "Building materials", ok: true },
      { k: "POL", v: "Turkey (TRIST)", ok: true },
      { k: "POD", v: "Lagos (NGAPP)", ok: true },
    ],
    missingFields: ["Company", "Email", "HS Code", "Tonnage", "Volume", "Container"],
  },
  {
    id: "5", name: "Ngozi Traders", phone: "+234 805 678 9012", lastMessage: "Hello I want to import goods from...", date: "25 Apr",
    status: "info_needed", ref: "RFQ-2605-0909",
    messages: [
      { id: "m1", text: "Hello I want to import goods from India to Onne port", time: "14:30", from: "customer" },
      { id: "m2", text: "rice and spices, about 3 containers", time: "14:31", from: "customer" },
    ],
    fields: [
      { k: "Contact", v: "Ngozi Traders", ok: true },
      { k: "Commodity", v: "Rice and spices", ok: true },
      { k: "POL", v: "India (INNSZ)", ok: true },
      { k: "POD", v: "Onne (NGONE)", ok: true },
      { k: "Container", v: "3 units", ok: true },
    ],
    missingFields: ["Company", "Email", "HS Code", "Tonnage", "Volume"],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function avatarColor(name: string) {
  const colors = ["#dcfce7", "#dbeafe", "#fef3c7", "#ede9fe", "#fee2e2", "#d1fae5", "#fce7f3", "#e0f2fe"];
  const textColors = ["#166534", "#1e40af", "#92400e", "#5b21b6", "#991b1b", "#065f46", "#9d174d", "#0369a1"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return { bg: colors[idx], color: textColors[idx] };
}

function statusLabel(status: string) {
  if (status === "ready") return { cls: "b-ok", text: "✓ ready" };
  return { cls: "b-miss", text: "⚠ info needed" };
}

function fieldObj(fields: { k: string; v: string; ok: boolean }[], key: string) {
  return fields.find((x) => x.k.toLowerCase().includes(key.toLowerCase()));
}

function detectDirection(fields: { k: string; v: string; ok: boolean }[]): string {
  const pod = (fieldObj(fields, "pod")?.v || "").toLowerCase();
  if (pod.includes("nigeria") || pod.includes("ngapp") || pod.includes("ngtcn") || pod.includes("ngone") || pod.includes("lagos")) return "Import → Nigeria";
  return "Cross-trade";
}

export default function WhatsAppInbox() {
  const [contacts] = useState<WaContact[]>(DEMO_CONTACTS);
  const [selected, setSelected] = useState<WaContact | null>(null);
  const [reply, setReply] = useState("");

  const getReadiness = (fields: { k: string; v: string; ok: boolean }[]) => {
    let filled = 0;
    QUOTE_REQUIRED.forEach((key) => {
      const f = fieldObj(fields, key);
      if (f && f.ok) filled++;
    });
    return { filled, total: QUOTE_REQUIRED.length };
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ===== LEFT: CONTACT SIDEBAR ===== */}
      <div style={{ width: 280, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <button onClick={() => { window.location.href = "/"; }} style={{
              padding: "2px 6px", fontSize: 10, fontWeight: 500, background: "none", border: "1px solid var(--border)",
              borderRadius: 4, cursor: "pointer", color: "var(--text3)", fontFamily: "Inter, sans-serif",
            }}>← RFQ</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>WhatsApp Business</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} />
            +234 XXX XXX XXXX · not connected
          </div>
        </div>

        <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>RFQ Conversations</div>
          <MessageCircle size={14} color="var(--accent)" />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {contacts.map((c) => {
            const isSelected = selected?.id === c.id;
            const av = avatarColor(c.name);
            const st = statusLabel(c.status);
            return (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: isSelected ? "#eef6e6" : "var(--surface)",
                  borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f8faf8"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initials(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text3)", flexShrink: 0 }}>{c.date}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                    {c.lastMessage}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <span className="badge b-rate" style={{ fontSize: 9 }}>Customer RFQ</span>
                    <span className={`badge ${st.cls}`} style={{ fontSize: 9 }}>{st.text}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== CENTER: CHAT VIEW ===== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ece5dd" }}>
        {selected ? (
          <>
            {/* Chat header */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(selected.name).bg, color: avatarColor(selected.name).color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                  {initials(selected.name)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{selected.name}</div>
                  <div style={{ fontSize: 10, color: "var(--accent)" }}>online</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="badge b-rate">RFQ</span>
                <span className={`badge ${statusLabel(selected.status).cls}`}>{statusLabel(selected.status).text}</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 60px" }}>
              {selected.messages.map((msg) => (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.from === "agent" ? "flex-start" : "flex-end", marginBottom: 8 }}>
                  <div style={{
                    maxWidth: "70%",
                    padding: "8px 12px",
                    borderRadius: msg.from === "agent" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                    background: msg.from === "agent" ? "#dcf8c6" : "#ffffff",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                    position: "relative",
                  }}>
                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{msg.text}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "right", marginTop: 2 }}>{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply input */}
            <div style={{ padding: "8px 16px", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply..."
                style={{ flex: 1, padding: "10px 14px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 24, outline: "none", fontFamily: "Inter, sans-serif", background: "var(--bg)" }}
                onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) setReply(""); }}
              />
              <button style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={16} color="#fff" />
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 13 }}>
            Select a conversation to view
          </div>
        )}
      </div>

      {/* ===== RIGHT: EXTRACTION PANEL ===== */}
      <div style={{ width: 300, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0, overflow: "hidden" }}>
        {selected ? (
          <>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8faf8" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Extracted Details</span>
              <span className="badge b-ok" style={{ fontFamily: "monospace", fontSize: 10 }}>{selected.ref}</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
              {/* Direction */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span className="badge b-ok">🔻 {detectDirection(selected.fields)}</span>
              </div>

              {/* Quote readiness */}
              {(() => {
                const { filled, total } = getReadiness(selected.fields);
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quote Readiness</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: filled === total ? "var(--accent-dark)" : "var(--warn)" }}>{filled}/{total}</span>
                    </div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(filled / total) * 100}%`, background: filled === total ? "var(--accent)" : "var(--warn)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })()}

              {/* Field checklist */}
              {QUOTE_REQUIRED.map((key) => {
                const f = fieldObj(selected.fields, key);
                const hasValue = f && f.ok;
                const value = f?.v || "";
                const isMissing = !hasValue;
                return (
                  <div key={key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "6px 8px", marginBottom: 2, borderRadius: 6,
                    background: isMissing ? "#fffbeb" : "transparent",
                    border: isMissing ? "1px solid #fde68a" : "1px solid transparent",
                  }}>
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : "var(--text3)", fontWeight: 500 }}>{key}</span>
                    <span style={{ fontSize: 11, color: isMissing ? "var(--warn)" : "var(--text)", fontWeight: 500, textAlign: "right", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isMissing ? "⚠ missing" : `✓ ${value}`}
                    </span>
                  </div>
                );
              })}

              {/* Additional details */}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Additional Details</div>
              {selected.fields
                .filter((f) => !QUOTE_REQUIRED.some((rk) => f.k.toLowerCase().includes(rk.toLowerCase())))
                .map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                    <span style={{ color: "var(--text3)", fontSize: 10 }}>{f.k}</span>
                    <span style={{ color: f.ok ? "var(--text)" : "var(--warn)", fontWeight: 500 }}>{f.ok ? `✓ ${f.v}` : "not specified"}</span>
                  </div>
                ))}

              {/* Missing info */}
              {selected.missingFields.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 6px" }}>Missing Info</div>
                  {selected.missingFields.map((m, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#92400e", padding: "4px 8px", background: "#fffbeb", borderLeft: "3px solid var(--warn)", marginBottom: 4, borderRadius: "0 4px 4px 0" }}>
                      ⚠ {m}
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text3)", fontSize: 12 }}>
            No conversation selected
          </div>
        )}
      </div>
    </div>
  );
}
