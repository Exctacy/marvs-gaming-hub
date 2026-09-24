/** Client-side Hub Overview aggregate PDF with optional e-sign. */
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
  const margin = 40;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  const pageH = doc.internal.pageSize.getHeight();

  const ensure = (need = 20) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const line = (text: string, size = 11, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(text), maxW);
    ensure(lines.length * (size + 4) + 4);
    doc.text(lines, margin, y);
    y += lines.length * (size + 4) + 4;
  };
  const section = (t: string) => {
    y += 8;
    line(t, 13, "bold");
  };

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

  line(`Reports in range: ${opts.reportsCount}`);
  line(`Defective PCs: ${opts.recurring.length}`);
  line(`Open follow-ups: ${opts.followUps.length}`);

  section("Overall Peripherals Count");
  let anyCount = false;
  for (const [cat, brands] of Object.entries(opts.overallCounts || {})) {
    const entries = Object.entries(brands).filter(([, q]) => q > 0);
    if (!entries.length) continue;
    anyCount = true;
    line(cat, 11, "bold");
    for (const [b, q] of entries) line(`  ${b}: ${q}`);
  }
  if (!anyCount) line("No data.");

  section("Defective PCs");
  if (!opts.recurring.length) line("None.");
  else {
    for (const x of opts.recurring) {
      line(
        `PC ${x.pc}${x.count >= 2 ? " [RECURRING]" : ""} — ${x.brands.join(" · ")} (in ${x.count} report${x.count > 1 ? "s" : ""})`
      );
    }
  }

  section("Changes Summary");
  if (!opts.changesSummary.length) line("None.");
  else {
    for (const r of opts.changesSummary) {
      const date = String(r.reportDate || r.report_date || "").slice(0, 10);
      line(`${date} — ${r.shift}`, 11, "bold");
      line(r.changes || "");
    }
  }

  section("Latest PC No-Defect State");
  if (opts.latestMeta) line(`From ${opts.latestMeta}`);
  line(opts.latestNoDefect.length ? opts.latestNoDefect.join(", ") : "None.");

  section("Game Status Summary");
  if (!opts.gameEntries.length) line("None.");
  else for (const [g, s] of opts.gameEntries) line(`${g}: ${s}`);

  section("Open Follow-ups");
  if (!opts.followUps.length) line("None.");
  else {
    for (const r of opts.followUps) {
      const date = String(r.reportDate || r.report_date || "").slice(0, 10);
      line(`${date} — ${r.shift}`, 11, "bold");
      line(r.followUp || r.follow_up || "");
    }
  }

  // E-sign block
  if (opts.signOff) {
    section("Authorized Sign-off");
    line(`Signed by: ${opts.signOff.name}`);
    line(`Role: ${opts.signOff.role}`);
    line(`Signed at: ${opts.signOff.signedAt}`);
    if (opts.signOff.imageUrl && opts.signOff.imageUrl.startsWith("data:")) {
      try {
        ensure(70);
        doc.addImage(opts.signOff.imageUrl, "PNG", margin, y, 180, 55);
        y += 65;
      } catch {
        line("(signature image)");
      }
    }
  }

  const safeRange = opts.rangeLabel.replace(/\s+/g, "-").toLowerCase();
  doc.save(`hub-overview-${safeRange}.pdf`);
}
