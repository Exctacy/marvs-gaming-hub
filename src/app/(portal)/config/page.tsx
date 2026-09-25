"use client";

import { useEffect, useState } from "react";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import {
  mergeConfig,
  PERIPHERAL_CATEGORIES,
  SHIFTS,
  type GamingConfig,
} from "@/lib/gamingReportData";
import ReportSection from "@/components/reports/ReportSection";
import ListEditor from "@/components/reports/ListEditor";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export default function StaffGamingConfigPage() {
  const { branchId } = useBranch();
  const user = usePortalUser();
  const [config, setConfig] = useState<GamingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const canEdit = ["super_admin", "admin", "management", "computer_tech"].includes(
    user?.role || ""
  );

  useEffect(() => {
    if (!branchId) return;
    (async () => {
      try {
        const d = await fetch(`/api/config?branchId=${branchId}`).then((r) =>
          r.json()
        );
        setConfig(mergeConfig(d.config));
      } catch (e: any) {
        toast.error("Failed to load configuration", {
          description: e.message || "Please try again.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [branchId]);

  const set = (field: keyof GamingConfig, value: any) => {
    setConfig((c) => (c ? { ...c, [field]: value } : c));
  };
  const setShiftPcs = (shift: string, value: string[]) =>
    setConfig((c) =>
      c ? { ...c, shift_pcs: { ...c.shift_pcs, [shift]: value } } : c
    );
  const setBrands = (key: string, value: string[]) =>
    setConfig((c) =>
      c
        ? {
            ...c,
            peripheral_brands: { ...c.peripheral_brands, [key]: value },
          }
        : c
    );

  const save = async () => {
    if (!config || !branchId) return;
    setSaving(true);
    try {
      // Filter empty strings from lists before save
      const cleanList = (arr: string[]) =>
        arr.map((s) => s.trim()).filter(Boolean);

      const payload = {
        branchId,
        standardPcs: cleanList(config.standard_pcs),
        vipPcs: cleanList(config.vip_pcs),
        games: cleanList(config.games),
        gameStatuses: cleanList(config.game_statuses),
        shiftPcs: Object.fromEntries(
          Object.entries(config.shift_pcs).map(([k, v]) => [k, cleanList(v || [])])
        ),
        spareTypes: cleanList(config.spare_types),
        peripheralBrands: Object.fromEntries(
          Object.entries(config.peripheral_brands).map(([k, v]) => [
            k,
            cleanList(v || []),
          ])
        ),
      };

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setConfig(mergeConfig(data.config));
      toast.success("Configuration saved", {
        description: "Hub setup updated successfully.",
      });
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className="max-w-6xl space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Gaming Config</h1>
        <p className="text-sm text-muted-foreground">
          Configure the PC lists, games, shifts, and peripheral brands used across
          gaming hub reports.
        </p>
      </div>

      <ReportSection title="PC Numbers" eyebrow="PC LISTS">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-navy-900 mb-2">Standard PCs</p>
            <ListEditor
              items={config.standard_pcs}
              onChange={(v) => set("standard_pcs", v)}
              placeholder="Add PC number, e.g. N-PC-05"
              disabled={!canEdit}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900 mb-2">VIP PCs</p>
            <ListEditor
              items={config.vip_pcs}
              onChange={(v) => set("vip_pcs", v)}
              placeholder="Add VIP PC, e.g. N-VIP-03"
              disabled={!canEdit}
            />
          </div>
        </div>
      </ReportSection>

      <ReportSection title="Per-Shift PCs" eyebrow="SHIFTS">
        <p className="text-xs text-muted-foreground mb-3">
          When set, only these PCs show for that shift&apos;s report (overriding the
          standard list). Leave empty to use the standard PCs.
        </p>
        <div className="grid gap-5 lg:grid-cols-3">
          {SHIFTS.map((s) => (
            <div key={s}>
              <p className="text-sm font-semibold text-navy-900 mb-2">
                {s} Shift PCs
              </p>
              <ListEditor
                items={config.shift_pcs[s] || []}
                onChange={(v) => setShiftPcs(s, v)}
                placeholder="Add PC number"
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="Games" eyebrow="GAME LIST">
        <ListEditor
          items={config.games}
          onChange={(v) => set("games", v)}
          placeholder="Add a game, e.g. Valorant"
          disabled={!canEdit}
        />
        <div className="mt-5">
          <p className="text-sm font-semibold text-navy-900 mb-2">
            Game Status Options
          </p>
          <ListEditor
            items={config.game_statuses}
            onChange={(v) => set("game_statuses", v)}
            placeholder="Add a status, e.g. Updated"
            disabled={!canEdit}
          />
        </div>
      </ReportSection>

      <ReportSection title="Spare Item Types" eyebrow="SPARES">
        <ListEditor
          items={config.spare_types}
          onChange={(v) => set("spare_types", v)}
          placeholder="Add spare type, e.g. Keyboard"
          disabled={!canEdit}
        />
      </ReportSection>

      <ReportSection title="Peripheral Brands" eyebrow="BRANDS">
        <div className="grid gap-5 sm:grid-cols-2">
          {PERIPHERAL_CATEGORIES.map(({ key, label }) => (
            <div key={key}>
              <p className="text-sm font-semibold text-navy-900 mb-2">{label}</p>
              <ListEditor
                items={config.peripheral_brands[key] || []}
                onChange={(v) => setBrands(key, v)}
                placeholder="Add brand, e.g. RED DRAGON"
                disabled={!canEdit}
              />
            </div>
          ))}
        </div>
      </ReportSection>

      {canEdit ? (
        <Button
          onClick={save}
          disabled={saving}
          className="bg-blue-700 hover:bg-blue-800"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}{" "}
          Save Configuration
        </Button>
      ) : (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          You can view the hub configuration, but your role cannot save changes.
        </div>
      )}
    </div>
  );
}
