import {
  fitText,
  wrapText,
  type ResultCardSpec,
} from "@/libs/algorithms/resultCard";
import { CLUB_THEME_PALETTE } from "@/libs/theme/clubTheme";

/**
 * The result card's layout, drawn against a Canvas-2D-shaped context and
 * nothing else.
 *
 * Two places paint it: a browser canvas, for the PNG a phone hands to its share
 * sheet (libs/browser/resultCard.ts), and pureimage on the server, for the
 * link-preview image every crawler fetches (libs/server/cardImage.ts). The two
 * must agree — a club that shares the square card and a stranger who sees the
 * preview are looking at the same tournament — so the geometry lives here once
 * and the two callers differ only in how they make a context, load an image and
 * name a font.
 *
 * ponytail: no avatars on the card. `players.avatar_url` is often an external
 * Google URL, and drawing a cross-origin image taints a browser canvas —
 * toBlob then throws SecurityError and there is no card at all. Names only
 * until avatars are proxied through our own origin.
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

/**
 * A font string, built by the caller.
 *
 * The browser takes the CSS shorthand — `700 84px "DM Sans Variable", …` — and
 * pureimage does not: its parser reads the first token as the size, so a weight
 * in front of it silently yields no font at all. Each side names fonts its own
 * way; this file only says which weight it wants.
 */
export type FontFn = (
  family: "sans" | "mono",
  weight: number,
  px: number,
) => string;

/** What both contexts can draw. Structural, so a real
 *  CanvasRenderingContext2D and pureimage's Context both satisfy it without
 *  either library being imported here. */
export type CardImage = { width: number; height: number };

export type CardContext = {
  /** Wider than the string this file ever assigns, so that a browser context —
   *  whose fillStyle also takes a gradient or a pattern — still fits. */
  fillStyle: string | object;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  arc(x: number, y: number, r: number, from: number, to: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  clip(): void;
  save(): void;
  restore(): void;
  drawImage(image: never, x: number, y: number, w: number, h: number): void;
};

export function paintResultCard(
  ctx: CardContext,
  spec: ResultCardSpec,
  {
    size,
    accent,
    font,
    logo,
    mark,
  }: {
    size: CardSize;
    /** The club's accent, already resolved to a hex string. */
    accent: string;
    font: FontFn;
    /** The club's logo and the app's ball, or null where either is missing —
     *  a card without them is worse-looking, not broken. */
    logo?: CardImage | null;
    mark?: CardImage | null;
  },
): void {
  const { width: W, height: H } = CARD_SIZES[size];

  /** Everything is sized off the square's 1080, so the wide card is the same
   *  layout at a smaller scale rather than a second set of numbers. */
  const s = H / CARD_SIZES.square.height;
  const u = (n: number) => n * s;
  const PAD = u(80);

  const measure = (fontString: string) => (text: string) => {
    ctx.font = fontString;
    return ctx.measureText(text).width;
  };
  const draw = (image: CardImage, x: number, y: number, w: number, h: number) =>
    ctx.drawImage(image as never, x, y, w, h);

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
    draw(logo, PAD, PAD, u(104), u(104));
    ctx.restore();
    nameX = PAD + u(104 + 28);
  }

  const clubFont = font("sans", 600, u(40));
  ctx.font = clubFont;
  ctx.fillStyle = accent;
  ctx.fillText(
    fitText(spec.club, W - nameX - PAD, measure(clubFont)),
    nameX,
    PAD + u(logo ? 70 : 40),
  );

  // Title, two lines at most.
  const titleFont = font("sans", 700, u(84));
  const titleLines = wrapText(spec.title, W - PAD * 2, 2, measure(titleFont));
  ctx.font = titleFont;
  ctx.fillStyle = INK;
  let y = u(340);
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += u(96);
  }

  if (spec.subtitle) {
    const subFont = font("sans", 400, u(36));
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

    ctx.font = font("mono", 600, u(step.rank === 1 ? 42 : 34));
    ctx.fillStyle = FELT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(step.rank), PAD + radius, centre + u(2));
    ctx.textAlign = "left";

    const nameFont = font(
      "sans",
      step.rank === 1 ? 700 : 500,
      u(step.rank === 1 ? 68 : 52),
    );
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
  ctx.font = font("mono", 400, u(30));
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(spec.url, PAD, footerY);
  if (mark) draw(mark, W - PAD - u(56), footerY - u(52), u(56), u(56));
}
