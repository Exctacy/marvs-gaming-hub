# Staff document database updates

The hosted database schema is updated separately from deployment. Vercel builds
run `prisma generate && next build`; they do not synchronize or seed the database.

## Existing installation with IR & Memos already enabled

Apply **only** `20261021_document_participants.sql`, once, in the hosted database's
SQL editor. Alternatively, with `DATABASE_URL` targeting that database, run:

```powershell
npm.cmd run db:document-participants
npm.cmd run db:generate
```

Then push the code and redeploy the website. Do not rerun the October 16 script
if its four tables already exist. Do not use `--accept-data-loss` or run demo seeds.

The October 21 update:

- Adds DocumentParticipant and the initiator/workflow metadata.
- Copies each original recipient into the participant table, preserving their
  signed/declined/pending state, response note, and response time.
- Retains all existing document content, signature images, fingerprints, and history.
- Expands signature uniqueness to allow one signature per staff member and version.
- Keeps legacy fingerprint verification compatible; new documents bind the entire
  participant list, and each signed staff response has a separate fingerprint.

## Existing database without the original IR & Memo tables

Apply `20261016_staff_documents.sql` first, then
`20261021_document_participants.sql`. Run each script once. Each script uses a
transaction, so an error rolls back its changes.

## New empty development database

`npm run db:push` creates the complete current schema. Do not run either SQL update
on a database already created from the current schema.

## Workflow

TL and Management (including Super Admin) can initiate a document for 1-50 active
staff members in the selected branch. Branch admins can review but do not initiate.

- TL signs as initiator, then an independent manager approves and signs.
- Management initiates and approves directly with one combined signature.
- IR initiators describe the incident requiring explanation; each involved staff
  member must provide their own explanation before signing. No one can submit
  another staff member's explanation or signature.
- Each participant can respond independently. The document stays open until all
  respond; a declined signature does not prevent the others from responding.
- Signed responses are immutable. Corrections create a separate revision requiring
  fresh staff explanations and signatures.
- Unsaved drafts have a form preview; saved documents have an exact inline PDF
  preview and download/print controls. Audit history remains in the portal.
