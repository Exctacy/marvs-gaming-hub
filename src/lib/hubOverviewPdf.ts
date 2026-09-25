/** Client-side Hub Overview aggregate PDF with optional e-sign. */
import { PERIPHERAL_CATEGORIES } from "@/lib/gamingReportData";

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";

export async function downloadHubOverviewPdf(opts: {
  rangeLabel: string;
  reportsCount: number;
  recurring: Array<{ pc: string; count: number; types: string[]; brands: string[] }>;
  followUps: any[];
  overallCounts: Record<string, Record<string, number>>;
  latestNoDefect: string[];
  latestMeta: string | null;
  gameEntries: [string, string][];
  changesSummary: any[];
  signOff?: {
    name: string;
    role: string;
    imageUrl: string | null;
    signedAt: string;
  } | null;
}) {
  if (typeof window === "undefined") throw new Error("Browser only");
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const para = (
    text: string,
    {
      size = 11,
      bold = false,
      color = [30, 41, 70] as [number, number, number],
      indent = 0,
    }: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ""), maxW - indent);
    lines.forEach((ln: string) => {
      ensure(size + 6);
      doc.text(ln, margin + indent, y);
      y += size + 5;
    });
  };

  const heading = (text: string) => {
    y += 10;
    ensure(40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 28, 76);
    doc.text(text, margin, y);
    y += 18;
  };

  // Header
  doc.setFillColor(7, 30, 76);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MARVS Gaming Hub — Hub Overview", margin, 28);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Range: ${opts.rangeLabel}  ·  ${opts.reportsCount} reports`, margin, 46);
  doc.setTextColor(20, 20, 20);
  y = 84;

  para(`Generated: ${new Date().toLocaleString("en-PH")}`, { size: 10, color: [110, 120, 140] });

  heading("SUMMARY");
  para(`Reports in range: ${opts.reportsCount}`, { bold: true });
  para(`Recurring defective PCs: ${opts.recurring.filter((x) => x.count >= 2).length}`, { bold: true });
  para(`Open follow-ups: ${opts.followUps.length}`, { bold: true });

  heading("OVERALL PERIPHERALS COUNT");
  let anyCount = false;
  PERIPHERAL_CATEGORIES.forEach(({ key, label }) => {
    const brands = opts.overallCounts[key] || {};
    const entries = Object.entries(brands).filter(([, q]) => q > 0);
    if (entries.length) {
      anyCount = true;
      para(`${label}:`, { bold: true });
      entries.forEach(([brand, q]) => para(`${brand} - ${q}`, { indent: 12 }));
    }
  });
  if (!anyCount) para("None.");

  heading("DEFECTIVE PCs");
  if (!opts.recurring.length) para("None.");
  else
    opts.recurring.forEach((x) =>
      para(
        `PC ${x.pc} — in ${x.count} report(s)${x.count >= 2 ? " [Recurring]" : ""} — ${x.brands.join(", ")}`
      )
    );

  heading("LATEST PC NO-DEFECT STATE");
  if (!opts.latestMeta) para("None.");
  else {
    para(`From ${opts.latestMeta}`, { size: 10, color: [110, 120, 140] });
    para(opts.latestNoDefect.length ? `PC - ${opts.latestNoDefect.join(", ")}` : "No no-defect PCs recorded.");
  }

  heading("GAME STATUS SUMMARY (LATEST)");
  if (!opts.gameEntries.length) para("None.");
  else opts.gameEntries.forEach(([game, status]) => para(`• ${game} — ${status}`));

  heading("CHANGES SUMMARY");
  if (!opts.changesSummary.length) para("None.");
  else
    opts.changesSummary.forEach((r) => {
      const date = r.reportDate ?? r.report_date;
      para(`${fmtDate(date)} — ${r.shift} shift`, { bold: true, size: 10, color: [110, 120, 140] });
      para(r.changes);
    });

  heading("OPEN FOLLOW-UPS");
  if (!opts.followUps.length) para("None.");
  else
    opts.followUps.forEach((r) => {
      const date = r.reportDate ?? r.report_date;
      para(`${fmtDate(date)} — ${r.shift} shift`, { bold: true, size: 10, color: [110, 120, 140] });
      para(r.followUp ?? r.follow_up);
    });

  // Authorized e-sign block
  if (opts.signOff) {
    heading("AUTHORIZED SIGN-OFF");
    para(`Signed by: ${opts.signOff.name}`, { bold: true });
    para(`Role: ${opts.signOff.role}`);
    para(`Signed at: ${opts.signOff.signedAt}`);
    if (opts.signOff.imageUrl) {
      try {
        ensure(70);
        doc.addImage(opts.signOff.imageUrl, "PNG", margin, y, 180, 55);
        y += 65;
      } catch {
        para("(signature image)", { indent: 12, color: [110, 120, 140] });
      }
    }
  }

  const safeRange = opts.rangeLabel.replace(/\s+/g, "-").toLowerCase();
  doc.save(`Hub-Overview-${safeRange}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
