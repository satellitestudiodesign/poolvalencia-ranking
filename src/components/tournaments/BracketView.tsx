import MatchCard from "@/components/games/MatchCard";
import type { BracketIndex } from "@/libs/algorithms/bracket";
import type { BracketSide, TournamentMatch } from "@/types";
import { useT } from "@/i18n";

const SIDES: { side: BracketSide; heading: "winners" | "losers" | "final" }[] =
  [
    { side: "winners", heading: "winners" },
    { side: "losers", heading: "losers" },
    { side: "final", heading: "final" },
  ];

/**
 * A bracket is a grid of rounds, and on a phone it is wider than the screen —
 * so each half scrolls sideways in its own track rather than the page doing it.
 *
 * The alignment and the connector lines are pure CSS, with nothing measured.
 * Every match sits in a slot that takes an equal share of the column's height
 * (`flex-1`) and centres it. A round with half as many matches therefore has
 * slots twice as tall, and each of its matches lands exactly on the midpoint
 * between the two that feed it — which is the line the connectors draw. It also
 * means a short column is centred against a tall one for free.
 *
 * Connectors are two pseudo-elements per slot, meeting in the middle of the
 * gap: `::after` reaches right out of a match, `::before` reaches left into the
 * next one. A merging round bends — the top match's line runs down to the
 * midpoint, the bottom one's runs up — and `h-1/2` is exactly that distance,
 * since the midpoint is the boundary between the two slots.
 */
export default function BracketView({
  matches,
  nameOf,
  slugOf,
  clubSlug,
  index,
  raceFor,
  onRecord,
}: {
  matches: TournamentMatch[];
  nameOf: (id: number) => string;
  /** The person's slug for each id, for the public side's /players/:slug
   *  links. Omitted inside a club, where PlayerLink uses the club route. */
  slugOf?: (id: number) => string | undefined;
  /** The club's slug on the public side, so a played fixture can link to the
   *  result's own page. Omitted inside a club, where the route carries it. */
  clubSlug?: string;
  index: BracketIndex;
  /** How many racks a fixture runs to; shown once per round. */
  raceFor: (match: TournamentMatch) => number;
  /** Returns null for a match this viewer cannot file a result for. */
  onRecord: (match: TournamentMatch) => (() => void) | null;
}) {
  const { t } = useT();

  return (
    <div className="space-y-6">
      {SIDES.map(({ side, heading }) => {
        const inSide = matches.filter((m) => m.bracket === side);
        if (inSide.length === 0) return null;

        const rounds = [...new Set(inSide.map((m) => m.round))].sort(
          (a, b) => a - b,
        );
        const inRound = (round: number) =>
          inSide
            .filter((m) => m.round === round)
            .sort((a, b) => a.slot - b.slot);

        return (
          <section key={side} className="space-y-2">
            <h3 className="text-caption font-medium uppercase tracking-[0.08em] text-ink-faint">
              {t(`tournaments.bracket.${heading}`)}
            </h3>
            <div className="-mx-3 overflow-x-auto px-3 py-1">
              <div className="flex min-w-max gap-8">
                {rounds.map((round, position) => {
                  const column = inRound(round);
                  const next = rounds[position + 1];
                  // The losers bracket alternates: rounds that take a dropping
                  // winners-bracket player keep their width, so those lines run
                  // straight across instead of merging in pairs.
                  const merges =
                    next !== undefined && inRound(next).length < column.length;

                  return (
                    <div key={round} className="flex w-56 shrink-0 flex-col">
                      <p className="mb-2 text-caption text-ink-faint">
                        {t("tournaments.round", { n: round })}
                        {" · "}
                        {t("tournaments.raceLabel", {
                          n: raceFor(column[0]),
                        })}
                      </p>
                      <div className="flex flex-1 flex-col">
                        {column.map((match, slot) => (
                          <div
                            key={match.id}
                            className={[
                              // Padding rather than a gap: the slot has to stay
                              // flush with its neighbour, because the boundary
                              // between them is the midpoint the connectors
                              // meet at. Symmetric padding leaves the centre —
                              // and so every line — exactly where it was.
                              "relative flex min-h-[88px] flex-1 items-center py-2",
                              position > 0 ? INCOMING : "",
                              next === undefined
                                ? ""
                                : merges
                                  ? slot % 2 === 0
                                    ? MERGE_DOWN
                                    : MERGE_UP
                                  : STRAIGHT,
                            ].join(" ")}
                          >
                            <MatchCard
                              match={match}
                              nameOf={nameOf}
                              slugOf={slugOf}
                              clubSlug={clubSlug}
                              index={index}
                              onRecord={onRecord(match) ?? undefined}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/*
 * Written out in full rather than composed from a shared fragment: Tailwind
 * finds classes by scanning the source text, so a name that only exists once
 * the strings are joined at runtime never gets generated.
 *
 * `w-4` is half of the `gap-8` between columns, so the two stubs meet in the
 * middle of it.
 */

/** Reaches left from a match to where its feeders converge. */
const INCOMING =
  "before:absolute before:right-full before:top-1/2 before:w-4 before:border-t before:border-hairline-strong before:content-['']";

/** Straight across: the next round is the same width. */
const STRAIGHT =
  "after:absolute after:left-full after:top-1/2 after:w-4 after:border-t after:border-hairline-strong after:content-['']";

/** Top of a pair: out, then down to the midpoint below. */
const MERGE_DOWN =
  "after:absolute after:left-full after:top-1/2 after:h-1/2 after:w-4 after:border-r after:border-t after:border-hairline-strong after:content-['']";

/** Bottom of a pair: out, then up to the midpoint above. */
const MERGE_UP =
  "after:absolute after:left-full after:top-0 after:h-1/2 after:w-4 after:border-b after:border-r after:border-hairline-strong after:content-['']";
