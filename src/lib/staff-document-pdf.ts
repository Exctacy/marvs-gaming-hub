import { jsPDF } from "jspdf";
import { CONTENT_FIELDS, DOCUMENT_STATUSES, IR_RECEIPT_STATEMENT, type StaffDocumentView } from "./staff-documents";

// Generated from the stored version, never from unsaved browser form values.
export function buildStaffDocumentPdf(document: StaffDocumentView): Uint8Array {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const margin = 46, pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
  const width = pageWidth - margin * 2;
  let y = margin;
  const ascii = (text: string) => text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-").replace(/\u2026/g, "...");
  const ensure = (height: number) => { if (y + height > pageHeight - 48) { pdf.addPage(); y = margin; } };
  const text = (value: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(30, 41, 59);
    const lines = pdf.splitTextToSize(ascii(value || "Not specified"), width) as string[];
    for (const line of lines) { ensure(size + 5); pdf.text(line, margin, y + size); y += size + 5; }
    y += 5;
  };
  const section = (title: string, body: string) => { ensure(50); text(title, 11, true); text(body); y += 7; };
  const timestamp = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) + " PHT";
  text("MARVS GAMING HUB", 11, true);
  text(document.kind === "IR" ? "INCIDENT REPORT FORM" : "MEMORANDUM", 19, true);
  text(document.title, 12, true);
  text(`${DOCUMENT_STATUSES[document.status]} | Revision ${document.revision} | Content version ${document.contentVersion}`, 9);
  if (["draft", "returned", "pending_review"].includes(document.status)) text("NOT YET ISSUED - FOR PREPARATION / MANAGEMENT REVIEW", 9, true);
  text(`Reference: ${document.id}`, 8);
  text(`Branch: ${document.branchName}`);
  text(`To / subject staff member: ${document.recipientName}`);
  text(`Reported / prepared by: ${document.preparedByName}`);
  y += 6;
  const content = document.content as unknown as Record<string, string>;
  for (const [key, label] of CONTENT_FIELDS[document.kind]) section(label, content[key]);
  if (document.kind === "IR") section("Staff receipt acknowledgment", IR_RECEIPT_STATEMENT);
  if (document.kind === "MEMO") section("Confirmation", "By signing below, I confirm the acknowledgment statement in this memorandum.");
  ensure(45); text("SIGNATURES", 13, true);
  for (const [purpose, label] of [["prepared", "Prepared by"], ["approved", "Approved by"], ["acknowledged", "Acknowledged by"]]) {
    const sig = document.signatures.find((s) => s.purpose === purpose && s.contentVersion === document.contentVersion);
    ensure(160); text(label, 11, true);
    if (sig) {
      pdf.addImage(sig.image, "PNG", margin, y, 200, 70); y += 78;
      text(`${sig.signerName} (${sig.signerRole.replaceAll("_", " ")})`, 10, true);
      text(`Signed: ${timestamp(sig.signedAt)}`, 9);
      text(sig.statement, 9);
    } else text(document.status === "declined" && purpose === "acknowledged" ? "Acknowledgment declined; no staff signature recorded." : "Not yet signed.", 9);
    y += 12;
  }
  if (document.supersedesId) section("Revision reference", `Correction of document ${document.supersedesId}. Original signatures remain on the original record.`);
  if (document.revisedBy) section("Linked correction", `Revision ${document.revisedBy.revision}: ${document.revisedBy.id}. Check the portal for its current approval status.`);
  if (document.contentHash) section("Content fingerprint (SHA-256)", document.contentHash);
  ensure(40); text("DOCUMENT HISTORY", 13, true);
  for (const event of document.events) {
    section(`${event.action.replaceAll("_", " ")} - ${event.actorName}`, `${timestamp(event.createdAt)} | Content version ${event.version}${event.note ? `\n${event.note}` : ""}`);
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(220, 225, 232); pdf.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
    pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
    pdf.text("CONFIDENTIAL - Staff document", margin, pageHeight - 22);
    pdf.text(`Revision ${document.revision} | ${page} / ${pages}`, pageWidth - margin, pageHeight - 22, { align: "right" });
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
