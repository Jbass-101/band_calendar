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
  const nodeRect = node.getBoundingClientRect();
  const nodeWidthPx = Math.max(1, nodeRect.width);
  const nodeHeightPx = Math.max(1, nodeRect.height);

  // Capture anchor locations before rasterizing so we can add clickable PDF annotations.
  const linkRects = Array.from(node.querySelectorAll("a[href]"))
    .map((anchor) => {
      const href = anchor.getAttribute("href")?.trim();
      if (!href) return null;

      const rect = anchor.getBoundingClientRect();
      const left = rect.left - nodeRect.left;
      const top = rect.top - nodeRect.top;
      const width = rect.width;
      const height = rect.height;

      if (width <= 0 || height <= 0) return null;
      if (left + width < 0 || top + height < 0) return null;
      if (left > nodeWidthPx || top > nodeHeightPx) return null;

      return { href, left, top, width, height };
    })
    .filter((item): item is { href: string; left: number; top: number; width: number; height: number } => Boolean(item));

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

  // Map DOM-space coordinates to PDF-space and add clickable links.
  const mmPerPxX = pageWidthMm / nodeWidthPx;
  const mmPerPxY = pageHeightMm / nodeHeightPx;
  for (const link of linkRects) {
    const x = link.left * mmPerPxX;
    const y = link.top * mmPerPxY;
    const w = link.width * mmPerPxX;
    const h = link.height * mmPerPxY;
    pdf.link(x, y, w, h, { url: link.href });
  }

  pdf.save(options.filename);
}
