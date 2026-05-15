import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import RfqInbox from "./pages/RfqInbox";
import CRM from "./pages/CRM";
import Rates from "./pages/Rates";
import Quotes from "./pages/Quotes";
import SettingsPage from "./pages/SettingsPage";
import WhatsAppInbox from "./pages/WhatsAppInbox";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Routes>
          <Route path="/" element={<RfqInbox />} />
          <Route path="/whatsapp" element={<WhatsAppInbox />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/rates" element={<Rates />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}
