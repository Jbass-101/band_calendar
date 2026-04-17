/**
 * Band setlist export — PNG capture for {@link SetlistBandExportView} only.
 *
 * `mx-auto` (margin: auto) on the card breaks inside SVG foreignObject (blank left,
 * content shifted/clipped). We pass explicit px size from getBoundingClientRect and
 * zero margins on the clone only (html-to-image `style` applies to the clone).
 */
import { toPng } from "html-to-image";

export type DownloadBandSetlistPngOptions = {
  filename: string;
  scale?: number;
  backgroundColor?: string | null;
};

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (img.complete && img.naturalHeight > 0) {
        try {
          await img.decode();
        } catch {
          /* ignore */
        }
        return;
      }
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      try {
        await img.decode();
      } catch {
        /* ignore */
      }
    })
  );
}

function triggerPngDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadBandSetlistPng(
  node: HTMLElement,
  options: DownloadBandSetlistPngOptions
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

  await waitForImages(node);

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

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const rect = node.getBoundingClientRect();
  const widthPx = Math.max(1, Math.round(rect.width));
  const heightPx = Math.max(1, Math.round(rect.height));

  const dataUrl = await toPng(node, {
    pixelRatio: scale,
    backgroundColor: bg,
    cacheBust: true,
    width: widthPx,
    height: heightPx,
    style: {
      margin: "0",
      marginLeft: "0",
      marginRight: "0",
      marginTop: "0",
      marginBottom: "0",
      transform: "none",
    },
  });

  if (scrollParent && prevParentScroll != null) scrollParent.scrollTop = prevParentScroll;
  if (typeof window !== "undefined") window.scrollTo({ top: prevWinScroll, left: 0 });

  triggerPngDownload(dataUrl, options.filename);
}
