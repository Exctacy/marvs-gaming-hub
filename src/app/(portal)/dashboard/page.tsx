"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Plus,
  PieChart,
  Settings2,
  Clock3,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useBranch, usePortalUser } from "@/components/layout/portal-shell";
import { formatDate } from "@/lib/utils";

interface Stats {
  totalReports: number;
  draftCount: number;
  submittedCount: number;
  openFollowUps: number;
  recent: Array<{
    id: string;
    shift: string;
    reportDate: string;
    status: string;
    createdByName: string;
  }>;
}

export default function DashboardPage() {
  const { branchId } = useBranch();
  const user = usePortalUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    fetch(`/api/dashboard/summary?branchId=${branchId}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
      })
      .catch(() =>
        setStats({
          totalReports: 0,
          draftCount: 0,
          submittedCount: 0,
          openFollowUps: 0,
          recent: [],
        })
      )
      .finally(() => setLoading(false));
  }, [branchId]);

  const priorityItems = [
    { label: "Drafts", value: stats?.draftCount ?? 0, tone: "amber" },
    { label: "Submitted", value: stats?.submittedCount ?? 0, tone: "emerald" },
    { label: "Follow-ups", value: stats?.openFollowUps ?? 0, tone: "red" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-gradient-to-br from-[#071E4C] to-[#1458C7] rounded-2xl p-6 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-white/70">
              OPERATIONS
            </p>
            <h1 className="text-xl font-bold mt-1">
              {user?.fullName ? `Welcome, ${user.fullName}` : "Dashboard"}
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
            <Clock3 className="h-3.5 w-3.5" />
            Ready for the next shift
          </div>
        </div>
        <p className="text-sm text-white/70 mt-3">
          Branch operational summary — focus on action items, recent activity, and quick updates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-blue-700 hover:bg-blue-800">
          <Link href="/reports/new">
            <Plus className="h-4 w-4 mr-1" />
            New Shift Report
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/hub-overview">
            <PieChart className="h-4 w-4 mr-1" />
            Hub Overview
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/config">
            <Settings2 className="h-4 w-4 mr-1" />
            Gaming Config
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-100 bg-blue-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reports
            </CardTitle>
            <FileText className="h-4 w-4 text-navy-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-navy-900">
              {loading ? "—" : stats?.totalReports ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Drafts
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-800">
              {loading ? "—" : stats?.draftCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Submitted
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-800">
              {loading ? "—" : stats?.submittedCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-100 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Follow-ups
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {loading ? "—" : stats?.openFollowUps ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest shift reports for this branch</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !stats?.recent.length ? (
              <p className="text-sm text-muted-foreground">
                No reports yet. Create your first shift report.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recent.map((r) => (
                  <Link
                    key={r.id}
                    href={`/reports/${r.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-800">
                        {r.shift} Shift — {formatDate(r.reportDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {r.createdByName}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === "submitted"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Priority Snapshot</CardTitle>
            <CardDescription>Items that need attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50/60"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      item.tone === "amber"
                        ? "bg-amber-500"
                        : item.tone === "emerald"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                </div>
                <span className="text-lg font-bold text-slate-900">{loading ? "—" : item.value}</span>
              </div>
            ))}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4" />
                Recommended next step
              </div>
              <p className="mt-1 text-blue-700">
                {stats?.draftCount
                  ? "Review draft submissions before the next shift handoff."
                  : "Everything looks current. Start a fresh shift report when ready."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
