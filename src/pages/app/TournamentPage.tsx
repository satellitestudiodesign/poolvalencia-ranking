import { useMemo, useState } from "react";
import { dialogClasses } from "@/components/ui/cardStyles";
import {
  LuGitFork,
  LuList,
  LuPlus,
  LuUserMinus,
  LuUserPlus,
} from "react-icons/lu";
import { runMutation } from "@/libs/browser/mutationToast";
import { useAuth } from "@/hooks/useAuth";
import { usePlayers, usePlayerLookup } from "@/hooks/usePlayers";
import { useGames } from "@/hooks/useGames";
import { useEloRanking } from "@/hooks/useEloRanking";
import { useTournament, useManageTournaments } from "@/hooks/useTournaments";
import {
  bracketIndex,
  eligibleToAdd,
  findOutstandingMatch,
  groupCount,
  minimumEntrants,
  raceFor,
  resolveBracket,
  seedEntrants,
  sortPlayedMatches,
  tournamentPodium,
  type BracketIndex,
} from "@/libs/algorithms/bracket";
import { groupStandings, standings } from "@/libs/algorithms/leagueTable";
import { eventDates, isUpcoming } from "@/libs/algorithms/eventDates";
import PageTitle from "@/components/layout/PageTitle";
import BracketView from "@/components/tournaments/BracketView";
import LeagueTable from "@/components/tournaments/LeagueTable";
import MatchCard from "@/components/games/MatchCard";
import MatchList from "@/components/games/MatchList";
import TournamentPodium from "@/components/tournaments/TournamentPodium";
import SocialBar from "@/components/social/SocialBar";
import TournamentAdminPanel from "@/components/tournaments/TournamentAdminPanel";
import PlayGameForm from "@/components/games/PlayGameForm";
import { PlayerHighlight } from "@/components/players/PlayerLink";
import TournamentForm, {
  type TournamentValues,
} from "@/components/tournaments/TournamentForm";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { CategoryBadge } from "@/components/ui/Ball";
import { Fact } from "@/components/ui/Fact";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDialog } from "@/hooks/useDialog";
import { FORMAT_KEY, type TournamentMatch } from "@/types";
import { useT } from "@/i18n";
import { getRouteApi } from "@tanstack/react-router";
import { AppLink } from "@/components/layout/AppLink";

const route = getRouteApi("/app/_authed/$clubSlug/tournaments/$tournamentId");

export default function TournamentPage() {
  const { t, locale } = useT();
  const { tournamentId: tournamentIdParam } = route.useParams();
  const tournamentId = Number(tournamentIdParam);

  const { player, activeClubId, isClubAdmin, isMember } = useAuth();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: players } = usePlayers();
  const { byId, nameOf } = usePlayerLookup();
  const { data: games } = useGames({});
  const elo = useEloRanking({ games: games?.games, players });

  const {
    updateTournament,
    deleteTournament,
    joinTournament,
    leaveTournament,
    startTournament,
    generateKnockout,
    recordResult,
  } = useManageTournaments();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const editRef = useDialog(isEditOpen);
  // Either a fixture tapped in the bracket, or "new" for the pick-the-players
  // route. Both end up filing a result against a fixture.
  const [playing, setPlaying] = useState<TournamentMatch | "new" | null>(null);
  const recordRef = useDialog(!!playing);
  const [adding, setAdding] = useState("");
  const [view, setView] = useState<"bracket" | "list">("list");

  const entrants = useMemo(
    () => (tournament?.tournament_players ?? []).map((e) => e.player_id),
    [tournament],
  );

  const seeded = useMemo(
    () => seedEntrants(entrants, elo, nameOf),
    [entrants, elo, nameOf],
  );

  // The stored rows only hold the seats known at generation; this fills in the
  // rest from the results so far, and settles any walkover they created.
  const matches = useMemo(
    () => resolveBracket(tournament?.tournament_matches ?? []),
    [tournament],
  );

  // Built once from the whole tournament and handed to every view, so #12 is
  // the same match in the bracket, in the list and in a "loser of #12" seat.
  const index = useMemo(() => bracketIndex(matches), [matches]);

  if (isLoading) return <PageSkeleton />;
  // Someone in two clubs can reach the other club's tournament by URL — RLS
  // lets them read it, since they are a member there too. Acting on it would
  // enter the wrong player: `player` is the one for the club being viewed.
  if (!tournament || tournament.club_id !== activeClubId) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        <PageTitle title={t("nav.tournaments")} />
        <Card>
          <EmptyState
            title={t("tournaments.missing")}
            hint={tournament ? t("tournaments.otherClub") : undefined}
          />
        </Card>
      </div>
    );
  }

  const minimum = minimumEntrants(tournament.format, tournament.advance);
  const groups = groupCount(tournament.advance ?? 2);
  const entered = player ? entrants.includes(player.id) : false;
  const canEnter =
    tournament.category === null || player?.category === tournament.category;

  /** Who the organiser can still put in: the club roster this tournament is
   *  open to, minus whoever is already entered. */
  const addable = eligibleToAdd(players ?? [], tournament.category, entrants);

  // A knockout's podium is who lost to whom; a league's is just the top of the
  // table, since there is no final to read it off.
  const podium = tournamentPodium(tournament.format, entrants, matches);

  const groupMatches = matches.filter((m) => m.bracket === "group");
  const groupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => m.winner_id !== null);

  /** Anyone in the club can file a result, once both seats are filled. */
  const canPlay = isMember && tournament.status !== "done";
  const playable = (match: TournamentMatch) =>
    match.winner_id === null && match.p1_id !== null && match.p2_id !== null;

  const recorder = (match: TournamentMatch) =>
    canPlay && playable(match) ? () => setPlaying(match) : null;

  /** Most recent first — a league is read as "what happened lately", not as a
   *  calendar. Fixtures generated at the same time have no order of their own,
   *  so an unplayed one falls back to its number. */
  const playedMatches = sortPlayedMatches(
    matches.filter((m) => m.winner_id !== null),
  );
  const pendingMatches = matches.filter((m) => m.winner_id === null);

  const findMatch = (a: number, b: number) =>
    findOutstandingMatch(matches, a, b);

  const entrantPlayers = (players ?? []).filter((p) => entrants.includes(p.id));

  /** The race this fixture runs to, from how deep in the draw it sits. */
  const raceOf = (match: TournamentMatch) =>
    raceFor(match, tournament, matches);

  const when = eventDates(tournament.starts_on, tournament.ends_on, locale);

  return (
    <PlayerHighlight>
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
        <PageTitle title={tournament.name}>
          {/* Two people meet at a table and want it recorded there and then, so
              this is next to the tournament's name rather than buried beside a
              fixture. */}
          {canPlay && pendingMatches.some(playable) && (
            <Button size="sm" onClick={() => setPlaying("new")}>
              <LuPlus className="h-4 w-4" aria-hidden />
              {t("tournaments.addGame")}
            </Button>
          )}
        </PageTitle>

        {/* The terms of the thing, each one named.
            This was a run-on subtitle — "9-ball · League · Entries open" — and
            a page that told you none of what an entrant actually needs to know:
            when it runs, what it costs, what a match is played to. Every one of
            those was already on the row, unread. Same definition list the
            public page leads with, so a member and a visitor read the same
            facts in the same shape. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-hairline py-4 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
          {/* First, across the phone's whole width, and present even when
              empty: "when" is the question an open tournament is opened to
              answer, "nobody has said yet" is a real answer to it, and a date
              range is the one value here that will not share a narrow row
              without being cut in half. */}
          <Fact
            className="col-span-2 sm:col-span-1"
            label={t(
              isUpcoming(tournament.starts_on) && !tournament.ends_on
                ? "tournaments.startsOn"
                : "tournaments.dates",
            )}
          >
            {when ?? (
              <span className="text-ink-faint">
                {t("tournaments.notDated")}
              </span>
            )}
          </Fact>

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

          {/* What a match is. The number carries its unit — a bare "7" under a
              label leaves the reader to guess whether it is racks, frames or
              minutes. The base race always; the deeper ones only where the
              organiser set them apart, since a flat draw would otherwise say
              the same number three times. */}
          <Fact label={t("tournaments.raceTo")}>
            {t("tournaments.raceN", { n: tournament.race_to })}
          </Fact>
          {!!tournament.race_semi && (
            <Fact label={t("tournaments.raceSemi")}>
              {t("tournaments.raceN", { n: tournament.race_semi })}
            </Fact>
          )}
          {!!tournament.race_final && (
            <Fact label={t("tournaments.raceFinal")}>
              {t("tournaments.raceN", { n: tournament.race_final })}
            </Fact>
          )}

          {/* Meaningless in a straight knockout, where a pair meets once by
              construction. */}
          {tournament.format !== "double_elim" && (
            <Fact label={t("tournaments.legs")}>
              {t(
                tournament.legs === 2
                  ? "tournaments.legs2"
                  : "tournaments.legs1",
              )}
            </Fact>
          )}
          {tournament.format === "group_knockout" &&
            tournament.advance !== null && (
              <Fact label={t("tournaments.advance")}>
                {t("tournaments.advanceN", { n: tournament.advance })}
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

        {/* A finished tournament leads with its result: the bracket below is
            then the story of how it got there, not the headline. */}
        {tournament.status === "done" && podium && (
          <Card className="overflow-hidden">
            <CardHeader title={t("tournaments.results")} />
            <TournamentPodium places={podium} byId={byId} />
            {/* Same target as the feed card's bar, so it is one thread seen
                from two places rather than two threads. */}
            <div className="px-4 pb-3">
              <SocialBar target={{ tournamentId: tournament.id }} />
            </div>
          </Card>
        )}

        {/* The draw leads. It is the one thing everybody opens the page for
            once the tournament is under way, so it comes before the tables
            that explain it and long before the tools that run it. */}
        {matches.some(
          (m) => m.bracket !== "group" && m.bracket !== "league",
        ) && (
          <Card className="overflow-hidden">
            <CardHeader
              title={t("games.title")}
              action={
                <Segmented<"bracket" | "list">
                  value={view}
                  onChange={setView}
                  label={t("tournaments.view")}
                  options={[
                    {
                      value: "list",
                      label: t("tournaments.viewList"),
                      icon: <LuList className="h-4 w-4" aria-hidden />,
                    },
                    {
                      value: "bracket",
                      label: t("tournaments.viewBracket"),
                      icon: <LuGitFork className="h-4 w-4" aria-hidden />,
                    },
                  ]}
                />
              }
            />
            <div className="p-3">
              {view === "bracket" ? (
                <BracketView
                  matches={matches}
                  nameOf={nameOf}
                  index={index}
                  raceFor={raceOf}
                  onRecord={recorder}
                />
              ) : (
                <MatchList
                  matches={matches}
                  nameOf={nameOf}
                  index={index}
                  raceFor={raceOf}
                  onRecord={recorder}
                />
              )}
            </div>
          </Card>
        )}

        {tournament.status === "open" && (
          <Card className="overflow-hidden">
            <CardHeader
              title={t("tournaments.entrants", { n: entrants.length })}
              action={
                isMember &&
                canEnter && (
                  <Button
                    size="sm"
                    variant={entered ? "secondary" : "primary"}
                    disabled={
                      joinTournament.isPending || leaveTournament.isPending
                    }
                    onClick={() =>
                      runMutation(
                        entered
                          ? leaveTournament.mutateAsync({ tournamentId })
                          : joinTournament.mutateAsync({ tournamentId }),
                        t,
                        entered ? "tournaments.left" : "tournaments.joined",
                        "common.error",
                        { denied: "common.deniedError" },
                      )
                    }
                  >
                    {entered ? t("tournaments.leave") : t("tournaments.join")}
                  </Button>
                )
              }
            />
            {entrants.length === 0 ? (
              <EmptyState
                title={t("tournaments.noEntrants")}
                hint={
                  !canEnter && tournament.category
                    ? t("tournaments.notEligible", {
                        category: t(`category.${tournament.category}`),
                      })
                    : t("tournaments.noEntrantsHint")
                }
              />
            ) : (
              <ul className="divide-y divide-hairline">
                {seeded.map((playerId, index) => (
                  <li
                    key={playerId}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="w-6 shrink-0 font-mono text-caption tabular-nums text-ink-faint">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      <AppLink
                        to="/app/$clubSlug/players/$playerId"
                        params={{ playerId: playerId }}
                        className="transition-colors duration-150 hover:text-strike"
                      >
                        {nameOf(playerId)}
                      </AppLink>
                      {playerId === player?.id && (
                        <span className="ml-2 text-caption text-ink-faint">
                          {t("club.you")}
                        </span>
                      )}
                    </span>
                    {isClubAdmin && (
                      <IconButton
                        label={t("tournaments.removeNamed", {
                          name: nameOf(playerId),
                        })}
                        size="sm"
                        tone="danger"
                        onClick={() =>
                          runMutation(
                            leaveTournament.mutateAsync({
                              tournamentId,
                              playerId,
                            }),
                            t,
                            "tournaments.removed",
                            "common.error",
                            { denied: "common.deniedError" },
                          )
                        }
                      >
                        <LuUserMinus className="h-4 w-4" aria-hidden />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Not everyone waits to be asked twice: the organiser can put a
                member in directly. Outside the list above, so it is there when
                nobody has entered yet. */}
            {isClubAdmin && (
              <div className="border-t border-hairline p-4">
                {addable.length === 0 ? (
                  <p className="text-caption text-ink-faint">
                    {t("tournaments.allEntered")}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      size="sm"
                      className="min-w-0 flex-1"
                      value={adding}
                      aria-label={t("tournaments.addPlayer")}
                      onChange={(e) => setAdding(e.target.value)}
                    >
                      <option value="">{t("tournaments.addPlayer")}</option>
                      {addable.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={!adding || joinTournament.isPending}
                      onClick={() => {
                        const playerId = Number(adding);
                        setAdding("");
                        runMutation(
                          joinTournament.mutateAsync({
                            tournamentId,
                            playerId,
                          }),
                          t,
                          "tournaments.added",
                          "common.error",
                          { denied: "common.deniedError" },
                        );
                      }}
                    >
                      <LuUserPlus className="h-4 w-4" aria-hidden />
                      {t("tournaments.add")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Group tables stay up once the bracket is running: the bracket says
            who is left, the tables say how they got there. */}
        {groupMatches.length > 0 &&
          groupStandings(entrants, groupMatches, groups).map((rows, group) => (
            <Card key={group} className="overflow-hidden">
              <CardHeader title={t("tournaments.group", { n: group + 1 })} />
              <LeagueTable
                rows={rows}
                nameOf={nameOf}
                qualify={tournament.status === "groups" ? 2 : 0}
              />
              <div className="border-t border-hairline p-3">
                <Fixtures
                  matches={groupMatches.filter((m) => m.group_no === group + 1)}
                  nameOf={nameOf}
                  index={index}
                  recorder={recorder}
                />
              </div>
            </Card>
          ))}

        {tournament.format === "league" && matches.length > 0 && (
          <>
            <Card className="overflow-hidden">
              <CardHeader title={t("tournaments.standings")} />
              <LeagueTable
                rows={standings(entrants, matches)}
                nameOf={nameOf}
              />
            </Card>
            {/* What is left to arrange comes first: the played ones are a log,
                the pending ones are the thing anyone can act on. Once the
                tournament is closed nobody can, so they stop being news. */}
            {pendingMatches.length > 0 && tournament.status !== "done" && (
              <Card className="overflow-hidden">
                <CardHeader
                  title={t("tournaments.stillToPlay", {
                    n: pendingMatches.length,
                  })}
                />
                <div className="p-3">
                  <Fixtures
                    matches={pendingMatches}
                    nameOf={nameOf}
                    index={index}
                    recorder={recorder}
                  />
                </div>
              </Card>
            )}
            <Card className="overflow-hidden">
              <CardHeader
                title={t("tournaments.gamesPlayed", {
                  n: playedMatches.length,
                })}
              />
              {playedMatches.length === 0 ? (
                <EmptyState
                  title={t("tournaments.noGamesYet")}
                  hint={canPlay ? t("tournaments.noGamesHint") : undefined}
                />
              ) : (
                <div className="p-3">
                  <Fixtures
                    matches={playedMatches}
                    nameOf={nameOf}
                    index={index}
                    recorder={recorder}
                  />
                </div>
              )}
            </Card>
          </>
        )}

        {isClubAdmin && tournament.status !== "done" && (
          // The seam between the tournament and the running of it. Everything
          // above is what a tournament is; everything below is a job, and only
          // one person on the page has it.
          <div className="border-t border-hairline pt-4">
            <TournamentAdminPanel
              tournament={tournament}
              tournamentId={tournamentId}
              entrants={entrants}
              seeded={seeded}
              minimum={minimum}
              groupsDone={groupsDone}
              manage={{
                startTournament,
                deleteTournament,
                generateKnockout,
                updateTournament,
              }}
              onEdit={() => setIsEditOpen(true)}
            />
          </div>
        )}
      </div>

      <dialog
        ref={editRef}
        className={dialogClasses({ wide: true })}
        aria-label={t("tournaments.edit")}
        onClose={() => setIsEditOpen(false)}
        onClick={(e) => {
          if (e.target === editRef.current) setIsEditOpen(false);
        }}
      >
        <h2 className="mb-4 text-h3 font-semibold text-ink">
          {t("tournaments.edit")}
        </h2>
        {isEditOpen && (
          <TournamentForm
            initialValues={{
              name: tournament.name,
              starts_on: tournament.starts_on,
              ends_on: tournament.ends_on,
              entry_fee: tournament.entry_fee,
              format: tournament.format,
              category: tournament.category,
              legs: tournament.legs,
              advance: tournament.advance,
              single_from: tournament.single_from,
              discipline: tournament.discipline,
              race_to: tournament.race_to,
              race_semi: tournament.race_semi,
              race_final: tournament.race_final,
            }}
            isSubmitting={updateTournament.isPending}
            onCancel={() => setIsEditOpen(false)}
            onSubmit={(values: TournamentValues) => {
              setIsEditOpen(false);
              runMutation(
                updateTournament.mutateAsync({ id: tournamentId, ...values }),
                t,
                "common.saved",
                "common.error",
                { denied: "common.deniedError" },
              );
            }}
          />
        )}
      </dialog>

      <dialog
        ref={recordRef}
        className={dialogClasses()}
        aria-label={t("tournaments.record")}
        onClose={() => setPlaying(null)}
        onClick={(e) => {
          if (e.target === recordRef.current) setPlaying(null);
        }}
      >
        {/* Mounted only while open, so the pickers start empty every time. */}
        {playing && (
          <PlayGameForm
            entrants={entrantPlayers}
            initialMatch={playing === "new" ? null : playing}
            findMatch={findMatch}
            raceFor={raceOf}
            isSubmitting={recordResult.isPending}
            onCancel={() => setPlaying(null)}
            onSubmit={(values) => {
              setPlaying(null);
              runMutation(
                recordResult.mutateAsync({
                  ...values,
                  discipline: tournament.discipline,
                }),
                t,
                "tournaments.recorded",
                "common.error",
                { denied: "common.deniedError" },
              );
            }}
          />
        )}
      </dialog>
    </PlayerHighlight>
  );
}

/** Fixtures as cards. No matchday headings: a club league is played whenever
 *  two people are free, so the round a fixture was generated in means nothing
 *  to anybody reading it. */
function Fixtures({
  matches,
  nameOf,
  index,
  recorder,
}: {
  matches: TournamentMatch[];
  nameOf: (id: number) => string;
  index: BracketIndex;
  recorder: (match: TournamentMatch) => (() => void) | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          nameOf={nameOf}
          index={index}
          onRecord={recorder(match) ?? undefined}
        />
      ))}
    </div>
  );
}
