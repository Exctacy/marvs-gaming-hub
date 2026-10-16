"use client";
import { DOCUMENT_STATUSES, type DocumentStatus } from "@/lib/staff-documents";

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const tone = status === "completed" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : status === "declined" ? "bg-red-50 text-red-800 border-red-200" : ["pending_review", "awaiting_acknowledgment"].includes(status) ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-amber-50 text-amber-800 border-amber-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{DOCUMENT_STATUSES[status] || status}</span>;
}
export function documentTime(value: string) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export async function documentRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to process this request.");
  return data as T;
}
