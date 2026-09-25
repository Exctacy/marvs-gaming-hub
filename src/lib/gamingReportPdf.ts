/**
 * Client-side PDF export for a single gaming shift report.
 * Uses jsPDF when available. Call only from the browser.
 */
import { DEFECT_TYPES, PERIPHERAL_CATEGORIES, noDefectList } from "@/lib/gamingReportData";

const sigName = (sig: any) =>
  sig ? (typeof sig === "string" ? sig : sig.name || null) : null;
const sigImage = (sig: any) =>
  sig && typeof sig === "object" ? sig.image_url || null : null;

/** Resolve a signature image to a PNG data URL usable by jsPDF. */
const loadImageData = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (url.startsWith("data:")) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

const fmtDateTime = (d: any) => (d ? new Date(d).toLocaleString("en-PH") : "");

export async function downloadGamingReportPdf(report: any) {
  if (typeof window === "undefined") {
    throw new Error("PDF export only works in the browser");
  }

  const { default: jsPDF } = await import("jspdf");

  const d = report.reportData || report.report_data || {};
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
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
    y += 8;
    ensure(40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 28, 76);
    doc.text(text, margin, y);
    y += 18;
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

  para(
    `Admin on duty: ${report.adminName || report.admin_name || "—"}     Technician: ${
      report.techName || report.tech_name || "—"
    }`,
    { size: 11, color: [80, 90, 110] }
  );
  if (d.pc_range) para(`PC Range: ${d.pc_range}`, { size: 11 });
  para(`Created by: ${report.createdByName || report.created_by_name || "—"}`, {
    size: 11,
    color: [80, 90, 110],
  });

  heading("CHANGES");
  para(report.changes || "None reported.");

  heading("UPDATED GAMES FOR THIS SHIFT");
  const games = d.updated_games || [];
  if (!games.length) para("None.");
  else games.forEach((g: any) => para(`• ${g.game_name} — ${g.status}`));

  heading("DEFECTIVE PERIPHERALS");
  DEFECT_TYPES.forEach(({ label, storeKey }) => {
    const arr = d[storeKey] || [];
    para(`Defective ${label}:`, { size: 11, bold: true });
    if (!arr.length) para("None.", { indent: 12, color: [110, 120, 140] });
    else
      arr.forEach((x: any) =>
        para(`PC ${x.pc || "?"}${x.brand ? ` (${x.brand})` : ""} — ${x.note || "No note"}`, {
          indent: 12,
        })
      );
  });

  heading("PC NUMBER WITH NO DEFECTS");
  const nd = noDefectList(d);
  para(nd.length ? `PC - ${nd.join(", ")}` : "None.");

  heading("PERIPHERALS COUNT (BY BRAND)");
  const pc = d.peripheral_counts || {};
  let anyCount = false;
  PERIPHERAL_CATEGORIES.forEach(({ key, label }) => {
    const rows = (pc[key] || []).filter((r: any) => Number(r.quantity) > 0);
    if (rows.length) {
      anyCount = true;
      para(`${label}:`, { size: 11, bold: true });
      rows.forEach((r: any) => para(`${r.brand} - ${r.quantity}`, { indent: 12 }));
    }
  });
  if (!anyCount) para("None.");

  heading("SPARE ITEMS");
  const sp = d.spare_items || [];
  if (!sp.length) para("None.");
  else sp.forEach((s: any) => para(`Spare ${s.item_type}: ${s.quantity}`));

  heading("FOLLOW UP REPORT");
  para(report.followUp || report.follow_up || "None.");

  heading("CLEANED PCs");
  const cleaned = d.cleaned_pcs || [];
  para(cleaned.length ? `PC - ${cleaned.join(", ")}` : "None.");

  // Sign-off with e-signatures
  heading("SIGN-OFF");
  const adminSig = d.admin_signature;
  const techSig = d.tech_signature;
  const gap = 20;
  const sigBoxW = (pageW - margin * 2 - gap) / 2;
  const sigBoxH = 64;
  const sigY = y;
  ensure(sigBoxH + 44);

  const adminSigUrl = sigImage(adminSig);
  const techSigUrl = sigImage(techSig);
  const adminImg = adminSigUrl ? await loadImageData(adminSigUrl) : null;
  const techImg = techSigUrl ? await loadImageData(techSigUrl) : null;

  const drawSig = (x: number, img: string | null, name: string | null, role: string) => {
    doc.setDrawColor(150, 160, 180);
    doc.line(x, sigY + sigBoxH, x + sigBoxW, sigY + sigBoxH);
    if (img) {
      try {
        doc.addImage(img, "PNG", x, sigY + 4, sigBoxW, sigBoxH - 8, undefined, "FAST");
      } catch {
        /* ignore bad image data */
      }
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(11, 28, 76);
    doc.text(name || "—", x, sigY + sigBoxH + 14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 120, 140);
    doc.text(role, x, sigY + sigBoxH + 26);
  };
  drawSig(margin, adminImg, sigName(adminSig), "Admin");
  drawSig(margin + sigBoxW + gap, techImg, sigName(techSig), "Technician");

  y = sigY + sigBoxH + 36;
  para(
    `Status: ${report.status === "submitted" ? "Submitted" : "Draft"}    Saved: ${fmtDateTime(
      report.createdAt || report.created_date
    )}`,
    { size: 9, color: [130, 140, 150] }
  );

  const filename = `Gaming-Hub-Report-${dateStr || "report"}-${report.shift || "shift"}.pdf`;
  doc.save(filename);
}
