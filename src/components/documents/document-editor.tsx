"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_FIELDS, canPrepareDocuments, defaultDocumentContent, documentInputSchema, type DocumentContent, type StaffDocumentView } from "@/lib/staff-documents";
import { documentRequest } from "./document-ui";

export default function DocumentEditor({ initial, onSaved }: { initial?: StaffDocumentView; onSaved?: () => void }) {
  const router = useRouter();
  const { branchId: activeBranchId } = useBranch();
  const user = usePortalUser();
  const branchId = initial?.branchId || activeBranchId;
  const [kind, setKind] = useState<"IR" | "MEMO">(initial?.kind || "IR");
  const [title, setTitle] = useState(initial?.title || "Incident Report");
  const [recipientId, setRecipientId] = useState(initial?.recipientId || "");
  const [content, setContent] = useState<DocumentContent>(initial?.content || defaultDocumentContent("IR"));
  const [options, setOptions] = useState<{ branches: { id: string; name: string }[]; staff: { id: string; fullName: string; role: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!branchId || !canPrepareDocuments(user?.role || "")) return;
    const controller = new AbortController();
    setOptions(null); setError("");
    if (!initial) setRecipientId("");
    documentRequest<typeof options>(`/api/documents/options?branchId=${encodeURIComponent(branchId)}`, { signal: controller.signal })
      .then(setOptions).catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [branchId, initial, user?.role]);

  if (!canPrepareDocuments(user?.role || "")) return <p className="rounded-xl border bg-white p-6">Only Team Leaders and managers can prepare documents.</p>;
  if (!branchId) return <p className="rounded-xl border bg-white p-6">Select an active branch in Settings before creating a document.</p>;
  const chooseKind = (value: "IR" | "MEMO") => {
    setKind(value); setTitle(value === "IR" ? "Incident Report" : "Equipment Acknowledgment Advisory"); setContent(defaultDocumentContent(value));
  };
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const input = { kind, title, recipientId, branchId, content };
    const parsed = documentInputSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the form fields."); return; }
    setSaving(true);
    try {
      const data = await documentRequest<{ id?: string }>(initial ? `/api/documents/${initial.id}` : "/api/documents", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, ...(initial ? { lockVersion: initial.lockVersion } : {}) }) });
      toast.success("Draft saved");
      if (initial) onSaved?.(); else router.push(`/documents/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save draft."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="space-y-6">
    {!initial && <div className="grid gap-3 sm:grid-cols-2">
      {([ ["IR", "Incident Report", "Record an incident, people involved, and actions taken.", AlertTriangle], ["MEMO", "Equipment Memo", "Issue a property responsibility acknowledgment.", ShieldCheck] ] as const).map(([value, label, description, Icon]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => chooseKind(value)} className={`rounded-xl border p-5 text-left transition ${kind === value ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "border-slate-200 bg-white hover:border-blue-300"}`}><Icon className="mb-3 h-5 w-5 text-blue-700" /><span className="block font-semibold text-navy-900">{label}</span><span className="mt-1 block text-sm text-slate-600">{description}</span></button>)}
    </div>}
    <section className="rounded-xl border bg-white p-5 sm:p-6 space-y-5">
      <div><h2 className="flex items-center gap-2 font-semibold text-navy-900"><FileText className="h-4 w-4" />Document details</h2><p className="mt-1 text-sm text-slate-500">Save a draft first. You will review and sign it before sending it to management.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="document-title" className="text-sm font-medium">Document title</label><Input id="document-title" className="mt-1.5" required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label htmlFor="document-branch" className="text-sm font-medium">Branch</label><Input id="document-branch" className="mt-1.5" disabled value={initial?.branchName || options?.branches.find((b) => b.id === branchId)?.name || "Loading branch..."} /></div>
        <div><label htmlFor="document-recipient" className="text-sm font-medium">Subject staff member</label><select id="document-recipient" required disabled={!options || saving} value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select a staff member</option>{options?.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName} ({staff.role.replaceAll("_", " ")})</option>)}</select>{options && !options.staff.length && <p className="mt-2 text-sm text-amber-700">No eligible staff in this branch. Add or activate a staff account first.</p>}</div>
        <div><label htmlFor="document-preparer" className="text-sm font-medium">Prepared / reported by</label><Input id="document-preparer" className="mt-1.5" disabled value={initial?.preparedByName || user?.fullName || ""} /></div>
      </div>
    </section>
    <section className="rounded-xl border bg-white p-5 sm:p-6"><h2 className="mb-5 font-semibold text-navy-900">{kind === "IR" ? "Incident details" : "Memorandum content"}</h2><div className="grid gap-5 sm:grid-cols-2">
      {CONTENT_FIELDS[kind].map(([key, label, type]) => <div key={key} className={type === "textarea" || key === "subject" ? "sm:col-span-2" : ""}><label htmlFor={`field-${key}`} className="text-sm font-medium">{label}</label>{type === "textarea" ? <Textarea id={`field-${key}`} className="mt-1.5 min-h-[110px]" maxLength={6000} value={(content as unknown as Record<string, string>)[key] || ""} onChange={(e) => setContent((c) => ({ ...c, [key]: e.target.value }))} /> : <Input id={`field-${key}`} type={type} className="mt-1.5" required={type === "date" || type === "time" || key === "from" || key === "subject"} maxLength={300} value={(content as unknown as Record<string, string>)[key] || ""} onChange={(e) => setContent((c) => ({ ...c, [key]: e.target.value }))} />}</div>)}
    </div></section>
    {kind === "MEMO" && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This template includes policy wording for management review. Creating an IR or memo does not automatically apply a disciplinary action.</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={saving || !options}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save draft</Button><p className="text-xs text-slate-500">Drafts are private to the preparer and authorized managers.</p></div>
  </form>;
}
