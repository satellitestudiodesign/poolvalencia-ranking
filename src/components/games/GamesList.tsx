import type { Game, Player } from "@/types";
import React from "react";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/EmptyState";
import SocialBar from "@/components/social/SocialBar";
import { LuPencil, LuSwords } from "react-icons/lu";
import { dayLabel, startsNewDay, timeOf } from "@/libs/algorithms/dayLabel";
import { useT } from "@/i18n";
import { AppLink } from "@/components/layout/AppLink";
import GameLinkOverlay from "@/components/games/GameLinkOverlay";

const NAME_LINK = "transition-colors duration-150 hover:text-strike";

/** What this list needs to turn a game's player id into a linked name. Games
 *  stopped carrying a copy of the name when names moved to people, so the
 *  roster is now an input rather than a convenience. */
type GamesListPlayer = Pick<Player, "id" | "name" | "slug">;

/**
 * One player's name on the tape.
 *
 * Text, not a link, wherever the row itself opens the result: a row full of
 * links to somewhere else is a row you cannot tap. Only a tape whose results
 * have no page to go to — a public club that cannot be resolved to a slug —
 * spends the name on a link to the person instead.
 */
function Name({
  player,
  linked,
}: {
  /** Undefined for somebody who has since left the club: the game keeps its id,
   *  the roster no longer has the row. The em dash is what the rest of the app
   *  shows for that — see usePlayerLookup. */
  player: GamesListPlayer | undefined;
  linked: boolean;
}) {
  if (!player) return <>—</>;

  return linked ? (
    <Link
      to="/players/$playerSlug"
      params={{ playerSlug: player.slug }}
      className={NAME_LINK}
    >
      {player.name}
    </Link>
  ) : (
    <>{player.name}</>
  );
}

/**
 * A team's name(s) on the tape, one per line.
 *
 * Stacked rather than joined with a slash: the row gives each side half the
 * width, and two names on one line of it is two truncations — every doubles
 * result read as "Jesus Sr ... v Vicent R...", which is the same four letters
 * whoever was playing.
 */
function Team({
  id1,
  id2,
  byId,
  linked,
}: {
  id1: number;
  id2?: number | null;
  byId: Map<number, GamesListPlayer>;
  linked: boolean;
}) {
  return (
    <>
      <span className="truncate">
        <Name player={byId.get(id1)} linked={linked} />
      </span>
      {id2 != null && (
        <span className="truncate">
          <Name player={byId.get(id2)} linked={linked} />
        </span>
      )}
    </>
  );
}

interface GamesListProps {
  games: Game[];
  /** The roster these games were played in, for resolving ids to names. In the
   *  app that is usePlayers(); on the public side, publicClubRosterQuery. */
  players: GamesListPlayer[];
  /** Whose page this is, if anyone's — their won frames get the accent. */
  playerId?: number;
  showDates?: boolean;
  /** Off for the TV board, which nobody is standing close enough to tap. */
  showSocial?: boolean;
  /**
   * Pin the day headings under the app bar while their frames scroll past.
   * Only on a page where this list is the page — sticky does nothing inside an
   * `overflow-hidden` card, so it stays off by default.
   */
  stickyDates?: boolean;
  /**
   * Rendered outside /app. Names link to the public player pages instead of the
   * club's, and the social bar goes away — reactions and comments are members'
   * business, and anon cannot read either table.
   */
  public?: boolean;
  /**
   * Which club a given result belongs to, on the public side only: with a slug
   * the row links to the result's own page, without one the tape stays a list
   * of plain facts. A function rather than one slug because a person's history
   * is every club they play for, not one.
   */
  clubSlugOf?: (game: Game) => string | undefined;
  /**
   * Show the way in to correcting a result. The club admin's, and off
   * everywhere else — a tape on a player's page or a wall display is something
   * to read, and the edit route bounces anyone else anyway.
   */
  admin?: boolean;
}

/**
 * The tape: what the club played, newest first, at the tightest rhythm in the
 * app. There are thousands of these and each one is a single fact, so the row
 * is a small inset pill rather than a card — the surface goes *down* from the
 * page, which is what stops a result reading like a tournament or a drill.
 *
 * A result is a score. The figure is the focal element — mono, tabular, large
 * enough to read at arm's length in a dim room. The winning side gets the
 * weight; the losing side is demoted rather than marked in red, because red
 * means "act" everywhere else in this app.
 */
export default function GamesList({
  games,
  players,
  playerId,
  showDates,
  showSocial = true,
  stickyDates = false,
  public: isPublic = false,
  clubSlugOf,
  admin = false,
}: GamesListProps) {
  const { t, locale } = useT();
  const social = showSocial && !isPublic;
  const byId = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  if (!games || games.length === 0) {
    return (
      <EmptyState
        icon={<LuSwords className="h-5 w-5" />}
        title={t("games.emptyTitle")}
        hint={t("games.emptyHint")}
      />
    );
  }

  return (
    <div className="space-y-1">
      {games.map((game, index) => {
        const {
          id,
          player_1_id,
          player_1_score,
          player_2_id,
          player_2_score,
          player_1b_id,
          player_2b_id,
          mode,
          played_at,
        } = game;

        const isDoubles = mode === "doubles";
        // Public only: inside a club the route already carries the slug.
        const publicClubSlug = isPublic ? clubSlugOf?.(game) : undefined;
        const linkable = isPublic ? publicClubSlug !== undefined : true;

        // bigint columns, so these arrive as numbers
        const p1Score = player_1_score;
        const p2Score = player_2_score;
        const p1Won = p1Score > p2Score;
        const p2Won = p2Score > p1Score;

        // On a player's own page, mark the frames they took. Losses are simply
        // left plain — absence reads as loss without spending a second colour.
        let accent = "border-hairline";
        if (playerId) {
          const inTeam1 =
            game.player_1_id === playerId || game.player_1b_id === playerId;
          const inTeam2 =
            game.player_2_id === playerId || game.player_2b_id === playerId;
          if ((inTeam1 && p1Won) || (inTeam2 && p2Won)) {
            accent = "border-hairline border-l-2 border-l-pot";
          }
        }

        const date = new Date(played_at);
        const newDate = startsNewDay(
          date,
          index > 0 ? new Date(games[index - 1].played_at) : undefined,
        );

        const side = (won: boolean) =>
          won ? "font-semibold text-ink" : "text-ink-faint";

        return (
          <React.Fragment key={id}>
            {showDates && newDate && (
              // A day is a rule across the tape, not a card header. 3.5rem is
              // the app bar; the env() term is the notch the bar itself clears.
              <h3
                className={[
                  "px-2 pb-1.5 pt-5 text-caption font-medium uppercase tracking-[0.08em] text-strike first:pt-0",
                  stickyDates
                    ? "sticky top-0 z-10 -mx-1 border-b border-hairline bg-pocket/90 backdrop-blur-sm"
                    : "",
                ].join(" ")}
                // "Today" depends on the reader's timezone, which the server
                // does not have — see libs/dayLabel.
                suppressHydrationWarning
              >
                {dayLabel(date, t, locale)}
              </h3>
            )}
            {/* Row and thread in one pill: the bar used to be a loose sibling
                under the row, which on a tape of short results read as two
                floating buttons belonging to nothing. */}
            <div className={`rounded-control border bg-pocket ${accent}`}>
              <div className="relative flex items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-felt-raised">
                {/* The row is the tap, and it covers the row rather than
                    wrapping it: the pencil is a link too, and a link inside a
                    link is not a thing. Anything that must stay clickable sits
                    above this on the z axis. Two destinations, because the
                    result has a page on each side: the editor inside the club,
                    the public one out here. */}
                {linkable && (
                  <GameLinkOverlay gameId={id} clubSlug={publicClubSlug} />
                )}
                <time
                  dateTime={played_at}
                  className="hidden w-12 shrink-0 font-mono text-caption tabular-nums text-ink-ghost sm:block"
                >
                  {timeOf(date, locale)}
                </time>
                <span
                  className={`flex min-w-0 flex-1 flex-col text-right ${side(p1Won)}`}
                >
                  <Team
                    id1={player_1_id}
                    id2={isDoubles ? player_1b_id : undefined}
                    byId={byId}
                    linked={!linkable}
                  />
                </span>
                <span className="shrink-0 font-mono text-h4 font-semibold tabular-nums">
                  <span className={p1Won ? "text-ink" : "text-ink-faint"}>
                    {p1Score}
                  </span>
                  <span className="px-1 text-ink-ghost">-</span>
                  <span className={p2Won ? "text-ink" : "text-ink-faint"}>
                    {p2Score}
                  </span>
                </span>
                <span className={`flex min-w-0 flex-1 flex-col ${side(p2Won)}`}>
                  <Team
                    id1={player_2_id}
                    id2={isDoubles ? player_2b_id : undefined}
                    byId={byId}
                    linked={!linkable}
                  />
                </span>
                {admin && (
                  <AppLink
                    to="/app/$clubSlug/games/$gameId/edit"
                    params={{ gameId: id }}
                    aria-label={t("games.edit")}
                    title={t("games.edit")}
                    className="relative shrink-0 p-1 text-ink-ghost transition-colors duration-150 hover:text-ink"
                  >
                    <LuPencil className="h-3.5 w-3.5" aria-hidden />
                  </AppLink>
                )}
              </div>
              {social && (
                <div className="border-t border-hairline px-2 py-1.5">
                  <SocialBar target={{ gameId: id }} />
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
