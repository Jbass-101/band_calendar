import { jsPDF } from "jspdf";
import type { SetlistDetail } from "@/src/lib/sanity/client";
import { BRANDING } from "@/src/lib/branding";
import { formatIsoDateToDDMMYYYY } from "@/src/lib/formatDate";
import { normalizeTextForHelveticaPdf } from "@/src/lib/normalizePdfText";

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 15;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM;
/** Bottom band reserved on every page so body never overlaps the fixed last-page footer. */
const FOOTER_RESERVE_MM = 14;
const CONTENT_BOTTOM_MAX_MM = PAGE_H_MM - MARGIN_MM - FOOTER_RESERVE_MM;

/** Tailwind zinc-ish (light mode) */
const ZINC200: [number, number, number] = [228, 228, 231];
const ZINC500: [number, number, number] = [113, 113, 122];
const ZINC600: [number, number, number] = [82, 82, 91];
const ZINC700: [number, number, number] = [63, 63, 70];
const ZINC800: [number, number, number] = [39, 39, 42];
const EMERALD600: [number, number, number] = [5, 150, 105];

const LOGO_MM = 11;
const LOGO_GAP_MM = 3;
/** Max width for right-column header lines. */
const RIGHT_COL_W_MM = 78;

/** Same order as the on-screen media export. */
const LYRIC_ORDER: Array<{ key: keyof SetlistDetail["songs"][number]["lyricsSections"]; label: string }> = [
  { key: "intro", label: "Intro" },
  { key: "verse1", label: "Verse 1" },
  { key: "verse2", label: "Verse 2" },
  { key: "preChorus", label: "Pre-Chorus" },
  { key: "chorus", label: "Chorus" },
  { key: "hook", label: "Hook" },
  { key: "bridge", label: "Bridge" },
  { key: "outro", label: "Outro" },
  { key: "ending", label: "Ending" },
];

type LayoutCtx = {
  doc: jsPDF;
  y: number;
};

async function fetchLogoDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ensureSpace(ctx: LayoutCtx, neededMm: number): void {
  if (ctx.y + neededMm > CONTENT_BOTTOM_MAX_MM) {
    ctx.doc.addPage();
    ctx.y = MARGIN_MM;
  }
}

function wrapText(
  doc: jsPDF,
  text: string,
  fontSize: number,
  style: "normal" | "bold" | "italic",
  maxWidthMm: number
): string[] {
  doc.setFont("helvetica", style === "bold" ? "bold" : style === "italic" ? "italic" : "normal");
  doc.setFontSize(fontSize);
  const safe = normalizeTextForHelveticaPdf(text).trim();
  return doc.splitTextToSize(safe, maxWidthMm);
}

function addLinesColored(
  ctx: LayoutCtx,
  lines: string[],
  fontSize: number,
  lineHeightMm: number,
  style: "normal" | "bold" | "italic",
  color: [number, number, number]
): void {
  ctx.doc.setFont("helvetica", style === "bold" ? "bold" : style === "italic" ? "italic" : "normal");
  ctx.doc.setFontSize(fontSize);
  ctx.doc.setTextColor(...color);
  for (const line of lines) {
    ensureSpace(ctx, lineHeightMm);
    ctx.doc.text(line, MARGIN_MM, ctx.y);
    ctx.y += lineHeightMm;
  }
}

function addWrappedParagraphZinc800(
  ctx: LayoutCtx,
  raw: string,
  fontSize: number,
  lineHeightMm: number
): void {
  const normalized = normalizeTextForHelveticaPdf(raw);
  const paragraphs = normalized.split(/\n/);
  for (const para of paragraphs) {
    if (!para.trim()) {
      ctx.y += lineHeightMm * 0.35;
      continue;
    }
    const wrapped = wrapText(ctx.doc, para.trim(), fontSize, "normal", CONTENT_W_MM);
    addLinesColored(ctx, wrapped, fontSize, lineHeightMm, "normal", ZINC800);
  }
}

function drawHorizontalRule(doc: jsPDF, y: number): void {
  doc.setDrawColor(...ZINC200);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_MM, y, PAGE_W_MM - MARGIN_MM, y);
}

/** Fixed footer on the last page only (not body flow — avoids a blank page with footer at top). */
function drawFooterOnLastPage(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);

  const footerTextBaselineY = PAGE_H_MM - MARGIN_MM - 3;
  const footerRuleY = footerTextBaselineY - 4;
  drawHorizontalRule(doc, footerRuleY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const powered = "Powered by ";
  const brand = "Extra Brains";
  doc.setTextColor(...ZINC600);
  const totalW = doc.getTextWidth(powered) + doc.getTextWidth(brand);
  let fx = (PAGE_W_MM - totalW) / 2;
  doc.text(powered, fx, footerTextBaselineY);
  fx += doc.getTextWidth(powered);
  doc.setTextColor(...EMERALD600);
  doc.setFont("helvetica", "bold");
  doc.text(brand, fx, footerTextBaselineY);
  const linkW = doc.getTextWidth(brand);
  doc.link(fx, footerTextBaselineY - 3.2, linkW, 4.5, { url: "https://extrabrains.co.za/" });
}

/**
 * Vector-text PDF for media/lyrics — layout aligned with SetlistMediaExportView.
 */
export async function downloadMediaSetlistPdf(
  detail: SetlistDetail,
  options: { filename: string }
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: LayoutCtx = { doc, y: MARGIN_MM };

  const logoDataUrl = await fetchLogoDataUrl(BRANDING.main.logoSrc);
  const headerTopY = ctx.y;
  const leftTextX = logoDataUrl ? MARGIN_MM + LOGO_MM + LOGO_GAP_MM : MARGIN_MM;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN_MM, headerTopY, LOGO_MM, LOGO_MM, undefined, "FAST");
    } catch {
      /* ignore bad image */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const orgBaseline = headerTopY + 5;
  doc.text("Last Harvest Choir", leftTextX, orgBaseline);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ZINC500);
  doc.text("Media / Lyrics", leftTextX, orgBaseline + 5);

  const dateFormatted =
    formatIsoDateToDDMMYYYY(detail.serviceDate) || detail.serviceDate.trim();
  const dateLine = `${dateFormatted} - ${detail.serviceTitle}`;
  const leadLine =
    detail.leadVocalNames.length > 0
      ? `Lead vocal: ${detail.leadVocalNames.join(", ")}`
      : "Lead vocal: —";

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let ry = orgBaseline;
  doc.setTextColor(...ZINC700);
  const dateLines = wrapText(doc, dateLine, 10, "normal", RIGHT_COL_W_MM);
  for (const line of dateLines) {
    doc.text(line, PAGE_W_MM - MARGIN_MM, ry, { align: "right", maxWidth: RIGHT_COL_W_MM });
    ry += 5;
  }

  doc.setTextColor(...ZINC600);
  const leadLines = wrapText(doc, leadLine, 10, "normal", RIGHT_COL_W_MM);
  for (const line of leadLines) {
    doc.text(line, PAGE_W_MM - MARGIN_MM, ry, { align: "right", maxWidth: RIGHT_COL_W_MM });
    ry += 5;
  }

  const leftColumnBottom = Math.max(
    headerTopY + (logoDataUrl ? LOGO_MM : 0),
    orgBaseline + 5 + 2
  );
  const headerBottom = Math.max(leftColumnBottom, ry + 1);
  drawHorizontalRule(doc, headerBottom);
  ctx.y = headerBottom + 6 + 6;

  const songs = detail.songs;
  const spaceBetweenSectionsMm = 4;
  const spaceBetweenSongsMm = 10;
  const gapBeforeSetlistSectionMm = 5;

  for (let i = 0; i < songs.length; i += 1) {
    const item = songs[i];
    if (!item) continue;

    const prev = songs[i - 1];
    const setlistSectionChanged =
      i === 0 || (item.section ?? "").trim() !== (prev?.section ?? "").trim();
    const setlistSectionLabel = (item.section ?? "").trim() || "Worship";

    if (setlistSectionChanged) {
      if (i > 0) {
        ctx.y += gapBeforeSetlistSectionMm;
      }
      ensureSpace(ctx, 10);
      addLinesColored(ctx, [setlistSectionLabel.toUpperCase()], 9, 5, "bold", ZINC600);
      ctx.y += 2;
    }

    const title = `${i + 1}. ${item.songName ?? "Song"}`;
    ensureSpace(ctx, 16);
    const titleLines = wrapText(doc, title, 12, "bold", CONTENT_W_MM);
    addLinesColored(ctx, titleLines, 12, 6.5, "bold", [0, 0, 0]);

    const ruleY = ctx.y + 1;
    drawHorizontalRule(doc, ruleY);
    ctx.y = ruleY + 3;

    let firstSection = true;
    for (const { key, label } of LYRIC_ORDER) {
      const text = item.lyricsSections[key];
      if (!text || !String(text).trim()) continue;

      if (!firstSection) {
        ctx.y += spaceBetweenSectionsMm;
      }
      firstSection = false;

      ensureSpace(ctx, 10);
      const labelUpper = label.toUpperCase();
      addLinesColored(ctx, [labelUpper], 8, 4.2, "bold", ZINC500);
      ctx.y += 0.5;
      addWrappedParagraphZinc800(ctx, String(text), 10, 5.2);
    }

    if (i < songs.length - 1) {
      ctx.y += spaceBetweenSongsMm;
    }
  }

  drawFooterOnLastPage(doc);

  doc.save(options.filename);
}
