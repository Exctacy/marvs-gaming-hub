"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, History, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SignaturePad, { type SignaturePadHandle } from "@/components/reports/SignaturePad";
import DocumentEditor from "@/components/documents/document-editor";
import { DocumentPaper } from "@/components/documents/document-paper";
import { documentRequest, DocumentStatusBadge, documentTime } from "@/components/documents/document-ui";
import { APPROVE_STATEMENT, INITIATE_APPROVE_STATEMENT, canEditDocument, canPrepareDocuments, canReviewDocument, isDocumentParticipant, isIssuedDocument, managementInitiated, PREPARE_STATEMENT, participantStatement, type StaffDocumentView } from "@/lib/staff-documents";

type Decision = "submit" | "approve" | "acknowledge" | "return" | "decline" | "revise";
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
  const [explanation, setExplanation] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const pad = useRef<SignaturePadHandle>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setDoc(null); setEditing(false); setDecision(null); setNote(""); setExplanation(""); setConfirmed(false); setPreviewUrl("");
    documentRequest<{ document: StaffDocumentView }>(`/api/documents/${id}`, { signal: controller.signal }).then((d) => setDoc(d.document)).catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const selected = (value: Decision) => { setDecision(value); setConfirmed(false); setNote(""); setExplanation(""); setError(""); };
  async function act() {
    if (!doc || !decision) return;
    const needsSignature = ["submit", "approve", "acknowledge"].includes(decision);
    if (needsSignature && (!confirmed || !pad.current || pad.current.isEmpty())) { setError("Draw your signature and confirm the statement."); return; }
    if (decision === "acknowledge" && doc.kind === "IR" && doc.workflowVersion === 2 && !explanation.trim()) { setError("Enter your explanation / reason for the incident before signing."); return; }
    if (["return", "decline"].includes(decision) && !note.trim()) { setError("Enter a reason before continuing."); return; }
    setBusy(true); setError("");
    try {
      const result = await documentRequest<{ id: string }>(`/api/documents/${doc.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: decision, lockVersion: doc.lockVersion, note, explanation, confirmed, ...(needsSignature ? { signature: pad.current!.getDataURL() } : {}) }) });
      toast.success(decision === "revise" ? "Correction draft created" : "Document updated");
      window.dispatchEvent(new Event("document-notices-changed"));
      if (result.id !== doc.id) router.push(`/documents/${result.id}`); else setRefresh((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update this document."); }
    finally { setBusy(false); }
  }
  async function pdf(preview: boolean) {
    if (!doc) return;
    if (preview && previewUrl) { setPreviewUrl(""); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/documents/${doc.id}/pdf${preview ? "?preview=1" : ""}`, { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Unable to generate PDF."); }
      const url = URL.createObjectURL(await response.blob());
      if (preview) setPreviewUrl(url);
      else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${doc.kind}-${doc.id}-revision-${doc.revision}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate PDF."); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (!doc) return <div className="space-y-4"><Link href="/documents" className="text-sm text-blue-700">Back to IR &amp; Memos</Link><p role="alert" className="rounded-lg border bg-white p-6 text-red-700">{error || "Document not found."}</p><Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>Try again</Button></div>;
  const editable = user && canEditDocument(user, doc);
  const reviewable = user && canReviewDocument(user, doc);
  const participant = doc.participants.find((p) => p.staffId === user?.id);
  const signable = participant?.status === "pending" && doc.status === "awaiting_acknowledgment";
  const revisable = user && canPrepareDocuments(user.role) && !isDocumentParticipant(user.id, doc) && isIssuedDocument(doc.status) && !doc.revisedBy;
  const combined = managementInitiated(doc);
  const statement = decision === "submit" ? combined ? INITIATE_APPROVE_STATEMENT : PREPARE_STATEMENT : decision === "approve" ? APPROVE_STATEMENT : participantStatement(doc.kind, doc.content, doc.workflowVersion);
  const needsSignature = decision && ["submit", "approve", "acknowledge"].includes(decision);
  const labels = { submit: combined ? "Initiate, approve & issue" : "Sign & send for approval", approve: "Approve, sign & issue", acknowledge: doc.kind === "IR" ? "Submit explanation & sign" : "Sign acknowledgment", return: "Return for changes", decline: "Decline to sign", revise: "Create correction draft" };
  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <Link href="/documents" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />IR &amp; Memos</Link>
    <header className="rounded-2xl bg-gradient-to-br from-[#071E4C] to-[#1458C7] p-6 text-white"><p className="text-xs uppercase tracking-widest text-blue-200">{doc.kind === "IR" ? "Incident Report" : "Memorandum"} / Revision {doc.revision}</p><h1 className="mt-2 text-2xl font-bold">{doc.title}</h1><p className="mt-2 text-sm text-blue-100">{doc.branchName} / {doc.participants.length} participant(s) / {doc.participants.filter((p) => p.status !== "pending").length} responded</p><div className="mt-5 flex flex-wrap items-center gap-3"><DocumentStatusBadge status={doc.status} /><Button variant="outline" className="bg-white text-navy-900" disabled={busy} onClick={() => pdf(true)}><Eye />{previewUrl ? "Close PDF preview" : "Preview printable PDF"}</Button><Button variant="outline" className="bg-white text-navy-900" disabled={busy} onClick={() => pdf(false)}><Download />Download PDF</Button><Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" disabled={busy} onClick={() => setRefresh((n) => n + 1)}><RefreshCw />Refresh</Button></div></header>
    {previewUrl && <section className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Printable PDF preview</h2><p className="text-xs text-slate-500">This is the same PDF as the download. Use its print control for a paper copy.</p></div><a className="text-sm text-blue-700 underline" href={previewUrl} target="_blank" rel="noopener noreferrer">Open full preview / print</a></div><iframe title={`${doc.kind} printable PDF preview`} src={previewUrl} className="h-[780px] w-full" /></section>}
    {(doc.supersedesId || doc.revisedBy) && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{doc.supersedesId && <p>Correction of <Link href={`/documents/${doc.supersedesId}`} className="underline">the original document</Link>.</p>}{doc.revisedBy && <p>A <Link href={`/documents/${doc.revisedBy.id}`} className="underline">linked correction (revision {doc.revisedBy.revision})</Link> exists. Original responses and signatures remain preserved.</p>}</div>}
    {doc.status === "returned" && <p className="whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Changes requested: </strong>{[...doc.events].reverse().find((e) => e.action === "RETURNED")?.note}</p>}
    {!editing && <div className="flex flex-wrap gap-2">{editable && <><Button variant="outline" disabled={busy} onClick={() => { setEditing(true); setDecision(null); }}><Pencil />Edit draft</Button><Button disabled={busy} onClick={() => selected("submit")}>{labels.submit}</Button></>}{reviewable && <><Button disabled={busy} onClick={() => selected("approve")}>Approve &amp; issue</Button><Button variant="outline" disabled={busy} onClick={() => selected("return")}>Return for changes</Button></>}{signable && <><Button disabled={busy} onClick={() => selected("acknowledge")}>{labels.acknowledge}</Button><Button variant="outline" disabled={busy} onClick={() => selected("decline")}>Decline to sign</Button></>}{revisable && <Button variant="outline" disabled={busy} onClick={() => selected("revise")}>Create correction</Button>}</div>}
    {editing ? <><Button variant="ghost" onClick={() => setEditing(false)}>Cancel editing</Button><DocumentEditor key={`${doc.id}-${doc.lockVersion}`} initial={doc} onSaved={() => setRefresh((n) => n + 1)} /></> : <DocumentPaper document={doc} />}
    {decision && !editing && <section className="rounded-xl border-2 border-blue-300 bg-blue-50/50 p-6"><h2 className="text-lg font-semibold text-navy-900">{labels[decision]}</h2>{decision === "revise" ? <p className="mt-3 text-sm">The correction copies the initiating details and participants. Each person supplies a fresh response and signature; the original remains intact.</p> : needsSignature ? <><p className="mt-3 text-sm">Signing as <strong>{user?.fullName}</strong>. Review the form above before continuing.</p>{decision === "acknowledge" && doc.kind === "IR" && <div className="mt-5"><label htmlFor="staff-explanation" className="text-sm font-semibold">Your explanation / reason for the incident {doc.workflowVersion === 2 ? "(required)" : "(optional for this legacy document)"}</label><Textarea id="staff-explanation" className="mt-2 min-h-40 bg-white" maxLength={6000} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explain what happened from your perspective and the reason or circumstances involved." /><p className="mt-2 text-xs text-slate-600">Only you can submit this explanation. Your signature binds it to this document. It becomes read-only after submission.</p></div>}<div className="mt-5 max-w-lg"><SignaturePad key={`${decision}-${doc.lockVersion}`} ref={pad} label="Your signature" /></div><label className="mt-4 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>{statement}</span></label></> : <p className="mt-3 text-sm">{decision === "return" ? "Describe the changes required from the initiator." : "Your reason for declining is recorded. Other participants can still submit their own responses."}</p>}<label htmlFor="document-note" className="mt-5 block text-sm font-medium">{["return", "decline"].includes(decision) ? "Reason (required)" : "Additional note (optional)"}</label><Textarea id="document-note" className="mt-2 bg-white" value={note} maxLength={6000} onChange={(e) => setNote(e.target.value)} /><div className="mt-4 flex flex-wrap gap-3"><Button disabled={busy || (!!needsSignature && !confirmed)} onClick={act}>{busy && <Loader2 className="animate-spin" />}{labels[decision]}</Button><Button variant="outline" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button></div></section>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <section className="rounded-xl border bg-white p-6"><h2 className="flex items-center gap-2 font-semibold"><History className="h-4 w-4" />Document history</h2><ol className="mt-5 space-y-5 border-l pl-5">{doc.events.map((event) => <li key={event.id}><p className="text-sm font-medium">{event.action.toLowerCase().replaceAll("_", " ")} <span className="font-normal text-slate-500">by {event.actorName}</span></p><p className="mt-1 text-xs text-slate-500">{documentTime(event.createdAt)} PHT / Content v{event.version}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{event.note}</p>}</li>)}</ol></section>
  </div>;
}
