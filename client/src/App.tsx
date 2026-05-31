import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import RfqInbox from "./pages/RfqInbox";
import CRM from "./pages/CRM";
import Rates from "./pages/Rates";
import Quotes from "./pages/Quotes";
import SettingsPage from "./pages/SettingsPage";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import Shipments from "./pages/Shipments";
import ShipmentDetail from "./pages/ShipmentDetail";
import CustomerProfile from "./pages/CustomerProfile";
import api from "./lib/api";

function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { password });
      localStorage.setItem("app-token", data.token);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1a2d1c 0%, #2d5225 100%)",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px", width: 360,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a2d1c", marginBottom: 4 }}>
            OnePort 365
          </div>
          <div style={{ fontSize: 13, color: "#8a9e8a" }}>
            Backoffice
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            style={{
              width: "100%", padding: "12px 16px", fontSize: 14,
              border: `1px solid ${error ? "#dc2626" : "#e4e8e4"}`,
              borderRadius: 8, outline: "none", fontFamily: "Inter, sans-serif",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 600,
            background: "#7AB648", color: "#fff", border: "none", borderRadius: 8,
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const [authed, setAuthed] = useState<boolean | null>(isDev ? true : null);

  useEffect(() => {
    if (isDev) return; // Skip auth check on localhost
    const token = localStorage.getItem("app-token");
    if (!token) {
      setAuthed(false);
      return;
    }
    // Verify token is still valid with a lightweight API call
    api.get("/health")
      .then(() => setAuthed(true))
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("app-token");
          setAuthed(false);
        } else {
          // Network error or server down — assume authed, let app handle it
          setAuthed(true);
        }
      });
  }, [isDev]);

  // Loading state while checking auth
  if (authed === null) return null;

  if (!authed) return <LoginScreen />;

  return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", overflow: "hidden" }}>
      <Navbar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={<RfqInbox />} />
          <Route path="/whatsapp" element={<WhatsAppInbox />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/shipments" element={<Shipments />} />
          <Route path="/shipments/view/:id" element={<ShipmentDetail />} />
          <Route path="/customers/:name" element={<CustomerProfile />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
