import { z } from "zod";

export const DOCUMENT_STATUSES = {
  draft: "Draft", pending_review: "Pending approval", returned: "Returned for changes",
  awaiting_acknowledgment: "Awaiting staff responses", completed: "All participants signed", declined: "Completed with declined signatures",
} as const;
export type DocumentStatus = keyof typeof DOCUMENT_STATUSES;
export const canPrepareDocuments = (role: string) => ["team_leader", "management", "super_admin"].includes(role);
export const managementInitiated = (doc: { initiatedByRole?: string }) => ["management", "super_admin"].includes(doc.initiatedByRole || "");
export const canApproveDocuments = (role: string) => ["admin", "management", "super_admin"].includes(role);
export const isGlobalDocumentManager = (role: string) => ["management", "super_admin"].includes(role);
export const isIssuedDocument = (status: string) => ["awaiting_acknowledgment", "completed", "declined"].includes(status);

type Actor = { id: string; role: string; branchId: string | null };
type DocumentAccess = { createdById: string; recipientId: string; branchId: string; status: string; participants?: { staffId: string }[] };
export const isDocumentParticipant = (id: string, doc: Pick<DocumentAccess, "recipientId" | "participants">) => doc.participants?.length ? doc.participants.some((p) => p.staffId === id) : doc.recipientId === id;
export function canReadDocument(user: Actor, doc: DocumentAccess) {
  if (isDocumentParticipant(user.id, doc) && isIssuedDocument(doc.status)) return true;
  const inBranch = isGlobalDocumentManager(user.role) || (!!user.branchId && user.branchId === doc.branchId);
  return inBranch && (canApproveDocuments(user.role) || (user.id === doc.createdById && canPrepareDocuments(user.role)));
}
export function canEditDocument(user: Actor, doc: DocumentAccess) {
  return canReadDocument(user, doc) && user.id === doc.createdById && canPrepareDocuments(user.role) && ["draft", "returned"].includes(doc.status);
}
export function canReviewDocument(user: Actor, doc: DocumentAccess) {
  return canReadDocument(user, doc) && canApproveDocuments(user.role) && user.id !== doc.createdById && !isDocumentParticipant(user.id, doc) && doc.status === "pending_review";
}

const text = z.string().trim().max(6000);
const shortText = z.string().trim().max(300);
const date = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Enter a valid date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
export const incidentContentSchema = z.object({
  reportDate: date, reportTime: time, incidentDate: date, incidentTime: time,
  personsInvolved: shortText, witnesses: shortText, whatHappened: text, howHappened: text.optional(),
  equipment: text, actionsTaken: text,
}).strict();
export const memoContentSchema = z.object({
  memoDate: date, from: shortText.min(1), subject: shortText.min(1), purpose: text,
  properties: text, acknowledgment: text.min(1), policyReference: text, disciplinaryAction: text,
}).strict();
const participantIds = z.array(z.string().min(1)).min(1, "Select at least one staff member").max(50).refine((ids) => new Set(ids).size === ids.length, "Select each staff member only once");
export const documentInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("IR"), title: shortText.min(1), branchId: z.string().min(1), participantIds, content: incidentContentSchema }).strict(),
  z.object({ kind: z.literal("MEMO"), title: shortText.min(1), branchId: z.string().min(1), participantIds, content: memoContentSchema }).strict(),
]);
export type DocumentInput = z.infer<typeof documentInputSchema>;
export type DocumentContent = DocumentInput["content"];
// Only bounded PNG data URLs from the signature canvas are accepted.
export const signatureSchema = z.string().max(180000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, "Draw your signature");
export const actionSchema = z.object({
  action: z.enum(["submit", "approve", "return", "acknowledge", "decline", "revise"]),
  lockVersion: z.number().int().positive(), signature: signatureSchema.optional(),
  note: z.string().trim().max(6000).default(""), confirmed: z.boolean().default(false),
  explanation: z.string().trim().max(6000).default(""),
}).strict();

export const PREPARE_STATEMENT = "I prepared this document and confirm it is ready for management review.";
export const APPROVE_STATEMENT = "I reviewed and approve this version for issuance to the named staff participants.";
export const INITIATE_APPROVE_STATEMENT = "I initiate and approve this document for issuance to all named participants.";
export const IR_RECEIPT_STATEMENT = "I acknowledge receipt of this incident report. My signature confirms receipt and does not necessarily indicate agreement with its contents.";
export function receiptStatement(kind: string, content: DocumentContent) {
  return kind === "IR" ? IR_RECEIPT_STATEMENT : (content as z.infer<typeof memoContentSchema>).acknowledgment;
}
export function participantStatement(kind: string, content: DocumentContent, workflowVersion: number) {
  return receiptStatement(kind, content) + (kind === "IR" && workflowVersion === 2 ? " I confirm that the explanation submitted under my name is my own response." : "");
}
export function submissionError(input: Pick<DocumentInput, "kind" | "content">): string | null {
  if (input.kind === "IR") {
    const c = input.content as z.infer<typeof incidentContentSchema>;
    if (!c.whatHappened) return "Describe the incident or issue requiring the staff members' explanations before issuing.";
  } else {
    const c = input.content as z.infer<typeof memoContentSchema>;
    if (!c.purpose || !c.properties || !c.acknowledgment) return "Complete purpose, properties, and acknowledgment before submitting.";
  }
  return null;
}

export function manilaDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
export function defaultDocumentContent(kind: "IR" | "MEMO"): DocumentContent {
  const { date, time } = manilaDateTime();
  return kind === "IR" ? {
    reportDate: date, reportTime: time, incidentDate: date, incidentTime: time,
    personsInvolved: "", witnesses: "", whatHappened: "", howHappened: "", equipment: "", actionsTaken: "",
  } : {
    memoDate: date, from: "Management", subject: "Acknowledgment of MARVS Gaming Hub Properties",
    purpose: "This memorandum serves as formal acknowledgment of the properties, equipment, and facilities assigned to the staff member at the branch identified above.",
    properties: "Computers/Clients: PC clients, mouse, keyboard, headset, and gaming chair.\nNetworking Equipment: Router, switch, and LAN cable.\nServer PC: Software, apps, and games.\nOthers: Kitchen equipment, webcam, gamepad controller, and technician tools.",
    acknowledgment: "I hereby acknowledge receipt and responsibility for the above-listed MARVS Gaming Hub properties. I understand that these assets are to be used solely for official purposes, maintained in good condition, and returned upon request or at the end of assignment.",
    policyReference: "As per company policy and MARVS Gaming Hub operational guidelines, employees are expected to carry out their duties responsibly and consistently. Failure to do so constitutes a breach of professional conduct.",
    disciplinaryAction: "First offense: Written warning or Incident Report.\nSecond offense: Suspension.\nThird offense: Termination of employment, subject to management decision.",
  };
}

export const CONTENT_FIELDS = {
  IR: [
    ["reportDate", "Date of report", "date"], ["reportTime", "Time of report (Manila)", "time"],
    ["incidentDate", "Date of incident", "date"], ["incidentTime", "Time of incident (Manila)", "time"],
    ["personsInvolved", "Other persons involved", "text"], ["witnesses", "Witnesses", "text"],
    ["whatHappened", "Incident / issue requiring explanation", "textarea"],
    ["equipment", "Equipment / property involved", "textarea"], ["actionsTaken", "Immediate actions taken", "textarea"],
  ],
  MEMO: [
    ["memoDate", "Date of memorandum", "date"], ["from", "From", "text"], ["subject", "Subject", "text"],
    ["purpose", "Purpose", "textarea"], ["properties", "Details of properties", "textarea"],
    ["acknowledgment", "Staff acknowledgment statement", "textarea"], ["policyReference", "Policy reference", "textarea"],
    ["disciplinaryAction", "Disciplinary action (management review)", "textarea"],
  ],
} as const;

export interface DocumentSignatureView {
  id: string; contentVersion: number; contentHash: string; purpose: string; signerId: string;
  signerName: string; signerRole: string; image: string; statement: string; signedAt: string;
  responseHash?: string | null;
}
export interface DocumentParticipantView {
  id: string; staffId: string; staffName: string; status: string; explanation: string; responseNote: string; respondedAt: string | null;
}
export interface StaffDocumentView {
  id: string; kind: "IR" | "MEMO"; title: string; branchId: string; branchName: string;
  recipientId: string; recipientName: string; createdById: string; preparedByName: string;
  initiatedByRole: string; workflowVersion: number; participants: DocumentParticipantView[];
  status: DocumentStatus; content: DocumentContent; contentVersion: number; lockVersion: number;
  contentHash: string | null; revision: number; supersedesId: string | null;
  revisedBy?: { id: string; revision: number } | null;
  createdAt: string; updatedAt: string; signatures: DocumentSignatureView[];
  events: { id: string; actorName: string; action: string; note: string | null; version: number; createdAt: string }[];
}
