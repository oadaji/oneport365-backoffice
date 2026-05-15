import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  selectedId?: string;
  emptyMessage?: string;
  title?: string;
}

export default function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  onRowClick,
  selectedId,
  emptyMessage = "No data",
  title,
}: DataTableProps<T>) {
  return (
    <div style={{
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      flex: 1,
    }}>
      {title && (
        <div style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    color: "var(--text3)",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                    background: "#f8faf8",
                    whiteSpace: "nowrap",
                    position: "sticky",
                    top: 0,
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const itemId = item._id || item.id || "";
                const isSelected = selectedId === itemId;
                return (
                  <tr
                    key={itemId}
                    onClick={() => onRowClick?.(item)}
                    style={{
                      cursor: onRowClick ? "pointer" : "default",
                      background: isSelected ? "#eef6e6" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#f8faf8";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "";
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "9px 14px",
                          borderBottom: "1px solid var(--border)",
                          color: "var(--text2)",
                          verticalAlign: "middle",
                        }}
                      >
                        {col.render ? col.render(item) : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
