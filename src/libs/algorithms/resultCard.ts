import type { Places } from "./bracket";
import { slugify } from "./slug";

/**
 * What a shareable result card says, decided here rather than inside the
 * canvas drawing so it can be tested without a DOM.
 *
 * The card exists because a club's marketing is a WhatsApp group and an
 * Instagram story, not a bracket URL: the result has to leave the app as an
 * image or it does not leave at all. Everything on it is data the tournament
 * page already has — see libs/browser/resultCard.ts for the pixels.
 */
export type CardStep = { rank: number; name: string };

export type ResultCardSpec = {
  club: string;
  title: string;
  /** When it ran. Empty for a tournament nobody dated. */
  subtitle: string;
  steps: CardStep[];
  /** Shown on the card, so no scheme: "poolclubs.app/clubs/paulas-pool". */
  url: string;
  fileName: string;
};

/** Four steps: a winner, a runner-up and the two shared thirds a draw that
 *  never played a third-place match leaves behind. A fifth would be somebody
 *  who lost in the quarters. */
const MAX_STEPS = 4;

export function podiumSteps(
  places: Places,
  nameOf: (playerId: number) => string,
): CardStep[] {
  const steps: CardStep[] = [
    ...(places.first !== null ? [{ rank: 1, name: nameOf(places.first) }] : []),
    ...(places.second !== null
      ? [{ rank: 2, name: nameOf(places.second) }]
      : []),
    ...places.third.map((id) => ({ rank: 3, name: nameOf(id) })),
  ];
  return steps.slice(0, MAX_STEPS);
}

export function resultCardSpec({
  club,
  clubSlug,
  title,
  subtitle,
  places,
  nameOf,
  origin,
}: {
  club: string;
  clubSlug: string;
  title: string;
  subtitle: string | null;
  places: Places;
  nameOf: (playerId: number) => string;
  /** The app's own origin, with scheme, as readOrigin() hands it out. */
  origin: string;
}): ResultCardSpec {
  return {
    club,
    title,
    subtitle: subtitle ?? "",
    steps: podiumSteps(places, nameOf),
    url: `${origin.replace(/^https?:\/\//, "").replace(/\/$/, "")}/clubs/${clubSlug}`,
    // Phones name the shared file in the caption of some apps and in the
    // camera roll of all of them, so it carries the club and the tournament
    // rather than "image.png".
    fileName: `${slugify(club)}-${slugify(title)}.png`,
  };
}

/** Width of a string in whatever the caller is drawing with. Canvas supplies
 *  `ctx.measureText(s).width`; the test supplies one character = one unit. */
export type Measure = (text: string) => number;

/** One line, shortened with an ellipsis until it fits. A name too long for the
 *  card is cut rather than shrunk: two type sizes on one podium read as a
 *  mistake. */
export function fitText(text: string, max: number, measure: Measure): string {
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
