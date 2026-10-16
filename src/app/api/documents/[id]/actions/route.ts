import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionSchema, APPROVE_STATEMENT, canEditDocument, canPrepareDocuments, canReadDocument, canReviewDocument, PREPARE_STATEMENT, receiptStatement, submissionError, type DocumentContent } from "@/lib/staff-documents";
import { DocumentError, documentBody, documentEvent, documentFailure, documentHash, documentNotices, documentUser, validateDocumentRecipient, validateSignature } from "@/lib/staff-documents-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await documentUser(req, true);
    const { id } = await params;
    const parsed = actionSchema.safeParse(await documentBody(req));
    if (!parsed.success) throw new DocumentError(400, parsed.error.issues[0]?.message || "Invalid action.");
    const body = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.staffDocument.findUnique({ where: { id }, include: { revisedBy: true } });
      if (!doc || !canReadDocument(user, doc)) throw new DocumentError(404, "Document not found.");
      if (doc.lockVersion !== body.lockVersion) throw new DocumentError(409, "This document changed. Refresh before continuing.");
      const change = async (status: string) => {
        const update = await tx.staffDocument.updateMany({ where: { id, lockVersion: body.lockVersion, status: doc.status }, data: { status, lockVersion: { increment: 1 } } });
        if (!update.count) throw new DocumentError(409, "This document changed. Refresh before continuing.");
      };
      const hash = documentHash(doc);
      const sign = async (purpose: string, statement: string) => {
        if (!body.confirmed) throw new DocumentError(400, "Confirm the signature statement before signing.");
        const image = validateSignature(body.signature);
        await tx.documentSignature.create({ data: { documentId: id, contentVersion: doc.contentVersion, contentHash: hash, purpose, signerId: user.id, signerName: user.fullName, signerRole: user.role, image, statement } });
      };
      // Clear only this actor's notices for this document; new actions issue fresh notices.
      const clearNotices = () => tx.documentNotice.updateMany({ where: { documentId: id, staffId: user.id, readAt: null }, data: { readAt: new Date() } });

      if (body.action === "revise") {
        if (!canPrepareDocuments(user.role) || user.id === doc.recipientId || !["awaiting_acknowledgment", "completed", "declined"].includes(doc.status)) throw new DocumentError(403, "Only a preparer or manager with access can revise an issued document.");
        if (doc.revisedBy) throw new DocumentError(409, "A revision already exists. Open the linked revision.");
        await validateDocumentRecipient(tx, doc.branchId, doc.recipientId, user.id);
        await change(doc.status);
        const revised = await tx.staffDocument.create({ data: {
          kind: doc.kind, title: doc.title, branchId: doc.branchId, branchName: doc.branchName,
          recipientId: doc.recipientId, recipientName: doc.recipientName, createdById: user.id,
          preparedByName: user.fullName, content: doc.content!, revision: doc.revision + 1, supersedesId: id,
        } });
        await documentEvent(tx, user, doc, "REVISION_CREATED", `Correction draft: ${revised.id}. ${body.note}`);
        await documentEvent(tx, user, revised, "CREATED", `Revision of ${id}.`);
        return { id: revised.id };
      }
      if (body.action === "submit") {
        if (!canEditDocument(user, doc)) throw new DocumentError(403, "Only the preparer can submit this draft.");
        await validateDocumentRecipient(tx, doc.branchId, doc.recipientId, doc.createdById);
        const error = submissionError({ kind: doc.kind as "IR" | "MEMO", content: doc.content as DocumentContent });
        if (error) throw new DocumentError(400, error);
        const reviewers = await tx.staffProfile.findMany({ where: { status: "active", id: { notIn: [user.id, doc.recipientId] }, OR: [{ role: { in: ["super_admin", "management"] } }, { role: "admin", branchId: doc.branchId }] }, select: { id: true } });
        if (!reviewers.length) throw new DocumentError(400, "No eligible approver is available. An active manager other than the preparer and recipient is required.");
        // A returned document needs a saved new content version before re-signing.
        const prior = await tx.documentSignature.findUnique({ where: { documentId_contentVersion_purpose: { documentId: id, contentVersion: doc.contentVersion, purpose: "prepared" } } });
        if (prior) throw new DocumentError(400, "Save the returned document before submitting a new version.");
        await sign("prepared", PREPARE_STATEMENT);
        await change("pending_review");
        await tx.staffDocument.update({ where: { id }, data: { contentHash: hash } });
        await clearNotices();
        await documentEvent(tx, user, doc, "SUBMITTED");
        await documentNotices(tx, id, reviewers.map((r) => r.id), "A staff document needs your review.");
      } else if (body.action === "approve" || body.action === "return") {
        if (!canReviewDocument(user, doc)) throw new DocumentError(403, "An eligible manager other than the preparer and recipient must review this document.");
        if (body.action === "return") {
          if (!body.note) throw new DocumentError(400, "Explain what needs to change.");
          await change("returned");
          await documentEvent(tx, user, doc, "RETURNED", body.note);
          await documentNotices(tx, id, [doc.createdById], "Your staff document was returned for changes.");
        } else {
          await validateDocumentRecipient(tx, doc.branchId, doc.recipientId, doc.createdById);
          if (doc.contentHash !== hash) throw new DocumentError(409, "The document content no longer matches the submitted version.");
          await sign("approved", APPROVE_STATEMENT);
          await change("awaiting_acknowledgment");
          await documentEvent(tx, user, doc, "APPROVED", body.note);
          await documentNotices(tx, id, [doc.recipientId], "A document is ready for you to review and sign.");
          await documentNotices(tx, id, [doc.createdById], "Your staff document was approved and issued.");
        }
        await tx.documentNotice.updateMany({ where: { documentId: id, message: "A staff document needs your review.", readAt: null }, data: { readAt: new Date() } });
      } else if (body.action === "acknowledge" || body.action === "decline") {
        if (doc.recipientId !== user.id || doc.status !== "awaiting_acknowledgment") throw new DocumentError(403, "Only the named staff member can acknowledge this issued document.");
        if (doc.contentHash !== hash) throw new DocumentError(409, "The document content no longer matches the approved version.");
        const approved = await tx.documentSignature.findUnique({ where: { documentId_contentVersion_purpose: { documentId: id, contentVersion: doc.contentVersion, purpose: "approved" } } });
        if (!approved || approved.contentHash !== hash) throw new DocumentError(409, "A matching management approval is required.");
        if (body.action === "decline") {
          if (!body.note) throw new DocumentError(400, "Enter your reason for declining acknowledgment.");
          await change("declined");
          await documentEvent(tx, user, doc, "ACKNOWLEDGMENT_DECLINED", body.note);
        } else {
          await sign("acknowledged", receiptStatement(doc.kind, doc.content as DocumentContent));
          await change("completed");
          await documentEvent(tx, user, doc, "ACKNOWLEDGED", body.note);
        }
        await clearNotices();
        await documentNotices(tx, id, [doc.createdById, approved.signerId], body.action === "decline" ? "Staff declined acknowledgment of a document." : "Staff signed a document.");
      }
      return { id };
    });
    return NextResponse.json(result);
  } catch (e) { return documentFailure(e); }
}
