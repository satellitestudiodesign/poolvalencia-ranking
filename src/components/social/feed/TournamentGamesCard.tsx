import { LuChevronRight, LuTrophy } from "react-icons/lu";
import SocialBar from "@/components/social/SocialBar";
import { usePlayerLookup } from "@/hooks/usePlayers";
import { timeOf } from "@/libs/algorithms/dayLabel";
import type { Game, Tournament } from "@/types";
import { useT } from "@/i18n";
import { AppLink } from "@/components/layout/AppLink";
import { GROUP_ROWS } from "./types";

/**
 * A tournament night: the fixtures it produced under one heading, in the same
 * running-order shape the tournament's own list view uses — names either side of
 * the score, one line each. Faces and a big score per fixture would turn an
 * evening of eight matches into eight screens of feed.
 *
 * Each fixture still carries its own reactions and comments: the conversation
 * belongs to the match somebody played, not to the night.
 */
export default function TournamentGamesCard({
  games,
  tournament,
}: {
  games: Game[];
  tournament: Pick<Tournament, "id" | "name">;
}) {
  const { t, locale } = useT();
  // Names come from the roster, not from the game: see the note in Side.
  const { byId } = usePlayerLookup();
  const nameOf = (id: number | null) =>
    (id == null ? undefined : byId.get(id)?.name) ?? "";

  // Past five fixtures the card stops being a feed row and starts being the
  // tournament page done worse — so the rest is a link to the real thing.
  const shown = games.slice(0, GROUP_ROWS);
  const rest = games.length - shown.length;

  return (
    <>
      <AppLink
        to="/app/$clubSlug/tournaments/$tournamentId"
        params={{ tournamentId: tournament.id }}
        className="mb-2 flex items-baseline gap-1.5 border-b border-hairline pb-2 text-caption font-medium text-ink-soft transition-colors duration-150 hover:text-strike"
      >
        <LuTrophy className="h-3.5 w-3.5 shrink-0 self-center text-strike" />
        <span className="min-w-0 flex-1 truncate">{tournament.name}</span>
        <span className="shrink-0 font-mono tabular-nums text-ink-ghost">
          {t("games.count", { n: games.length })}
        </span>
      </AppLink>

      <ul className="divide-y divide-hairline">
        {shown.map((game) => {
          const isDoubles = game.mode === "doubles";
          const p1 = game.player_1_score;
          const p2 = game.player_2_score;
          const side = (won: boolean) =>
            won ? "font-semibold text-ink" : "text-ink-faint";

          return (
            <li key={game.id} className="py-2 first:pt-0 last:pb-0">
              {/* Names share the leftover width evenly, so a long one cannot
                  push the score off centre. */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <span
                  className={`min-w-0 truncate text-right text-body ${side(p1 > p2)}`}
                >
                  <AppLink
                    to="/app/$clubSlug/players/$playerId"
                    params={{ playerId: game.player_1_id }}
                    className="transition-colors duration-150 hover:text-strike"
                  >
                    {nameOf(game.player_1_id)}
                  </AppLink>
                  {isDoubles && game.player_1b_id != null && (
                    <>
                      {" / "}
                      <AppLink
                        to="/app/$clubSlug/players/$playerId"
                        params={{ playerId: game.player_1b_id }}
                        className="transition-colors duration-150 hover:text-strike"
                      >
                        {nameOf(game.player_1b_id)}
                      </AppLink>
                    </>
                  )}
                </span>
                <span className="shrink-0 font-mono text-body font-semibold tabular-nums">
                  <span className={p1 > p2 ? "text-ink" : "text-ink-faint"}>
                    {p1}
                  </span>
                  <span className="px-1 text-ink-ghost">-</span>
                  <span className={p2 > p1 ? "text-ink" : "text-ink-faint"}>
                    {p2}
                  </span>
                </span>
                <span className={`min-w-0 truncate text-body ${side(p2 > p1)}`}>
                  <AppLink
                    to="/app/$clubSlug/players/$playerId"
                    params={{ playerId: game.player_2_id }}
                    className="transition-colors duration-150 hover:text-strike"
                  >
                    {nameOf(game.player_2_id)}
                  </AppLink>
                  {isDoubles && game.player_2b_id != null && (
                    <>
                      {" / "}
                      <AppLink
                        to="/app/$clubSlug/players/$playerId"
                        params={{ playerId: game.player_2b_id }}
                        className="transition-colors duration-150 hover:text-strike"
                      >
                        {nameOf(game.player_2b_id)}
                      </AppLink>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                {/* The time doubles as the way into the fixture's own page —
                    the row cannot be one big link, because the names in it are
                    already links and the social bar is already buttons. */}
                <AppLink
                  to="/app/$clubSlug/games/$gameId"
                  params={{ gameId: game.id }}
                  aria-label={t("games.openResult")}
                  className="shrink-0 pl-1 font-mono text-caption tabular-nums text-ink-ghost transition-colors duration-150 hover:text-strike"
                >
                  <time dateTime={game.played_at}>
                    {timeOf(new Date(game.played_at), locale)}
                  </time>
                </AppLink>
                <div className="min-w-0 flex-1">
                  <SocialBar target={{ gameId: game.id }} preview />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {rest > 0 && (
        <AppLink
          to="/app/$clubSlug/tournaments/$tournamentId"
          params={{ tournamentId: tournament.id }}
          className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2 text-caption font-medium text-ink-soft transition-colors duration-150 hover:text-strike"
        >
          <span className="min-w-0 truncate">
            {t("feed.moreGames", { n: rest })}
          </span>
          <LuChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </AppLink>
      )}
    </>
  );
}
