"use client";

import { useEffect, useState } from "react";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Save,
  Settings as SettingsIcon,
  Check,
  Building2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function StaffSettingsPage() {
  const { branchId, setBranchId } = useBranch();
  const staff = usePortalUser();
  const isSuperAdmin = staff?.role === "super_admin";
  const isManagement = staff?.role === "management";

  const [form, setForm] = useState<{
    business_name: string;
    system_name: string;
    logo_url: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [branches, setBranches] = useState<any[]>([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [viewBranch, setViewBranch] = useState("");

  const loadSettings = async () => {
    try {
      const d = await fetch("/api/settings").then((r) => r.json());
      const s = d.settings;
      setForm({
        business_name: s.business_name || "",
        system_name: s.system_name || "",
        logo_url: s.logo_url || "",
      });
    } catch (e: any) {
      toast.error("Failed to load settings", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    setBranchLoading(true);
    try {
      const d = await fetch("/api/branches").then((r) => r.json());
      const list = (d.branches || []).filter((b: any) => b.active !== false);
      setBranches(list);
      setViewBranch(branchId || list[0]?.id || "");
    } catch (e: any) {
      toast.error("Failed to load branches", { description: e.message });
    } finally {
      setBranchLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (branchId && branches.some((b) => b.id === branchId)) {
      setViewBranch(branchId);
    }
  }, [branchId, branches]);

  const applyBranch = () => {
    if (!viewBranch) return;
    setBranchId(viewBranch);
    toast.success("Branch view updated", {
      description: "Portal data will use the selected branch.",
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      toast.success("Settings saved", {
        description: "System settings updated successfully.",
      });
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!editing?.name) {
      toast.error("Branch name is required.");
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        const res = await fetch(`/api/branches/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editing.name,
            code: editing.code,
            address: editing.address,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Update failed");
      } else {
        const res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editing.name,
            code: editing.code || editing.name.slice(0, 4).toUpperCase(),
            address: editing.address,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Create failed");
      }
      toast.success(editing.id ? "Branch updated" : "Branch created", {
        description: `"${editing.name}" saved.`,
      });
      setEditing(null);
      loadBranches();
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const removeBranch = (b: any) => {
    setConfirm({
      title: "Delete Branch",
      message: `Deactivate branch "${b.name}"? Existing reports keep their history; the branch will no longer appear as active.`,
      label: "Deactivate",
      action: async () => {
        const res = await fetch(`/api/branches/${b.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        toast.success("Branch deactivated", {
          description: `"${b.name}" removed from active list.`,
        });
        loadBranches();
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.action();
      setConfirm(null);
    } catch (e: any) {
      toast.error("Action failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading && isSuperAdmin) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System configuration and branch management.
        </p>
      </div>

      {(isSuperAdmin || isManagement) && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-3">
          <div className="flex items-center gap-2 text-navy-900 font-semibold pb-2 border-b border-border">
            <Building2 className="w-4 h-4" /> Branch View
          </div>
          <p className="text-xs text-muted-foreground">
            Choose the branch whose reports, dashboard, hub overview, and gaming
            configuration you want to view. Your selection is remembered after refresh.
          </p>
          {branchLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-navy-700" />
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={viewBranch}
                onChange={(e) => setViewBranch(e.target.value)}
                className="flex-1 h-10 rounded-lg border border-border bg-white px-3 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Button
                onClick={applyBranch}
                disabled={!viewBranch}
                className="bg-blue-700 hover:bg-blue-800"
              >
                <Check className="w-4 h-4 mr-2" /> Apply
              </Button>
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && form && (
        <>
          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 text-navy-900 font-semibold pb-2 border-b border-border">
              <SettingsIcon className="w-4 h-4" /> Business
            </div>
            <div>
              <Label>Business Name</Label>
              <Input
                value={form.business_name}
                onChange={(e) =>
                  setForm({ ...form, business_name: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>System Name</Label>
              <Input
                value={form.system_name}
                onChange={(e) =>
                  setForm({ ...form, system_name: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url}
                onChange={(e) =>
                  setForm({ ...form, logo_url: e.target.value })
                }
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Loyalty / points settings are intentionally excluded — this portal is
              operations-only.
            </p>
            <Button
              onClick={save}
              disabled={saving}
              className="w-full h-11 font-semibold bg-blue-700 hover:bg-blue-800"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
              <div className="flex items-center gap-2 text-navy-900 font-semibold">
                <Building2 className="w-4 h-4" /> Branches
              </div>
              <Button
                onClick={() =>
                  setEditing({ name: "", code: "", address: "" })
                }
                variant="outline"
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Branch
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Each branch keeps its own hub setup, reports, and operational data.
            </p>
            {branchLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-navy-700" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No branches yet. Add your first branch to enable per-branch data.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900 text-sm truncate">
                        {b.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[b.code, b.address].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: b.id,
                            name: b.name,
                            code: b.code || "",
                            address: b.address || "",
                          })
                        }
                        className="p-1.5 rounded-md hover:bg-muted text-navy-900"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBranch(b)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!isSuperAdmin && !isManagement && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Only Super Admin can edit system settings and branches. Super Admin and
          Management can switch the active branch from Settings.
        </div>
      )}

      {/* Edit branch modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-navy-900">
              {editing.id ? "Edit Branch" : "Add Branch"}
            </h3>
            <div className="space-y-3">
              <div>
                <Label>Branch Name *</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  placeholder="e.g. MARVS Hub - Branch 1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={editing.code || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, code: e.target.value })
                  }
                  placeholder="e.g. BR1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editing.address || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, address: e.target.value })
                  }
                  placeholder="Branch location"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                onClick={saveBranch}
                disabled={busy}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-navy-900">
              {confirm.title}
            </h3>
            <p className="text-sm text-muted-foreground">{confirm.message}</p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={executeConfirm}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {confirm.label}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
