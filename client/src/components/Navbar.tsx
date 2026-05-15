import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, MessageCircle, FileText } from "lucide-react";
import api from "../lib/api";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ rfqs: 0, quotes: 0, companies: 0 });

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

  const navItems = [
    { path: "/crm", label: "CRM", count: counts.companies, icon: null },
    { path: "/", label: "", icon: Mail, count: counts.rfqs },
    { path: "/whatsapp", label: "", icon: MessageCircle, count: 5 },
    { path: "/rates", label: "$ Rates", icon: null, count: null },
    { path: "/quotes", label: "Quotes", icon: FileText, count: counts.quotes },
  ];

  return (
    <nav style={{ height: 48, backgroundColor: "#1a2d1c", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 20, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 28, height: 28, borderRadius: 5, backgroundColor: "#3d7a2d", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>O</div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>OnePort<span style={{ color: "#7AB648" }}>365</span></span>
        </div>

        {/* Nav items */}
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <div
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "0 12px",
                height: 48,
                cursor: "pointer",
                color: active ? "#fff" : "#8a9e8a",
                fontWeight: 500,
                fontSize: 12,
                transition: "color 0.1s",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#c0d0c0"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#8a9e8a"; }}
            >
              {Icon && <Icon size={14} />}
              {item.label && <span>{item.label}</span>}
              {item.count !== null && item.count !== undefined && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 6px",
                  borderRadius: 8,
                  background: active ? "#7AB648" : "#2d5225",
                  color: active ? "#fff" : "#8a9e8a",
                  minWidth: 18,
                  textAlign: "center",
                }}>
                  {item.count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* User chip */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 10px", borderRadius: 20, border: "1px solid #2d5225" }}
        onClick={() => navigate("/settings")}
      >
        <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "#7AB648", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
          OA
        </div>
        <span style={{ color: "#c0d0c0", fontSize: 12, fontWeight: 500 }}>Okpanachi Adaji</span>
      </div>
    </nav>
  );
}
