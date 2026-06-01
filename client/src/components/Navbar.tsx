// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, DollarSign, Building2, Ship, Brain } from "lucide-react";
import api from "../lib/api";

function RfqIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Email envelope */}
      <rect x="2" y="4" width="12" height="10" rx="1.5" />
      <path d="M2 6l6 4 6-4" />
      {/* WhatsApp bubble */}
      <circle cx="18" cy="15" r="5.5" strokeWidth="1.6" />
      <path d="M15.8 20l.6-2.2" strokeWidth="1.4" />
      <path d="M16.5 14a1.5 1.5 0 0 1 1.5 1.5c0 .5-.3.9-.7 1.1l-.3.4v.5" strokeWidth="1.3" />
    </svg>
  );
}

function NavTooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "absolute",
      left: "calc(100% + 10px)",
      top: "50%",
      transform: "translateY(-50%)",
      backgroundColor: "#111",
      color: "#fff",
      fontSize: 12,
      fontWeight: 500,
      padding: "5px 10px",
      borderRadius: 6,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: 1000,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>
      {label}
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ rfqs: 0, quotes: 0, companies: 0 });
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  useEffect(() => {
    api.get("/rfqs").then((res: any) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setCounts((c) => ({ ...c, rfqs: data.filter((r: any) => r.emailType === "customer-rfq" || r.emailType === "internal-rfq").length }));
    }).catch(() => {});
    api.get("/quotes").then((res: any) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setCounts((c) => ({ ...c, quotes: data.length }));
    }).catch(() => {});
    api.get("/companies").then((res: any) => {
      setCounts((c) => ({ ...c, companies: (res.data as any)?.companies?.length || 0 }));
    }).catch(() => {});
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navItems: { path: string; title: string; count: number | null; icon: React.FC<{ size?: number }> }[] = [
    { path: "/crm", title: "CRM", count: counts.companies, icon: Building2 },
    { path: "/", title: "RFQ", icon: RfqIcon, count: counts.rfqs },
    { path: "/rates", title: "Rates", icon: DollarSign, count: null },
    { path: "/quotes", title: "Quotes", icon: FileText, count: counts.quotes },
    { path: "/shipments", title: "Shipments", icon: Ship, count: null },
    { path: "/brain", title: "Brain", icon: Brain, count: null },
  ];

  return (
    <nav style={{
      width: 52,
      backgroundColor: "#1a2d1c",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 12,
      flexShrink: 0,
      height: "100vh",
      boxSizing: "border-box",
    }}>
      {/* Logo */}
      <div
        style={{ marginBottom: 20, cursor: "pointer", padding: 4 }}
        onClick={() => navigate("/")}
      >
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
          {/* Speed lines */}
          <line x1="2" y1="42" x2="28" y2="42" stroke="#7AB648" strokeWidth="4" strokeLinecap="round"/>
          <line x1="6" y1="50" x2="30" y2="50" stroke="#7AB648" strokeWidth="4" strokeLinecap="round"/>
          <line x1="2" y1="58" x2="28" y2="58" stroke="#7AB648" strokeWidth="4" strokeLinecap="round"/>
          {/* Outer hexagon */}
          <path d="M55 12 L85 27 L85 57 L55 72 L25 57 L25 27 Z" stroke="#7AB648" strokeWidth="5" fill="none"/>
          {/* Inner cube - front face */}
          <path d="M55 35 L72 44 L72 62 L55 71 L38 62 L38 44 Z" stroke="#7AB648" strokeWidth="4" fill="none"/>
          {/* Inner cube - top line */}
          <path d="M55 35 L55 52 M38 44 L55 52 L72 44" stroke="#7AB648" strokeWidth="3.5" fill="none"/>
          {/* Inner cube - vertical */}
          <path d="M55 52 L55 71" stroke="#7AB648" strokeWidth="3.5"/>
        </svg>
      </div>

      {/* Nav items */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                cursor: "pointer",
                color: active ? "#fff" : "#8a9e8a",
                backgroundColor: active ? "#2d5225" : "transparent",
                transition: "background-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                setHoveredPath(item.path);
                if (!active) {
                  e.currentTarget.style.backgroundColor = "#243d1f";
                  e.currentTarget.style.color = "#c0d0c0";
                }
              }}
              onMouseLeave={(e) => {
                setHoveredPath(null);
                if (!active) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#8a9e8a";
                }
              }}
            >
              <Icon size={18} />
              {item.count !== null && item.count !== undefined && item.count > 0 && (
                <span style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  fontSize: 8,
                  fontWeight: 700,
                  padding: "0px 4px",
                  borderRadius: 6,
                  background: "#7AB648",
                  color: "#fff",
                  minWidth: 14,
                  textAlign: "center",
                  lineHeight: "14px",
                }}>
                  {item.count}
                </span>
              )}
              <NavTooltip label={item.title} visible={hoveredPath === item.path} />
            </div>
          );
        })}
      </div>

      {/* Bottom section: Live + Settings */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span
          style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#7AB648", display: "inline-block" }}
          title="Live"
        />
        <div
          onClick={() => navigate("/settings")}
          style={{
            position: "relative",
            width: 32,
            height: 32,
            borderRadius: "50%",
            backgroundColor: isActive("/settings") ? "#7AB648" : "#2d5225",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            setHoveredPath("/settings");
            if (!isActive("/settings")) e.currentTarget.style.backgroundColor = "#3d6a2d";
          }}
          onMouseLeave={(e) => {
            setHoveredPath(null);
            if (!isActive("/settings")) e.currentTarget.style.backgroundColor = "#2d5225";
          }}
        >
          S
          <NavTooltip label="Settings" visible={hoveredPath === "/settings"} />
        </div>
      </div>
    </nav>
  );
}
