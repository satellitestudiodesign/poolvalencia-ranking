import { Link, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LuTrophy } from "react-icons/lu";
import ShareButton from "@/components/social/ShareButton";
import Side from "@/components/social/feed/Side";
import { Card } from "@/components/ui/Card";
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
 * The result itself is the same card the club's own feed draws — faces either
 * side of the score, the winner carrying the weight — because a result is one
 * shape whichever side of the login you are on.
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
  /** One side of the result: one person for singles, two for doubles, and
   *  nobody the roster has lost dropped rather than drawn as a blank face. */
  const teamOf = (ids: (number | null)[]) =>
    ids
      .map((id) => (id === null ? undefined : byId.get(id)))
      .filter((p) => !!p);

  const doubles = game.mode === "doubles";
  const p1 = game.player_1_score;
  const p2 = game.player_2_score;
  const p1Won = p1 > p2;
  const p2Won = p2 > p1;

  const played = fmt(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(game.played_at));

  return (
    <div className="mt-8 space-y-6">
      {/* One line of facts, then the result. The card *is* the headline, so
          there is no title over it: "Result" only ever restated what the score
          below it already says, and the club's own header and tabs are
          directly above. Singles or doubles is not a fact either — one face a
          side or two says it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The heading the page still owes a screen reader and a search
              result, spent on the result rather than on the word for it. */}
          <h1 className="sr-only">{t("public.game.title")}</h1>
          <div className="flex flex-wrap items-center gap-2 text-caption text-ink-soft">
            <span suppressHydrationWarning>{played}</span>
            <span className="text-ink-ghost">·</span>
            <span>{t(`discipline.${game.discipline}`)}</span>
            {tournament && (
              <>
                <span className="text-ink-ghost">·</span>
                <Link
                  to="/tournaments/$tournamentId"
                  params={{ tournamentId: String(tournament.id) }}
                  className="inline-flex items-center gap-1 text-strike hover:underline"
                >
                  <LuTrophy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {tournament.name}
                </Link>
              </>
            )}
          </div>
        </div>
        {/* The link is the only thing to hand somebody: what it unfurls to in a
            chat is the card, drawn by /api/og/games. */}
        <ShareButton
          title={t("public.game.title")}
          url={`${origin}/clubs/${club.slug}/game/${game.id}`}
        />
      </div>

      <Card className="overflow-hidden">
        {/* The score is the focal element and the two sides mirror around it,
            so the winner reads as weight rather than as a colour. */}
        <div className="flex items-center gap-3 px-4 py-6 sm:gap-6">
          <Side
            people={teamOf([
              game.player_1_id,
              doubles ? game.player_1b_id : null,
            ])}
            won={p1Won}
          />
          {/* h-12 self-start puts the figure on the avatars' centre line, not
              on the centre of avatar-plus-name. */}
          <span className="flex h-12 shrink-0 items-center self-start font-mono text-h1 font-semibold tabular-nums">
            <span className={p1Won ? "text-ink" : "text-ink-faint"}>{p1}</span>
            <span className="px-1 text-ink-ghost">-</span>
            <span className={p2Won ? "text-ink" : "text-ink-faint"}>{p2}</span>
          </span>
          <Side
            people={teamOf([
              game.player_2_id,
              doubles ? game.player_2b_id : null,
            ])}
            won={p2Won}
          />
        </div>
      </Card>
    </div>
  );
}
