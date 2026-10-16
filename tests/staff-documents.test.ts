import assert from "node:assert/strict";
import { test } from "node:test";
import { canReadDocument, canEditDocument, canReviewDocument, documentInputSchema, defaultDocumentContent, manilaDateTime, receiptStatement, IR_RECEIPT_STATEMENT, submissionError } from "../src/lib/staff-documents";

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
  const input = { kind: "IR", title: "Incident", branchId: "a", recipientId: "staff-a", content: defaultDocumentContent("IR") };
  assert.equal(documentInputSchema.safeParse(input).success, true);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, incidentDate: "2026-02-30" } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, reportTime: "25:00" } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, whatHappened: ["invalid"] } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, content: { ...input.content, whatHappened: "x".repeat(6001) } }).success, false);
  assert.equal(documentInputSchema.safeParse({ ...input, status: "completed" }).success, false);
});
test("submission needs incident details and receipt language stays distinct", () => {
  assert.ok(submissionError({ kind: "IR", content: defaultDocumentContent("IR") }));
  assert.equal(submissionError({ kind: "MEMO", content: defaultDocumentContent("MEMO") }), null);
  assert.equal(receiptStatement("IR", defaultDocumentContent("IR")), IR_RECEIPT_STATEMENT);
  assert.match(receiptStatement("MEMO", defaultDocumentContent("MEMO")), /responsibility/);
});
test("Manila dates remain correct around UTC midnight", () => {
  assert.deepEqual(manilaDateTime(new Date("2026-10-15T17:30:00Z")), { date: "2026-10-16", time: "01:30" });
});
