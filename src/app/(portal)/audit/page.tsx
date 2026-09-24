"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { Search, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";

export default function StaffAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(5);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetch("/api/audit?limit=200").then((r) => r.json());
        if (d.error) throw new Error(d.error);
        setLogs(d.logs || []);
      } catch (e: any) {
        toast.error(e.message || "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        (l.description || "").toLowerCase().includes(q) ||
        (l.user_name || l.userName || "").toLowerCase().includes(q) ||
        (l.action || "").toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="max-w-5xl space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Permanent record of all staff and admin actions.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Search action, user, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-white text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <ScrollText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No audit logs found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.slice(0, limit).map((l) => (
              <div
                key={l.id}
                className="bg-white rounded-xl border border-border p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-navy-900">{l.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.user_name || l.userName || "System"} · {l.role || ""} ·{" "}
                      {l.action}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(l.created_date || l.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(limit, filtered.length)} of {filtered.length}
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
                      : "bg-white text-muted-foreground border-border"
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
  );
}
