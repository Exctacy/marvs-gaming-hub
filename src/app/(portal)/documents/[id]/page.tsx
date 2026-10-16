"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, History, Loader2, LockKeyhole, Pencil, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SignaturePad, { type SignaturePadHandle } from "@/components/reports/SignaturePad";
import DocumentEditor from "@/components/documents/document-editor";
import { documentRequest, DocumentStatusBadge, documentTime } from "@/components/documents/document-ui";
import { APPROVE_STATEMENT, canEditDocument, canPrepareDocuments, canReviewDocument, CONTENT_FIELDS, isIssuedDocument, PREPARE_STATEMENT, receiptStatement, type StaffDocumentView } from "@/lib/staff-documents";

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = usePortalUser();
  const router = useRouter();
  const [doc, setDoc] = useState<StaffDocumentView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"submit" | "approve" | "acknowledge" | "return" | "decline" | "revise" | null>(null);
  const pad = useRef<SignaturePadHandle>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setDoc(null); setEditing(false); setDecision(null); setNote(""); setConfirmed(false);
    documentRequest<{ document: StaffDocumentView }>(`/api/documents/${id}`, { signal: controller.signal }).then((d) => setDoc(d.document)).catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);
  async function act() {
    if (!doc || !decision) return;
    const needsSignature = ["submit", "approve", "acknowledge"].includes(decision);
    if (needsSignature && (!confirmed || !pad.current || pad.current.isEmpty())) { setError("Draw your signature and confirm the statement."); return; }
    if (["return", "decline"].includes(decision) && !note.trim()) { setError("Enter a reason before continuing."); return; }
    setBusy(true); setError("");
    try {
      const result = await documentRequest<{ id: string }>(`/api/documents/${doc.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: decision, lockVersion: doc.lockVersion, note, confirmed, ...(needsSignature ? { signature: pad.current!.getDataURL() } : {}) }) });
      toast.success(decision === "revise" ? "Correction draft created" : "Document updated");
      window.dispatchEvent(new Event("document-notices-changed"));
      if (result.id !== doc.id) router.push(`/documents/${result.id}`); else setRefresh((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update this document."); }
    finally { setBusy(false); }
  }
  async function download() {
    if (!doc) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/documents/${doc.id}/pdf`, { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to download PDF."); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${doc.kind}-${doc.id}-revision-${doc.revision}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to download PDF."); }
    finally { setBusy(false); }
  }
  const selectDecision = (value: NonNullable<typeof decision>) => { setDecision(value); setConfirmed(false); setNote(""); setError(""); };
  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (!doc) return <div className="space-y-4"><Link href="/documents" className="text-sm text-blue-700">Back to IR & Memos</Link><p role="alert" className="rounded-lg border bg-white p-6 text-red-700">{error || "Document not found."}</p><Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>Try again</Button></div>;
  const actor = user ? { ...user } : null;
  const editable = actor && canEditDocument(actor, doc);
  const reviewable = actor && canReviewDocument(actor, doc);
  const signable = user?.id === doc.recipientId && doc.status === "awaiting_acknowledgment";
  const revisable = user && canPrepareDocuments(user.role) && user.id !== doc.recipientId && isIssuedDocument(doc.status) && !doc.revisedBy;
  const statement = decision === "submit" ? PREPARE_STATEMENT : decision === "approve" ? APPROVE_STATEMENT : receiptStatement(doc.kind, doc.content);
  const needsSignature = decision && ["submit", "approve", "acknowledge"].includes(decision);
  const decisionLabel = { submit: "Sign & send for approval", approve: "Approve, sign & issue", acknowledge: "Sign acknowledgment", return: "Return for changes", decline: "Decline acknowledgment", revise: "Create correction draft" };
  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <Link href="/documents" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />IR & Memos</Link>
    <header className="rounded-2xl bg-gradient-to-br from-[#071E4C] to-[#1458C7] p-6 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-blue-200">{doc.kind === "IR" ? "Incident Report" : "Memorandum"} · Revision {doc.revision}</p><h1 className="mt-2 text-2xl font-bold">{doc.title}</h1><p className="mt-2 text-sm text-blue-100">For {doc.recipientName} · {doc.branchName}</p></div><Button disabled={busy} variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={download}><Download />Download PDF</Button></div><div className="mt-5 flex flex-wrap items-center gap-3"><DocumentStatusBadge status={doc.status} /><span className="text-xs text-blue-100">Content version {doc.contentVersion}</span></div></header>
    {(doc.supersedesId || doc.revisedBy) && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{doc.supersedesId && <p>This is a correction of an earlier document. <Link href={`/documents/${doc.supersedesId}`} className="font-medium underline">View original</Link>.</p>}{doc.revisedBy && <p>A linked correction exists. <Link href={`/documents/${doc.revisedBy.id}`} className="font-medium underline">View revision {doc.revisedBy.revision}</Link>. This document and its signatures remain preserved.</p>}</div>}
    {doc.status === "returned" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Changes requested</strong><p className="mt-1 whitespace-pre-wrap">{[...doc.events].reverse().find((e) => e.action === "RETURNED")?.note}</p></div>}
    {!editing && <div className="flex flex-wrap gap-2">{editable && <><Button variant="outline" onClick={() => { setEditing(true); setDecision(null); }}><Pencil />Edit draft</Button><Button onClick={() => selectDecision("submit")}><Send />Review & submit</Button></>}{reviewable && <><Button onClick={() => selectDecision("approve")}><ShieldCheck />Approve & issue</Button><Button variant="outline" onClick={() => selectDecision("return")}>Return for changes</Button></>}{signable && <><Button onClick={() => selectDecision("acknowledge")}><CheckCircle2 />Review & sign</Button><Button variant="outline" onClick={() => selectDecision("decline")}>Decline acknowledgment</Button></>}{revisable && <Button variant="outline" onClick={() => selectDecision("revise")}><Pencil />Create correction</Button>}</div>}
    {editing ? <><Button variant="ghost" onClick={() => setEditing(false)}>Cancel editing</Button><DocumentEditor key={`${doc.id}-${doc.lockVersion}`} initial={doc} onSaved={() => setRefresh((n) => n + 1)} /></> : <article className="rounded-xl border bg-white p-6 sm:p-8"><div className="mb-6 grid gap-4 border-b pb-6 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-slate-500">Subject staff member</p><p className="mt-1 font-semibold text-navy-900">{doc.recipientName}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Prepared / reported by</p><p className="mt-1 font-semibold text-navy-900">{doc.preparedByName}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Branch</p><p className="mt-1">{doc.branchName}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Reference</p><p className="mt-1 break-all font-mono text-xs">{doc.id}</p></div></div><div className="grid gap-6 sm:grid-cols-2">{CONTENT_FIELDS[doc.kind].map(([key, label, type]) => <section key={key} className={type === "textarea" || key === "subject" ? "sm:col-span-2" : ""}><h2 className="text-sm font-semibold text-navy-900">{label}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{(doc.content as unknown as Record<string, string>)[key] || "Not specified"}</p></section>)}</div>{doc.contentHash && <div className="mt-8 border-t pt-4"><p className="flex items-center gap-2 text-xs font-medium text-slate-600"><LockKeyhole className="h-3.5 w-3.5" />Signatures are tied to this content version</p><p className="mt-2 break-all font-mono text-[10px] text-slate-400">SHA-256: {doc.contentHash}</p></div>}</article>}
    {!editing && <section className="rounded-xl border bg-white p-6"><h2 className="font-semibold text-navy-900">Signatures & acknowledgment</h2><p className="mt-1 text-xs text-slate-500">Only signatures for content version {doc.contentVersion} appear below. All earlier signature records are retained.</p><div className="mt-5 grid gap-4 md:grid-cols-3">{([ ["prepared", "Prepared by"], ["approved", "Approved by"], ["acknowledged", "Staff acknowledgment"] ] as const).map(([purpose, label]) => { const sig = doc.signatures.find((s) => s.purpose === purpose && s.contentVersion === doc.contentVersion); return <div key={purpose} className="rounded-lg border bg-slate-50 p-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>{sig ? <><img src={sig.image} alt={`${label}: ${sig.signerName}`} className="mt-3 h-24 w-full rounded bg-white object-contain" /><p className="mt-3 text-sm font-semibold">{sig.signerName}</p><p className="mt-1 text-xs text-slate-500">{sig.signerRole.replaceAll("_", " ")} · {documentTime(sig.signedAt)} PHT</p><p className="mt-3 text-xs leading-relaxed text-slate-600">{sig.statement}</p></> : <p className="py-8 text-sm text-slate-400">{purpose === "acknowledged" && doc.status === "declined" ? "Acknowledgment declined" : "Awaiting signature"}</p>}</div>; })}</div></section>}
    {decision && !editing && <section className="rounded-xl border-2 border-blue-300 bg-blue-50/50 p-6"><h2 className="text-lg font-semibold text-navy-900">{decisionLabel[decision]}</h2>{decision === "revise" ? <p className="mt-3 text-sm text-slate-700">A new draft will copy this document. Existing signatures stay with the original. The correction requires fresh preparation, approval, and staff acknowledgment.</p> : needsSignature ? <><p className="mt-3 text-sm text-slate-700">You are signing as <strong>{user?.fullName}</strong> for content version {doc.contentVersion}. Review the full document above before continuing.</p><div className="mt-4 max-w-lg"><SignaturePad key={`${decision}-${doc.lockVersion}`} ref={pad} label="Your signature" /></div><label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-slate-700"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>{statement}</span></label></> : <p className="mt-3 text-sm text-slate-700">{decision === "return" ? "Explain the changes needed. The preparer will be notified." : "Your reason will be recorded and shared with the preparer and authorized managers. No staff signature will be added."}</p>}<label htmlFor="document-note" className="mt-5 block text-sm font-medium">{decision === "return" || decision === "decline" ? "Reason (required)" : decision === "acknowledge" ? "Your response (optional)" : "Note (optional)"}</label><Textarea id="document-note" value={note} maxLength={6000} onChange={(e) => setNote(e.target.value)} className="mt-2 bg-white" /><div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || (!!needsSignature && !confirmed)} onClick={act}>{busy && <Loader2 className="animate-spin" />}{decisionLabel[decision]}</Button><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button></div></section>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="rounded-xl border bg-white p-6"><h2 className="flex items-center gap-2 font-semibold text-navy-900"><History className="h-4 w-4" />Document history</h2><ol className="mt-5 space-y-5 border-l border-slate-200 pl-5">{doc.events.map((event) => <li key={event.id}><p className="text-sm font-medium text-navy-900">{event.action.toLowerCase().replaceAll("_", " ")} <span className="font-normal text-slate-500">by {event.actorName}</span></p><p className="mt-1 text-xs text-slate-500">{documentTime(event.createdAt)} PHT · Content v{event.version}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{event.note}</p>}</li>)}</ol></section>
  </div>;
}
