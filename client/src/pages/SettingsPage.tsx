import React from "react";

export default function SettingsPage() {
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Settings</div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Application configuration</div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 20 }}>
        <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: 40 }}>
          Settings page coming soon — email accounts, API keys, and integration config.
        </div>
      </div>
    </div>
  );
}
