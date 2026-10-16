"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, FileText, Loader2, Plus, Search, ArrowRight } from "lucide-react";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canPrepareDocuments, DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/staff-documents";
import { documentRequest, DocumentStatusBadge, documentTime } from "@/components/documents/document-ui";

type Row = { id: string; kind: string; title: string; branchName: string; recipientName: string; preparedByName: string; status: DocumentStatus; revision: number; createdAt: string };
type Notice = { id: string; documentId: string; message: string; createdAt: string };
export default function DocumentsPage() {
  const user = usePortalUser();
  const { branchId } = useBranch();
  const canPrepare = canPrepareDocuments(user?.role || "");
  const [view, setView] = useState("workspace");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ documents: Row[]; total: number; awaitingSignature: number } | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const mine = !canPrepare || view === "mine";
  useEffect(() => { setPage(1); }, [branchId, view, status, query]);
  useEffect(() => {
    if (!mine && !branchId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    const params = new URLSearchParams({ view: mine ? "mine" : "workspace", page: String(page), status, q: query });
    if (branchId) params.set("branchId", branchId);
    const timer = setTimeout(() => {
      documentRequest<NonNullable<typeof data>>(`/api/documents?${params}`, { signal: controller.signal }).then(setData).catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [branchId, mine, page, status, query, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    documentRequest<{ notices: Notice[] }>("/api/documents/notifications", { signal: controller.signal }).then((d) => setNotices(d.notices)).catch(() => {});
    return () => controller.abort();
  }, [refresh]);
  async function dismissNotice(id: string) {
    try { await documentRequest("/api/documents/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) }); setNotices((n) => n.filter((x) => x.id !== id)); window.dispatchEvent(new Event("document-notices-changed")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to dismiss notification."); }
  }
  return <div className="mx-auto max-w-6xl space-y-6 pb-10">
    <div className="rounded-2xl bg-gradient-to-br from-[#071E4C] to-[#1458C7] p-6 text-white sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Staff accountability</p><h1 className="mt-2 text-2xl font-bold">IR & Memos</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">Prepare documents, review approvals, and keep a clear record of staff acknowledgments.</p></div>{canPrepare && <Button asChild className="bg-white text-blue-900 hover:bg-blue-50"><Link href="/documents/new"><Plus />New document</Link></Button>}</div><div className="mt-6 flex flex-wrap gap-3 text-xs text-blue-100"><span className="rounded-full bg-white/10 px-3 py-2">01 Prepare</span><span className="rounded-full bg-white/10 px-3 py-2">02 Management approval</span><span className="rounded-full bg-white/10 px-3 py-2">03 Staff acknowledgment</span></div></div>
    {notices.length > 0 && <section className="rounded-xl border border-blue-200 bg-blue-50 p-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-blue-900"><Bell className="h-4 w-4" />Document notifications <span className="text-xs font-normal">({notices.length})</span></h2><div className="mt-3 divide-y divide-blue-100">{notices.map((n) => <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><Link href={`/documents/${n.documentId}`} className="text-sm text-blue-900 hover:underline">{n.message}<span className="ml-2 text-xs text-blue-700">{documentTime(n.createdAt)}</span></Link><button onClick={() => dismissNotice(n.id)} className="text-xs text-blue-700 hover:underline">Mark read</button></div>)}</div></section>}
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="inline-flex rounded-lg border bg-white p-1">{canPrepare && <button onClick={() => setView("workspace")} className={`rounded-md px-4 py-2 text-sm font-medium ${!mine ? "bg-navy-900 text-white" : "text-slate-600"}`}>{user?.role === "team_leader" ? "Prepared by me" : "Branch documents"}</button>}<button onClick={() => setView("mine")} className={`rounded-md px-4 py-2 text-sm font-medium ${mine ? "bg-navy-900 text-white" : "text-slate-600"}`}>My documents{data?.awaitingSignature ? ` (${data.awaitingSignature} to sign)` : ""}</button></div><Button variant="outline" size="sm" onClick={() => setRefresh((r) => r + 1)}>Refresh</Button></div>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap gap-3 border-b p-4"><div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="Search documents" placeholder="Search title or staff name..." className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} /></div><select aria-label="Filter document status" className="h-10 rounded-md border bg-white px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(DOCUMENT_STATUSES).filter(([key]) => !mine || ["awaiting_acknowledgment", "completed", "declined"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {error ? <div role="alert" className="p-8 text-sm text-red-700">{error}</div> : loading ? <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-blue-700" /></div> : !mine && !branchId ? <p className="p-8 text-sm text-slate-600">Select a branch in Settings to view its documents.</p> : !data?.documents.length ? <div className="px-6 py-16 text-center"><FileText className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-4 font-semibold text-navy-900">{mine ? "No issued documents" : "No documents found"}</h2><p className="mt-2 text-sm text-slate-500">{mine ? "Documents issued to you will appear here for review and signing." : "Create an incident report or equipment memo to get started."}</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Document</th><th className="px-5 py-3">Staff / branch</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th><th className="px-5 py-3"><span className="sr-only">Open document</span></th></tr></thead><tbody className="divide-y">{data.documents.map((doc) => <tr key={doc.id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link className="font-semibold text-navy-900 hover:text-blue-700" href={`/documents/${doc.id}`}>{doc.title}</Link><p className="mt-1 text-xs text-slate-500">{doc.kind === "IR" ? "Incident Report" : "Memo"} · Revision {doc.revision}</p></td><td className="px-5 py-4"><p>{doc.recipientName}</p><p className="mt-1 text-xs text-slate-500">{doc.branchName}</p></td><td className="px-5 py-4"><DocumentStatusBadge status={doc.status} /></td><td className="px-5 py-4 text-xs text-slate-500">{documentTime(doc.createdAt)}</td><td className="px-5 py-4"><Link aria-label={`Open ${doc.title}`} href={`/documents/${doc.id}`} className="inline-flex p-2 text-blue-700"><ArrowRight className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div>}
      {data && data.total > 20 && <div className="flex items-center justify-between border-t p-4 text-sm"><span className="text-slate-500">Page {page} of {Math.ceil(data.total / 20)} · {data.total} documents</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 20 >= data.total || loading} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>}
    </section>
  </div>;
}
