"use client";
import { useState } from "react";
import { CONTENT_FIELDS, defaultSharedIncident, sharedIncidentSchema, type SharedIncidentDetails } from "@/lib/staff-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { documentRequest } from "./document-ui";

export default function SharedIncidentEditor({ documentId, lockVersion, onSaved }: { documentId: string; lockVersion: number; onSaved: () => void }) {
  const [details, setDetails] = useState<SharedIncidentDetails>(defaultSharedIncident);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const parsed = sharedIncidentSchema.safeParse(details);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the report fields."); return; }
    if (!confirmed) { setError("Confirm that this report is ready for everyone to review and sign."); return; }
    setBusy(true);
    try {
      await documentRequest(`/api/documents/${documentId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit_report", lockVersion, incidentDetails: parsed.data, confirmed }) });
      window.dispatchEvent(new Event("document-notices-changed")); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit report."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5 rounded-xl border-2 border-blue-300 bg-white p-6">
    <div><h2 className="text-lg font-semibold text-navy-900">Complete the shared incident report</h2><p className="mt-2 text-sm text-slate-600">Only one involved staff member needs to complete these fields. After submission, everyone reviews and signs the same locked report. Use “None” for equipment or actions that do not apply.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">{CONTENT_FIELDS.IR.map(([key, label, type]) => <div key={key} className={type === "textarea" ? "sm:col-span-2" : ""}><label htmlFor={`shared-${key}`} className="text-sm font-medium">{label}</label>{type === "textarea" ? <Textarea id={`shared-${key}`} disabled={busy} required className="mt-2 min-h-28" maxLength={6000} value={details[key] || ""} onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))} /> : <Input id={`shared-${key}`} type={type} disabled={busy} required={type === "date" || type === "time"} className="mt-2" maxLength={300} value={details[key] || ""} onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))} />}</div>)}</div>
    <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" /><span>I am one of the involved staff and confirm this shared report is ready for all participants to review and sign. The report will lock when submitted.</span></label>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Button type="submit" disabled={busy || !confirmed}>{busy ? "Submitting..." : "Submit shared report for signatures"}</Button>
  </form>;
}
