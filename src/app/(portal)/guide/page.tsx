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
