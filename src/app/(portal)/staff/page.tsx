"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Loader2,
  Shield,
  Power,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { usePortalUser } from "@/components/layout/portal-shell";

const STATUS_META: Record<
  string,
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  ACTIVE: {
    label: "Active",
    icon: CheckCircle2,
    cls: "bg-green-50 text-green-700 border-green-200",
  },
  INACTIVE: {
    label: "Inactive",
    icon: XCircle,
    cls: "bg-red-50 text-red-700 border-red-200",
  },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Branch Admin",
  counter_admin: "Counter Admin",
  computer_tech: "Computer Tech",
  team_leader: "Team Leader",
  management: "Management",
};
const ALL_ROLE_OPTIONS = [
  "counter_admin",
  "computer_tech",
  "team_leader",
  "management",
  "admin",
  "super_admin",
];
const BRANCH_ROLE_OPTIONS = ["counter_admin", "computer_tech", "team_leader"];

export default function StaffManagementPage() {
  const currentUser = usePortalUser();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("counter_admin");
  const [branch, setBranch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(5);

  const isGlobalManager = ["super_admin", "management"].includes(
    currentUser?.role || ""
  );
  const isBranchAdmin = currentUser?.role === "admin";
  const canManageStaff = isGlobalManager || isBranchAdmin;
  const roleOptions = isGlobalManager ? ALL_ROLE_OPTIONS : BRANCH_ROLE_OPTIONS;
  const homeBranch = currentUser?.branchId || "";

  const load = async () => {
    setLoading(true);
    try {
      const [d, b] = await Promise.all([
        fetch("/api/staff").then((r) => r.json()),
        fetch("/api/branches").then((r) => r.json()),
      ]);
      setProfiles(d.profiles || []);
      setBranches(b.branches || []);
      if (!branch && (currentUser?.branchId || b.branches?.[0]?.id)) {
        setBranch(currentUser?.branchId || b.branches[0].id);
      }
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchName = (id: string) =>
    branches.find((b) => b.id === id)?.name || "—";

  const create = async () => {
    setError("");
    setSuccess("");
    if (!username || !fullName) {
      setError("Username and full name are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          role,
          branch_id:
            role === "management" || role === "super_admin"
              ? ""
              : isBranchAdmin
                ? homeBranch
                : branch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");
      setSuccess(
        `Staff account created for ${fullName}. Temporary password is "123". They must change it on first login.`
      );
      toast.success("Staff account created", {
        description: `${fullName} can sign in with temporary password "123".`,
      });
      setUsername("");
      setFullName("");
      setEmail("");
      setRole("counter_admin");
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message);
      toast.error("Creation failed", { description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const patch = async (id: string, body: any) => {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Action failed");
  };

  const resetPassword = (p: any) => {
    setConfirm({
      title: "Reset Password",
      message: `Reset the password for ${p.full_name || p.fullName} (${p.username})? Temporary password will be "123".`,
      label: "Reset Password",
      variant: "default",
      action: async () => {
        await patch(p.id, { action: "reset_password" });
        setSuccess(
          `Password reset for ${p.full_name || p.fullName}. Temporary password is "123".`
        );
      },
    });
  };

  const toggleStatus = (p: any) => {
    const isDeactivate = p.status === "ACTIVE";
    setConfirm({
      title: isDeactivate ? "Deactivate Staff" : "Activate Staff",
      message: isDeactivate
        ? `Deactivate ${p.full_name || p.fullName}? They will immediately lose access.`
        : `Reactivate ${p.full_name || p.fullName}?`,
      label: isDeactivate ? "Deactivate" : "Activate",
      variant: isDeactivate ? "destructive" : "default",
      action: async () => {
        await patch(p.id, {
          action: isDeactivate ? "deactivate" : "activate",
        });
      },
    });
  };

  const changeRole = (p: any, newRole: string) => {
    if (newRole === p.role) return;
    setConfirm({
      title: "Change Role",
      message: `Change ${p.full_name || p.fullName}'s role to ${ROLE_LABELS[newRole] || newRole}?`,
      label: "Confirm",
      variant: newRole === "admin" ? "destructive" : "default",
      action: async () => {
        await patch(p.id, { action: "change_role", new_role: newRole });
      },
    });
  };

  const changeBranch = (p: any, newBranchId: string) => {
    if (newBranchId === (p.branch_id || p.branchId || "")) return;
    setConfirm({
      title: "Change Branch",
      message: `Change ${p.full_name || p.fullName}'s home branch to ${branchName(newBranchId)}?`,
      label: "Confirm",
      variant: "default",
      action: async () => {
        await patch(p.id, {
          action: "change_branch",
          new_branch_id: newBranchId,
        });
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    setError("");
    try {
      await confirm.action();
      setConfirm(null);
      setSuccess(confirm.title + " completed successfully.");
      toast.success(confirm.title, { description: "Completed successfully." });
      load();
    } catch (e: any) {
      setError(e.message);
      toast.error("Action failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-5 pb-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Staff Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage staff and admin accounts.
          </p>
        </div>
        {canManageStaff && (
          <Button
            onClick={() => {
              setOpen(true);
              setError("");
              setSuccess("");
            }}
            className="bg-blue-700 hover:bg-blue-800"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Create Staff
          </Button>
        )}
      </div>

      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}
      {error && !open && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-10 text-center">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No staff members yet. Click &quot;Create Staff&quot; to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Username</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Branch</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.slice(0, limit).map((p) => {
                  const meta = STATUS_META[p.status] || STATUS_META.INACTIVE;
                  const SIcon = meta.icon;
                  const isSelf = p.id === currentUser?.id;
                  const displayName = p.full_name || p.fullName;
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">
                        {displayName || "—"}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{p.username}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[p.role] || p.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {p.role === "management" || p.role === "super_admin"
                          ? "All branches"
                          : branchName(p.branch_id || p.branchId)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${meta.cls}`}
                        >
                          <SIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {canManageStaff ? (
                          <div className="flex items-center justify-end gap-3 flex-wrap">
                            {p.status === "ACTIVE" && !isSelf && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => resetPassword(p)}
                                  className="text-xs text-blue-700 hover:underline font-medium flex items-center gap-1"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  Reset Password
                                </button>
                                <select
                                  value={p.role}
                                  onChange={(e) =>
                                    changeRole(p, e.target.value)
                                  }
                                  className="h-7 rounded-md border border-border bg-white px-2 text-xs"
                                >
                                  {roleOptions.map((r) => (
                                    <option key={r} value={r}>
                                      {ROLE_LABELS[r]}
                                    </option>
                                  ))}
                                </select>
                                {isGlobalManager &&
                                  p.role !== "management" &&
                                  p.role !== "super_admin" && (
                                    <select
                                      value={p.branch_id || p.branchId || ""}
                                      onChange={(e) =>
                                        changeBranch(p, e.target.value)
                                      }
                                      className="h-7 rounded-md border border-border bg-white px-2 text-xs"
                                    >
                                      <option value="">— No branch —</option>
                                      {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                          {b.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => toggleStatus(p)}
                                  className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1"
                                >
                                  <Power className="w-3 h-3" />
                                  Deactivate
                                </button>
                              </>
                            )}
                            {p.status === "ACTIVE" && isSelf && (
                              <button
                                type="button"
                                onClick={() => resetPassword(p)}
                                className="text-xs text-blue-700 hover:underline font-medium flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                Reset Password
                              </button>
                            )}
                            {p.status === "INACTIVE" && (
                              <button
                                type="button"
                                onClick={() => toggleStatus(p)}
                                className="text-xs text-green-600 hover:underline font-medium flex items-center gap-1"
                              >
                                <Power className="w-3 h-3" />
                                Activate
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              Showing {Math.min(limit, profiles.length)} of {profiles.length}
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
        </div>
      )}

      {/* Create dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-navy-900">
              Create Staff Account
            </h3>
            <div className="space-y-3">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Username *</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. juan.staff"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@marvs.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm mt-1"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              {role === "management" || role === "super_admin" ? (
                <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  Super Admin and Management are branch-agnostic — no home branch
                  is assigned.
                </p>
              ) : isBranchAdmin ? (
                <div>
                  <Label>Home Branch</Label>
                  <select
                    value={homeBranch}
                    disabled
                    className="w-full h-10 rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground mt-1"
                  >
                    {branches
                      .filter((b) => b.id === homeBranch)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Branch admins can only create staff within their own branch.
                  </p>
                </div>
              ) : (
                <div>
                  <Label>Home Branch</Label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm mt-1"
                  >
                    <option value="">— No branch —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Temporary password is &quot;123&quot;. Staff must change it on
                first login.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                onClick={create}
                disabled={creating}
                className="bg-blue-700 hover:bg-blue-800"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
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
                variant={
                  confirm.variant === "destructive" ? "destructive" : "default"
                }
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
