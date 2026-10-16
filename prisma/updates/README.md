# Staff document database update

`20261016_staff_documents.sql` adds StaffDocument, DocumentSignature, DocumentEvent,
and DocumentNotice, their indexes, and foreign keys. It does not alter or delete
existing tables or data. The script applies to an existing database matching the
previous schema and should be run once per database.

With the intended PostgreSQL database configured in `.env`:

```sh
npm run db:documents
npm run db:generate
npm run build
```

For a new empty development database, `npm run db:push` creates the complete
schema instead; do not also run this SQL script after `db:push`.

Do not run the demo seed to enable this module. Existing accounts are reused.
An active Team Leader (or manager), an independent manager, and the recipient
staff account are needed to exercise the full preparation/approval/signing flow.

## Hosted deployment

The Vercel build runs only `prisma generate && next build`. It does not change
the database schema or seed demo accounts.

Apply the SQL update once in your hosted database's SQL editor, or run
`npm run db:documents` with `DATABASE_URL` targeting that database. If the four
new tables already exist, do not rerun the create-table script; verify the
previous update completed instead. Then push the code and redeploy on Vercel.

If an older deployment fails at `prisma db push` with a data-loss warning, do
not add `--accept-data-loss`. Deploy the updated build script above. The warning
indicates a difference between the live database and Prisma schema; its exact
cause requires the preceding warning lines to identify.
