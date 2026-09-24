"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import NewGamingReportForm from "./form";

export default function NewGamingReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-navy-700" />
        </div>
      }
    >
      <NewGamingReportForm />
    </Suspense>
  );
}
