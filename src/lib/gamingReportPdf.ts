/**
 * Client-side PDF export for a single gaming shift report.
 * Uses jsPDF when available. Call only from the browser.
 */
export async function downloadGamingReportPdf(report: any) {
  if (typeof window === "undefined") {
    throw new Error("PDF export only works in the browser");
  }

  const { default: jsPDF } = await import("jspdf");
  // optional autotable
  try {
    await import("jspdf-autotable");
  } catch {
    /* optional */
  }

  const d = report.reportData || report.report_data || {};
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;

  const line = (text: string, size = 11, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxW);
    if (y + lines.length * (size + 4) > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * (size + 4) + 4;
  };

  const section = (title: string) => {
    y += 8;
    line(title, 13, "bold");
    y += 2;
  };

  // Header
  doc.setFillColor(7, 30, 76);
  doc.rect(0, 0, pageW, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MARVS Gaming Hub — Shift Report", margin, 32);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dateStr = String(report.reportDate || report.report_date || "").slice(0, 10);
  doc.text(`${dateStr}  ·  ${report.shift} Shift  ·  ${report.status}`, margin, 52);
  doc.setTextColor(20, 20, 20);
  y = 90;

  line(`Admin: ${report.adminName || report.admin_name || "—"}`);
  line(`Technician: ${report.techName || report.tech_name || "—"}`);
  if (d.pc_range) line(`PC Range: ${d.pc_range}`);
  line(`Created by: ${report.createdByName || report.created_by_name || "—"}`);

  if ((report.changes || "").trim()) {
    section("Changes");
    line(report.changes);
  }

  const games = d.updated_games || [];
  if (games.length) {
    section("Updated Games");
    for (const g of games) line(`${g.game_name}: ${g.status}`);
  }

  const defectBlocks = [
    ["Defective Keyboards", d.defective_keyboards],
    ["Defective Mice", d.defective_mice],
    ["Defective Headsets", d.defective_headsets],
    ["Defective Monitors", d.defective_monitors],
  ];
  let anyDefect = false;
  for (const [title, rows] of defectBlocks) {
    if (rows?.length) {
      if (!anyDefect) {
        section("Defective Peripherals");
        anyDefect = true;
      }
      line(title as string, 11, "bold");
      for (const x of rows) {
        line(`  PC ${x.pc || "?"} (${x.brand || "—"}) — ${x.note || "—"}`);
      }
    }
  }

  const nd = Array.isArray(d.no_defect_pcs)
    ? d.no_defect_pcs
    : [...(d.no_defect_pcs?.standard || []), ...(d.no_defect_pcs?.vip || [])];
  if (nd.length) {
    section("PCs With No Defects");
    line(nd.join(", "));
  }

  if (d.peripheral_counts) {
    section("Peripherals Count (by Brand)");
    for (const [cat, rows] of Object.entries(d.peripheral_counts as Record<string, any[]>)) {
      const filled = (rows || []).filter((r) => Number(r.quantity) > 0);
      if (!filled.length) continue;
      line(cat, 11, "bold");
      for (const r of filled) line(`  ${r.brand}: ${r.quantity}`);
    }
  }

  if (d.spare_items?.length) {
    section("Spare Items");
    for (const s of d.spare_items) line(`${s.item_type}: ${s.quantity}`);
  }

  if ((report.followUp || report.follow_up || "").trim()) {
    section("Follow-up");
    line(report.followUp || report.follow_up);
  }

  if (d.cleaned_pcs?.length) {
    section("Cleaned PCs");
    line(d.cleaned_pcs.join(", "));
  }

  // Signatures as images if present
  const addSig = (label: string, sig: any) => {
    const name = sig?.name || "—";
    const url = sig?.image_url;
    section(`${label} Signature — ${name}`);
    if (url && typeof url === "string" && url.startsWith("data:")) {
      try {
        if (y + 50 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.addImage(url, "PNG", margin, y, 160, 50);
        y += 60;
      } catch {
        line("(signature image)");
      }
    }
  };
  if (d.admin_signature) addSig("Admin", d.admin_signature);
  if (d.tech_signature) addSig("Technician", d.tech_signature);

  const filename = `gaming-report-${dateStr}-${report.shift || "shift"}.pdf`;
  doc.save(filename);
}
