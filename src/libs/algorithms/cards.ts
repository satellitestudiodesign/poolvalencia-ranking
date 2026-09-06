import type { Places } from "./bracket";
import { slugify } from "./slug";

/**
 * What each shareable card says, decided here rather than inside the canvas
 * drawing so it can be tested without a DOM.
 *
 * These cards exist because a club's marketing is a WhatsApp group and an
 * Instagram story, not a URL: a result has to leave the app as an image or it
 * does not leave at all, and a link somebody pastes previews as a picture or as
 * a grey rectangle. Everything on them is data the pages already have — see
 * libs/cards/paint.ts for the pixels.
 *
 * Three shapes: a tournament's podium, a club, and one result. Every one of
 * them names the club and carries the app's mark, because that is the whole
 * point of the thing travelling.
 */
export type CardStep = { rank: number; name: string };

/** A club, as a link preview: who they are and how many of them there are.
 *
 *  Also what a tournament that has no podium yet is drawn as — a heading, a
 *  date and a line of standing is the same shape, and the alternative was a
 *  fourth painter for three words of text. See the og/tournaments route. */
export type ClubCardSpec = {
  /** The club's own name is the headline here, not the byline. */
  title: string;
  /** The byline over the title. Empty on a club's own card, where the club is
   *  the title; the club's name on a tournament drawn in this layout. */
  club?: string;
  /** Where it is — "Valencia, España" — or empty for a club that has not said. */
  subtitle: string;
  /** "21 jugadores", already pluralised and translated by the caller: this
   *  module has no dictionary, and the routes that build these run outside
   *  React where `t()` is not reachable. */
  stat: string;
  fileName: string;
};

/** A person, as a link preview: who they are, where they play, what they have
 *  done. */
export type PlayerCardSpec = {
  title: string;
  /** The clubs they play in, already joined into a sentence by the caller. */
  subtitle: string;
  /** Three at most — the row is a headline, not a table. Values and labels are
   *  both translated by the caller: these routes run outside React, where
   *  `t()` is not reachable. */
  stats: { value: string; label: string }[];
  fileName: string;
};

/** One side of a result: a name, or two of them in doubles. */
export type GameSide = {
  names: string[];
  score: number;
  won: boolean;
};

/** A single result, at the size a scoreline deserves. */
export type GameCardSpec = {
  club: string;
  /** "9-ball · Individual · 27 de agosto de 2026" */
  subtitle: string;
  sides: [GameSide, GameSide];
  fileName: string;
};

export type ResultCardSpec = {
  club: string;
  title: string;
  /** When it ran. Empty for a tournament nobody dated. */
  subtitle: string;
  steps: CardStep[];
  fileName: string;
};

/** Four steps: a winner, a runner-up and the two shared thirds a draw that
 *  never played a third-place match leaves behind. A fifth would be somebody
 *  who lost in the quarters. */
const MAX_STEPS = 4;

/** Who is on the card, in the order they appear on it. Kept apart from
 *  `podiumSteps` so a caller with something else to say about each player —
 *  their avatar, say — can line it up with the steps without re-deriving the
 *  order and hoping the two agree. */
export function podiumIds(places: Places): number[] {
  return [
    ...(places.first !== null ? [places.first] : []),
    ...(places.second !== null ? [places.second] : []),
    ...places.third,
  ].slice(0, MAX_STEPS);
}

export function podiumSteps(
  places: Places,
  nameOf: (playerId: number) => string,
): CardStep[] {
  const rankOf = (playerId: number) =>
    playerId === places.first ? 1 : playerId === places.second ? 2 : 3;

  return podiumIds(places).map((playerId) => ({
    rank: rankOf(playerId),
    name: nameOf(playerId),
  }));
}

export function clubCardSpec({
  name,
  place,
  stat,
  club,
}: {
  name: string;
  /** City and country, however much of either is known. */
  place: string | null;
  stat: string;
  /** Only for a tournament borrowing this layout — a club's own card has no
   *  byline, because its name is already the headline. */
  club?: string;
}): ClubCardSpec {
  return {
    title: name,
    subtitle: place ?? "",
    stat,
    club,
    fileName: `${slugify(club ? `${club}-${name}` : name)}.png`,
  };
}

export function playerCardSpec({
  name,
  clubs,
  stats,
}: {
  name: string;
  clubs: string;
  stats: { value: string; label: string }[];
}): PlayerCardSpec {
  return {
    title: name,
    subtitle: clubs,
    stats: stats.slice(0, 3),
    fileName: `${slugify(name)}.png`,
  };
}

export function gameCardSpec({
  club,
  subtitle,
  sides,
}: {
  club: string;
  subtitle: string;
  sides: [GameSide, GameSide];
}): GameCardSpec {
  return {
    club,
    subtitle,
    sides,
    // Named after who played, not after a uuid nobody can read: this is the
    // file a player saves to their camera roll.
    fileName: `${sides.map((side) => slugify(side.names[0] ?? "x")).join("-vs-")}.png`,
  };
}

export function resultCardSpec({
  club,
  title,
  subtitle,
  places,
  nameOf,
}: {
  club: string;
  title: string;
  subtitle: string | null;
  places: Places;
  nameOf: (playerId: number) => string;
}): ResultCardSpec {
  return {
    club,
    title,
    subtitle: subtitle ?? "",
    steps: podiumSteps(places, nameOf),
    // Phones name the shared file in the caption of some apps and in the
    // camera roll of all of them, so it carries the club and the tournament
    // rather than "image.png".
    fileName: `${slugify(club)}-${slugify(title)}.png`,
  };
}

/**
 * Left to right, the order the steps are drawn in: second, winner, third —
 * the shape of a real podium, read middle-first rather than as a list. A draw
 * that never played its beaten semi-finalists off against each other has two
 * thirds, and the extra one goes on the far left rather than both on the right,
 * which would put the winner off centre.
 *
 * Returns indices into `steps`, so whatever a caller holds alongside them —
 * each player's avatar — stays lined up.
 *
 * The same arrangement as components/tournaments/TournamentPodium.tsx, which is
 * what a member sees in the app. Change both together.
 */
export function podiumOrder(steps: CardStep[]): number[] {
  const at = (rank: number) => steps.findIndex((step) => step.rank === rank);
  const thirds = steps.flatMap((step, i) => (step.rank === 3 ? [i] : []));
  const [right, ...left] = thirds;

  return [
    ...left,
    at(2),
    at(1),
    ...(right === undefined ? [] : [right]),
  ].filter((index) => index >= 0);
}

/** Width of a string in whatever the caller is drawing with. Canvas supplies
 *  `ctx.measureText(s).width`; the test supplies one character = one unit. */
export type Measure = (text: string) => number;

/**
 * The spaces Intl reaches for that the card's fonts do not have.
 *
 * `formatRange` joins a date range with THIN SPACE, EN DASH, THIN SPACE, and
 * the vendored .ttf files the server draws with carry no glyph for U+2009 —
 * pureimage draws .notdef, so "21 de septiembre – 21 de diciembre" arrived in
 * a chat app as two empty boxes around the dash. Flattened to an ordinary
 * space here rather than in eventDates, which is also read by the DOM, where
 * the typographer's space is right and renders.
 *
 * Applied in fitText, which every piece of free text on a card passes through —
 * wrapText splits on \s and rejoins with ordinary spaces, so it is already
 * safe, and its last line comes back through here anyway.
 */
const plainSpaces = (text: string) =>
  text.replace(/[\u2009\u202f\u2007]/g, " ");

/** One line, shortened with an ellipsis until it fits. A name too long for the
 *  card is cut rather than shrunk: two type sizes on one podium read as a
 *  mistake. */
export function fitText(raw: string, max: number, measure: Measure): string {
  const text = plainSpaces(raw);
  if (measure(text) <= max) return text;
  let cut = text;
  while (cut.length > 1 && measure(`${cut}…`) > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Greedy word wrap, capped: the overflow is ellipsised into the last line so a
 *  long tournament name never pushes the podium off the bottom. */
export function wrapText(
  text: string,
  max: number,
  lines: number,
  measure: Measure,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > max) {
      out.push(line);
      line = word;
      if (out.length === lines - 1) break;
    } else {
      line = next;
    }
  }

  const used = out.join(" ");
  const rest = used ? text.slice(used.length).trim() : text;
  out.push(fitText(rest, max, measure));
  return out;
}
