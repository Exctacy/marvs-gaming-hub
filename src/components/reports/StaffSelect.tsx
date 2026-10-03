import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface StaffOption {
  id: string;
  fullName: string;
  role: string;
}

interface StaffSelectProps {
  branchId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function StaffSelect({
  branchId,
  value,
  onChange,
  placeholder = "Select staff...",
  disabled = false,
}: StaffSelectProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!branchId) {
      setStaff([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    fetch(`/api/staff/by-branch?branchId=${encodeURIComponent(branchId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load branch staff.");
        setStaff(d.staff || []);
      })
      .catch((e: unknown) => {
        setStaff([]);
        setError(e instanceof Error ? e.message : "Could not load branch staff.");
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  if (error) {
    return (
      <p role="alert" className="mt-1 text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 h-10 rounded-lg border border-border bg-white">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 h-10 rounded-lg border border-border bg-white text-sm font-medium text-navy-900 disabled:bg-muted disabled:text-muted-foreground"
    >
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.fullName}>
          {s.fullName} ({s.role.replace(/_/g, " ")})
        </option>
      ))}
    </select>
  );
}
