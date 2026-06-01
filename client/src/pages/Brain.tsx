// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Building2, Ship, DollarSign, FileText, Loader2 } from "lucide-react";
import api from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { type: string; label: string }[];
}

const SUGGESTED_QUERIES = [
  { icon: Building2, label: "Tell me everything about Dangote", category: "Company" },
  { icon: Ship, label: "Show me all active shipments this month", category: "Operations" },
  { icon: DollarSign, label: "What are current rates for Lagos to Antwerp?", category: "Rates" },
  { icon: FileText, label: "How many quotes were issued this week?", category: "Commercial" },
  { icon: Building2, label: "Which customers have pending RFQs?", category: "Commercial" },
  { icon: Ship, label: "Give me a summary of shipment SLA performance", category: "Operations" },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function BrainIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a6 6 0 0 0-6 6c0 1.6.6 3 1.7 4.1L12 16l4.3-3.9A6 6 0 0 0 18 8a6 6 0 0 0-6-6z" />
      <path d="M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      <path d="M15 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      <path d="M9 8.5c0-1 .5-2 1.5-2.5" />
      <path d="M15 8.5c0-1-.5-2-1.5-2.5" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
    </svg>
  );
}

export default function Brain() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const queryBrain = async (query: string) => {
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: query.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Gather context from all available data sources
      const [rfqsRes, quotesRes, companiesRes] = await Promise.allSettled([
        api.get("/rfqs"),
        api.get("/quotes"),
        api.get("/companies"),
      ]);

      const rfqs = rfqsRes.status === "fulfilled" ? (rfqsRes.value.data as any[]) || [] : [];
      const quotes = quotesRes.status === "fulfilled" ? (quotesRes.value.data as any[]) || [] : [];
      const companies = companiesRes.status === "fulfilled" ? (companiesRes.value.data as any)?.companies || [] : [];

      // Build context summary for Claude
      const context = buildContext(rfqs, quotes, companies);

      const { data } = await api.post("/brain/query", {
        query: query.trim(),
        context,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: (data as any).answer || "I couldn't find relevant information for that query.",
        timestamp: new Date(),
        sources: (data as any).sources || [],
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your query. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const buildContext = (rfqs: any[], quotes: any[], companies: any[]) => {
    const rfqSummary = rfqs.slice(0, 50).map(r => ({
      ref: r.ref,
      status: r.status,
      type: r.emailType,
      customer: r.resolvedSenderName || r.email?.fromName,
      company: r.company?.name,
      fields: r.fields?.reduce((acc: any, f: any) => { acc[f.k] = f.v; return acc; }, {}),
      createdAt: r.createdAt,
    }));

    const quoteSummary = quotes.slice(0, 30).map(q => ({
      ref: q.ref || q._id,
      customer: q.customerName,
      company: q.companyName,
      amount: q.totalAmount,
      status: q.status,
      createdAt: q.createdAt,
    }));

    const companySummary = companies.slice(0, 30).map((c: any) => ({
      name: c.name,
      contactCount: c.contacts?.length || 0,
      rfqCount: c.rfqCount || 0,
    }));

    return { rfqs: rfqSummary, quotes: quoteSummary, companies: companySummary };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      queryBrain(input);
    }
  };

  const isEmptyState = messages.length === 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "linear-gradient(135deg, #1a2d1c 0%, #2d5225 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#7AB648",
        }}>
          <Sparkles size={18} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>OnePort 365 Brain</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>AI assistant for Commercial, Finance and Operations</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "6px 14px",
              borderRadius: 6, background: "none", border: "1px solid var(--border)",
              color: "var(--text3)", cursor: "pointer",
            }}
          >
            New Chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
        {isEmptyState ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", padding: "40px 20px",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: "linear-gradient(135deg, #1a2d1c 0%, #2d5225 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <Sparkles size={28} color="#7AB648" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              What would you like to know?
            </div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 32, textAlign: "center", maxWidth: 400 }}>
              Ask about customers, shipments, rates, quotes, or any business intelligence across OnePort 365.
            </div>

            {/* Suggested queries grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              maxWidth: 560, width: "100%",
            }}>
              {SUGGESTED_QUERIES.map((sq, i) => {
                const Icon = sq.icon;
                return (
                  <div
                    key={i}
                    onClick={() => { setInput(sq.label); queryBrain(sq.label); }}
                    style={{
                      padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                      border: "1px solid var(--border)", background: "var(--surface)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#7AB648"; e.currentTarget.style.background = "var(--bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Icon size={14} color="#7AB648" />
                      <span style={{ fontSize: 9, fontWeight: 600, color: "#7AB648", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {sq.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
                      {sq.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: "flex", gap: 12, marginBottom: 20,
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: msg.role === "user" ? "var(--accent)" : "linear-gradient(135deg, #1a2d1c 0%, #2d5225 100%)",
                  color: msg.role === "user" ? "#fff" : "#7AB648",
                  fontSize: 11, fontWeight: 700,
                }}>
                  {msg.role === "user" ? "Y" : <Sparkles size={14} />}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: "75%", padding: "12px 16px", borderRadius: 12,
                  background: msg.role === "user" ? "var(--accent)" : "var(--surface)",
                  color: msg.role === "user" ? "#fff" : "var(--text)",
                  border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {msg.sources.map((s, i) => (
                        <span key={i} style={{
                          fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                          background: "var(--bg)", color: "var(--text3)", border: "1px solid var(--border)",
                        }}>
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{
                    fontSize: 9, color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "var(--text3)",
                    marginTop: 6, textAlign: msg.role === "user" ? "right" : "left",
                  }}>
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg, #1a2d1c 0%, #2d5225 100%)",
                  color: "#7AB648",
                }}>
                  <Sparkles size={14} />
                </div>
                <div style={{
                  padding: "14px 18px", borderRadius: 12,
                  background: "var(--surface)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}>
                    <Loader2 size={16} color="var(--text3)" />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: "16px 24px", borderTop: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          display: "flex", gap: 10, alignItems: "flex-end",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about customers, shipments, rates, operations..."
            rows={1}
            style={{
              flex: 1, padding: "12px 16px", fontSize: 13,
              border: "1px solid var(--border)", borderRadius: 10,
              outline: "none", resize: "none", fontFamily: "Inter, sans-serif",
              color: "var(--text)", background: "var(--bg)",
              minHeight: 44, maxHeight: 120,
              lineHeight: 1.5,
            }}
            onFocus={e => e.currentTarget.style.borderColor = "#7AB648"}
            onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
          />
          <button
            onClick={() => queryBrain(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: 10, border: "none",
              background: input.trim() && !loading ? "#7AB648" : "var(--border)",
              color: input.trim() && !loading ? "#fff" : "var(--text3)",
              cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <div style={{
          maxWidth: 720, margin: "6px auto 0", textAlign: "center",
          fontSize: 10, color: "var(--text3)",
        }}>
          OnePort 365 Brain queries your RFQs, quotes, companies, and shipment data in real-time.
        </div>
      </div>
    </div>
  );
}
