import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Staff Guide</h1>
        <p className="text-sm text-muted-foreground">Onboarding & quick reference</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-3 text-sm">
          <p>1. Sign in with the username and temporary password provided by your admin.</p>
          <p>2. On first login you will be required to set a new password (min 8 characters).</p>
          <p>3. You will then land on the Dashboard for your assigned branch.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Shift Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Go to <strong>Operations → New Report</strong>.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Select date and shift (Opening / Mid / Night).</li>
            <li>Mark each PC status and whether it was cleaned.</li>
            <li>Update game statuses.</li>
            <li>Log any defective peripherals with brand.</li>
            <li>Enter spare counts.</li>
            <li>Add notes / follow-ups.</li>
            <li>Capture admin & tech e-signatures (draw with mouse or finger).</li>
            <li><strong>Save Draft</strong> to continue later, or <strong>Submit</strong> when complete. Submitted reports cannot be edited.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">IR &amp; Memos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Open <strong>Operations / IR &amp; Memos</strong>. Team Leaders and managers can prepare an Incident Report or equipment acknowledgment memo for a staff member in their branch.</p>
          <p>Save the draft, review it, and add your own signature to send it for approval. An independent manager reviews and signs before the document is issued. Returned documents must be saved as a new content version before resubmission.</p>
          <p>Staff use <strong>My documents</strong> to read the full approved document and sign using their own account. An IR signature confirms receipt; a memo signature confirms its displayed acknowledgment statement. Staff may add a response or decline acknowledgment with a reason.</p>
          <p>Issued documents are locked. Use <strong>Create correction</strong> for a linked revision with fresh signatures. Download PDF preserves the selected version, signature statements, timestamps in Manila time, and document history.</p>
          <p>Notifications appear beside IR &amp; Memos in the sidebar and inside the document inbox. Documents are private to the preparer, authorized managers, and the named recipient after issuance.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roles at a Glance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>counter_admin / computer_tech / team_leader</strong> — locked to home branch; create & submit reports.</p>
          <p><strong>admin</strong> — branch-scoped management of staff, config, and all reports.</p>
          <p><strong>management / super_admin</strong> — can switch branches; global visibility and oversight.</p>
        </CardContent>
      </Card>
    </div>
  );
}
