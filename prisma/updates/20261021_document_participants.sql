-- Apply once AFTER 20261016_staff_documents.sql. Preserves issued content and signatures.
BEGIN;

ALTER TABLE "StaffDocument" ADD COLUMN "initiatedByRole" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StaffDocument" ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DocumentSignature" ADD COLUMN "responseHash" TEXT;

CREATE TABLE "DocumentParticipant" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "staffName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "explanation" TEXT NOT NULL DEFAULT '',
  "responseNote" TEXT NOT NULL DEFAULT '',
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "DocumentParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentParticipant_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StaffDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DocumentParticipant_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DocumentParticipant_documentId_staffId_key" ON "DocumentParticipant"("documentId", "staffId");
CREATE INDEX "DocumentParticipant_staffId_status_idx" ON "DocumentParticipant"("staffId", "status");

-- Retain the original recipient as the first participant, including their existing response.
INSERT INTO "DocumentParticipant" ("id", "documentId", "staffId", "staffName", "status", "responseNote", "respondedAt")
SELECT 'legacy_' || d."id", d."id", d."recipientId", d."recipientName",
  CASE WHEN d."status" = 'completed' THEN 'signed' WHEN d."status" = 'declined' THEN 'declined' ELSE 'pending' END,
  COALESCE(e."note", ''), COALESCE(s."signedAt", e."createdAt")
FROM "StaffDocument" d
LEFT JOIN "DocumentSignature" s ON s."documentId" = d."id" AND s."contentVersion" = d."contentVersion" AND s."purpose" = 'acknowledged' AND s."signerId" = d."recipientId"
LEFT JOIN LATERAL (
  SELECT "note", "createdAt" FROM "DocumentEvent"
  WHERE "documentId" = d."id" AND "actorId" = d."recipientId" AND "action" IN ('ACKNOWLEDGED', 'ACKNOWLEDGMENT_DECLINED')
  ORDER BY "createdAt" DESC LIMIT 1
) e ON true;

-- Each participant signs separately; old signature rows remain unchanged.
CREATE UNIQUE INDEX "DocumentSignature_version_purpose_signer_key" ON "DocumentSignature"("documentId", "contentVersion", "purpose", "signerId");
DROP INDEX "DocumentSignature_documentId_contentVersion_purpose_key";
COMMIT;
