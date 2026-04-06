import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

export type DownloadDomAsPdfOptions = {
  filename: string;
  /** Effective DPR for capture; higher = sharper PDFs (larger files). */
  scale?: number;
  backgroundColor?: string | null;
};

/**
 * DOM → canvas via `html-to-image` (SVG pipeline), then single-page PDF.
 * Avoids **html2canvas**, whose CSS parser throws on modern colors (`lab()` /
 * `oklch()` from Tailwind v4).
 */
export async function downloadDomAsPdf(
  node: HTMLElement,
  options: DownloadDomAsPdfOptions
): Promise<void> {
  const scale = options.scale ?? 2;
  const bg = options.backgroundColor ?? "#ffffff";

  const canvas = await toCanvas(node, {
    pixelRatio: scale,
    backgroundColor: bg,
    cacheBust: true,
  });

  const imgData = canvas.toDataURL("image/png", 1);

  const pageWidthMm = 210;
  const pageHeightMm = Math.max(1, (canvas.height / canvas.width) * pageWidthMm);

  const pdf = new jsPDF({
    unit: "mm",
    format: [pageWidthMm, pageHeightMm],
  });

  pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm, undefined, "NONE");
  pdf.save(options.filename);
}
