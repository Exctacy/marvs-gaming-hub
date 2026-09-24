"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReportSection from "@/components/reports/ReportSection";
import { Button } from "@/components/ui/button";
import { DEFECT_TYPES, PERIPHERAL_CATEGORIES, noDefectList } from "@/lib/gamingReportData";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePortalUser } from "@/components/layout/portal-shell";

const sigName = (sig: any) =>
  sig ? (typeof sig === "string" ? sig : sig.name || null) : null;
const sigImage = (sig: any) =>
  sig && typeof sig === "object" ? sig.image_url || null : null;

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = usePortalUser();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const d = await fetch(`/api/reports/${id}`).then((r) => r.json());
        setReport(d.report);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const canManage = ["super_admin", "management", "admin"].includes(user?.role || "");
  const canDeleteDraft = ["counter_admin", "computer_tech", "team_leader"].includes(
    user?.role || ""
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // PDF export will be wired in a follow-up; placeholder toast for now
      const { downloadGamingReportPdf } = await import("@/lib/gamingReportPdf");
      await downloadGamingReportPdf(report);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message || "PDF export not available yet");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete report.");
      toast.success("Report deleted", { description: "The report has been removed." });
      router.push("/reports");
    } catch (e: any) {
      setConfirmDelete(false);
      toast.error("Delete failed", { description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Report not found.</p>
        <Link href="/reports" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
          Back to reports
        </Link>
      </div>
    );
  }

  const d = report.reportData || {};
  const isDraft = report.status === "draft";
  const nd = noDefectList(d);
  const hasDefects = DEFECT_TYPES.some(
    ({ storeKey }) => (d[storeKey] || []).length > 0
  );
  const hasCounts = PERIPHERAL_CATEGORIES.some(({ key }) =>
    (d.peripheral_counts?.[key] || []).some((r: any) => Number(r.quantity) > 0)
  );

  return (
    <div className="max-w-4xl space-y-5 pb-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to reports
      </Link>

      <div className="flex gap-2 flex-wrap">
        {!isDraft && (
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-blue-700 hover:bg-blue-800"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
        )}
        {isDraft && (
          <Button asChild className="bg-blue-700 hover:bg-blue-800">
            <Link href={`/reports/new?edit=${report.id}`}>
              <Pencil className="w-4 h-4 mr-2" /> Edit Draft
            </Link>
          </Button>
        )}
        {(canManage || (isDraft && canDeleteDraft)) && (
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        )}
      </div>

      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#071E4C] to-[#1458C7] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] font-bold tracking-wider text-white/70">
            GAMING HUB REPORT
          </p>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isDraft
                ? "bg-amber-400/30 text-amber-100"
                : "bg-green-400/30 text-green-100"
            }`}
          >
            {isDraft ? "Draft" : "Submitted"}
          </span>
        </div>
        <h2 className="text-xl font-bold mt-1">
          {formatDate(report.reportDate)} — {report.shift} Shift
        </h2>
        <div className="flex gap-4 mt-3 text-sm text-white/80 flex-wrap">
          <span>
            Admin: <strong className="text-white">{report.adminName || "—"}</strong>
          </span>
          <span>
            Tech: <strong className="text-white">{report.techName || "—"}</strong>
          </span>
          {d.pc_range && (
            <span>
              PC Range: <strong className="text-white">{d.pc_range}</strong>
            </span>
          )}
        </div>
      </div>

      {(report.changes || "").trim() && (
        <ReportSection title="Changes">
          <p className="text-sm whitespace-pre-wrap text-navy-900">{report.changes}</p>
        </ReportSection>
      )}

      <ReportSection title="Updated Games">
        {(d.updated_games || []).length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {(d.updated_games || []).map((g: any, i: number) => (
              <li
                key={i}
                className="flex justify-between items-center text-sm py-2 border-b border-border/60 last:border-0"
              >
                <span className="font-medium text-navy-900">{g.game_name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    g.status === "Updated"
                      ? "bg-green-50 text-green-700"
                      : g.status === "Need to Check"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {g.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection title="Defective Peripherals">
        {!hasDefects ? (
          <Empty />
        ) : (
          <div className="space-y-4">
            {DEFECT_TYPES.map(({ key, label, storeKey }) =>
              (d[storeKey] || []).length > 0 ? (
                <div key={key}>
                  <p className="text-sm font-semibold text-navy-900 mb-1.5">
                    Defective {label}
                  </p>
                  <ul className="space-y-1">
                    {(d[storeKey] || []).map((x: any, i: number) => (
                      <li key={i} className="text-sm flex gap-2 flex-wrap">
                        <span className="font-semibold text-blue-700">
                          PC {x.pc || "?"}
                        </span>
                        {x.brand && (
                          <span className="text-navy-900 font-medium">({x.brand})</span>
                        )}
                        <span className="text-muted-foreground">{x.note || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}
      </ReportSection>

      <ReportSection title="PCs With No Defects">
        <PcList pcs={nd} />
      </ReportSection>

      <ReportSection title="Peripherals Count (by Brand)">
        {!hasCounts ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {PERIPHERAL_CATEGORIES.map(({ key, label }) => {
              const rows = (d.peripheral_counts?.[key] || []).filter(
                (r: any) => Number(r.quantity) > 0
              );
              if (!rows.length) return null;
              return (
                <div key={key} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-navy-900 mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {rows.map((r: any) => (
                      <div key={r.brand} className="flex justify-between text-sm">
                        <span className="text-navy-900">{r.brand}</span>
                        <span className="font-semibold text-blue-700">{r.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ReportSection>

      <ReportSection title="Spare Items">
        {(d.spare_items || []).length === 0 ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {(d.spare_items || []).map((s: any, i: number) => (
              <div
                key={i}
                className="flex justify-between bg-blue-50/60 rounded-lg p-2.5 text-sm"
              >
                <span className="font-medium text-navy-900">Spare {s.item_type}</span>
                <span className="font-semibold text-blue-700">{s.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </ReportSection>

      {(report.followUp || "").trim() && (
        <ReportSection title="Follow-up Report">
          <p className="text-sm whitespace-pre-wrap text-navy-900">{report.followUp}</p>
        </ReportSection>
      )}

      <ReportSection title="Cleaned PCs">
        <PcList pcs={d.cleaned_pcs || []} />
      </ReportSection>

      <ReportSection title="Report Sign-off">
        <div className="grid sm:grid-cols-2 gap-4">
          <SignBlock
            label="Admin"
            name={sigName(d.admin_signature) || report.adminName}
            imageUrl={sigImage(d.admin_signature)}
          />
          <SignBlock
            label="Technician"
            name={sigName(d.tech_signature) || report.techName}
            imageUrl={sigImage(d.tech_signature)}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Saved {formatDateTime(report.createdAt)} by {report.createdByName || "—"}
        </p>
      </ReportSection>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-navy-900">Delete Report</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete this report? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? (
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

function Empty() {
  return <p className="text-sm text-muted-foreground">None.</p>;
}

function PcList({ pcs }: { pcs: string[] }) {
  if (!pcs || pcs.length === 0)
    return <p className="text-sm text-muted-foreground">None.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pcs.map((n) => (
        <span
          key={n}
          className="px-2.5 h-7 inline-flex items-center rounded-lg text-xs font-semibold bg-blue-50 text-blue-700"
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function SignBlock({
  label,
  name,
  imageUrl,
}: {
  label: string;
  name: string | null;
  imageUrl: string | null;
}) {
  return (
    <div className="border-b-2 border-navy-900/20 pb-2">
      <p className="text-xs text-muted-foreground">{label} Signature</p>
      <div className="h-20 flex items-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${label} signature`}
            className="max-h-16 max-w-full object-contain"
          />
        ) : (
          <p className="font-bold text-navy-900 text-lg">{name || "—"}</p>
        )}
      </div>
      {imageUrl && <p className="font-bold text-navy-900">{name || "—"}</p>}
    </div>
  );
}
