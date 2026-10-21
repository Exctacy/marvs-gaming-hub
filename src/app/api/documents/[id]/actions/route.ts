import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actionSchema, IR_INITIATE_STATEMENT, IR_AUTHORIZE_STATEMENT, APPROVE_STATEMENT, canEditDocument, canPrepareDocuments, canReadDocument, canReviewDocument, isDocumentParticipant, managementInitiated, INITIATE_APPROVE_STATEMENT, PREPARE_STATEMENT, participantStatement, submissionError, type DocumentContent } from "@/lib/staff-documents";
import { DocumentError, documentBody, documentEvent, documentFailure, documentHash, documentNotices, documentUser, validateDocumentParticipants, validateSignature, participantResponseHash, sharedReportHash, verifyParticipantResponses } from "@/lib/staff-documents-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await documentUser(req, true);
    const { id } = await params;
    const parsed = actionSchema.safeParse(await documentBody(req));
    if (!parsed.success) throw new DocumentError(400, parsed.error.issues[0]?.message || "Invalid action.");
    const body = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      let doc = await tx.staffDocument.findUnique({ where: { id }, include: { revisedBy: true, participants: true, incidentReport: true, signatures: true } });
      if (!doc || !canReadDocument(user, doc)) throw new DocumentError(404, "Document not found.");
      if (doc.lockVersion !== body.lockVersion) throw new DocumentError(409, "Someone updated this document. Refresh and review before continuing.");
      let expectedLock = body.lockVersion;
      if (body.incidentDetails && body.action !== "submit_report") throw new DocumentError(400, "Incident fields can only be submitted through the staff report form.");
      // Upgrade only unissued drafts. Previously issued reports and their signatures remain untouched.
      if (body.action === "submit" && doc.kind === "IR" && doc.workflowVersion < 3 && canEditDocument(user, doc)) {
        const previous = doc.content;
        const upgraded = await tx.staffDocument.updateMany({ where: { id, lockVersion: expectedLock, status: doc.status }, data: { content: { instructions: "" }, workflowVersion: 3, initiatedByRole: user.role, contentHash: null, contentVersion: { increment: 1 }, lockVersion: { increment: 1 } } });
        if (!upgraded.count) throw new DocumentError(409, "The draft changed. Refresh and try again.");
        doc = { ...doc, content: { instructions: "" }, workflowVersion: 3, initiatedByRole: user.role, contentHash: null, contentVersion: doc.contentVersion + 1, lockVersion: doc.lockVersion + 1 };
        expectedLock++;
        await documentEvent(tx, user, doc, "IR_DRAFT_UPGRADED", "Previous initiating draft details preserved: " + JSON.stringify(previous));
      }
      const change = async (status: string) => {
        const update = await tx.staffDocument.updateMany({ where: { id, lockVersion: expectedLock, status: document.status }, data: { status, lockVersion: { increment: 1 } } });
        if (!update.count) throw new DocumentError(409, "Someone updated this document. Refresh and review before continuing.");
      };
      const document = doc;
      const ids = doc.participants.map((p) => p.staffId);
      const hash = documentHash(doc);
      const sign = async (purpose: string, statement: string, responseHash?: string) => {
        if (!body.confirmed) throw new DocumentError(400, "Confirm the signature statement before signing.");
        await tx.documentSignature.create({ data: { documentId: id, contentVersion: document.contentVersion, contentHash: hash, reportHash: purpose === "acknowledged" ? document.incidentReport?.reportHash : undefined, purpose, signerId: user.id, signerName: user.fullName, signerRole: user.role, image: validateSignature(body.signature), statement, responseHash } });
      };
      const clearNotices = () => tx.documentNotice.updateMany({ where: { documentId: id, staffId: user.id, readAt: null }, data: { readAt: new Date() } });
      if (body.action === "submit_report") {
        if (doc.kind !== "IR" || doc.workflowVersion !== 3 || doc.status !== "awaiting_acknowledgment") throw new DocumentError(403, "This document is not accepting a shared incident report.");
        const participant = doc.participants.find((p) => p.staffId === user.id && p.status === "pending");
        if (!participant) throw new DocumentError(403, "Only an involved staff member can complete this report.");
        if (doc.incidentReport) throw new DocumentError(409, "A participant already submitted the shared report. Refresh to review and sign it.");
        if (doc.contentHash !== hash) throw new DocumentError(409, "The issued request failed its integrity check.");
        if (!body.incidentDetails || !body.confirmed) throw new DocumentError(400, "Complete and confirm the shared incident report before submitting.");
        const approval = await tx.documentSignature.findFirst({ where: { documentId: id, contentVersion: doc.contentVersion, purpose: { in: ["approved", "initiated_approved"] } } });
        if (!approval || approval.contentHash !== hash) throw new DocumentError(409, "An authorized issued request is required.");
        await change(doc.status);
        await tx.sharedIncidentReport.create({ data: { documentId: id, details: body.incidentDetails, submittedById: user.id, submittedByName: user.fullName, reportHash: sharedReportHash(hash, body.incidentDetails, user.id, user.fullName) } });
        await documentEvent(tx, user, doc, "SHARED_REPORT_SUBMITTED");
        await documentNotices(tx, id, [...ids.filter((staffId) => staffId !== user.id), doc.createdById], "The shared incident report is ready for review and signatures.");
        return { id };
      }
      if (body.action === "revise") {
        if (!canPrepareDocuments(user.role) || isDocumentParticipant(user.id, doc) || !["awaiting_acknowledgment", "completed", "declined"].includes(doc.status)) throw new DocumentError(403, "Only an authorized initiator can revise an issued document.");
        if (doc.revisedBy) throw new DocumentError(409, "A correction already exists. Open the linked revision.");
        const { participants } = await validateDocumentParticipants(tx, doc.branchId, ids, user.id);
        await change(doc.status);
        const content = { ...(doc.content as Record<string, string>) };
        // Legacy initiator-written explanations stay on the original; staff write new responses.
        if (doc.kind === "IR") { for (const key of Object.keys(content)) delete content[key]; content.instructions = ""; }
        const revised = await tx.staffDocument.create({ data: { kind: doc.kind, title: doc.title, branchId: doc.branchId, branchName: doc.branchName, recipientId: participants[0].staffId, recipientName: participants.map((p) => p.staffName).join(", "), createdById: user.id, preparedByName: user.fullName, initiatedByRole: user.role, workflowVersion: doc.kind === "IR" ? 3 : 2, participants: { create: participants }, content, revision: doc.revision + 1, supersedesId: id } });
        await documentEvent(tx, user, doc, "REVISION_CREATED", `Correction draft: ${revised.id}. ${body.note}`);
        await documentEvent(tx, user, revised, "CREATED", `Revision of ${id}.`);
        return { id: revised.id };
      }
      if (body.action === "submit") {
        if (!canEditDocument(user, doc)) throw new DocumentError(403, "Only the initiator can issue or submit this draft.");
        await validateDocumentParticipants(tx, doc.branchId, ids, doc.createdById);
        const error = submissionError({ kind: doc.kind as "IR" | "MEMO", content: doc.content as DocumentContent });
        if (error) throw new DocumentError(400, error);
        const combined = managementInitiated(doc);
        if (combined && !["management", "super_admin"].includes(user.role)) throw new DocumentError(403, "Management permission is required to issue this document.");
        const purpose = combined ? "initiated_approved" : "prepared";
        const prior = await tx.documentSignature.findFirst({ where: { documentId: id, contentVersion: doc.contentVersion, purpose } });
        if (prior) throw new DocumentError(400, "Save the returned draft as a new content version before signing again.");
        const reviewers = combined ? [] : await tx.staffProfile.findMany({ where: { status: "active", id: { notIn: [user.id, ...ids] }, OR: [{ role: { in: ["super_admin", "management"] } }, { role: "admin", branchId: doc.branchId }] }, select: { id: true } });
        if (!combined && !reviewers.length) throw new DocumentError(400, "An active manager other than the initiator and participants is required to approve this document.");
        await sign(purpose, doc.kind === "IR" && doc.workflowVersion === 3 ? IR_INITIATE_STATEMENT : combined ? INITIATE_APPROVE_STATEMENT : PREPARE_STATEMENT);
        await change(combined ? "awaiting_acknowledgment" : "pending_review");
        await tx.staffDocument.update({ where: { id }, data: { contentHash: hash } });
        await clearNotices();
        await documentEvent(tx, user, doc, doc.kind === "IR" && doc.workflowVersion === 3 && combined ? "IR_REQUEST_ISSUED" : combined ? "INITIATED_AND_APPROVED" : "SUBMITTED");
        await documentNotices(tx, id, combined ? ids : reviewers.map((r) => r.id), combined ? "A document is ready for your explanation and signature." : "A staff document needs your review.");
      } else if (body.action === "approve" || body.action === "return") {
        if (!canReviewDocument(user, doc)) throw new DocumentError(403, "An independent authorized manager must review this document.");
        if (body.action === "return") {
          if (!body.note) throw new DocumentError(400, "Explain what needs to change.");
          await change("returned");
          await documentEvent(tx, user, doc, "RETURNED", body.note);
          await documentNotices(tx, id, [doc.createdById], "Your staff document was returned for changes.");
        } else {
          await validateDocumentParticipants(tx, doc.branchId, ids, doc.createdById);
          if (doc.contentHash !== hash) throw new DocumentError(409, "The content does not match the submitted version.");
          await sign("approved", doc.kind === "IR" && doc.workflowVersion === 3 ? IR_AUTHORIZE_STATEMENT : APPROVE_STATEMENT);
          await change("awaiting_acknowledgment");
          await documentEvent(tx, user, doc, doc.kind === "IR" && doc.workflowVersion === 3 ? "IR_REQUEST_AUTHORIZED" : "APPROVED", body.note);
          await documentNotices(tx, id, ids, "A document is ready for your explanation and signature.");
          await documentNotices(tx, id, [doc.createdById], "Your staff document was approved and issued.");
        }
        await tx.documentNotice.updateMany({ where: { documentId: id, message: "A staff document needs your review.", readAt: null }, data: { readAt: new Date() } });
      } else {
        const participant = doc.participants.find((p) => p.staffId === user.id);
        if (!participant || participant.status !== "pending" || doc.status !== "awaiting_acknowledgment") throw new DocumentError(403, "Only a pending participant can submit their own response.");
        if (doc.contentHash !== hash) throw new DocumentError(409, "The content does not match the approved version.");
        const approved = await tx.documentSignature.findFirst({ where: { documentId: id, contentVersion: doc.contentVersion, purpose: { in: ["approved", "initiated_approved"] } } });
        if (!approved || approved.contentHash !== hash) throw new DocumentError(409, "A matching management approval is required.");
        if (body.action === "decline" && !body.note) throw new DocumentError(400, "Enter a reason for declining to sign.");
        if (body.action === "acknowledge" && doc.kind === "IR" && doc.workflowVersion === 2 && !body.explanation) throw new DocumentError(400, "Enter your own explanation / reason for this incident before signing.");
        verifyParticipantResponses(doc);
        if (body.action === "acknowledge" && doc.kind === "IR" && doc.workflowVersion === 3 && !doc.incidentReport) throw new DocumentError(400, "One involved staff member must complete the shared incident report before anyone signs.");
        const explanation = doc.kind === "IR" && doc.workflowVersion < 3 ? body.explanation : "";
        const responseHash = participantResponseHash(hash, user.id, explanation, body.note, doc.incidentReport?.reportHash);
        const nextParticipants = doc.participants.map((p) => p.id === participant.id ? { ...p, status: body.action === "decline" ? "declined" : "signed" } : p);
        const pending = nextParticipants.some((p) => p.status === "pending");
        await change(pending ? "awaiting_acknowledgment" : nextParticipants.some((p) => p.status === "declined") ? "declined" : "completed");
        if (body.action === "acknowledge") await sign("acknowledged", participantStatement(doc.kind, doc.content as DocumentContent, doc.workflowVersion), responseHash);
        await tx.documentParticipant.update({ where: { id: participant.id }, data: { status: body.action === "decline" ? "declined" : "signed", explanation, responseNote: body.note, respondedAt: new Date() } });
        await documentEvent(tx, user, doc, body.action === "decline" ? "ACKNOWLEDGMENT_DECLINED" : "ACKNOWLEDGED", body.note);
        await clearNotices();
        await documentNotices(tx, id, [doc.createdById, approved.signerId], body.action === "decline" ? "A participant declined to sign a document." : "A participant submitted their explanation and signature.");
      }
      return { id };
    });
    return NextResponse.json(result);
  } catch (e) { return documentFailure(e); }
}
