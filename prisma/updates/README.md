# Staff document database updates

The hosted database schema is updated separately from deployment. Vercel builds
run `prisma generate && next build`; they do not synchronize or seed the database.

## Shared IR correction (latest update)

If the participant update is already installed, apply **only**
`20261021_shared_incident_report.sql` once in the hosted SQL editor, then deploy
this code. With the intended hosted DATABASE_URL configured locally, the equivalent
command is `npm.cmd run db:shared-ir`.

This adds SharedIncidentReport and a nullable signature reportHash. Existing issued
IRs, participant responses, and signatures remain unchanged. No backfill or data
removal is performed. Existing unissued IR drafts automatically switch to the new
staff-completed flow when submitted; prior draft content is preserved in history.

A new IR request contains only its title, participants, branch, and optional
instructions. One selected staff member completes all incident fields and submits
the shared report. It then locks. Every staff signature binds to that same report's
fingerprint. TL/Management cannot submit the report for staff. A correction requires
a new revision, a fresh shared report, and fresh signatures.

## Participant update (required before shared IR correction)

Apply **only** `20261021_document_participants.sql`, once, in the hosted database's
SQL editor. Alternatively, with `DATABASE_URL` targeting that database, run:

```powershell
npm.cmd run db:document-participants
npm.cmd run db:generate
```

Apply the shared IR correction above next, then push the code and redeploy the website. Do not rerun the October 16 script
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
`20261021_document_participants.sql`, then `20261021_shared_incident_report.sql`. Run each script once. Each script uses a
transaction, so an error rolls back its changes.

## New empty development database

`npm run db:push` creates the complete current schema. Do not run either SQL update
on a database already created from the current schema.

## Workflow

TL and Management (including Super Admin) can initiate a document for 1-50 active
staff members in the selected branch. Branch admins can authorize issuance but do
not initiate. For IR requests, Management signs as "Initiated by"; a TL signs as
initiator and an independent manager signs as "Authorized for issuance by". These
signatures authorize a request; they do not claim to approve an as-yet-unwritten
staff account. Memo approval behavior is unchanged.

One pending participant fills the shared IR dates/times, witnesses, other persons
involved, what happened, reason, equipment, and immediate actions. Other participants
only review and sign that shared report (and may add personal reservations in a
note). Declines require a reason and do not block the other participants. The
report locks upon submission. Competing submissions and stale signing actions are
rejected. Existing issued legacy reports retain their earlier response workflow.

Drafts have a form preview; saved documents offer an exact PDF preview and download.
