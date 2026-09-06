import type { ResultCardSpec } from "@/libs/algorithms/resultCard";
import { CARD_SIZES, paintResultCard, type CardSize } from "@/libs/cards/paint";
import { CLUB_THEME_PALETTE } from "@/libs/theme/clubTheme";
import type { BallColor } from "@/types";

/**
 * The result card as a PNG blob, drawn on a real canvas with the app's own
 * fonts, for the share sheet.
 *
 * The layout is in libs/cards/paint.ts, shared with the server renderer behind
 * the link-preview route. This file is only the browser's half: a canvas, image
 * loading, and the CSS font shorthand.
 */

const SANS = '"DM Sans Variable", ui-sans-serif, system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';

/** Resolves to null rather than rejecting: a missing logo costs the card a
 *  corner, a rejected promise costs the club its post. */
const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export async function drawResultCard(
  spec: ResultCardSpec,
  {
    color,
    logoUrl,
    size = "square",
  }: {
    /** The club's accent ball. */
    color: BallColor;
    /** `clubs.logo_url`, a data URI. Same-origin paths work too; anything
     *  cross-origin would taint the canvas, so it is not drawn. */
    logoUrl?: string | null;
    size?: CardSize;
  },
): Promise<Blob> {
  const { width, height } = CARD_SIZES[size];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // Without this the first card of a session draws in Times: the variable
  // fonts are still loading, and canvas has no fallback-then-repaint.
  await document.fonts.ready;

  paintResultCard(ctx, spec, {
    size,
    accent: CLUB_THEME_PALETTE[color].dark.base,
    font: (family, weight, px) =>
      `${weight} ${px}px ${family === "sans" ? SANS : MONO}`,
    logo: logoUrl?.startsWith("data:") ? await loadImage(logoUrl) : null,
    mark: await loadImage("/ball.png"),
  });

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("no blob"))),
      "image/png",
    ),
  );
}

/**
 * Hand the PNG to the phone's share sheet — which is what puts it in WhatsApp
 * or Instagram in two taps — and fall back to a download where there is none,
 * i.e. most desktops.
 */
export async function shareResultCard(
  blob: Blob,
  spec: ResultCardSpec,
): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], spec.fileName, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: spec.title });
      return "shared";
    } catch (err) {
      // Dismissing the sheet is a decision, not a failure — no error toast.
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = spec.fileName;
  link.click();
  URL.revokeObjectURL(url);
  return "saved";
}
