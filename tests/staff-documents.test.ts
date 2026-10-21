import assert from "node:assert/strict";
import { test } from "node:test";
import { canReadDocument, canEditDocument, canReviewDocument, documentInputSchema, defaultDocumentContent, manilaDateTime, receiptStatement, IR_RECEIPT_STATEMENT, submissionError, sharedIncidentSchema, defaultSharedIncident } from "../src/lib/staff-documents";

const doc = { createdById: "tl-a", recipientId: "staff-a", branchId: "a", status: "draft" };
const actor = (id: string, role: string, branchId: string | null = "a") => ({ id, role, branchId });
test("branch isolation applies to preparers, managers, and staff", () => {
  assert.equal(canReadDocument(actor("admin-b", "admin", "b"), doc), false);
  assert.equal(canReadDocument(actor("other-tl", "team_leader"), doc), false);
  assert.equal(canReadDocument(actor("other-staff", "computer_tech"), { ...doc, status: "completed" }), false);
  assert.equal(canReadDocument(actor("tl-a", "team_leader"), doc), true);
  assert.equal(canReadDocument(actor("admin-a", "admin"), doc), true);
  assert.equal(canReadDocument(actor("manager", "management", null), doc), true);
  assert.equal(canReadDocument(actor("orphan-admin", "admin", null), doc), false);
});
test("staff can access only their issued documents, including after a branch transfer", () => {
  const staff = actor("staff-a", "counter_admin", "b");
  for (const status of ["draft", "returned", "pending_review"]) assert.equal(canReadDocument(staff, { ...doc, status }), false);
  for (const status of ["awaiting_acknowledgment", "completed", "declined"]) assert.equal(canReadDocument(staff, { ...doc, status }), true);
});
test("approval requires an independent authorized manager", () => {
  const pending = { ...doc, status: "pending_review" };
  assert.equal(canReviewDocument(actor("admin-a", "admin"), pending), true);
  assert.equal(canReviewDocument(actor("admin-b", "admin", "b"), pending), false);
  assert.equal(canReviewDocument(actor("tl-a", "admin"), pending), false);
  assert.equal(canReviewDocument(actor("staff-a", "admin"), pending), false);
  assert.equal(canReviewDocument(actor("other-tl", "team_leader"), pending), false);
  assert.equal(canReviewDocument(actor("admin-a", "admin"), doc), false);
});
test("issued and submitted documents cannot be edited, even by an admin author", () => {
  for (const status of ["pending_review", "awaiting_acknowledgment", "completed", "declined"]) {
    assert.equal(canEditDocument(actor("tl-a", "admin"), { ...doc, status }), false);
  }
  assert.equal(canEditDocument(actor("tl-a", "team_leader"), doc), true);
  assert.equal(canEditDocument(actor("tl-a", "team_leader"), { ...doc, status: "returned" }), true);
  assert.equal(canEditDocument(actor("other-admin", "admin"), doc), false);
});
test("templates validate nested data, dates, and payload bounds", () => {
  const input = { kind: "IR", title: "Incident", branchId: "a", participantIds: ["staff-a"], content: defaultDocumentContent("IR") };
  assert.equal(documentInputSchema.safeParse(input).success, true);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, incidentDate: "2026-02-30" } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, reportTime: "25:00" } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, whatHappened: ["invalid"] } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, whatHappened: "x".repeat(6001) } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, status: "completed" }).success, false);
});
test("submission needs incident details and receipt language stays distinct", () => {
  assert.equal(submissionError({ kind: "IR", content: defaultDocumentContent("IR") }), null);
  assert.equal(submissionError({ kind: "MEMO", content: defaultDocumentContent("MEMO") }), null);
  assert.equal(receiptStatement("IR", defaultDocumentContent("IR")), IR_RECEIPT_STATEMENT);
  assert.match(receiptStatement("MEMO", defaultDocumentContent("MEMO")), /responsibility/);
});
test("Manila dates remain correct around UTC midnight", () => {
  assert.deepEqual(manilaDateTime(new Date("2026-10-15T17:30:00Z")), { date: "2026-10-16", time: "01:30" });
});

test("all participants have issued access, and participants cannot approve", () => {
  const group = { ...doc, status: "awaiting_acknowledgment", participants: [{ staffId: "staff-a" }, { staffId: "staff-b" }] };
  assert.equal(canReadDocument(actor("staff-b", "computer_tech", "b"), group), true);
  assert.equal(canReadDocument(actor("outsider", "computer_tech"), group), false);
  assert.equal(canReviewDocument(actor("staff-b", "admin"), { ...group, status: "pending_review" }), false);
  const input = { kind: "MEMO", title: "Memo", branchId: "a", content: defaultDocumentContent("MEMO") };
  assert.equal(documentInputSchema.safeParse({ ...input, participantIds: [] }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, participantIds: ["a", "a"] }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, participantIds: ["a", "b"] }).success, true);
});

test("shared IR fields belong to staff, while request fields contain only optional instructions", () => {
 const request = { kind: "IR", title: "IR", branchId: "a", participantIds: ["staff"], content: {} };
 assert.equal(documentInputSchema.safeParse(request).success, true);
 for (const key of ["witnesses", "personsInvolved", "equipment", "actionsTaken", "whatHappened", "howHappened", "incidentDate"]) assert.equal(documentInputSchema.safeParse({ ...request, content: { [key]: "Initiator supplied" } }).success, false);
 const details = { ...defaultSharedIncident(), whatHappened: "Failure", howHappened: "Reported during shift", equipment: "None", actionsTaken: "None" };
 assert.equal(sharedIncidentSchema.safeParse(details).success, true);
 assert.equal(sharedIncidentSchema.safeParse({ ...details, incidentDate: "2026-02-30" }).success, false);
 assert.equal(sharedIncidentSchema.safeParse({ ...details, actionsTaken: "" }).success, false);
});
