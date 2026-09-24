"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import {
  SHIFTS,
  PERIPHERAL_CATEGORIES,
  DEFECT_TYPES,
  noDefectList,
  toneForStatus,
} from "@/lib/gamingReportData";
import { formatDate } from "@/lib/utils";
import {
  Loader2,
  PieChart,
  Cpu,
  ShieldCheck,
  Flag,
  Gamepad2,
  FileDown,
  FileText,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import SignaturePad, { SignaturePadHandle } from "@/components/reports/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const todayISO = () => new Date().toLocaleDateString("en-CA");
const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

export default function StaffHubOverviewPage() {
  const { branchId } = useBranch();
  const user = usePortalUser();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const signPadRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    fetch(`/api/reports?branchId=${branchId}&limit=500&status=submitted&includeData=1`)
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [branchId]);

  const canDownload = ["admin", "super_admin", "management", "team_leader"].includes(user?.role || "");
  const requiresSignOff = canDownload; // team lead / manager / admin must e-sign before PDF
  const today = todayISO();

  const inRange = (r: any) => {
    const d = String(r.reportDate || "").slice(0, 10);
    if (!d) return false;
    if (range === "all") return true;
    if (range === "today") return d === today;
    if (range === "custom") {
      if (customFrom && d < customFrom) return false;
      if (customTo && d > customTo) return false;
      return true;
    }
    // week = last 7 days including today
    const start = new Date(today + "T00:00:00");
    start.setDate(start.getDate() - 6);
    return d >= start.toISOString().slice(0, 10) && d <= today;
  };

  const ranged = useMemo(
    () => reports.filter((r) => r.status !== "draft").filter(inRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, range, today, customFrom, customTo]
  );

  const agg = useMemo(() => {
    const byShiftLatest: Record<string, any> = {};
    SHIFTS.forEach((s) => {
      byShiftLatest[s] = [...ranged]
        .filter((r) => r.shift === s)
        .sort(
          (a, b) =>
            String(b.reportDate || "").localeCompare(String(a.reportDate || "")) ||
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        )[0];
    });

    const overallCounts: Record<string, Record<string, number>> = {};
    SHIFTS.forEach((s) => {
      const pc = byShiftLatest[s]?.reportData?.peripheral_counts || {};
      PERIPHERAL_CATEGORIES.forEach(({ key }) => {
        (pc[key] || []).forEach((row: any) => {
          if (!row.quantity) return;
          overallCounts[key] = overallCounts[key] || {};
          overallCounts[key][row.brand] =
            (overallCounts[key][row.brand] || 0) + Number(row.quantity);
        });
      });
    });

    const pcReports: Record<string, Set<string>> = {};
    const pcTypes: Record<string, Set<string>> = {};
    const pcBrands: Record<string, Set<string>> = {};
    ranged.forEach((r) => {
      DEFECT_TYPES.forEach(({ storeKey, label }) => {
        (r.reportData?.[storeKey] || []).forEach((x: any) => {
          if (!x.pc) return;
          pcReports[x.pc] = pcReports[x.pc] || new Set();
          pcReports[x.pc].add(r.id);
          pcTypes[x.pc] = pcTypes[x.pc] || new Set();
          pcTypes[x.pc].add(label);
          pcBrands[x.pc] = pcBrands[x.pc] || new Set();
          const brand = (x.brand || "").trim();
          pcBrands[x.pc].add(brand ? `${label}: ${brand}` : label);
        });
      });
    });
    const defective = Object.entries(pcReports)
      .map(([pc, set]) => ({
        pc,
        count: set.size,
        types: [...(pcTypes[pc] || [])],
        brands: [...(pcBrands[pc] || [])],
      }))
      .sort((a, b) => b.count - a.count);
    const recurringCount = defective.filter((x) => x.count >= 2).length;

    const changesList = ranged
      .filter((r) => (r.changes || "").trim())
      .sort((a, b) =>
        String(b.reportDate || "").localeCompare(String(a.reportDate || ""))
      );

    const latestReport = [...ranged].sort(
      (a, b) =>
        String(b.reportDate || "").localeCompare(String(a.reportDate || "")) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )[0];
    const latestNoDefect = latestReport
      ? noDefectList(latestReport.reportData)
      : [];
    const latestMeta = latestReport
      ? `${formatDate(latestReport.reportDate)} — ${latestReport.shift}`
      : null;

    const followUps = ranged
      .filter((r) => (r.followUp || "").trim())
      .sort((a, b) =>
        String(b.reportDate || "").localeCompare(String(a.reportDate || ""))
      );

    const gameStatus: Record<string, string> = {};
    [...ranged]
      .sort(
        (a, b) =>
          String(a.reportDate || "").localeCompare(String(b.reportDate || "")) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
      )
      .forEach((r) => {
        (r.reportData?.updated_games || []).forEach((g: any) => {
          if (g.status) gameStatus[g.game_name] = g.status;
        });
      });

    return {
      overallCounts,
      defective,
      recurringCount,
      latestNoDefect,
      latestMeta,
      followUps,
      gameStatus,
      changesList,
    };
  }, [ranged]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
      </div>
    );
  }

  const overallHasData = Object.values(agg.overallCounts).some((b) =>
    Object.values(b).some((q) => q > 0)
  );
  const gameEntries = Object.entries(agg.gameStatus);

  const rangeLabel =
    range === "custom"
      ? `Custom${customFrom || customTo ? `: ${customFrom || "…"} – ${customTo || "…"}` : ""}`
      : RANGES.find((r) => r.key === range)?.label || range;

  const openSignAndDownload = () => {
    if (!canDownload) return;
    setSignerName(user?.fullName || "");
    setSignOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (requiresSignOff) {
      if (!signerName.trim()) {
        toast.error("Enter your name to sign off");
        return;
      }
      if (!signPadRef.current || signPadRef.current.isEmpty()) {
        toast.error("Please provide your e-signature");
        return;
      }
    }

    setDownloading(true);
    try {
      let signOff = null as null | {
        name: string;
        role: string;
        imageUrl: string | null;
        signedAt: string;
      };
      if (requiresSignOff && signPadRef.current) {
        const ROLE_LABELS: Record<string, string> = {
          super_admin: "Super Admin",
          admin: "Branch Admin",
          management: "Management",
          team_leader: "Team Leader",
        };
        signOff = {
          name: signerName.trim(),
          role: ROLE_LABELS[user?.role || ""] || user?.role || "",
          imageUrl: signPadRef.current.getDataURL(),
          signedAt: new Date().toLocaleString(),
        };
      }

      const { downloadHubOverviewPdf } = await import("@/lib/hubOverviewPdf");
      await downloadHubOverviewPdf({
        rangeLabel,
        reportsCount: ranged.length,
        recurring: agg.defective,
        followUps: agg.followUps,
        overallCounts: agg.overallCounts,
        latestNoDefect: agg.latestNoDefect,
        latestMeta: agg.latestMeta,
        gameEntries,
        changesSummary: agg.changesList,
        signOff,
      });
      toast.success("PDF downloaded");
      setSignOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "PDF failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-5 pb-8">
      <div className="bg-gradient-to-br from-[#071E4C] to-[#1458C7] rounded-2xl p-6 text-white">
        <p className="text-[11px] font-bold tracking-wider text-white/70">AGGREGATE</p>
        <h2 className="text-xl font-bold mt-1 flex items-center gap-2">
          <PieChart className="w-5 h-5" /> Hub Overview
        </h2>
        <p className="text-sm text-white/70 mt-1">
          Auto-aggregated from saved shift reports. Read-only — derived from your per-shift
          reports.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3 h-9 rounded-lg text-sm font-medium border ${
                range === r.key
                  ? "bg-navy-700 text-white border-navy-700"
                  : "bg-white text-navy-900 border-border hover:border-navy-400"
              }`}
            >
              {r.label}
            </button>
          ))}
          {range === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={openSignAndDownload}
          disabled={!canDownload || downloading}
          title={
            !canDownload
              ? "Your role cannot download the Hub Overview"
              : "Download PDF"
          }
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border ${
            canDownload
              ? "bg-white text-navy-900 border-border hover:border-navy-400"
              : "bg-muted text-muted-foreground border-border cursor-not-allowed"
          }`}
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}{" "}
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Reports in range" value={ranged.length} />
        <Stat label="Defective PCs" value={agg.defective.length} />
        <Stat label="Open follow-ups" value={agg.followUps.length} />
      </div>

      <Card title="Overall Peripherals Count (PC Assigned)" icon={Cpu}>
        {!overallHasData ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PERIPHERAL_CATEGORIES.map(({ key, label }) => {
              const brands = agg.overallCounts[key] || {};
              const entries = Object.entries(brands).filter(([, q]) => q > 0);
              if (!entries.length) return null;
              return (
                <div key={key} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-navy-900 mb-2">{label}</p>
                  <div className="space-y-1">
                    {entries.map(([brand, q]) => (
                      <div key={brand} className="flex justify-between text-sm">
                        <span className="text-navy-900">{brand}</span>
                        <span className="font-semibold text-blue-700">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Sums the latest per-shift peripheral counts across {SHIFTS.join(", ")} shifts.
        </p>
      </Card>

      <Card title="Defective PCs" icon={Cpu}>
        {agg.defective.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {agg.defective.map((x) => (
              <div
                key={x.pc}
                className={`rounded-lg border p-3 ${
                  x.count >= 2
                    ? "border-red-300 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-semibold text-sm ${
                      x.count >= 2 ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    PC {x.pc}
                  </span>
                  {x.count >= 2 && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                      RECURRING
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    x.count >= 2 ? "text-red-600" : "text-amber-600"
                  }`}
                >
                  {x.brands.join(" · ")}
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    x.count >= 2 ? "text-red-400" : "text-amber-500"
                  }`}
                >
                  in {x.count} report{x.count > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          All PCs flagged as defective in range, with peripheral brand. Those in 2+ reports
          are marked Recurring ({agg.recurringCount}).
        </p>
      </Card>

      <Card title="Changes Summary" icon={FileText}>
        {agg.changesList.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {agg.changesList.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {formatDate(r.reportDate)} — {r.shift} shift
                </p>
                <p className="text-sm text-navy-900 whitespace-pre-wrap">{r.changes}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Latest PC No-Defect State" icon={ShieldCheck}>
        {!agg.latestMeta ? (
          <Empty />
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">From {agg.latestMeta}</p>
            {agg.latestNoDefect.length === 0 ? (
              <Empty label="No no-defect PCs recorded." />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {agg.latestNoDefect.map((n) => (
                  <span
                    key={n}
                    className="px-2.5 h-7 inline-flex items-center rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200"
                  >
                    {n}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card title="Game Status Summary (latest)" icon={Gamepad2}>
        {gameEntries.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {gameEntries.map(([game, status]) => (
              <div
                key={game}
                className="flex items-center justify-between bg-blue-50/40 rounded-lg px-3 h-9"
              >
                <span className="text-sm font-medium text-navy-900">{game}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full text-white ${toneForStatus(status)}`}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Open Follow-ups" icon={Flag}>
        {agg.followUps.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {agg.followUps.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {formatDate(r.reportDate)} — {r.shift} shift
                </p>
                <p className="text-sm text-navy-900 whitespace-pre-wrap">{r.followUp}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* E-sign modal before Hub Overview PDF */}
      {signOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-navy-700" />
              <h3 className="text-lg font-semibold text-navy-900">Sign off Hub Overview</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Team leads and managers must e-sign before downloading the aggregate PDF.
              Your signature will appear on the last page of the report.
            </p>
            <div>
              <Label>Full name</Label>
              <Input
                className="mt-1"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div>
              <SignaturePad ref={signPadRef} label="Signature" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                disabled={downloading}
                onClick={() => setSignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800"
                disabled={downloading}
                onClick={handleDownloadPdf}
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                {downloading ? "Preparing…" : "Sign & Download PDF"}
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
      <strong className="block text-lg font-bold text-navy-900 mt-1">{value}</strong>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-navy-900 flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-blue-600" />} {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ label = "No data in range." }: { label?: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
