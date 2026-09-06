import type { BracketIndex } from "@/libs/algorithms/bracket";
import type { BracketSide, TournamentMatch } from "@/types";
import { useT } from "@/i18n";
import GameLinkOverlay from "@/components/games/GameLinkOverlay";
import PlayerLink from "@/components/players/PlayerLink";

/** Reading order of a tournament: groups, then the main draw, then the repêchage
 *  it feeds, then the match everything has been building to. Kept in step with
 *  the numbering in libs/algorithms/bracket/, which sorts by the same thing. */
const ORDER: BracketSide[] = ["group", "league", "winners", "losers", "final"];

/** Settled with an empty seat: the opposite side is not undecided, it is
 *  nobody — the seat was a bye and the match is not going to be played. A
 *  forfeit has both names, so it is a fixture and stays. */
export const isBye = (match: TournamentMatch) =>
  match.winner_id !== null && (match.p1_id === null || match.p2_id === null);

/**
 * The same fixtures as the bracket, as a running order.
 *
 * A bracket answers "who plays whom next"; this answers "what happened, in what
 * order" — which is the question anyone catching up on a tournament night is
 * actually asking, and it does not need a horizontal scrollbar to do it.
 */
export default function MatchList({
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
  /** How many racks a fixture runs to; shown once per stage. */
  raceFor: (match: TournamentMatch) => number;
  /** Returns null for a match this viewer cannot file a result for. */
  onRecord: (match: TournamentMatch) => (() => void) | null;
}) {
  const { t } = useT();

  // A bye is not a fixture: nobody turned up for it and nobody is going to.
  // Twelve of them above four real openers is how a field of twenty pads out to
  // a draw of thirty-two, and listing them buries the matches that exist.
  const sorted = matches
    .filter((m) => !isBye(m))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.bracket) - ORDER.indexOf(b.bracket) ||
        a.round - b.round ||
        (a.group_no ?? 0) - (b.group_no ?? 0) ||
        a.slot - b.slot,
    );

  const stages: { key: string; label: string; rows: TournamentMatch[] }[] = [];
  for (const match of sorted) {
    // Knockout rounds are stages; a round robin's "round" is only the order the
    // fixtures came out of the generator, and nobody plays to it.
    const key =
      match.bracket === "group"
        ? `group:${match.group_no}`
        : match.bracket === "league"
          ? "league"
          : `${match.bracket}:${match.round}`;
    let last = stages[stages.length - 1];
    if (last?.key !== key) {
      last = { key, label: stageLabel(match, t), rows: [] };
      stages.push(last);
    }
    last.rows.push(match);
  }

  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <section key={stage.key}>
          <h3 className="mb-1 flex flex-wrap items-baseline gap-x-2 px-1 text-caption font-medium uppercase tracking-[0.08em] text-ink-faint">
            {stage.label && <span>{stage.label}</span>}
            <span className="normal-case tracking-normal text-ink-ghost">
              {t("tournaments.raceLabel", { n: raceFor(stage.rows[0]) })}
            </span>
          </h3>
          <ul className="divide-y divide-hairline overflow-hidden rounded-control border border-hairline">
            {stage.rows.map((match) => (
              <li key={match.id}>
                <Row
                  match={match}
                  index={index}
                  nameOf={nameOf}
                  slugOf={slugOf}
                  clubSlug={clubSlug}
                  onRecord={onRecord(match) ?? undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function stageLabel(match: TournamentMatch, t: ReturnType<typeof useT>["t"]) {
  if (match.bracket === "group") {
    return t("tournaments.group", { n: match.group_no ?? 0 });
  }
  // A league is one undivided stage, so a heading over it would say nothing.
  if (match.bracket === "league") return "";
  if (match.bracket === "final") return t("tournaments.bracket.final");
  return `${t(`tournaments.bracket.${match.bracket === "winners" ? "winners" : "losers"}`)} · ${t("tournaments.round", { n: match.round })}`;
}

function Row({
  match,
  index,
  nameOf,
  slugOf,
  clubSlug,
  onRecord,
}: {
  match: TournamentMatch;
  index: BracketIndex;
  nameOf: (id: number) => string;
  slugOf?: (id: number) => string | undefined;
  clubSlug?: string;
  onRecord?: () => void;
}) {
  const { t } = useT();
  const game = match.game;
  const played = match.winner_id !== null;

  const racksFor = (playerId: number | null) => {
    if (!game || playerId === null) return null;
    return game.player_1_id === playerId
      ? game.player_1_score
      : game.player_2_score;
  };

  const walkover = isBye(match);

  const name = (playerId: number | null, slot: 1 | 2) => {
    if (playerId !== null) return nameOf(playerId);
    if (walkover) return t("tournaments.walkover");
    const from = index.source(match.id, slot);
    if (!from) return t("tournaments.tbd");
    return t(
      from.kind === "winner" ? "tournaments.winnerOf" : "tournaments.loserOf",
      { n: from.number },
    );
  };

  const nameNode = (playerId: number | null, slot: 1 | 2) => {
    if (playerId === null) return name(playerId, slot);
    return (
      <PlayerLink
        playerId={playerId}
        playerSlug={slugOf?.(playerId)}
        onClick={(e) => e.stopPropagation()}
        className="relative transition-colors duration-150 hover:text-strike"
      >
        {name(playerId, slot)}
      </PlayerLink>
    );
  };

  const tone = (playerId: number | null) =>
    playerId === null
      ? "text-ink-ghost"
      : played && playerId === match.winner_id
        ? "font-semibold text-ink"
        : played
          ? "text-ink-faint"
          : "text-ink";

  const score = (playerId: number | null) => {
    const racks = racksFor(playerId);
    if (racks !== null) return String(racks);
    // A walkover has no racks; the winner still needs something in the column.
    return played && playerId === match.winner_id
      ? t("tournaments.walkoverMark")
      : "";
  };

  const content = (
    // Names share the leftover width evenly, so a long one cannot push the
    // scores off centre.
    <div className="grid w-full grid-cols-[1.75rem_1fr_auto_auto_1fr] items-center gap-2 px-3 py-2.5">
      <span className="font-mono text-caption tabular-nums text-ink-ghost">
        {index.number(match.id)}
      </span>
      <span
        className={`min-w-0 truncate text-right text-body ${tone(match.p1_id)}`}
      >
        {nameNode(match.p1_id, 1)}
      </span>
      {played ? (
        <>
          <span
            className={`w-5 text-center font-mono text-body tabular-nums ${tone(match.p1_id)}`}
          >
            {score(match.p1_id)}
          </span>
          <span
            className={`w-5 text-center font-mono text-body tabular-nums ${tone(match.p2_id)}`}
          >
            {score(match.p2_id)}
          </span>
        </>
      ) : (
        // Nothing to show yet, and two empty cells leave the row with a hole in
        // the middle. One dash across both keeps the names hung off a centre.
        // ponytail: punctuation, so not a translated string.
        <span className="col-span-2 w-10 text-center font-mono text-body text-ink-ghost">
          –
        </span>
      )}
      <span className={`min-w-0 truncate text-body ${tone(match.p2_id)}`}>
        {nameNode(match.p2_id, 2)}
      </span>
    </div>
  );

  // Same split as the bracket: a played row is filled, one still to come is an
  // outline.
  // A row holding a highlighted name lights up — that is the whole mechanism
  // behind tapping a player: no state reaches here, only the marked child.
  const surface = `relative has-[[data-highlight]]:bg-strike-tint ${
    played ? "bg-felt-raised" : "bg-felt"
  }`;

  // A fixture that has been played is a result, and a result has a page: the
  // whole row is the way to it. Only the names opt out — here they follow a
  // player through the draw instead.
  const link = match.game_id ? (
    <GameLinkOverlay gameId={match.game_id} clubSlug={clubSlug} />
  ) : null;

  if (!onRecord)
    return (
      <div
        className={`${surface} ${
          link ? "transition-colors duration-150 hover:bg-rail" : ""
        }`}
      >
        {link}
        {content}
      </div>
    );

  // Not a native <button> because a player's name inside it is a link to
  // their page, and interactive content cannot nest inside a <button>.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onRecord}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRecord();
        }
      }}
      aria-label={t("tournaments.recordFor", {
        p1: name(match.p1_id, 1),
        p2: name(match.p2_id, 2),
      })}
      className={`flex w-full cursor-pointer text-left transition-colors duration-150 hover:bg-rail ${surface}`}
    >
      {content}
    </div>
  );
}
