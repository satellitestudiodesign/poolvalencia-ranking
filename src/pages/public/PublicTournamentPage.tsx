import { useState } from "react";
import { headlineClasses } from "@/components/layout/publicTitleStyles";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, getRouteApi, useRouter } from "@tanstack/react-router";
import { LuGitFork, LuList } from "react-icons/lu";
import PublicShell from "@/components/layout/PublicShell";
import ShareButton from "@/components/social/ShareButton";
import TournamentSocialBar from "@/components/social/TournamentSocialBar";
import BracketView from "@/components/tournaments/BracketView";
import LeagueTable from "@/components/tournaments/LeagueTable";
import MatchList from "@/components/games/MatchList";
import { PlayerHighlight } from "@/components/players/PlayerLink";
import TournamentPodium from "@/components/tournaments/TournamentPodium";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CategoryBadge } from "@/components/ui/Ball";
import { Fact } from "@/components/ui/Fact";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHead } from "@/components/ui/SectionHead";
import { Segmented } from "@/components/ui/Segmented";
import { buttonClasses } from "@/components/ui/buttonStyles";
import {
  bracketIndex,
  groupCount,
  placings,
  raceFor,
  resolveBracket,
} from "@/libs/algorithms/bracket";
import {
  groupStandings,
  leaguePodium,
  standings,
} from "@/libs/algorithms/leagueTable";
import { eventDates } from "@/libs/algorithms/eventDates";
import { runMutation } from "@/libs/browser/mutationToast";
import { supabase } from "@/libs/supabase/browser";
import { useSession } from "@/hooks/useAuth";
import { publicClubRosterQuery } from "@/queries/public/clubs";
import { publicTournamentQuery } from "@/queries/public/tournaments";
import type { PublicTournament } from "@/queries/public/tournaments";
import { FORMAT_KEY, type TournamentMatch } from "@/types";
import { useT } from "@/i18n";

const route = getRouteApi("/_public/tournaments/$tournamentId");

type View = "bracket" | "list";

/**
 * A tournament as a stranger sees it: the draw, the standings, the podium.
 *
 * Read-only, and that is the whole difference from the club's own page — no
 * manage panel, no entry buttons, no way to file a result. `onRecord` returning
 * null for every fixture is what tells the shared bracket components that: they
 * already handle "this viewer cannot file this one", because a member who is not
 * in the club is in the same position.
 */
export default function PublicTournamentPage() {
  const { t } = useT();
  // The tournament comes from the loader rather than from a query: the loader
  // already threw notFound() if there wasn't one, so this is non-null here,
  // whereas publicTournamentQuery's own type is nullable — and narrowing it with
  // an early return would put a hook call behind a condition.
  const { tournament, origin } = route.useLoaderData();
  const [view, setView] = useState<View>("bracket");

  const { data: roster } = useSuspenseQuery(
    publicClubRosterQuery(tournament.club_id),
  );

  const byId = new Map(roster.map((p) => [p.id, p]));
  const nameOf = (id: number) => byId.get(id)?.name ?? t("tournaments.tbd");
  // Out here a name links to the person, not to the membership, so the shared
  // bracket components need the slug alongside the name. Inside a club they get
  // neither — PlayerLink uses the club route there.
  const slugOf = (id: number) => byId.get(id)?.slug;

  const entrantIds = tournament.tournament_players.map((e) => e.player_id);
  // resolveBracket fills each empty seat from the match that feeds it, so a draw
  // reads forward rather than only backward.
  const matches = resolveBracket(
    tournament.tournament_matches as TournamentMatch[],
  );
  const index = bracketIndex(matches);
  const raceOf = (match: TournamentMatch) =>
    raceFor(match, tournament, matches);

  const isLeague = tournament.format === "league";
  const isGroups = tournament.format === "group_knockout";
  const groups = groupCount(tournament.advance ?? 2);
  const groupMatches = matches.filter((m) => m.bracket === "group");

  const podium = isLeague
    ? leaguePodium(standings(entrantIds, matches))
    : placings(matches);
  const finished = tournament.status === "done";

  const played = matches.filter((m) => m.winner_id !== null).length;

  const url = `${origin}/tournaments/${tournament.id}`;

  return (
    <PlayerHighlight>
      <TournamentHero
        tournament={tournament}
        entrantIds={entrantIds}
        matchesTotal={matches.length}
        matchesPlayed={played}
        url={url}
      />

      <PublicShell>
        {/* Only while it is still open. Once it is under way the standings, the
            bracket and the results say who is in it and how they are doing — a
            flat grid of faces above them is the same list with the answer taken
            out. */}
        {tournament.status === "open" && entrantIds.length > 0 && (
          <section className="mt-6">
            <SectionHead title={t("public.publicTournament.entrantsLabel")} />
            <div className="mt-5 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
              {entrantIds.map((id) => {
                const player = byId.get(id);
                return (
                  <Link
                    key={id}
                    to="/players/$playerSlug"
                    params={{ playerSlug: player?.slug ?? "" }}
                    className="group flex flex-col items-center gap-1.5 text-center"
                  >
                    <Avatar
                      name={player?.name ?? "—"}
                      url={player?.avatar_url}
                      seed={id}
                      className="h-14 w-14 transition-transform duration-150 group-hover:scale-105 sm:h-16 sm:w-16"
                    />
                    <span className="w-full truncate text-caption text-ink-soft group-hover:text-ink">
                      {player?.name ?? "—"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {finished && (
          <section className="wash wash-soft mt-10 overflow-hidden rounded-sheet border border-hairline">
            <h2 className="px-6 pt-6 text-h3 font-semibold tracking-tight text-ink">
              {t("tournaments.results")}
            </h2>
            <TournamentPodium places={podium} byId={byId} />
          </section>
        )}

        {matches.length === 0 ? (
          <Card className="mt-10">
            <EmptyState
              icon={<LuGitFork className="h-5 w-5" aria-hidden />}
              title={t("public.publicTournament.notDrawnTitle")}
              hint={t("public.publicTournament.notDrawnHint")}
            />
          </Card>
        ) : isLeague ? (
          <Card className="mt-10 overflow-hidden">
            <CardHeader title={t("tournaments.standings")} />
            <LeagueTable
              rows={standings(entrantIds, matches)}
              nameOf={nameOf}
              slugOf={slugOf}
            />
          </Card>
        ) : (
          <>
            {isGroups && (
              <div className="mt-10 grid gap-4 lg:grid-cols-2">
                {groupStandings(entrantIds, groupMatches, groups).map(
                  (rows, group) => (
                    <Card key={group} className="overflow-hidden">
                      <CardHeader
                        title={t("tournaments.group", { n: group + 1 })}
                      />
                      <LeagueTable
                        rows={rows}
                        nameOf={nameOf}
                        slugOf={slugOf}
                        qualify={tournament.advance ? 2 : 0}
                      />
                    </Card>
                  ),
                )}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between gap-3">
              <h2 className="text-h3 font-semibold text-ink">
                {t("public.publicTournament.draw")}
              </h2>
              <Segmented
                label={t("tournaments.view")}
                value={view}
                onChange={setView}
                options={[
                  {
                    value: "bracket",
                    label: t("tournaments.viewBracket"),
                    icon: <LuGitFork className="h-3.5 w-3.5" aria-hidden />,
                  },
                  {
                    value: "list",
                    label: t("tournaments.viewList"),
                    icon: <LuList className="h-3.5 w-3.5" aria-hidden />,
                  },
                ]}
              />
            </div>

            <div className="mt-3">
              {view === "bracket" ? (
                <BracketView
                  matches={matches}
                  nameOf={nameOf}
                  slugOf={slugOf}
                  clubSlug={tournament.club?.slug}
                  index={index}
                  raceFor={raceOf}
                  onRecord={() => null}
                />
              ) : (
                <MatchList
                  matches={matches}
                  nameOf={nameOf}
                  slugOf={slugOf}
                  clubSlug={tournament.club?.slug}
                  index={index}
                  raceFor={raceOf}
                  onRecord={() => null}
                />
              )}
            </div>
          </>
        )}

        {/* Under the results, not beside them: the draw is what the page is
            for, and the talk about it is what you reach after reading it. */}
        <TournamentSocialBar
          tournamentId={tournament.id}
          clubId={tournament.club_id}
        />

        {tournament.club && (
          <Link
            to="/clubs/$slug"
            params={{ slug: tournament.club.slug }}
            className="wash wash-soft lift mt-10 flex flex-col items-center gap-4 rounded-sheet border border-hairline p-8 text-center sm:flex-row sm:justify-between sm:text-left"
          >
            <div className="flex items-center gap-3">
              <Avatar
                name={tournament.club.name}
                url={tournament.club.logo_url}
                mark
                className="h-14 w-14"
              />
              <div>
                <p className="text-caption text-ink-faint">
                  {t("public.publicTournament.hostedBy")}
                </p>
                <p className="text-h3 font-semibold text-ink">
                  {tournament.club.name}
                </p>
              </div>
            </div>
            <span
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              {t("public.publicPlayer.viewClub")}
            </span>
          </Link>
        )}
      </PublicShell>
    </PlayerHighlight>
  );
}

/**
 * The name, the way in, and every fact about the tournament as a labelled
 * field. Below those, only what the fields cannot say: a live pill and a real
 * progress bar while it is under way. Nothing while it is open — the entrant
 * count is a field and the entrants themselves are a named section below — and
 * nothing once it is finished, because the results section opens with the
 * podium and saying it twice on one screen read as two different facts.
 */
function TournamentHero({
  tournament,
  entrantIds,
  matchesTotal,
  matchesPlayed,
  url,
}: {
  tournament: PublicTournament;
  entrantIds: number[];
  matchesTotal: number;
  matchesPlayed: number;
  url: string;
}) {
  const { t, locale } = useT();
  const progress = matchesTotal > 0 ? matchesPlayed / matchesTotal : 0;
  const when = eventDates(tournament.starts_on, tournament.ends_on, locale);

  return (
    <section className="border-b border-hairline">
      <div className="px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* The title alone on its line. Everything that qualifies it is a
              labelled field below rather than a run-on of pills and separators:
              a reader looking for the date was reading a sentence to find it,
              and "Bola 9 · Inscripción abierta" gave neither word a name. */}
          <h1 className={headlineClasses("display", "min-w-0 flex-1 truncate")}>
            {tournament.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <TournamentEntry tournament={tournament} entrantIds={entrantIds} />
            <ShareButton title={tournament.name} url={url} />
          </div>
        </div>

        {/* A definition list, because that is what this is: every row names the
            question and then answers it. Grid rather than flex so the labels
            line up down the columns — a ragged left edge is what made the old
            run-on hard to scan. Fields with nothing in them are absent, not
            blank: most tournaments open before anyone has dated them. */}
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:gap-x-8 lg:grid-cols-3 xl:grid-cols-4">
          {tournament.club && (
            <Fact
              className="col-span-2 sm:col-span-1"
              label={t("public.publicTournament.hostedBy")}
            >
              <Link
                to="/clubs/$slug"
                params={{ slug: tournament.club.slug }}
                className="inline-flex max-w-full items-center gap-1.5 transition-colors duration-150 hover:text-strike"
              >
                <Avatar
                  name={tournament.club.name}
                  url={tournament.club.logo_url}
                  mark
                  className="h-4 w-4 shrink-0"
                />
                <span className="truncate">{tournament.club.name}</span>
              </Link>
            </Fact>
          )}
          <Fact label={t("tournaments.statusLabel")}>
            {t(`tournaments.status.${tournament.status}`)}
          </Fact>
          <Fact label={t("tournaments.format")}>
            {t(`tournaments.${FORMAT_KEY[tournament.format]}`)}
          </Fact>
          <Fact label={t("tournaments.discipline")}>
            {t(`discipline.${tournament.discipline}`)}
          </Fact>
          <Fact label={t("tournaments.category")}>
            {tournament.category === null ? (
              t("tournaments.combined")
            ) : (
              <CategoryBadge category={tournament.category} />
            )}
          </Fact>
          {tournament.status === "open" && (
            <Fact label={t("public.publicTournament.entrantsLabel")}>
              <span className="font-mono tabular-nums">
                {entrantIds.length}
              </span>
            </Fact>
          )}
          {/* Both of these run long — a date range, and a fee the club wrote in
              its own words — so on a phone they take the whole row rather than
              half of one and lose their tail to the truncation. */}
          {when && (
            <Fact
              className="col-span-2 sm:col-span-1"
              label={t("tournaments.dates")}
            >
              {when}
            </Fact>
          )}
          {tournament.entry_fee && (
            <Fact
              className="col-span-2 sm:col-span-1"
              label={t("tournaments.entryFee")}
            >
              {tournament.entry_fee}
            </Fact>
          )}
        </dl>

        {/* Under the fields: only progress, and only while there is any.
            A count and a row of faces used to sit here too, directly above a
            section that lists the same people larger and with their names on —
            the same four faces twice on one screen, the second time captioned.
            The count is a field now; the faces belong to the list that names
            them. Nothing at all once it is finished: the results section below
            opens with the podium, and the champion twice made the second one
            look like a different fact. */}
        {tournament.status === "running" || tournament.status === "groups" ? (
          <div className="mt-8 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-strike-tint px-2 py-1 font-mono text-caption font-semibold text-strike">
              <span
                className="live-dot h-1.5 w-1.5 rounded-full bg-strike"
                aria-hidden
              />
              {t("tournaments.status.running")}
            </span>
            {/* ponytail: track tinted from the fill colour rather than a
                surface token, so it reads whatever the header sits on */}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-strike/20">
              <div
                className="h-full rounded-full bg-strike transition-[width] duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-caption tabular-nums text-ink-faint">
              {t("public.publicTournament.progress", {
                done: matchesPlayed,
                total: matchesTotal,
              })}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The way in, for whoever is reading the page.
 *
 * Entering a tournament is a member's action — the RLS policy on
 * tournament_players wants an active player row in the host club and your own
 * user behind it (see sql/schema.sql) — so what this renders is whichever step
 * of that the visitor is missing: sign in, join the club, or enter. A stranger
 * who lands here from a share link gets a path rather than a disabled button.
 *
 * Only while entries are open. Once the draw is cut the field is fixed, and a
 * button that would always fail is worse than no button.
 *
 * The mutation is written here rather than reused from useManageTournaments:
 * that hook reads `useAuth`, which only exists under /app/$clubSlug. Out here
 * the membership comes off the root context instead.
 */
function TournamentEntry({
  tournament,
  entrantIds,
}: {
  tournament: PublicTournament;
  entrantIds: number[];
}) {
  const { t } = useT();
  const { session, memberships } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Their player row in *this* club. Someone can be a member of three clubs and
  // a pending request at a fourth; only an active row here can enter.
  const membership = memberships.find(
    (m) => m.club_id === tournament.club_id && m.status === "active",
  );
  const entered = !!membership && entrantIds.includes(membership.id);
  // A tournament limited to one division is not open to the others. Mirrors the
  // check the club's own page makes.
  const eligible =
    tournament.category === null ||
    membership?.category === tournament.category;

  const entry = useMutation({
    mutationFn: async () => {
      if (!membership) throw new Error("no player");
      if (entered) {
        await supabase
          .from("tournament_players")
          .delete()
          .eq("tournament_id", tournament.id)
          .eq("player_id", membership.id)
          .throwOnError();
      } else {
        await supabase
          .from("tournament_players")
          .insert([{ tournament_id: tournament.id, player_id: membership.id }])
          .throwOnError();
      }
    },
    onSuccess: async () => {
      // Both halves, for the reason useAuth's refresh gives: the query holds the
      // entrants, the route's loader holds the copy this page renders.
      //
      // Refetched by passing the options with staleTime 0, not by invalidating
      // the key: the loader primes this query with staleTime "static", nothing
      // on the page observes it, and static beats isInvalidated inside
      // isStaleByTime — so an invalidate here refetched nothing and the entrant
      // list kept the field it was rendered with.
      await queryClient.query({
        ...publicTournamentQuery(tournament.id),
        staleTime: 0,
      });
      await router.invalidate();
    },
  });

  if (tournament.status !== "open") return null;

  if (!session) {
    return (
      <Link
        to="/app/login"
        search={{ next: `/tournaments/${tournament.id}` }}
        className={buttonClasses({ size: "sm" })}
      >
        {t("public.publicTournament.signInToEnter")}
      </Link>
    );
  }

  // Signed in, but not a player at this club yet — the invite link is the same
  // one the club hands out, and it comes back here afterwards.
  if (!membership) {
    return tournament.club ? (
      <Link
        to="/app/join/$slug"
        params={{ slug: tournament.club.slug }}
        className={buttonClasses({ size: "sm" })}
      >
        {t("public.publicTournament.joinClubToEnter")}
      </Link>
    ) : null;
  }

  // A tournament with no category takes anybody who has a division, and a
  // membership always has one — so ineligible here always means a division
  // tournament, and the copy always has a division to name.
  if (!entered && !eligible && tournament.category) {
    return (
      <p className="max-w-[24ch] text-caption text-ink-faint">
        {t("tournaments.notEligible", {
          category: t(`category.${tournament.category}`),
        })}
      </p>
    );
  }

  return (
    <Button
      size="sm"
      variant={entered ? "secondary" : "primary"}
      disabled={entry.isPending}
      onClick={() =>
        runMutation(
          entry.mutateAsync(),
          t,
          entered ? "tournaments.left" : "tournaments.joined",
          "common.error",
          { denied: "common.deniedError" },
        )
      }
    >
      {entered ? t("tournaments.leave") : t("tournaments.join")}
    </Button>
  );
}
