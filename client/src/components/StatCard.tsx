import React from "react";

interface StatCardProps {
  value: string | number;
  label: string;
  note?: string;
  noteType?: "up" | "warn" | "danger";
}

export default function StatCard({ value, label, note, noteType = "up" }: StatCardProps) {
  const noteColor = noteType === "warn" ? "var(--warn)" : noteType === "danger" ? "var(--danger)" : "var(--accent-dark)";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text3)" }}>{label}</div>
      {note && <div style={{ fontSize: 10, marginTop: 4, fontWeight: 500, color: noteColor }}>{note}</div>}
    </div>
  );
}
