import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, FileText, DollarSign, Building2 } from "lucide-react";
import api from "../lib/api";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
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
    api.get("/rfqs").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setCounts((c) => ({ ...c, rfqs: data.filter((r: any) => r.emailType === "customer-rfq" || r.emailType === "internal-rfq").length }));
    }).catch(() => {});
    api.get("/quotes").then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setCounts((c) => ({ ...c, quotes: data.length }));
    }).catch(() => {});
    api.get("/companies").then((res) => {
      setCounts((c) => ({ ...c, companies: res.data?.companies?.length || 0 }));
    }).catch(() => {});
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navItems: { path: string; title: string; count: number | null; icon: React.FC<{ size?: number }> }[] = [
    { path: "/crm", title: "CRM", count: counts.companies, icon: Building2 },
    { path: "/", title: "RFQ Inbox", icon: Mail, count: counts.rfqs },
    { path: "/whatsapp", title: "WhatsApp Inbox", icon: WhatsAppIcon, count: 5 },
    { path: "/rates", title: "Rates", icon: DollarSign, count: null },
    { path: "/quotes", title: "Quotes", icon: FileText, count: counts.quotes },
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
        <img src="/logo-icon.png" alt="OnePort 365" style={{ height: 28, width: "auto", filter: "brightness(10)" }} />
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
