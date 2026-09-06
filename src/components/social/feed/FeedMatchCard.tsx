import { LuTrophy } from "react-icons/lu";
import SocialBar from "@/components/social/SocialBar";
import { timeOf } from "@/libs/algorithms/dayLabel";
import type { Game, Tournament } from "@/types";
import { useT } from "@/i18n";
import { AppLink } from "@/components/layout/AppLink";
import { usePlayerLookup } from "@/hooks/usePlayers";
import Side from "./Side";

export default function FeedMatchCard({
  game,
  tournament,
  detail = false,
}: {
  game: Game;
  /** Set when the game was filed as a tournament fixture. */
  tournament?: Pick<Tournament, "id" | "name">;
  /** This card *is* the page rather than a row of the feed: the thread opens
   *  with it, and the time stops being a link to where the reader already is. */
  detail?: boolean;
}) {
  const { t, locale } = useT();
  // The club's roster: a game carries ids, and the faces and names come from
  // here. Side takes the people rather than the ids, because out on the public
  // side they come from a different roster.
  const { byId } = usePlayerLookup();
  const teamOf = (ids: (number | null | undefined)[]) =>
    ids
      .map((id) => (id == null ? undefined : byId.get(id)))
      .filter((player) => !!player);

  const isDoubles = game.mode === "doubles";
  const p1 = game.player_1_score;
  const p2 = game.player_2_score;

  return (
    <>
      {/* A fixture belongs to its bracket first: the card says so before it says
          anything about the score. */}
      {tournament && (
        <AppLink
          to="/app/$clubSlug/tournaments/$tournamentId"
          params={{ tournamentId: tournament.id }}
          className="mb-2 flex items-center gap-1.5 border-b border-hairline pb-2 text-caption font-medium text-ink-soft transition-colors duration-150 hover:text-strike"
        >
          <LuTrophy className="h-3.5 w-3.5 shrink-0 text-strike" />
          <span className="truncate">{tournament.name}</span>
        </AppLink>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption font-medium uppercase tracking-[0.08em] text-strike">
          {isDoubles ? t("games.doubles") : t("games.single")}
        </p>
        {/* The time doubles as the way into the result's own page — the card
            cannot be one big link, because half of it already is one (the
            names, the bracket, every button on the social bar). */}
        {detail ? (
          <time
            dateTime={game.played_at}
            className="shrink-0 font-mono text-caption tabular-nums text-ink-ghost"
          >
            {timeOf(new Date(game.played_at), locale)}
          </time>
        ) : (
          <AppLink
            to="/app/$clubSlug/games/$gameId"
            params={{ gameId: game.id }}
            aria-label={t("games.openResult")}
            className="shrink-0 font-mono text-caption tabular-nums text-ink-ghost transition-colors duration-150 hover:text-strike"
          >
            <time dateTime={game.played_at}>
              {timeOf(new Date(game.played_at), locale)}
            </time>
          </AppLink>
        )}
      </div>

      {/* The score is the focal element; the two sides mirror around it, so the
          winner reads as weight rather than as a colour. */}
      <div className="mt-3 flex items-center gap-3">
        <Side
          people={teamOf([
            game.player_1_id,
            isDoubles ? game.player_1b_id : undefined,
          ])}
          won={p1 > p2}
        />
        {/* h-12 self-start puts the score on the avatars' centre line, not on
            the centre of avatar-plus-name. */}
        <span className="flex h-12 shrink-0 items-center self-start font-mono text-h2 font-semibold tabular-nums">
          <span className={p1 > p2 ? "text-ink" : "text-ink-faint"}>{p1}</span>
          <span className="px-1 text-ink-ghost">-</span>
          <span className={p2 > p1 ? "text-ink" : "text-ink-faint"}>{p2}</span>
        </span>
        <Side
          people={teamOf([
            game.player_2_id,
            isDoubles ? game.player_2b_id : undefined,
          ])}
          won={p2 > p1}
        />
      </div>

      <div className="mt-3 border-t border-hairline pt-2">
        <SocialBar
          target={{ gameId: game.id }}
          preview={!detail}
          defaultOpen={detail}
        />
      </div>
    </>
  );
}
