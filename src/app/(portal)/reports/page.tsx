"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Search,
  Loader2,
  FileText,
  Plus,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface ReportRow {
  id: string;
  reportDate: string;
  shift: string;
  adminName?: string | null;
  techName?: string | null;
  status: string;
  followUp?: string | null;
  createdAt: string;
  createdByName?: string;
}

export default function StaffGamingReportsPage() {
  const { branchId } = useBranch();
  const user = usePortalUser();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [delTarget, setDelTarget] = useState<ReportRow | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    const params = new URLSearchParams({
      branchId,
      limit: String(limit),
    });
    if (dateFilter) params.set("date", dateFilter);
    if (search.trim()) params.set("q", search.trim());

    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports || []);
        setTotal(d.total || 0);
      })
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [branchId, dateFilter, search, limit]);

  const canCreate = ["admin", "counter_admin", "computer_tech", "team_leader", "super_admin", "management"].includes(
    user?.role || ""
  );
  const canManage = ["super_admin", "management", "admin"].includes(user?.role || "");
  const hasFilters = Boolean(dateFilter || search.trim());

  const latest = reports.length
    ? formatDate(
        [...reports].sort((a, b) =>
          String(b.reportDate || "").localeCompare(String(a.reportDate || ""))
        )[0].reportDate
      )
    : "—";

  const handleDeleteRow = async () => {
    if (!delTarget) return;
    setDeletingRow(true);
    try {
      const res = await fetch(`/api/reports/${delTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete report.");
      toast.success("Report deleted", { description: "The report has been removed." });
      setReports((prev) => prev.filter((x) => x.id !== delTarget.id));
      setDelTarget(null);
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeletingRow(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-5 pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#071E4C] to-[#1458C7] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-white/70">
              REPORT ARCHIVE
            </p>
            <h2 className="text-xl font-bold mt-1">Gaming Hub Reports</h2>
            <p className="text-sm text-white/70 mt-1">
              Browse saved daily shift reports. Click View to open the full report.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/reports/new"
              className="inline-flex items-center gap-2 bg-white text-[#1458C7] font-semibold px-4 h-10 rounded-lg text-sm hover:bg-white/90"
            >
              <Plus className="w-4 h-4" /> New Report
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <label htmlFor="report-date-filter" className="text-xs text-muted-foreground">
            Specific date
          </label>
          <input
            id="report-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="block h-9 w-full sm:w-auto rounded-lg border border-border bg-white px-3 text-sm mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="report-search" className="text-xs text-muted-foreground">
            Search
          </label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="report-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search date, shift, admin, tech, follow-up..."
              className="block w-full h-9 rounded-lg border border-border bg-white pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDateFilter("");
            setSearch("");
          }}
          className="h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-60"
          disabled={!hasFilters}
        >
          Clear
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total reports" value={reports.length} />
        <Stat label="Selected date" value={dateFilter || "All dates"} />
        <Stat label="Latest report" value={latest} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-navy-900">No report matches this view</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasFilters
                ? "Try clearing your filters or search terms to see earlier shift reports."
                : "No saved reports are available yet for this branch."}
            </p>
            {canCreate && !hasFilters && (
              <Link
                href="/reports/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                <Plus className="w-4 h-4" /> Create first report
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Shift</th>
                    <th className="text-left px-4 py-3 font-medium">Admin</th>
                    <th className="text-left px-4 py-3 font-medium">Tech</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Saved</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-navy-900">
                        {formatDate(r.reportDate)}
                      </td>
                      <td className="px-4 py-3">{r.shift}</td>
                      <td className="px-4 py-3">{r.adminName || "—"}</td>
                      <td className="px-4 py-3">{r.techName || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            r.status === "submitted"
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {r.status === "submitted" ? "Submitted" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Link
                            href={`/reports/${r.id}`}
                            className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold hover:underline"
                          >
                            <Eye className="w-4 h-4" /> View
                          </Link>
                          {r.status === "draft" && (
                            <Link
                              href={`/reports/new?edit=${r.id}`}
                              className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold hover:underline"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Link>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDelTarget(r)}
                              className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold hover:underline"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Showing {reports.length} of {total}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows</span>
                {[5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLimit(n)}
                    className={`h-7 px-2.5 rounded-md text-xs font-medium border ${
                      limit === n
                        ? "bg-navy-700 text-white border-navy-700"
                        : "bg-white text-muted-foreground border-border hover:border-navy-400"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm delete */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-navy-900">Delete Report</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete this{" "}
              {delTarget.status === "draft" ? "draft " : ""}
              report? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={deletingRow}
                onClick={() => setDelTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deletingRow}
                onClick={handleDeleteRow}
              >
                {deletingRow ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="block text-lg font-bold text-navy-900 mt-1 truncate">
        {value}
      </strong>
    </div>
  );
}
