import type { BracketIndex } from "@/libs/algorithms/bracket";
import type { TournamentMatch } from "@/types";
import { useT } from "@/i18n";
import GameLinkOverlay from "@/components/games/GameLinkOverlay";
import PlayerLink from "@/components/players/PlayerLink";

/**
 * One fixture, in every format.
 *
 * An empty seat says who it is waiting for — "loser of #7" — rather than just
 * shrugging, which is the difference between a bracket you can read ahead in
 * and one you can only read behind.
 */
export default function MatchCard({
  match,
  nameOf,
  slugOf,
  clubSlug,
  index,
  onRecord,
}: {
  match: TournamentMatch;
  nameOf: (id: number) => string;
  /** The person's slug for each id, for the public side's /players/:slug
   *  links. Omitted inside a club, where PlayerLink uses the club route. */
  slugOf?: (id: number) => string | undefined;
  /** The club's slug on the public side, so a played fixture can link to the
   *  result's own page. Omitted inside a club, where the route carries it. */
  clubSlug?: string;
  /** Numbering and seat provenance, shared across every view. */
  index?: BracketIndex;
  /** Omitted when the viewer cannot file a result, or the match is not ready. */
  onRecord?: () => void;
}) {
  const { t } = useT();

  const game = match.game;
  const racksFor = (playerId: number | null) => {
    if (!game || playerId === null) return null;
    return game.player_1_id === playerId
      ? game.player_1_score
      : game.player_2_score;
  };

  const played = match.winner_id !== null;
  // Settled with an empty seat: nobody was ever going to turn up, so the card
  // shows the one player who went through rather than pairing them with a
  // "to be decided" that is never going to be decided.
  const walkover = played && (match.p1_id === null || match.p2_id === null);

  const number = index?.number(match.id);

  const empty = (slot: 1 | 2) => {
    const from = index?.source(match.id, slot);
    if (!from) return t("tournaments.tbd");
    return t(
      from.kind === "winner" ? "tournaments.winnerOf" : "tournaments.loserOf",
      { n: from.number },
    );
  };

  const row = (playerId: number | null, slot: 1 | 2) => {
    const won = played && playerId === match.winner_id;
    // Name and score are one line of the result, so they carry the same weight:
    // the winner's score reads as the winner's, not as a number beside a name.
    const tone =
      playerId === null
        ? "text-ink-ghost"
        : won
          ? "font-semibold text-ink"
          : played
            ? "text-ink-faint"
            : "text-ink";
    return (
      <div className="flex items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-body ${tone}`}>
          {playerId === null ? (
            empty(slot)
          ) : (
            <PlayerLink
              playerId={playerId}
              playerSlug={slugOf?.(playerId)}
              onClick={(e) => e.stopPropagation()}
              className="relative transition-colors duration-150 hover:text-strike"
            >
              {nameOf(playerId)}
            </PlayerLink>
          )}
        </span>
        <span className={`shrink-0 font-mono text-body tabular-nums ${tone}`}>
          {racksFor(playerId) ?? (won ? t("tournaments.walkoverMark") : "")}
        </span>
      </div>
    );
  };

  const body = (
    <div className="flex w-full items-center gap-2.5">
      {number !== undefined && (
        <span className="shrink-0 font-mono text-caption tabular-nums text-ink-ghost">
          {number}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        {walkover ? (
          <>
            {row(match.winner_id, match.p1_id === null ? 2 : 1)}
            <p className="text-caption text-ink-faint">
              {t("tournaments.walkover")}
            </p>
          </>
        ) : (
          <>
            {row(match.p1_id, 1)}
            {row(match.p2_id, 2)}
          </>
        )}
      </div>
    </div>
  );

  // A played match has something in it, so it is the filled one; a fixture that
  // has not happened yet is an outline waiting to be filled in.
  const surface = `relative w-full rounded-control border border-hairline px-3 py-2 has-[[data-highlight]]:border-strike/40 has-[[data-highlight]]:bg-strike-tint ${
    played ? "bg-felt-raised" : "bg-felt"
  }`;

  // A fixture that has been played is a result, and a result has a page: the
  // whole card is the way to it. Only the names opt out — on a bracket they
  // follow a player through the draw instead.
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
        {body}
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
        p1: nameOf(match.p1_id!),
        p2: nameOf(match.p2_id!),
      })}
      className={`${surface} cursor-pointer text-left transition-colors duration-150 hover:border-hairline-strong hover:bg-rail`}
    >
      {body}
    </div>
  );
}
