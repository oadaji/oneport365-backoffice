import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, Users, DollarSign, FileText, Settings } from "lucide-react";

const tabs = [
  { path: "/", label: "RFQ Inbox", icon: Mail },
  { path: "/crm", label: "CRM", icon: Users },
  { path: "/rates", label: "Rates", icon: DollarSign },
  { path: "/quotes", label: "Quotes", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav style={{ height: 56, backgroundColor: "#1a2d1c", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
          <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: "#3d7a2d", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>O</div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>OnePort 365</span>
        </div>

        <div style={{ display: "flex", gap: 0, marginLeft: 24 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.path);
            return (
              <div
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  height: 56,
                  cursor: "pointer",
                  color: active ? "#7AB648" : "#8a9e8a",
                  fontWeight: active ? 600 : 500,
                  fontSize: 12,
                  borderBottom: active ? "2px solid #7AB648" : "2px solid transparent",
                  transition: "all 0.12s",
                }}
              >
                <Icon size={15} />
                {tab.label}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#2d5225", display: "flex", alignItems: "center", justifyContent: "center", color: "#7AB648", fontSize: 12, fontWeight: 600 }}>
          OA
        </div>
      </div>
    </nav>
  );
}
