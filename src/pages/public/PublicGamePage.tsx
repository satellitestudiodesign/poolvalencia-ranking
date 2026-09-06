import { Link, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LuArrowLeft } from "react-icons/lu";
import ShareButton from "@/components/social/ShareButton";
import ShareCardButton from "@/components/social/ShareCardButton";
import PlayerLink, { PlayerHighlight } from "@/components/players/PlayerLink";
import { Card, CardHeader } from "@/components/ui/Card";
import { Fact } from "@/components/ui/Fact";
import { headlineClasses } from "@/components/layout/publicTitleStyles";
import { publicClubRosterQuery } from "@/queries/public/clubs";
import { fmt } from "@/libs/algorithms/dayLabel";
import { useT } from "@/i18n";

const route = getRouteApi("/_public/clubs/$slug/game/$gameId");

/**
 * One result, at its own address.
 *
 * The tape on the club's games tab is a list of facts nobody can link to; this
 * is the one a player sends to the person they beat. Read-only and deliberately
 * small — the score, who played it, when, and the way back up to the tournament
 * it settled if it settled one.
 *
 * Names come from the club roster the parent route already loaded, so a player
 * who opted out of being listed is a name here and nothing more: no link, no
 * face, the same as everywhere else on the public side.
 */
export default function PublicGamePage() {
  const { t, locale } = useT();
  const { club, game, tournament, origin } = route.useLoaderData();
  const { data: roster } = useSuspenseQuery(publicClubRosterQuery(club.id));

  const byId = new Map(roster.map((player) => [player.id, player]));
  const nameOf = (id: number | null) =>
    id === null ? "—" : (byId.get(id)?.name ?? "—");

  const doubles = game.mode === "doubles";
  const p1Won = game.player_1_score > game.player_2_score;
  const p2Won = game.player_2_score > game.player_1_score;

  /** One side of the result: one name for singles, two for doubles. */
  const side = (ids: (number | null)[], score: number, won: boolean) => (
    <div className="flex items-baseline justify-between gap-4 px-4 py-4">
      <div
        className={`min-w-0 text-h4 ${won ? "font-semibold text-ink" : "text-ink-faint"}`}
      >
        {ids
          .filter((id): id is number => id !== null)
          .map((id, index) => (
            <span key={id}>
              {index > 0 && <span className="text-ink-faint"> · </span>}
              <PlayerLink playerId={id} playerSlug={byId.get(id)?.slug}>
                {nameOf(id)}
              </PlayerLink>
            </span>
          ))}
      </div>
      {/* The figure is the page. Mono and tabular so the two rows line up on
          the same column whatever the digits. */}
      <span
        className={`shrink-0 font-mono text-h1 tabular-nums ${won ? "text-ink" : "text-ink-faint"}`}
      >
        {score}
      </span>
    </div>
  );

  return (
    <PlayerHighlight>
      <div className="mt-8 space-y-4">
        <Link
          to="/clubs/$slug/games"
          params={{ slug: club.slug }}
          className="inline-flex items-center gap-1.5 text-caption text-ink-soft transition-colors duration-150 hover:text-ink"
        >
          <LuArrowLeft className="h-4 w-4" aria-hidden />
          {t("public.publicClub.recentResults")}
        </Link>

        <h1 className={headlineClasses("display")}>{t("public.game.title")}</h1>

        <Card className="overflow-hidden">
          <CardHeader
            title={club.name}
            action={
              <div className="flex items-center gap-1">
                {/* Two different things to hand somebody: the page, and the
                    picture of the result. */}
                <ShareCardButton
                  url={`/api/og/games/${game.id}.png`}
                  fileName={`${club.slug}-${game.id.slice(0, 8)}.png`}
                  title={t("public.game.title")}
                />
                <ShareButton
                  title={t("public.game.title")}
                  url={`${origin}/clubs/${club.slug}/game/${game.id}`}
                />
              </div>
            }
          />
          <div className="divide-y divide-hairline">
            {side(
              [game.player_1_id, doubles ? game.player_1b_id : null],
              game.player_1_score,
              p1Won,
            )}
            {side(
              [game.player_2_id, doubles ? game.player_2b_id : null],
              game.player_2_score,
              p2Won,
            )}
          </div>
        </Card>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-4 sm:grid-cols-4">
          <Fact label={t("games.playedAt")}>
            {fmt(locale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(game.played_at))}
          </Fact>
          <Fact label={t("games.discipline")}>
            {t(`discipline.${game.discipline}`)}
          </Fact>
          <Fact label={t("games.mode")}>
            {t(doubles ? "games.doubles" : "games.single")}
          </Fact>
          {tournament && (
            <Fact label={t("nav.tournaments")}>
              <Link
                to="/tournaments/$tournamentId"
                params={{ tournamentId: String(tournament.id) }}
                className="text-strike hover:underline"
              >
                {tournament.name}
              </Link>
            </Fact>
          )}
        </dl>
      </div>
    </PlayerHighlight>
  );
}
