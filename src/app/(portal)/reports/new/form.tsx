"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReportSection from "@/components/reports/ReportSection";
import PcChecklist from "@/components/reports/PcChecklist";
import SignaturePad, { SignaturePadHandle } from "@/components/reports/SignaturePad";
import {
  mergeConfig,
  buildPeripheralCounts,
  buildSpareItems,
  PERIPHERAL_CATEGORIES,
  DEFECT_TYPES,
  toneForStatus,
  emptyDefects,
  type GamingConfig,
  type DefectKey,
} from "@/lib/gamingReportData";
import { Loader2, Save, FileCheck, Plus, Trash2, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);

const compactDataUrl = (dataURL: string, maxW = 400): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / (img.width || maxW));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((img.width || maxW) * scale));
      c.height = Math.max(1, Math.round((img.height || 1) * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });

export default function NewGamingReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { branchId } = useBranch();
  const user = usePortalUser();

  const adminPadRef = useRef<SignaturePadHandle>(null);
  const techPadRef = useRef<SignaturePadHandle>(null);

  const [config, setConfig] = useState<GamingConfig | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [reportDate, setReportDate] = useState(todayISO());
  const [shift, setShift] = useState<"Opening" | "Mid" | "Night">("Opening");
  const [adminName, setAdminName] = useState("");
  const [techName, setTechName] = useState("");
  const [pcRange, setPcRange] = useState("");
  const [changes, setChanges] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [gameStatus, setGameStatus] = useState<Record<string, string>>({});
  const [defects, setDefects] = useState(emptyDefects);
  const [noDefectPcs, setNoDefectPcs] = useState<string[]>([]);
  const [peripheralCounts, setPeripheralCounts] = useState<
    Record<string, Array<{ brand: string; quantity: string | number }>>
  >({});
  const [spareItems, setSpareItems] = useState<Record<string, number>>({});
  const [cleanedPcs, setCleanedPcs] = useState<string[]>([]);
  const [existingAdminSig, setExistingAdminSig] = useState<string | null>(null);
  const [existingTechSig, setExistingTechSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [carryNote, setCarryNote] = useState("");

  useEffect(() => {
    if (!branchId) return;
    (async () => {
      try {
        const isTech = user?.role === "computer_tech";
        setStaffName(user?.fullName || "");
        setStaffRole(user?.role || "");
        setAdminName(isTech ? "" : user?.fullName || "");
        setTechName(isTech ? user?.fullName || "" : "");

        const cfgRes = await fetch(`/api/config?branchId=${branchId}`);
        const cfgData = await cfgRes.json();
        const cfg = mergeConfig(cfgData.config);
        setConfig(cfg);
        setPeripheralCounts(buildPeripheralCounts(cfg, null));
        setSpareItems(buildSpareItems(cfg.spare_types, []));
        setCleanedPcs([...cfg.standard_pcs, ...cfg.vip_pcs]);

        if (editId) {
          const d = await fetch(`/api/reports/${editId}`).then((r) => r.json());
          const r = d.report;
          if (!r) {
            toast.error("Report not found.");
            setLoading(false);
            return;
          }
          if (r.status !== "draft") {
            toast.error("This report is already submitted and cannot be edited.");
            setLoading(false);
            return;
          }
          setReportDate((r.reportDate || todayISO()).toString().slice(0, 10));
          setShift(r.shift || "Opening");
          setAdminName(r.adminName || (isTech ? "" : user?.fullName || ""));
          setTechName(r.techName || (isTech ? user?.fullName || "" : ""));
          const rd = r.reportData || {};
          setPcRange(rd.pc_range || "");
          setChanges(r.changes || "");
          setFollowUp(r.followUp || "");
          setGameStatus(
            Object.fromEntries((rd.updated_games || []).map((g: any) => [g.game_name, g.status]))
          );
          setDefects({
            keyboard: rd.defective_keyboards || [],
            mouse: rd.defective_mice || [],
            headset: rd.defective_headsets || [],
            monitor: rd.defective_monitors || [],
          });
          const nd = rd.no_defect_pcs;
          setNoDefectPcs(
            Array.isArray(nd) ? nd : nd ? [...(nd.standard || []), ...(nd.vip || [])] : []
          );
          setPeripheralCounts(buildPeripheralCounts(cfg, rd.peripheral_counts));
          setSpareItems(buildSpareItems(cfg.spare_types, rd.spare_items));
          setCleanedPcs(rd.cleaned_pcs || []);
          const aSig = rd.admin_signature;
          const tSig = rd.tech_signature;
          setExistingAdminSig(
            aSig && typeof aSig === "object" ? aSig.image_url || null : typeof aSig === "string" ? aSig : null
          );
          setExistingTechSig(
            tSig && typeof tSig === "object" ? tSig.image_url || null : typeof tSig === "string" ? tSig : null
          );
        } else {
          // Carry-forward from the preceding shift when available.
          try {
            const previousShift = shift === "Opening" ? "Night" : shift === "Mid" ? "Opening" : "Mid";
            const carryDate = new Date(`${reportDate}T00:00:00.000Z`);
            if (shift === "Opening") carryDate.setUTCDate(carryDate.getUTCDate() - 1);
            const date = carryDate.toISOString().slice(0, 10);
            const ld = await fetch(
              `/api/reports?branchId=${branchId}&date=${date}&shift=${previousShift}&limit=1`
            ).then((r) => r.json());
            const all = ld.reports || [];
            if (all.length) {
              const latest = all[0];
              const rd = latest.reportData || {};
              const nd = rd.no_defect_pcs;
              if (nd)
                setNoDefectPcs(
                  Array.isArray(nd) ? nd : [...(nd.standard || []), ...(nd.vip || [])]
                );
              if (rd.peripheral_counts)
                setPeripheralCounts(buildPeripheralCounts(cfg, rd.peripheral_counts));
              if (rd.spare_items) setSpareItems(buildSpareItems(cfg.spare_types, rd.spare_items));
              if (rd.pc_range) setPcRange(rd.pc_range);
              if (latest.changes) setChanges(latest.changes);
              if (latest.followUp) setFollowUp(latest.followUp);
              if (rd.updated_games)
                setGameStatus(
                  Object.fromEntries(
                    (rd.updated_games || []).map((g: any) => [g.game_name, g.status])
                  )
                );
              if (
                rd.defective_keyboards ||
                rd.defective_mice ||
                rd.defective_headsets ||
                rd.defective_monitors
              ) {
                setDefects({
                  keyboard: rd.defective_keyboards || [],
                  mouse: rd.defective_mice || [],
                  headset: rd.defective_headsets || [],
                  monitor: rd.defective_monitors || [],
                });
              }
              setCarryNote(
                `Pre-filled from the previous ${previousShift} shift (${String(latest.reportDate).slice(0, 10)}). Update only what changed; these fields may be left blank.`
              );
            }
          } catch {
            /* ignore carry-forward errors */
          }
        }
      } catch (e: any) {
        toast.error("Failed to load report", {
          description: e.message || "Failed to load configuration.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId, editId, reportDate, shift]);

  const toggleGame = (game: string, status: string) =>
    setGameStatus((p) => {
      const n = { ...p };
      if (p[game] === status) delete n[game];
      else n[game] = status;
      return n;
    });

  const addDefect = (type: DefectKey) =>
    setDefects((p) => ({ ...p, [type]: [...p[type], { pc: "", brand: "", note: "" }] }));
  const updateDefect = (type: DefectKey, i: number, field: string, val: string) =>
    setDefects((p) => {
      const arr = [...p[type]];
      arr[i] = { ...arr[i], [field]: val };
      return { ...p, [type]: arr };
    });
  const removeDefect = (type: DefectKey, i: number) =>
    setDefects((p) => ({ ...p, [type]: p[type].filter((_, idx) => idx !== i) }));

  const toggleNoDefect = (n: string) =>
    setNoDefectPcs((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const toggleCleaned = (n: string) =>
    setCleanedPcs((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  const setPcCount = (key: string, brand: string, val: string) =>
    setPeripheralCounts((p) => {
      const arr = [...(p[key] || [])];
      const idx = arr.findIndex((x) => x.brand === brand);
      if (idx >= 0) arr[idx] = { ...arr[idx], quantity: val };
      return { ...p, [key]: arr };
    });
  const setSpare = (type: string, val: string) =>
    setSpareItems((p) => ({ ...p, [type]: Number(val) || 0 }));

  const captureSig = async (
    padRef: React.RefObject<SignaturePadHandle | null>,
    existing: string | null
  ) => {
    if (!padRef.current || padRef.current.isEmpty()) return existing || null;
    const raw = padRef.current.getDataURL();
    if (!raw) return existing || null;
    if (raw === existing) return existing;
    return compactDataUrl(raw);
  };

  const buildReportData = (adminImg: string | null, techImg: string | null) => ({
    pc_range: pcRange,
    updated_games: Object.entries(gameStatus).map(([game_name, s]) => ({
      game_name,
      status: s,
    })),
    defective_keyboards: defects.keyboard,
    defective_mice: defects.mouse,
    defective_headsets: defects.headset,
    defective_monitors: defects.monitor,
    no_defect_pcs: noDefectPcs,
    peripheral_counts: peripheralCounts,
    spare_items: Object.entries(spareItems).map(([item_type, q]) => ({
      item_type,
      quantity: Number(q) || 0,
    })),
    cleaned_pcs: cleanedPcs,
    admin_signature: { name: adminName, image_url: adminImg },
    tech_signature: { name: techName, image_url: techImg },
  });

  const save = async (status: "draft" | "submitted") => {
    if (!reportDate || !shift || !adminName) {
      toast.error("Date, shift, and admin name are required.");
      return;
    }
    if (!branchId) {
      toast.error("No branch selected.");
      return;
    }
    setSaving(true);
    try {
      const adminImg = await captureSig(adminPadRef, existingAdminSig);
      const techImg = await captureSig(techPadRef, existingTechSig);
      const payload = {
        branchId,
        reportDate,
        shift,
        adminName,
        techName,
        status,
        changes,
        followUp,
        reportData: buildReportData(adminImg, techImg),
      };

      let res: Response;
      if (editId) {
        res = await fetch(`/api/reports/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save report.");
      toast.success(status === "draft" ? "Draft saved" : "Report submitted", {
        description: `${reportDate} · ${shift} shift`,
      });
      router.push(data.id ? `/reports/${data.id}` : "/reports");
      router.refresh();
    } catch (e: any) {
      toast.error("Save failed", {
        description: e.message || "Failed to save report.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
      </div>
    );
  }

  const statuses = config.game_statuses;
  const shiftPCs = config.shift_pcs[shift] || [];
  const noDefectGroups = shiftPCs.length
    ? [{ label: `${shift} Shift PCs`, pcs: shiftPCs }]
    : [
        { label: "Standard PCs", pcs: config.standard_pcs },
        { label: "VIP PCs", pcs: config.vip_pcs },
      ];
  const allBrands = [...new Set(Object.values(config.peripheral_brands).flat())];
  const defaultStatus = statuses.includes("Updated") ? "Updated" : statuses[0];
  const completionScore = Math.min(
    100,
    Math.round(
      ((Number(Boolean(reportDate)) + Number(Boolean(shift)) + Number(Boolean(adminName)) + Number(Boolean(techName || !user?.role || user.role === "computer_tech")) + Number(Boolean(changes || followUp)) + Number(Object.keys(gameStatus).length > 0 || config.games.length === 0)) /
        6 * 100
      )
    )
  );

  return (
    <div className="max-w-4xl space-y-5 pb-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to reports
      </Link>

      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-blue-700/80">REPORT STATUS</p>
            <h1 className="text-2xl font-bold text-navy-900 mt-1">
              {editId ? "Edit Draft Report" : "New Shift Report"}
            </h1>
          </div>
          <div className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-blue-800 border border-blue-200">
            {completionScore}% ready
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
            style={{ width: `${completionScore}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-800">
          <span className="rounded-full bg-white px-2.5 py-1 border border-blue-200">{reportDate || "No date"}</span>
          <span className="rounded-full bg-white px-2.5 py-1 border border-blue-200">{shift} shift</span>
          <span className="rounded-full bg-white px-2.5 py-1 border border-blue-200">{adminName || "No admin"}</span>
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {editId
            ? "Edit the draft report, then submit when ready."
            : "Fill out the gaming hub shift report for the selected date and shift."}
        </p>
      </div>

      {carryNote && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{carryNote}</span>
        </div>
      )}
      <datalist id="peripheral-brands">
        {allBrands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <ReportSection title="Report Details" eyebrow="SHIFT REPORT">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Report Date</label>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Shift</label>
            <div className="flex gap-2 mt-1">
              {(["Opening", "Mid", "Night"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`px-3 h-9 rounded-lg text-sm font-medium border ${
                    shift === s
                      ? "bg-navy-700 text-white border-navy-700"
                      : "bg-white text-navy-900 border-border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium">Admin Name</label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1"
              placeholder="Admin on duty"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Technician Name</label>
            <Input
              value={techName}
              onChange={(e) => setTechName(e.target.value)}
              className="mt-1"
              placeholder="Tech on duty"
            />
          </div>
          <div>
            <label className="text-sm font-medium">PC Range</label>
            <Input
              value={pcRange}
              onChange={(e) => setPcRange(e.target.value)}
              className="mt-1"
              placeholder="e.g. PC 19 - 36"
            />
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Changes" eyebrow="NOTES">
        <Textarea
          value={changes}
          onChange={(e) => setChanges(e.target.value)}
          rows={3}
          placeholder="Any changes observed this shift..."
        />
      </ReportSection>

      <ReportSection
        title="Updated Games"
        eyebrow="GAME STATUS"
        actions={
          <div className="flex gap-3">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() =>
                setGameStatus(Object.fromEntries(config.games.map((g) => [g, defaultStatus])))
              }
            >
              All {defaultStatus}
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => setGameStatus({})}
            >
              Clear
            </button>
          </div>
        }
      >
        <div>
          {config.games.map((g) => {
            const cur = gameStatus[g];
            return (
              <div
                key={g}
                className="flex items-center justify-between gap-2 py-2 border-b border-border/60 last:border-0"
              >
                <span className="text-sm font-medium text-navy-900">{g}</span>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {statuses.map((s) => {
                    const on = cur === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleGame(g, s)}
                        className={`px-2.5 h-7 rounded-md text-xs font-medium border ${
                          on
                            ? `${toneForStatus(s)} text-white border-transparent`
                            : "bg-white text-muted-foreground border-border hover:border-navy-400"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ReportSection>

      <ReportSection title="Defective Peripherals" eyebrow="DEFECTS">
        <div className="space-y-5">
          {DEFECT_TYPES.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-navy-900">Defective {label}</p>
                <button
                  type="button"
                  onClick={() => addDefect(key)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              {defects[key].length === 0 && (
                <p className="text-xs text-muted-foreground">None reported.</p>
              )}
              <div className="space-y-2">
                {defects[key].map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={d.pc}
                      onChange={(e) => updateDefect(key, i, "pc", e.target.value)}
                      placeholder="PC #"
                      className="w-24"
                    />
                    <Input
                      value={d.brand}
                      onChange={(e) => updateDefect(key, i, "brand", e.target.value)}
                      placeholder="Brand"
                      list="peripheral-brands"
                      className="w-32"
                    />
                    <Input
                      value={d.note}
                      onChange={(e) => updateDefect(key, i, "note", e.target.value)}
                      placeholder="Issue / note"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeDefect(key, i)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="PCs With No Defects" eyebrow="PC STATUS">
        <div className="space-y-4">
          {noDefectGroups.map((g) => (
            <PcChecklist
              key={g.label}
              label={g.label}
              pcs={g.pcs}
              selected={noDefectPcs}
              onToggle={toggleNoDefect}
              onAll={() => setNoDefectPcs((prev) => [...new Set([...prev, ...g.pcs])])}
              onClear={() => setNoDefectPcs((prev) => prev.filter((x) => !g.pcs.includes(x)))}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Peripherals Count (by Brand)" eyebrow="INVENTORY">
        <div className="grid sm:grid-cols-2 gap-4">
          {PERIPHERAL_CATEGORIES.map(({ key, label }) => {
            const rows = peripheralCounts[key] || [];
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-navy-900 mb-2">{label}</p>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No brands configured.</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div key={r.brand} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-navy-900">{r.brand}</span>
                        <Input
                          type="number"
                          min={0}
                          value={r.quantity}
                          onChange={(e) => setPcCount(key, r.brand, e.target.value)}
                          className="w-20"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ReportSection>

      <ReportSection title="Spare Items" eyebrow="SPARES">
        <div className="grid sm:grid-cols-2 gap-3">
          {config.spare_types.map((t) => (
            <div
              key={t}
              className="flex items-center justify-between gap-3 bg-blue-50/60 rounded-lg p-2.5"
            >
              <span className="text-sm font-medium text-navy-900">Spare {t}</span>
              <Input
                type="number"
                min={0}
                value={spareItems[t] ?? 0}
                onChange={(e) => setSpare(t, e.target.value)}
                className="w-24"
              />
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Follow-up Report" eyebrow="FOLLOW UP">
        <Textarea
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          rows={3}
          placeholder="Items needing follow-up..."
        />
      </ReportSection>

      <ReportSection title="Cleaned PCs" eyebrow="MAINTENANCE">
        <div className="space-y-4">
          {[
            { label: "Standard PCs", pcs: config.standard_pcs },
            { label: "VIP PCs", pcs: config.vip_pcs },
          ].map((g) => (
            <PcChecklist
              key={g.label}
              label={g.label}
              pcs={g.pcs}
              selected={cleanedPcs}
              onToggle={toggleCleaned}
              onAll={() => setCleanedPcs((prev) => [...new Set([...prev, ...g.pcs])])}
              onClear={() => setCleanedPcs((prev) => prev.filter((x) => !g.pcs.includes(x)))}
            />
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Report Sign-off" eyebrow="E-SIGN">
        <p className="text-xs text-muted-foreground mb-3">
          Sign in the boxes below using your finger or mouse. Printed name is taken from the
          admin/tech fields above.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <SignaturePad ref={adminPadRef} label="Admin Signature" existingUrl={existingAdminSig} />
          <SignaturePad ref={techPadRef} label="Tech Signature" existingUrl={existingTechSig} />
        </div>
      </ReportSection>

      <div className="flex gap-3 sticky bottom-4 bg-white/95 backdrop-blur p-3 rounded-xl border shadow-lg">
        <Button
          variant="outline"
          className="flex-1"
          disabled={saving}
          onClick={() => save("draft")}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {editId ? "Update Draft" : "Save Draft"}
        </Button>
        <Button
          className="flex-1 bg-blue-700 hover:bg-blue-800"
          disabled={saving}
          onClick={() => save("submitted")}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileCheck className="w-4 h-4 mr-2" />
          )}
          Submit Report
        </Button>
      </div>
    </div>
  );
}
