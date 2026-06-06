// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import { Globe, Search, Filter, Upload, X, Building2, Phone, Mail, Globe as WebIcon, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../lib/api";

interface MarketCompany {
  _id: string;
  category: string;
  subCategory?: string;
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  services?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

interface Stats {
  stats: { _id: string; count: number }[];
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Freight Forwarder": "#3b82f6",
  "Importer / Shipper": "#8b5cf6",
  "Exporter": "#10b981",
  "Haulage or Transport": "#f59e0b",
  "Air Cargo or Express": "#06b6d4",
  "Shipping Line": "#ef4444",
  "Logistics Company": "#ec4899",
  "Terminal or Port Operator": "#6366f1",
  "Trade Services": "#84cc16",
  "Other": "#6b7280",
};

export default function Market() {
  const [companies, setCompanies] = useState<MarketCompany[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MarketCompany | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      params.set("page", String(page));
      params.set("limit", "50");

      const { data } = await api.get(`/market/companies?${params.toString()}`);
      setCompanies(data.companies);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/market/companies/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [search, category, page]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await api.post("/market/companies/import?clear=true", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`Imported ${data.imported} companies`);
      fetchCompanies();
      fetchStats();
    } catch (err: any) {
      alert("Import failed: " + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#f0f4f0" }}>
      {/* Left panel - Stats & Filters */}
      <div style={{
        width: 260,
        borderRight: "1px solid #e4e8e4",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e4e8e4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Globe size={20} color="#7AB648" />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2e1a" }}>Market</span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {stats?.total || 0} companies tracked
          </div>
        </div>

        {/* Import */}
        <div style={{ padding: 12, borderBottom: "1px solid #e4e8e4" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              background: "#f0f4f0",
              border: "1px solid #e4e8e4",
              borderRadius: 6,
              cursor: importing ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              color: "#1a2e1a",
            }}
          >
            <Upload size={14} />
            {importing ? "Importing..." : "Import Excel"}
          </button>
        </div>

        {/* Category filters */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase" }}>
            Categories
          </div>
          <div
            onClick={() => { setCategory(""); setPage(1); }}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              marginBottom: 4,
              cursor: "pointer",
              background: !category ? "#dcfce7" : "transparent",
              color: !category ? "#166534" : "#1a2e1a",
              fontSize: 13,
              fontWeight: !category ? 600 : 400,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>All</span>
            <span style={{ color: "#6b7280" }}>{stats?.total || 0}</span>
          </div>
          {stats?.stats.map((s) => (
            <div
              key={s._id}
              onClick={() => { setCategory(s._id); setPage(1); }}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                marginBottom: 4,
                cursor: "pointer",
                background: category === s._id ? "#dcfce7" : "transparent",
                color: category === s._id ? "#166534" : "#1a2e1a",
                fontSize: 13,
                fontWeight: category === s._id ? 600 : 400,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: CATEGORY_COLORS[s._id] || "#6b7280",
                }} />
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s._id}
                </span>
              </div>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center - Company list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Search bar */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e4e8e4",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#f0f4f0",
            borderRadius: 8,
            padding: "8px 12px",
          }}>
            <Search size={16} color="#6b7280" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: 13,
                color: "#1a2e1a",
              }}
            />
            {search && (
              <X
                size={14}
                color="#6b7280"
                style={{ cursor: "pointer" }}
                onClick={() => setSearch("")}
              />
            )}
          </div>
        </div>

        {/* Company list */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading...</div>
          ) : companies.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
              No companies found. Import an Excel file to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {companies.map((company) => (
                <div
                  key={company._id}
                  onClick={() => setSelected(company)}
                  style={{
                    padding: "12px 16px",
                    background: selected?._id === company._id ? "#f0fdf4" : "#fff",
                    border: `1px solid ${selected?._id === company._id ? "#7AB648" : "#e4e8e4"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1a", marginBottom: 4 }}>
                        {company.companyName}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {company.address && <span>{company.address}</span>}
                        {company.city && <span> · {company.city}</span>}
                        {company.state && <span>, {company.state}</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 10,
                      background: CATEGORY_COLORS[company.category] || "#6b7280",
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}>
                      {company.category}
                    </span>
                  </div>
                  {company.services && (
                    <div style={{ fontSize: 11, color: "#8a9e8a", marginTop: 6 }}>
                      {company.services}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid #e4e8e4",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #e4e8e4",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  opacity: page === 1 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #e4e8e4",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: page === pagination.pages ? "not-allowed" : "pointer",
                  opacity: page === pagination.pages ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel - Company detail */}
      {selected && (
        <div style={{
          width: 320,
          borderLeft: "1px solid #e4e8e4",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}>
          <div style={{
            padding: "16px",
            borderBottom: "1px solid #e4e8e4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e1a", marginBottom: 4 }}>
                {selected.companyName}
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 10,
                background: CATEGORY_COLORS[selected.category] || "#6b7280",
                color: "#fff",
              }}>
                {selected.category}
              </span>
            </div>
            <X
              size={18}
              color="#6b7280"
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(null)}
            />
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {/* Address */}
            {(selected.address || selected.city || selected.state) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                  Address
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Building2 size={14} color="#8a9e8a" style={{ marginTop: 2 }} />
                  <div style={{ fontSize: 13, color: "#1a2e1a", lineHeight: 1.5 }}>
                    {selected.address && <div>{selected.address}</div>}
                    {(selected.city || selected.state) && (
                      <div>{[selected.city, selected.state].filter(Boolean).join(", ")}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contact */}
            {(selected.contactEmail || selected.contactPhone) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                  Contact
                </div>
                {selected.contactEmail && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Mail size={14} color="#8a9e8a" />
                    <a href={`mailto:${selected.contactEmail}`} style={{ fontSize: 13, color: "#3b82f6" }}>
                      {selected.contactEmail}
                    </a>
                  </div>
                )}
                {selected.contactPhone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Phone size={14} color="#8a9e8a" />
                    <a href={`tel:${selected.contactPhone}`} style={{ fontSize: 13, color: "#3b82f6" }}>
                      {selected.contactPhone}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Website */}
            {selected.website && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                  Website
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <WebIcon size={14} color="#8a9e8a" />
                  <a
                    href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "#3b82f6" }}
                  >
                    {selected.website}
                  </a>
                </div>
              </div>
            )}

            {/* Services */}
            {selected.services && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                  Services
                </div>
                <div style={{ fontSize: 13, color: "#1a2e1a", lineHeight: 1.5 }}>
                  {selected.services}
                </div>
              </div>
            )}

            {/* Notes */}
            {selected.notes && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>
                  Notes
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, fontStyle: "italic" }}>
                  {selected.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
