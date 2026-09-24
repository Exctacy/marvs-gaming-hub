import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function ReportSection({
  title,
  eyebrow,
  actions,
  children,
  className,
}: ReportSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500 mb-0.5">
              {eyebrow}
            </p>
          )}
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
