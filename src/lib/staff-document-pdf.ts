import { jsPDF } from "jspdf";
import { CONTENT_FIELDS, DOCUMENT_STATUSES, managementInitiated, participantStatement, receiptStatement, type StaffDocumentView } from "./staff-documents";

/** Formal printable form. System activity stays in the portal rather than bloating the paper copy. */
export function buildStaffDocumentPdf(doc: StaffDocumentView): Uint8Array {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42, width = pageWidth - margin * 2, bottom = pageHeight - 45;
  let y = margin;
  let continuingParticipant = "";
  const clean = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2022/g, "-").replace(/\u2026/g, "...");
  const font = (size: number, bold = false) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); pdf.setTextColor(25, 35, 50); };
  const header = (continued = false) => {
    font(11, true); pdf.text("MARVS GAMING HUB", pageWidth / 2, y + 11, { align: "center" }); y += 22;
    font(17, true); pdf.text(`${doc.kind === "IR" ? "INCIDENT REPORT" : "MEMORANDUM"}${continued ? " (continued)" : ""}`, pageWidth / 2, y + 17, { align: "center" }); y += 28;
    pdf.setDrawColor(25, 55, 100); pdf.setLineWidth(1); pdf.line(margin, y, pageWidth - margin, y); y += 14;
  };
  const ensure = (height: number) => { if (y + height > bottom) { pdf.addPage(); y = margin; header(true); if (continuingParticipant) { font(8, true); pdf.text(clean(`${continuingParticipant} - explanation / response continued`), margin, y + 8); y += 20; } } };
  const linesFor = (s: string, size = 9.5, w = width, bold = false): string[] => { font(size, bold); return pdf.splitTextToSize(clean(s || "Not specified"), w) as string[]; };
  const text = (s: string, size = 9.5, bold = false) => {
    for (const line of linesFor(s, size, width, bold)) { ensure(size + 4); font(size, bold); pdf.text(line, margin, y + size); y += size + 4; }
  };
  const section = (title: string, value: string) => { ensure(40); y += 5; text(title.toUpperCase(), 8.5, true); y += 2; text(value); y += 5; };
  const timestamp = (date: string) => new Date(date).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) + " PHT";
  const current = doc.signatures.filter((s) => s.contentVersion === doc.contentVersion);
  const findSignature = (purpose: string, staffId?: string) => current.find((s) => s.purpose === purpose && (!staffId || s.signerId === staffId));
  header();
  text(doc.title, 11, true); y += 5;
  text(`Branch: ${doc.branchName}   |   Revision: ${doc.revision}`, 9);
  text(`Status: ${DOCUMENT_STATUSES[doc.status]}`, 8.5);
  if (["draft", "returned", "pending_review"].includes(doc.status)) text("DRAFT / NOT YET ISSUED", 8, true);
  text(`To / staff involved: ${doc.participants.map((p) => p.staffName).join(", ")}`, 9);
  text(`Initiated by: ${doc.preparedByName}`, 9); y += 6;
  const sharedIR = doc.kind === "IR" && doc.workflowVersion === 3;
  const content = (sharedIR ? doc.incidentReport?.details || {} : doc.content) as unknown as Record<string, string>;
  if (sharedIR) {
    section("Instructions to involved staff", (doc.content as { instructions?: string }).instructions || "Complete the shared incident report, then review and sign.");
    if (doc.incidentReport) text(`Report completed by: ${doc.incidentReport.submittedByName} | ${timestamp(doc.incidentReport.submittedAt)}`, 8.5);
    else section("Shared incident report", "Awaiting completion by one involved staff member. Incident details, witnesses, other persons involved, equipment, and immediate actions will be provided by staff.");
  }
  // Compact the basic date/time information into pairs; long narrative sections wrap naturally.
  const fields = sharedIR && !doc.incidentReport ? [] : CONTENT_FIELDS[doc.kind];
  const basic = fields.filter(([, , type]) => type !== "textarea");
  for (let i = 0; i < basic.length; i += 2) {
    const row = basic.slice(i, i + 2), colWidth = (width - 18) / 2;
    const columns = row.map(([key, label]) => linesFor(`${label}: ${content[key] || "Not specified"}`, 9, colWidth));
    const height = Math.max(...columns.map((c) => c.length)) * 13 + 6;
    if (height > 120) { for (const [key, label] of row) section(label, content[key]); continue; }
    ensure(height);
    columns.forEach((lines, col) => { font(9); lines.forEach((line, lineIndex) => pdf.text(line, margin + col * (colWidth + 18), y + 9 + lineIndex * 13)); }); y += height;
  }
  for (const [key, label, type] of fields) if (type === "textarea" && key !== "acknowledgment") section(label, content[key]);

  section(sharedIR ? "Staff signatures on the shared report" : doc.kind === "IR" ? "Staff explanations and signatures" : "Staff acknowledgments", (sharedIR ? participantStatement(doc.kind, doc.content, doc.workflowVersion) : receiptStatement(doc.kind, doc.content)));
  const compactMemo = (doc.kind === "MEMO" || sharedIR) && doc.participants.every((p) => !p.responseNote);
  if (compactMemo) {
    for (let i = 0; i < doc.participants.length; i += 2) {
      const row = doc.participants.slice(i, i + 2);
      const nameLines = row.map((p) => linesFor(p.staffName, 9, width / 2 - 15, true));
      const nameHeight = Math.max(...nameLines.map((lines) => lines.length)) * 12;
      const rowHeight = nameHeight + 90;
      ensure(rowHeight);
      row.forEach((participant, index) => {
        const x = margin + index * (width / 2), sig = findSignature("acknowledged", participant.staffId);
        font(9, true); nameLines[index].forEach((line, lineIndex) => pdf.text(line, x, y + 10 + lineIndex * 12));
        font(7.5); pdf.text(participant.status === "pending" ? "Awaiting response" : participant.status, x, y + nameHeight + 12);
        if (sig) pdf.addImage(sig.image, "PNG", x, y + nameHeight + 16, 128, 44.8);
        else { pdf.setDrawColor(150); pdf.line(x, y + nameHeight + 58, x + 150, y + nameHeight + 58); }
        font(7); pdf.text(sig ? timestamp(sig.signedAt) : "Signature / date pending", x, y + nameHeight + 75);
      }); y += rowHeight;
    }
  }
  for (const participant of compactMemo ? [] : doc.participants) {
    const sig = findSignature("acknowledged", participant.staffId);
    const explanation = doc.kind === "IR" && !sharedIR ? participant.explanation || "Awaiting the staff member's explanation." : "";
    const measured = linesFor(explanation).length * 13.5 + (participant.responseNote ? linesFor(participant.responseNote).length * 13.5 + 20 : 0) + 100;
    ensure(Math.min(measured, 230));
    pdf.setDrawColor(195, 203, 214); pdf.setLineWidth(0.5); pdf.line(margin, y, pageWidth - margin, y); y += 8;
    text(`${participant.staffName} - ${participant.status === "pending" ? "Awaiting response" : participant.status}`, 10, true);
    continuingParticipant = participant.staffName;
    if (doc.kind === "IR" && !sharedIR) section("Explanation / reason provided by staff", explanation);
    if (participant.responseNote) section(participant.status === "declined" ? "Reason for declining" : "Additional response", participant.responseNote);
    ensure(70);
    if (sig) pdf.addImage(sig.image, "PNG", margin, y, 128, 44.8);
    else { pdf.setDrawColor(150); pdf.line(margin, y + 40, margin + 150, y + 40); }
    y += 49;
    text(sig ? `Signed: ${timestamp(sig.signedAt)}` : participant.respondedAt ? `Responded: ${timestamp(participant.respondedAt)} - no signature` : "Signature / date pending", 8); y += 10;
    continuingParticipant = "";
  }
  const officials = managementInitiated(doc) ? [["initiated_approved", sharedIR ? "INITIATED BY" : "INITIATED AND APPROVED BY"]] : [["prepared", "INITIATED BY"], ["approved", sharedIR ? "AUTHORIZED FOR ISSUANCE BY" : "APPROVED BY"]];
  const colWidth = width / officials.length;
  const officialHeight = Math.max(...officials.map(([purpose]) => linesFor(findSignature(purpose)?.signerName || (purpose !== "approved" ? doc.preparedByName : "Pending management approval"), 9, colWidth - 12, true).length * 12 + 91));
  ensure(officialHeight + 12); y += 12;
  officials.forEach(([purpose, label], index) => {
    const sig = findSignature(purpose), x = margin + colWidth * index;
    font(8.5, true); pdf.text(label, x, y + 9);
    if (sig) pdf.addImage(sig.image, "PNG", x, y + 15, 145, 50.75);
    else { pdf.setDrawColor(150); pdf.line(x, y + 66, x + 170, y + 66); }
    font(9, true);
    const name = sig?.signerName || (purpose !== "approved" ? doc.preparedByName : "Pending management approval");
    const names = linesFor(name, 9, colWidth - 12, true);
    names.forEach((line, lineIndex) => pdf.text(line, x, y + 79 + lineIndex * 12));
    font(7.5); pdf.text(sig ? timestamp(sig.signedAt) : "Not yet signed", x, y + 82 + names.length * 12);
  });
  y += officialHeight;
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(200); pdf.line(margin, pageHeight - 33, pageWidth - margin, pageHeight - 33);
    font(6.5); pdf.setTextColor(100); pdf.text(`CONFIDENTIAL | ${doc.id} | Rev ${doc.revision} / v${doc.contentVersion}`, margin, pageHeight - 21);
    pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 21, { align: "right" });
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
