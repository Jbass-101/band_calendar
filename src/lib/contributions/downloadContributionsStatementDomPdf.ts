/**
 * Contributions statement PDF only — DOM capture for {@link ContributionsManager}.
 * Not shared with band calendar or setlist exports.
 */
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

export type DownloadContributionsStatementDomPdfOptions = {
  filename: string;
  scale?: number;
  backgroundColor?: string | null;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (m) {
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  return { r: 255, g: 255, b: 255 };
}

function isPixelNearBg(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: { r: number; g: number; b: number },
  tolerance: number
): boolean {
  if (a < 12) return true;
  return (
    Math.abs(r - bg.r) <= tolerance &&
    Math.abs(g - bg.g) <= tolerance &&
    Math.abs(b - bg.b) <= tolerance
  );
}

function trimCanvasExcessBackground(
  source: HTMLCanvasElement,
  bgHex: string
): { canvas: HTMLCanvasElement; trimTopPx: number; trimLeftPx: number } {
  const ctx = source.getContext("2d");
  if (!ctx) return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };

  const bg = hexToRgb(bgHex);
  const tolerance = 14;
  const w = source.width;
  const h = source.height;

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };
  }

  const d = imageData.data;

  const rowHasNonBg = (y: number): boolean => {
    const rowStart = y * w * 4;
    for (let x = 0; x < w; x += 4) {
      const i = rowStart + x * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (!isPixelNearBg(r, g, b, a, bg, tolerance)) return true;
    }
    return false;
  };

  const colHasNonBg = (x: number, y0: number, y1: number): boolean => {
    for (let y = y0; y <= y1; y += 4) {
      const i = (y * w + x) * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (!isPixelNearBg(r, g, b, a, bg, tolerance)) return true;
    }
    return false;
  };

  let top = 0;
  while (top < h && !rowHasNonBg(top)) top += 1;
  if (top >= h) return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };

  let bottom = h - 1;
  while (bottom > top && !rowHasNonBg(bottom)) bottom -= 1;

  let left = 0;
  while (left < w && !colHasNonBg(left, top, bottom)) left += 1;
  if (left >= w) return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };

  let right = w - 1;
  while (right > left && !colHasNonBg(right, top, bottom)) right -= 1;

  if (top === 0 && bottom === h - 1 && left === 0 && right === w - 1) {
    return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };
  }

  const newW = right - left + 1;
  const newH = bottom - top + 1;
  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const octx = out.getContext("2d");
  if (!octx) return { canvas: source, trimTopPx: 0, trimLeftPx: 0 };

  octx.fillStyle = bgHex;
  octx.fillRect(0, 0, newW, newH);
  octx.drawImage(source, left, top, newW, newH, 0, 0, newW, newH);
  return { canvas: out, trimTopPx: top, trimLeftPx: left };
}

export async function downloadContributionsStatementDomPdf(
  node: HTMLElement,
  options: DownloadContributionsStatementDomPdfOptions
): Promise<void> {
  const scale = options.scale ?? 2;
  const bg = options.backgroundColor ?? "#ffffff";

  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const scrollParent = node.closest?.(".overflow-y-auto, .overflow-auto, [data-scroll-container]") as HTMLElement | null;
  const prevParentScroll = scrollParent ? scrollParent.scrollTop : null;
  const prevWinScroll = typeof window !== "undefined" ? window.scrollY : 0;

  node.scrollIntoView({ block: "start", inline: "nearest" });
  if (scrollParent) scrollParent.scrollTop = 0;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const innerScroll = node.querySelector(".overflow-x-auto");
  if (innerScroll instanceof HTMLElement) innerScroll.scrollLeft = 0;

  const nodeRect = node.getBoundingClientRect();
  const layoutWidthPx = Math.max(1, Math.round(nodeRect.width));
  const nodeHeightPx = Math.max(1, node.scrollHeight || Math.round(nodeRect.height));

  const linkRectsCss = Array.from(node.querySelectorAll("a[href]"))
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
      if (left > layoutWidthPx || top > nodeHeightPx) return null;

      return { href, left, top, width, height };
    })
    .filter((item): item is { href: string; left: number; top: number; width: number; height: number } =>
      Boolean(item)
    );

  const canvas = await toCanvas(node, {
    pixelRatio: scale,
    backgroundColor: bg,
    width: layoutWidthPx,
    height: nodeHeightPx,
    cacheBust: true,
  });

  if (scrollParent && prevParentScroll != null) scrollParent.scrollTop = prevParentScroll;
  if (typeof window !== "undefined") window.scrollTo({ top: prevWinScroll, left: 0 });

  const { canvas: canvasForPdf, trimTopPx, trimLeftPx } = trimCanvasExcessBackground(canvas, bg);

  const linkRects = linkRectsCss
    .map((r) => ({
      href: r.href,
      left: r.left * scale - trimLeftPx,
      top: r.top * scale - trimTopPx,
      width: r.width * scale,
      height: r.height * scale,
    }))
    .filter(
      (l) =>
        l.top + l.height > 0 &&
        l.top < canvasForPdf.height &&
        l.left + l.width > 0 &&
        l.left < canvasForPdf.width
    );

  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const marginMm = 8;
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;

  const canvasPxPerMmWidth = canvasForPdf.width / contentWidthMm;

  /** One continuous page (no A4 slices) when within PDF viewer limits. */
  const MAX_SINGLE_PAGE_HEIGHT_MM = 4800;
  const imgHeightMm = contentWidthMm * (canvasForPdf.height / canvasForPdf.width);
  const totalPageHeightMm = marginMm * 2 + imgHeightMm;

  if (totalPageHeightMm <= MAX_SINGLE_PAGE_HEIGHT_MM) {
    const pdf = new jsPDF({
      unit: "mm",
      format: [pageWidthMm, totalPageHeightMm],
    });
    const pngDataUrl = canvasForPdf.toDataURL("image/png");
    pdf.addImage(pngDataUrl, "PNG", marginMm, marginMm, contentWidthMm, imgHeightMm, undefined, "NONE");
    for (const link of linkRects) {
      const xMm = marginMm + link.left / canvasPxPerMmWidth;
      const yMm = marginMm + link.top / canvasPxPerMmWidth;
      const wMm = link.width / canvasPxPerMmWidth;
      const hMm = link.height / canvasPxPerMmWidth;
      pdf.link(xMm, yMm, wMm, hMm, { url: link.href });
    }
    pdf.save(options.filename);
    return;
  }

  const sliceHeightPx = Math.max(1, Math.floor(contentHeightMm * canvasPxPerMmWidth));

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  let offsetYPx = 0;
  let pageIndex = 0;

  while (offsetYPx < canvasForPdf.height) {
    const sliceH = Math.min(sliceHeightPx, canvasForPdf.height - offsetYPx);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvasForPdf.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) break;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvasForPdf, 0, offsetYPx, canvasForPdf.width, sliceH, 0, 0, canvasForPdf.width, sliceH);

    const pngDataUrl = sliceCanvas.toDataURL("image/png");
    const drawWidthMm = contentWidthMm;
    const drawHeightMm = drawWidthMm * (sliceH / sliceCanvas.width);

    if (pageIndex > 0) pdf.addPage("a4", "p");
    pdf.addImage(pngDataUrl, "PNG", marginMm, marginMm, drawWidthMm, drawHeightMm, undefined, "NONE");

    const pageTopPx = offsetYPx;
    const pageBottomPx = offsetYPx + sliceH;
    for (const link of linkRects) {
      const topPx = link.top;
      const bottomPx = link.top + link.height;
      if (bottomPx <= pageTopPx || topPx >= pageBottomPx) continue;

      const clippedTopPx = Math.max(topPx, pageTopPx);
      const clippedBottomPx = Math.min(bottomPx, pageBottomPx);
      const clippedHeightPx = clippedBottomPx - clippedTopPx;
      if (clippedHeightPx <= 0) continue;

      const xMm = marginMm + link.left / canvasPxPerMmWidth;
      const yMm = marginMm + (clippedTopPx - pageTopPx) / canvasPxPerMmWidth;
      const wMm = link.width / canvasPxPerMmWidth;
      const hMm = clippedHeightPx / canvasPxPerMmWidth;
      pdf.link(xMm, yMm, wMm, hMm, { url: link.href });
    }

    offsetYPx += sliceH;
    pageIndex += 1;
  }

  pdf.save(options.filename);
}
