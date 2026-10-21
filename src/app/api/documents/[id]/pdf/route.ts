import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadDocument, type StaffDocumentView } from "@/lib/staff-documents";
import { DocumentError, documentFailure, documentHash, documentUser, verifyParticipantResponses } from "@/lib/staff-documents-server";
import { buildStaffDocumentPdf } from "@/lib/staff-document-pdf";

export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await documentUser(req);
    const { id } = await params;
    const doc = await prisma.staffDocument.findUnique({ where: { id }, include: { incidentReport: true, participants: { orderBy: { id: "asc" } }, signatures: { orderBy: { signedAt: "asc" } }, events: { orderBy: { createdAt: "asc" } }, revisedBy: { select: { id: true, revision: true } } } });
    if (!doc || !canReadDocument(user, doc)) throw new DocumentError(404, "Document not found.");
    if (doc.contentHash && doc.contentHash !== documentHash(doc)) throw new DocumentError(409, "Document integrity check failed. Contact management.");
    verifyParticipantResponses(doc);
    const bytes = buildStaffDocumentPdf(JSON.parse(JSON.stringify(doc)) as StaffDocumentView);
    return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `${req.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="${doc.kind}-${doc.id}-revision-${doc.revision}.pdf"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (e) { return documentFailure(e); }
}
