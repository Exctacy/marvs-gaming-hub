import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DocumentEditor from "@/components/documents/document-editor";

export default function NewDocumentPage() {
  return <div className="mx-auto max-w-4xl space-y-6 pb-10"><Link href="/documents" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" />IR & Memos</Link><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Staff documents</p><h1 className="mt-2 text-2xl font-bold text-navy-900">Prepare an IR or memo</h1><p className="mt-2 text-sm text-slate-600">Document the details, request approval, and collect the staff member&apos;s acknowledgment.</p></div><DocumentEditor /></div>;
}
