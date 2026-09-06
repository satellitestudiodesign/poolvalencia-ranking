import {
  fitText,
  wrapText,
  type ResultCardSpec,
} from "@/libs/algorithms/resultCard";
import { CLUB_THEME_PALETTE } from "@/libs/theme/clubTheme";
import type { BallColor } from "@/types";

/**
 * A tournament result as a square PNG, drawn in the browser.
 *
 * Canvas rather than a server route: rendering an image on the server means a
 * rasteriser (satori + resvg or a headless browser), a native binary per
 * platform and fonts shipped into the function — for a picture the phone
 * holding the club's Instagram login is already able to draw. The blob never
 * leaves the device unless somebody shares it.
 *
 * ponytail: no avatars on the card. `players.avatar_url` is often an external
 * Google URL, and drawing a cross-origin image taints the canvas — toBlob then
 * throws SecurityError and there is no card at all. Names only until avatars
 * are proxied through our own origin.
 */
/**
 * Two shapes, one drawing. `square` is what a phone shares into WhatsApp and
 * Instagram; `wide` is the 1.91:1 every link preview crops to, and a square
 * card in that slot loses its club name off the top and its URL off the
 * bottom. Every number below is a fraction of the 1080 the square was drawn
 * at, so the wide one is the same design rather than a second design.
 */
export const CARD_SIZES = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;

const FELT = "#12161b";
const INK = "#f2f5f8";
const INK_SOFT = "#9aa7b6";

/** 1 yellow, 2 blue, 3 red — the same three the podium and the ranking wear,
 *  taken from the club palette rather than re-picked here. */
const RANK_COLOR: Record<number, string> = {
  1: CLUB_THEME_PALETTE.yellow.dark.base,
  2: CLUB_THEME_PALETTE.blue.dark.base,
  3: CLUB_THEME_PALETTE.red.dark.base,
};

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
  const { width: W, height: H } = CARD_SIZES[size];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // Without this the first card of a session draws in Times: the variable
  // fonts are still loading, and canvas has no fallback-then-repaint.
  await document.fonts.ready;

  /** Everything is sized off the square's 1080, so the wide card is the same
   *  layout at a smaller scale rather than a second set of numbers. */
  const s = H / CARD_SIZES.square.height;
  const u = (n: number) => n * s;
  const PAD = u(80);

  const accent = CLUB_THEME_PALETTE[color].dark.base;
  const logo = logoUrl?.startsWith("data:") ? await loadImage(logoUrl) : null;
  const mark = await loadImage("/ball.png");
  const measure = (font: string) => (text: string) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  ctx.fillStyle = FELT;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, u(14));

  ctx.textBaseline = "alphabetic";

  // Header: the club, not the app. Whoever sees this in a chat should read the
  // club's name first and ours in the corner.
  let nameX = PAD;
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, PAD, u(104), u(104), u(26));
    ctx.clip();
    ctx.drawImage(logo, PAD, PAD, u(104), u(104));
    ctx.restore();
    nameX = PAD + u(104 + 28);
  }

  const clubFont = `600 ${u(40)}px ${SANS}`;
  ctx.font = clubFont;
  ctx.fillStyle = accent;
  ctx.fillText(
    fitText(spec.club, W - nameX - PAD, measure(clubFont)),
    nameX,
    PAD + u(logo ? 70 : 40),
  );

  // Title, two lines at most.
  const titleFont = `700 ${u(84)}px ${SANS}`;
  const titleLines = wrapText(spec.title, W - PAD * 2, 2, measure(titleFont));
  ctx.font = titleFont;
  ctx.fillStyle = INK;
  let y = u(340);
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += u(96);
  }

  if (spec.subtitle) {
    const subFont = `400 ${u(36)}px ${SANS}`;
    ctx.font = subFont;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(
      fitText(spec.subtitle, W - PAD * 2, measure(subFont)),
      PAD,
      y + u(6),
    );
  }

  // The podium, hung from a fixed line rather than pushed up off the footer:
  // bottom-anchoring left a two-name card with a hole in its middle, and empty
  // space below the last name reads as room, not as a gap.
  const footerY = H - PAD;
  const rowHeight = (rank: number) => u(rank === 1 ? 116 : 96);
  /** Every name starts at the same x whatever its chip's size, so the column
   *  is a column. */
  const stepNameX = PAD + u(80 + 32);
  let rowY = u(520);

  for (const step of spec.steps) {
    const height = rowHeight(step.rank);
    const radius = u(step.rank === 1 ? 40 : 34);
    const centre = rowY + height / 2;

    ctx.beginPath();
    ctx.arc(PAD + radius, centre, radius, 0, Math.PI * 2);
    ctx.fillStyle = RANK_COLOR[step.rank] ?? INK_SOFT;
    ctx.fill();

    ctx.font = `600 ${u(step.rank === 1 ? 42 : 34)}px ${MONO}`;
    ctx.fillStyle = FELT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(step.rank), PAD + radius, centre + u(2));
    ctx.textAlign = "left";

    const nameFont = `${step.rank === 1 ? `700 ${u(68)}px` : `500 ${u(52)}px`} ${SANS}`;
    ctx.font = nameFont;
    ctx.fillStyle = step.rank === 1 ? INK : INK_SOFT;
    ctx.fillText(
      fitText(step.name, W - stepNameX - PAD, measure(nameFont)),
      stepNameX,
      centre,
    );
    ctx.textBaseline = "alphabetic";

    rowY += height;
  }

  // Footer: where to go to see the rest of it, and our mark.
  ctx.font = `400 ${u(30)}px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(spec.url, PAD, footerY);
  if (mark) ctx.drawImage(mark, W - PAD - u(56), footerY - u(52), u(56), u(56));

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
