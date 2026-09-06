import {
  fitText,
  podiumOrder,
  wrapText,
  type ClubCardSpec,
  type GameCardSpec,
  type PlayerCardSpec,
  type ResultCardSpec,
} from "@/libs/algorithms/cards";

/**
 * Every card's layout, drawn against a Canvas-2D-shaped context and nothing
 * else.
 *
 * Two places paint them: a browser canvas, for the PNG a phone hands to its
 * share sheet (libs/browser/resultCard.ts), and pureimage on the server, for
 * the link previews every crawler fetches (libs/server/cardImage.ts). The two
 * must agree — a club that shares a card and a stranger who sees a preview are
 * looking at the same thing — so the geometry lives here once and the callers
 * differ only in how they make a context, load an image and name a font.
 *
 * Three cards, one chrome: the felt, the accent rule, the club and our mark in
 * the header, a title and a subtitle. `paintChrome` draws all of that and hands
 * back the measurements; each card then paints its own body underneath.
 */

/**
 * Two shapes, one drawing. `square` is what a phone shares into WhatsApp and
 * Instagram; `wide` is the 1.91:1 every link preview crops to, and a square
 * card in that slot loses its heading off the top. Every number below is a
 * fraction of the 1080 the square was drawn at, so the wide one is the same
 * design rather than a second design.
 */
export const CARD_SIZES = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
} as const;

export type CardSize = keyof typeof CARD_SIZES;

/**
 * The app's own dark palette, copied from the `.dark` block in src/index.css —
 * `--color-felt`, `--color-ink`, `--color-ink-soft` and `--color-ink-faint`.
 * Copied rather than read: this draws onto a canvas, where there is no
 * stylesheet to resolve a custom property against. A card is always dark,
 * whatever theme the reader is in, because it is an image in somebody else's
 * chat window rather than a surface in our UI.
 */
const FELT = "#171c22";
const FELT_RAISED = "#1f242c";
const POCKET = "#090b0e";
const INK = "#f4f2ec";
const INK_SOFT = "#b9c0cb";
const INK_FAINT = "#8d95a1";

/** `--color-strike`, the app's own accent. The club's ball colour deliberately
 *  does not appear: the rank colours below are already three hues, and a fourth
 *  that changed per club made the same card look like a different product each
 *  time. The club is named, not tinted. */
const STRIKE = "#f4c53c";

/** Not from the dictionary: a card is one image shared into chats in every
 *  language, and a brand name does not translate. */
const APP_NAME = "PoolClubs";

/**
 * Rank as an object ball: 1 the yellow, 2 the blue, 3 the red. Values are
 * `--color-ball-1..3` and their text pairs from src/index.css — the same ones
 * components/ui/Ball.tsx gives the app's own podium, because a card that
 * recoloured them would be a different podium from the one the club sees.
 */
const RANK_TONE: Record<number, { fill: string; ink: string }> = {
  1: { fill: "#f2b705", ink: POCKET },
  2: { fill: "#2f6fd0", ink: "#ffffff" },
  3: { fill: "#d2342f", ink: "#ffffff" },
};

const rankTone = (rank: number) =>
  RANK_TONE[rank] ?? { fill: FELT_RAISED, ink: INK_SOFT };

/**
 * A font string, built by the caller.
 *
 * The browser takes the CSS shorthand — `700 84px "DM Sans Variable", …` — and
 * pureimage does not: its parser reads the first token as the size, so a weight
 * in front of it silently yields no font at all. Each side names fonts its own
 * way; this file only says which weight it wants.
 *
 * One family throughout. The rank on each step used to be set in the mono face,
 * as it is in the app — but pureimage fills paths with the even-odd rule rather
 * than canvas's non-zero, and Geist Mono's "1" is a stem crossing a base bar,
 * so the overlap cancelled and left a notch in the digit. See
 * src/assets/fonts/README.md, which is also why the sans files there are not
 * the ones Google serves.
 */
export type FontFn = (weight: number, px: number) => string;

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

/** What every card gets, whatever it draws. */
export type CardChrome = {
  size: CardSize;
  font: FontFn;
  /** Draw everything this many times bigger. The server renders at 2 and serves
   *  it that way, which is what stops pureimage's single-sample edges looking
   *  pixelated — see libs/server/cardImage.ts. Every measurement here is
   *  already relative, so this needs no other change. */
  scale?: number;
  /** The club's logo and the app's ball, or null where either is missing — a
   *  card without them is worse-looking, not broken. */
  logo?: CardImage | null;
  mark?: CardImage | null;
  /** How big the header image is drawn. A club's logo is a byline beside its
   *  name; a player's face is the subject of their own card, so it gets more
   *  room. */
  logoRadius?: number;
  /** The club's own photograph of the room, behind everything, under a scrim.
   *  Absent for a club that has published none, and the card is then plain
   *  felt — which is what it always used to be. */
  cover?: CardImage | null;
};

type Layout = {
  W: number;
  H: number;
  /** Square-card units into device pixels. */
  u: (n: number) => number;
  PAD: number;
  /** Where a body may start, below whatever heading was drawn. */
  bodyTop: number;
  /** Where things stand: the bottom padding line. */
  floor: number;
  measure: (fontString: string) => (text: string) => number;
  draw: (image: CardImage, x: number, y: number, w: number, h: number) => void;
  /** A face in a circle, with the person's initial where there is no
   *  photograph — the same fallback the app's own Avatar makes. */
  face: (
    image: CardImage | null,
    name: string,
    x: number,
    y: number,
    r: number,
  ) => void;
};

function paintChrome(
  ctx: CardContext,
  {
    size,
    font,
    scale = 1,
    logo,
    logoRadius,
    mark,
    cover,
    club,
    title,
    subtitle,
  }: CardChrome & {
    /** The byline. Omitted on a club's own card, where the club is the title. */
    club?: string;
    title: string;
    subtitle: string;
  },
): Layout {
  const W = CARD_SIZES[size].width * scale;
  const H = CARD_SIZES[size].height * scale;

  /** Everything is sized off the square's 1080, so the wide card is the same
   *  layout at a smaller scale rather than a second set of numbers — and a
   *  doubled render is the same layout again, bigger. */
  const s = H / CARD_SIZES.square.height;
  const u = (n: number) => n * s;
  const PAD = u(80);

  const measure = (fontString: string) => (text: string) => {
    ctx.font = fontString;
    return ctx.measureText(text).width;
  };
  const draw = (image: CardImage, x: number, y: number, w: number, h: number) =>
    ctx.drawImage(image as never, x, y, w, h);

  const face = (
    image: CardImage | null,
    name: string,
    x: number,
    y: number,
    r: number,
  ) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = FELT_RAISED;
    ctx.fill();

    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      draw(image, x - r, y - r, r * 2, r * 2);
      ctx.restore();
      return;
    }

    ctx.font = font(600, r);
    ctx.fillStyle = INK_SOFT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.trim().charAt(0).toUpperCase(), x, y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  };

  ctx.fillStyle = FELT;
  ctx.fillRect(0, 0, W, H);

  if (cover) {
    // Cropped to fill, like CSS `object-fit: cover`: a room is a wide subject
    // and letterboxing one inside a card looks like a mistake.
    const zoom = Math.max(W / cover.width, H / cover.height);
    const coverWidth = cover.width * zoom;
    const coverHeight = cover.height * zoom;
    draw(
      cover,
      (W - coverWidth) / 2,
      (H - coverHeight) / 2,
      coverWidth,
      coverHeight,
    );

    // The scrim is the whole reason this is readable. Anything lighter and the
    // secondary text stops clearing its contrast bar over a bright room;
    // anything heavier and there was no point showing the photograph. Painted
    // as an rgba fill rather than with globalAlpha, which pureimage ignores.
    ctx.fillStyle = "rgba(23, 28, 34, 0.82)";
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = STRIKE;
  ctx.fillRect(0, 0, W, u(14));
  ctx.textBaseline = "alphabetic";

  // Header: the club on the left, us on the right. Whoever sees this in a chat
  // should read the club first and us in the corner.
  const markSize = u(62);
  const wordmarkFont = font(700, u(42));
  ctx.font = wordmarkFont;
  const wordmarkWidth = ctx.measureText(APP_NAME).width;
  const markX = W - PAD - wordmarkWidth - u(12) - markSize;
  const headerBaseline = PAD + u(logo ? 70 : 40);

  if (mark) draw(mark, markX, headerBaseline - u(48), markSize, markSize);
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(APP_NAME, markX + markSize + u(12), headerBaseline);

  let nameX = PAD;
  let headerBottom = PAD;
  if (logo) {
    // A circle, like every other avatar in the app — the club's logo is its
    // face, and a rounded square beside round player avatars read as a
    // different kind of thing.
    const radius = logoRadius ?? u(52);
    headerBottom = PAD + radius * 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + radius, PAD + radius, radius, 0, Math.PI * 2);
    ctx.clip();
    draw(logo, PAD, PAD, radius * 2, radius * 2);
    ctx.restore();
    nameX = PAD + radius * 2 + u(28);
  }

  if (club) {
    const clubFont = font(600, u(40));
    ctx.font = clubFont;
    ctx.fillStyle = INK;
    ctx.fillText(
      fitText(club, markX - nameX - u(24), measure(clubFont)),
      nameX,
      headerBaseline,
    );
  }

  // Title, two lines at most, then the subtitle under it. A card with no title
  // — the scoreline is its own headline — closes the gap rather than leaving
  // the hole where one would have been.
  let y = headerBaseline + u(110);
  if (title) {
    const titleFont = font(700, u(104));
    const titleLines = wrapText(title, W - PAD * 2, 2, measure(titleFont));
    ctx.font = titleFont;
    ctx.fillStyle = INK;
    // Below the header image, not at a fixed height: a player's face is drawn
    // large enough to reach into where the title would otherwise start.
    // The baseline, so this clears the image by a whole cap height plus air.
    y = Math.max(u(350), headerBottom + u(150));
    for (const line of titleLines) {
      ctx.fillText(line, PAD, y);
      y += u(116);
    }
    y -= u(116);
  }

  if (subtitle) {
    const subFont = font(400, u(36));
    ctx.font = subFont;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(
      fitText(subtitle, W - PAD * 2, measure(subFont)),
      PAD,
      y + u(60),
    );
    y += u(60);
  }

  return {
    W,
    H,
    u,
    PAD,
    bodyTop: y + u(70),
    floor: H - PAD,
    measure,
    draw,
    face,
  };
}

export function paintResultCard(
  ctx: CardContext,
  spec: ResultCardSpec,
  opts: CardChrome & {
    /** One per step, in the same order — see `podiumIds`. A null draws the
     *  player's initial instead, which is what somebody with no photograph
     *  gets. */
    avatars?: (CardImage | null)[];
  },
): void {
  const { font, avatars } = opts;
  const { W, u, PAD, floor, measure, face } = paintChrome(ctx, {
    ...opts,
    club: spec.club,
    title: spec.title,
    subtitle: spec.subtitle,
  });

  // The podium: second on the left, the winner in the middle, third on the
  // right — read middle-first, the way a real one is. Every step stands on the
  // same floor, which is what makes the heights mean something.
  const order = podiumOrder(spec.steps);
  const gap = u(24);
  const columnWidth = Math.min(
    u(320),
    (W - PAD * 2 - gap * (order.length - 1)) / Math.max(order.length, 1),
  );
  const podiumWidth = columnWidth * order.length + gap * (order.length - 1);
  let columnX = (W - podiumWidth) / 2;

  /** Tall, taller, tallest: the plinth is the ranking, and the number on it
   *  only repeats what the height already said. */
  const PLINTH = { 1: 265, 2: 195, 3: 145 } as const;
  const AVATAR = { 1: 74, 2: 60, 3: 60 } as const;
  const NAME = { 1: 42, 2: 36, 3: 36 } as const;

  for (const index of order) {
    const step = spec.steps[index];
    const tone = rankTone(step.rank);
    const rank = (step.rank === 1 ? 1 : step.rank === 2 ? 2 : 3) as 1 | 2 | 3;
    const centreX = columnX + columnWidth / 2;

    // The step. Rounded at the top only: it is a plinth standing on a floor,
    // and rounding where it meets the floor lifts it off. roundRect takes one
    // radius here rather than four — pureimage has no per-corner form — so the
    // bottom is squared off by painting over it.
    const plinthHeight = u(PLINTH[rank]);
    const radius = u(18);
    ctx.fillStyle = tone.fill;
    ctx.beginPath();
    ctx.roundRect(
      columnX,
      floor - plinthHeight,
      columnWidth,
      plinthHeight,
      radius,
    );
    ctx.fill();
    ctx.fillRect(columnX, floor - radius, columnWidth, radius);

    const rankFont = font(600, u(rank === 1 ? 72 : 56));
    ctx.font = rankFont;
    ctx.fillStyle = tone.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(step.rank), centreX, floor - plinthHeight / 2);
    ctx.textBaseline = "alphabetic";

    // The name sits on the step rather than inside it, and wraps to a second
    // line rather than shrinking: a column is narrow, two type sizes on one
    // podium read as a mistake, and "Sara Cam…" is worse than two lines. Same
    // two-line limit the app's own podium clamps to.
    const nameSize = u(NAME[rank]);
    const nameFont = font(rank === 1 ? 700 : 500, nameSize);
    const nameLines = wrapText(
      step.name,
      columnWidth + gap,
      2,
      measure(nameFont),
    );
    const lineHeight = nameSize * 1.2;
    const nameBaseline = floor - plinthHeight - u(26);
    ctx.font = nameFont;
    ctx.fillStyle = rank === 1 ? INK : INK_SOFT;
    nameLines.forEach((line, lineIndex) => {
      ctx.fillText(
        line,
        centreX,
        nameBaseline - (nameLines.length - 1 - lineIndex) * lineHeight,
      );
    });

    // The face, above the name. A player with no photograph gets their initial
    // on the cue ball's grey, which is what the app's own Avatar falls back to.
    const avatarR = u(AVATAR[rank]);
    const avatarY =
      nameBaseline -
      (nameLines.length - 1) * lineHeight -
      nameSize -
      u(16) -
      avatarR;
    face(avatars?.[index] ?? null, step.name, centreX, avatarY, avatarR);

    ctx.textAlign = "left";
    columnX += columnWidth + gap;
  }
}

/**
 * A club, as a link preview: its name at display size, where it is, and the
 * faces of the people who play there.
 *
 * No byline in the header — the club is the title here, so repeating it above
 * would say the same thing twice in three lines. The logo stays, because a
 * club's logo is how it is recognised before its name is read.
 */
export function paintClubCard(
  ctx: CardContext,
  spec: ClubCardSpec,
  opts: CardChrome & {
    /** Up to eight, in the order the club page lists them: photographs first.
     *  Fewer is normal, none is fine. */
    faces?: { name: string; image: CardImage | null }[];
  },
): void {
  const { font, faces = [] } = opts;
  const { W, u, PAD, bodyTop, measure, face } = paintChrome(ctx, {
    ...opts,
    title: spec.title,
    subtitle: spec.subtitle,
  });

  // The face pile, overlapping the way it does on the club's own hero: a row
  // of people reads as a club, and eight is where the row stops earning its
  // width on the narrow card.
  const radius = u(74);
  const step = radius * 1.5;
  const shown = faces.slice(0, 8);
  const pileY = bodyTop + radius;

  shown.forEach((person, index) => {
    const x = PAD + radius + index * step;
    // A ring of felt between the faces, so an overlap reads as in front of
    // rather than merged into.
    ctx.beginPath();
    ctx.arc(x, pileY, radius + u(5), 0, Math.PI * 2);
    ctx.fillStyle = FELT;
    ctx.fill();
    face(person.image, person.name, x, pileY, radius);
  });

  const statFont = font(500, u(48));
  ctx.font = statFont;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(
    fitText(spec.stat, W - PAD * 2, measure(statFont)),
    PAD,
    pileY + radius + u(64),
  );
}

/**
 * One result: two sides, two scores, at the size a scoreline deserves.
 *
 * No title from the chrome — the scoreline is the headline, and a heading over
 * it would only name what is plainly below. The subtitle carries the discipline
 * and the date, so the card says what was played, by whom, and when.
 */
export function paintGameCard(
  ctx: CardContext,
  spec: GameCardSpec,
  opts: CardChrome & {
    /** Two entries, one per side, each holding that side's players in the same
     *  order as the spec's names. */
    avatars?: (CardImage | null)[][];
  },
): void {
  const { font, avatars = [] } = opts;
  const { W, u, PAD, bodyTop, floor, measure, face } = paintChrome(ctx, {
    ...opts,
    club: spec.club,
    title: "",
    subtitle: spec.subtitle,
  });

  const radius = u(56);
  const rowHeight = u(190);
  // Centred in what the chrome left, so the pair reads as one block rather
  // than as two rows that happen to start under the date.
  let rowY = bodyTop + Math.max(0, (floor - bodyTop - rowHeight * 2) / 2);

  spec.sides.forEach((side, sideIndex) => {
    const centreY = rowY + rowHeight / 2;

    // Doubles put two faces on a side, the second tucked behind the first.
    const players = side.names.slice(0, 2);
    players.forEach((name, index) => {
      const x = PAD + radius + index * radius * 1.5;
      ctx.beginPath();
      ctx.arc(x, centreY, radius + u(5), 0, Math.PI * 2);
      ctx.fillStyle = FELT;
      ctx.fill();
      face(avatars[sideIndex]?.[index] ?? null, name, x, centreY, radius);
    });

    // The score first: it is the fixed column the eye reads down, so the name
    // gets whatever width is left rather than the other way round.
    const scoreFont = font(700, u(108));
    ctx.font = scoreFont;
    ctx.fillStyle = side.won ? INK : INK_FAINT;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(side.score), W - PAD, centreY);
    const scoreWidth = ctx.measureText(String(side.score)).width;
    ctx.textAlign = "left";

    const nameX =
      PAD + radius * 2 + (players.length - 1) * radius * 1.5 + u(32);
    const nameFont = font(side.won ? 700 : 500, u(58));
    ctx.font = nameFont;
    ctx.fillStyle = side.won ? INK : INK_SOFT;
    ctx.fillText(
      fitText(
        players.join(" · "),
        W - nameX - PAD - scoreWidth - u(40),
        measure(nameFont),
      ),
      nameX,
      centreY,
    );
    ctx.textBaseline = "alphabetic";

    rowY += rowHeight;
  });
}

/**
 * A person: their face, their name, and the three figures a stranger reads
 * first.
 *
 * The face goes in the header's logo slot rather than the body — it is this
 * card's subject the way a club's logo is its club's — so the body is free for
 * the record, which is what anyone clicking through actually came for.
 */
export function paintPlayerCard(
  ctx: CardContext,
  spec: PlayerCardSpec,
  opts: CardChrome,
): void {
  const { font } = opts;
  const { W, u, PAD, bodyTop, measure } = paintChrome(ctx, {
    ...opts,
    logoRadius:
      (opts.size === "square" ? 1080 : 630) * (opts.scale ?? 1) * 0.09,
    title: spec.title,
    subtitle: spec.subtitle,
  });

  // Three columns of equal width, whatever the numbers in them: a row of
  // figures reads as a set when it is on a grid and as a list when it is not.
  const columnWidth = (W - PAD * 2) / 3;
  const valueFont = font(700, u(96));
  const labelFont = font(500, u(38));

  spec.stats.forEach((stat, index) => {
    const x = PAD + index * columnWidth;

    ctx.font = valueFont;
    ctx.fillStyle = INK;
    ctx.fillText(
      fitText(stat.value, columnWidth - u(24), measure(valueFont)),
      x,
      bodyTop + u(96),
    );

    ctx.font = labelFont;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(
      fitText(stat.label, columnWidth - u(24), measure(labelFont)),
      x,
      bodyTop + u(154),
    );
  });
}
