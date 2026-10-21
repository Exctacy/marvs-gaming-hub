-- Apply once AFTER 20261021_document_participants.sql.
-- Existing issued documents, participant responses, and signatures remain unchanged.
BEGIN;
ALTER TABLE "DocumentSignature" ADD COLUMN "reportHash" TEXT;
CREATE TABLE "SharedIncidentReport" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "submittedById" TEXT NOT NULL,
  "submittedByName" TEXT NOT NULL,
  "reportHash" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedIncidentReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SharedIncidentReport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StaffDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SharedIncidentReport_documentId_key" ON "SharedIncidentReport"("documentId");
COMMIT;
