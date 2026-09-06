import { DISCIPLINES, type Discipline, type GameMode } from "@/types";

/**
 * What the club is playing today: the format, the game, and to how many.
 *
 * One setting for the room rather than a question on every match. A club night
 * is nine-ball races to five until somebody says otherwise, and asking each of
 * fourteen matches what it is amounts to asking the same person the same three
 * questions all evening.
 */
export type DaySetup = {
  mode: GameMode;
  discipline: Discipline;
  raceTo: number;
};

export const DEFAULT_SETUP: DaySetup = {
  mode: "single",
  discipline: "9ball",
  raceTo: 5,
};

/** The race the database and the start form both accept. */
const RACE_MIN = 1;
const RACE_MAX = 50;

export const encodeSetup = (setup: DaySetup) =>
  `${setup.mode}:${setup.discipline}:${setup.raceTo}`;

/**
 * A cookie, for the reason theme and language are cookies (see libs/prefs.ts):
 * it arrives with the request, so the bar renders the right thing in the first
 * byte of HTML and there is nothing for hydration to move. localStorage would
 * render the default on the server and the real answer a frame later.
 *
 * Per device, not per club: a shared setting would be a column on `clubs` and a
 * policy to go with it. The device that runs the night is the tablet on the
 * rail, and it is the one that keeps this.
 *
 * Anything unreadable falls back rather than throwing. A cookie is user-editable
 * text, and a malformed one must not be able to take the page down.
 */
export function decodeSetup(raw: string | null): DaySetup {
  const [mode, discipline, race] = (raw ?? "").split(":");
  const raceTo = Number(race);

  return {
    mode: mode === "doubles" ? "doubles" : DEFAULT_SETUP.mode,
    discipline: (DISCIPLINES as string[]).includes(discipline ?? "")
      ? (discipline as Discipline)
      : DEFAULT_SETUP.discipline,
    raceTo:
      Number.isInteger(raceTo) && raceTo >= RACE_MIN && raceTo <= RACE_MAX
        ? raceTo
        : DEFAULT_SETUP.raceTo,
  };
}

/** Two seats, or four. What a suggestion needs before it is one. */
export const seatsNeeded = (setup: DaySetup) =>
  setup.mode === "doubles" ? 4 : 2;

/** Clamped here rather than left to an input's min/max, which only the spinner
 *  and the browser's own validation honour. */
export const clampRace = (n: number) =>
  Math.min(
    RACE_MAX,
    Math.max(RACE_MIN, Number.isFinite(n) ? n : DEFAULT_SETUP.raceTo),
  );

/** One key per pair of people, whichever way round they are named. */
export const pairKey = (a: number, b: number) =>
  a < b ? `${a}-${b}` : `${b}-${a}`;

/**
 * The moment somebody started waiting: when they arrived, or when their last
 * game ended, whichever is later.
 *
 * The second half is the whole of the rotation. Arrival alone puts the person
 * who has been here since six at the head of the queue all evening, however
 * many racks they have had; the winner of the game that has just finished has
 * waited no time at all and belongs at the back.
 *
 * Parsed rather than compared as strings: present_since is written by the
 * browser as `...Z` and played_at comes back from Postgres with a `+00:00`, and
 * those two do not sort against each other. A player with neither reads as
 * having waited forever, which is what the sort should do with somebody it
 * cannot date.
 */
export const waitingSince = (
  player: { present_since: string | null },
  lastPlayed: number | undefined,
) =>
  Math.max(
    Number.isNaN(Date.parse(player.present_since ?? ""))
      ? 0
      : Date.parse(player.present_since ?? ""),
    lastPlayed ?? 0,
  );

/** Longest wait first. A comparator rather than a sort, so it can be checked
 *  against a list without a hook — see today.test.ts. */
export const byWait =
  (lastPlayed: Map<number, number>) =>
  <T extends { id: number; present_since: string | null }>(a: T, b: T) =>
    waitingSince(a, lastPlayed.get(a.id)) -
    waitingSince(b, lastPlayed.get(b.id));

/**
 * Who could play whom, out of the people waiting.
 *
 * `maxGroups` is how many matches are wanted — the free tables, in practice.
 * It is a parameter and not a headcount for a reason: deriving it from how many
 * people are waiting made every suggestion depend on the size of the room, so
 * somebody checking in at the door with no intention of playing yet could
 * change who was being offered table six. What is asked for is what is built.
 *
 * Seed, then fill. The first person for each table is dealt out one per table in
 * arrival order, so two people who have already played can never end up on the
 * same one while there is another table to put them at. Only then is each table
 * filled — one table completed before the next is started, so the first
 * suggestion depends on the head of the queue and nothing else — each new name
 * having to be new to everybody already at that table.
 *
 * ponytail: greedy fill, not a maximum matching. With every table seeded first
 * it takes a room where nearly everybody has played nearly everybody to force a
 * repeat, and a repeat is still what a room like that has left. Blossom is the
 * upgrade if a club plays whole round robins through this.
 */
export function suggestGroups<T extends { id: number }>(
  waiting: T[],
  seats: number,
  metToday: (a: number, b: number) => boolean,
  maxGroups = Infinity,
): T[][] {
  const tables = Math.min(maxGroups, Math.floor(waiting.length / seats));
  if (tables < 1) return [];

  // One each, in arrival order: this is what separates the people who have
  // already played.
  const groups: T[][] = [];
  const left = [...waiting];
  for (let i = 0; i < tables; i++) groups.push([left.shift()!]);

  for (const group of groups) {
    while (group.length < seats) {
      let i = left.findIndex((candidate) =>
        group.every((member) => !metToday(member.id, candidate.id)),
      );
      // Everybody left has played everybody at this table. Take the next in
      // line anyway: a repeated pairing beats an empty section, and a room that
      // has played itself out knows it has.
      if (i === -1) i = 0;

      group.push(left.splice(i, 1)[0]);
    }
  }

  return groups;
}

/** The three ways four people can be split into two pairs, as index order
 *  [side one, its partner, side two, its partner]. */
const SPLITS = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
] as const;

/**
 * Which of the four plays with which, for doubles.
 *
 * The waiting list is ordered by who has played and who has waited, and neither
 * of those says anything about strength — so taking the four in the order they
 * came out of it produced the game nobody wants: two first-division players
 * against two thirds, over in fifteen minutes and no fun for either pair.
 *
 * Divisions are 1, 2, 3 with 1 the strongest (see libs/algorithms/dailyScore.ts), so a
 * level match is the split whose two sides add up to the closest thing to the
 * same number. Three splits exist; this checks all three and keeps the arrival
 * order when they tie.
 *
 * A division is a coarse instrument and it is the only one the club states. Two
 * seconds against a first and a third is a fairer game than the ranking knows
 * how to describe, and it is what this picks.
 */
export function balanceDoubles<T extends { category: number }>(
  group: T[],
): T[] {
  if (group.length !== 4) return group;

  let best = group;
  let closest = Infinity;

  for (const [a, b, c, d] of SPLITS) {
    const gap = Math.abs(
      group[a].category +
        group[b].category -
        group[c].category -
        group[d].category,
    );
    // Strictly closer, so a tie keeps the order the queue produced.
    if (gap < closest) {
      closest = gap;
      best = [group[a], group[b], group[c], group[d]];
    }
  }

  return best;
}
