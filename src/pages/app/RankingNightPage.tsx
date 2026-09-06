import { useState } from "react";
import { toast } from "react-toastify";
import { LuBellRing, LuMinus, LuPlus, LuTv } from "react-icons/lu";
import { useAuth } from "@/hooks/useAuth";
import { usePlayers } from "@/hooks/usePlayers";
import { useClubTables } from "@/hooks/useClubTables";
import { useLiveMatches, useManageLiveMatch } from "@/hooks/useLiveMatch";
import { useCallNight, useCheckIn, useWhoIsHere } from "@/hooks/useNight";
import { useSuggestions, seatsOfGroup } from "@/hooks/useSuggestions";
import { sideNames } from "@/libs/algorithms/night";
import { zoneOf } from "@/libs/algorithms/day";
import StartMatchForm from "@/components/live/StartMatchForm";
import SuggestedGroup from "@/components/live/SuggestedGroup";
import PageTitle from "@/components/layout/PageTitle";
import { AppLink } from "@/components/layout/AppLink";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Segmented } from "@/components/ui/Segmented";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { dialogClasses } from "@/components/ui/cardStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useDialog } from "@/hooks/useDialog";
import { readTodaySetup, writeTodaySetup } from "@/libs/prefs";
import { clampRace, seatsNeeded, type DaySetup } from "@/libs/algorithms/today";
import { LIVE_MATCH_KEYS, dbErrorMessage } from "@/libs/algorithms/dbError";
import { useT } from "@/i18n";
import { DISCIPLINES, type ClubTable, type Player } from "@/types";

/**
 * The ranking night, on one page.
 *
 * It used to be two: a grid of tables, and a board by the door for checking in.
 * They were never read apart — you arrive, you tap your face, you look for a
 * free table — and neither of them alone could answer the question the room
 * actually asks, which is "who is here and not playing".
 *
 * Top to bottom in the order the night is thought about: what we are playing,
 * what is on the tables, who could be on one, who is here.
 */
export default function RankingNightPage() {
  const { t, locale } = useT();
  const { player, isClubAdmin, isMember, activeClub } = useAuth();
  const { data: players, isLoading } = usePlayers();
  const { data: tables } = useClubTables();
  const { data: live } = useLiveMatches();
  const { startMatch } = useManageLiveMatch();
  const checkIn = useCheckIn();
  const callNight = useCallNight();
  const here = useWhoIsHere();

  /**
   * When the club was last called, as a clock time.
   *
   * Formatted in the club's own zone rather than the reader's, which is what
   * makes it safe to compute during render: an explicit timeZone gives the
   * server and the browser the same string, where the default would give
   * whatever each of them is set to. See libs/algorithms/day.ts.
   */
  const calledAt = activeClub?.night_call_at
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: zoneOf(activeClub),
      }).format(new Date(activeClub.night_call_at))
    : null;

  // From the cookie, so the server renders the bar the club left it on — see
  // libs/algorithms/today.ts.
  const [setup, setSetup] = useState<DaySetup>(readTodaySetup);
  const change = (part: Partial<DaySetup>) => {
    const next = { ...setup, ...part };
    setSetup(next);
    writeTodaySetup(next);
  };

  const [startingOn, setStartingOn] = useState<ClubTable | null>(null);
  const dialogRef = useDialog(startingOn !== null);
  const close = () => setStartingOn(null);

  const roster = players ?? [];
  const matchOn = (tableId: number) =>
    (live ?? []).find((m) => m.table_id === tableId);
  const hereIds = new Set(here.map((p) => p.id));
  /** Anybody in the club, which is what the guard in sql/schema.sql now allows:
   *  the person who says "he's here, he's just at the bar" is whoever saw him
   *  come in, and it was never going to be the owner every time. */
  const canCheckOthers = isMember;

  const seats = seatsNeeded(setup);
  // Who could play whom, and on what. Shared with each table's own screen and
  // with the scoreboard's "next on this table" offer, so the three can never
  // disagree — see hooks/useSuggestions.
  const {
    groups: suggestions,
    freeTables,
    canStart,
  } = useSuggestions({ setup });

  const startSuggested = (group: Player[], table: ClubTable) =>
    startMatch.mutate(
      {
        ...seatsOfGroup(group, seats),
        tableId: table.id,
        discipline: setup.discipline,
        raceTo: setup.raceTo,
      },
      {
        onError: (err) =>
          toast.error(t(dbErrorMessage(err, "startMatch", LIVE_MATCH_KEYS))),
      },
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 py-4">
      <PageTitle title={t("nav.night")}>
        {/* The wall display is a URL somebody types once on a device that then
            never navigates again — but it has to be findable the first time. */}
        <AppLink
          to="/app/$clubSlug/tv"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <LuTv className="h-4 w-4" aria-hidden />
          {t("tv.open")}
        </AppLink>
      </PageTitle>

      {/* What the club is playing. One answer for the room rather than the same
          three questions on every match — the start form still opens with these
          and can still be argued with per match. */}
      <section className="space-y-2">
        <p className="px-1 text-caption text-ink-faint">{t("night.setup")}</p>
        <Card className="flex flex-wrap items-end gap-x-4 gap-y-3 p-3">
          <div className="space-y-1.5">
            <Label>{t("live.format")}</Label>
            <Segmented
              value={setup.mode}
              onChange={(mode) => change({ mode })}
              label={t("live.format")}
              options={[
                { value: "single", label: t("games.single") },
                { value: "doubles", label: t("games.doubles") },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("live.discipline")}</Label>
            <Segmented
              value={setup.discipline}
              onChange={(discipline) => change({ discipline })}
              label={t("live.discipline")}
              options={DISCIPLINES.map((d) => ({
                value: d,
                label: t(`discipline.${d}`),
              }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("live.race")}</Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                aria-label={t("live.raceDown")}
                onClick={() => change({ raceTo: clampRace(setup.raceTo - 1) })}
                disabled={setup.raceTo <= 1}
                className="h-11 w-11 px-0"
              >
                <LuMinus className="h-4 w-4" aria-hidden />
              </Button>
              <span className="w-10 text-center font-mono text-h4 tabular-nums text-ink">
                {setup.raceTo}
              </span>
              <Button
                type="button"
                variant="secondary"
                aria-label={t("live.raceUp")}
                onClick={() => change({ raceTo: clampRace(setup.raceTo + 1) })}
                disabled={setup.raceTo >= 50}
                className="h-11 w-11 px-0"
              >
                <LuPlus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* The tables, first: it is the question anybody walking in asks. */}
      <section className="space-y-3">
        <h2 className="px-1 text-h4 font-semibold text-ink">
          {t("tables.title")}
        </h2>

        {isLoading ? (
          <SkeletonRows />
        ) : (tables ?? []).length === 0 ? (
          <EmptyState
            title={t("tables.emptyTitle")}
            hint={
              isClubAdmin ? t("tables.emptyAdminHint") : t("tables.emptyHint")
            }
            action={
              isClubAdmin && (
                <AppLink to="/app/$clubSlug/club">
                  <Button>{t("tables.manage")}</Button>
                </AppLink>
              )
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(tables ?? []).map((table) => {
              const match = matchOn(table.id);

              return (
                <Card key={table.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <AppLink
                      to="/app/$clubSlug/tables/$tableId"
                      params={{ tableId: String(table.id) }}
                      className="min-w-0 truncate text-h4 font-semibold text-ink hover:text-strike"
                    >
                      {table.label}
                    </AppLink>
                    {match ? (
                      <span className="flex items-center gap-1.5 text-caption text-strike">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-strike" />
                        {t("live.now")}
                      </span>
                    ) : (
                      <span className="text-caption text-ink-faint">
                        {t("tables.free")}
                      </span>
                    )}
                  </div>

                  {match ? (
                    <AppLink
                      to="/app/$clubSlug/live/$liveId"
                      params={{ liveId: match.id }}
                      className="mt-3 block"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-body text-ink">
                          {sideNames(match, 1, roster)}
                        </span>
                        <span className="font-mono text-h4 font-semibold text-ink tabular-nums">
                          {match.player_1_score} – {match.player_2_score}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-right text-body text-ink">
                          {sideNames(match, 2, roster)}
                        </span>
                      </div>
                      <p className="mt-1 text-caption text-ink-faint">
                        {t("live.raceTo", { n: match.race_to })}
                      </p>
                    </AppLink>
                  ) : (
                    <Button
                      className="mt-3 w-full"
                      variant="secondary"
                      onClick={() => setStartingOn(table)}
                    >
                      {t("live.playHere")}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Who could be playing. The whole of the old waiting list, without
          anybody having to join one: being here and not at a table is the only
          state it ever meant. */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-h4 font-semibold text-ink">
            {t("night.suggested")}
          </h2>

          <div className="space-y-2">
            {suggestions.map((group, i) => {
              const table = freeTables[i];

              return (
                <Card
                  key={group.map((p) => p.id).join("-")}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <SuggestedGroup group={group} seats={seats} />

                  {table ? (
                    <Button
                      disabled={!canStart(group) || startMatch.isPending}
                      onClick={() => startSuggested(group, table)}
                    >
                      {t("night.startOn", { name: table.label })}
                    </Button>
                  ) : (
                    <span className="text-caption text-ink-faint">
                      {t("night.noFreeTable")}
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* The board by the door, at the bottom: you tap your face once on the way
          in and never look at it again. Faces rather than a list, because it is
          read by somebody with a cue bag on their shoulder and the point is
          recognising yourself rather than reading a name.
          Anybody in the club may tap anybody's face, either way: the guard in
          sql/schema.sql asks for membership and nothing more. */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 px-1">
          <h2 className="text-h4 font-semibold text-ink">
            {t("tonight.heading")}
          </h2>
          <div className="flex items-baseline gap-3">
            <span className="text-caption tabular-nums text-ink-faint">
              {t("tonight.count", { n: here.length })}
            </span>
            {/* Half the club not being here is the reason this button exists,
                which is why it sits on the headcount rather than at the top of
                the page. It buzzes every member's phone, so it asks first.

                No two-hour countdown on it: the limit is call_ranking_night's,
                and a disabled state derived from the clock would differ between
                the server's render and the browser's. Pressing it too soon is
                refused and says so. */}
            {isClubAdmin && (
              <ConfirmButton
                size="sm"
                variant="secondary"
                confirmLabel={t("night.callConfirm")}
                disabled={callNight.isPending}
                onConfirm={() =>
                  callNight.mutate(undefined, {
                    onSuccess: () => toast.success(t("night.callSent")),
                    onError: (err) =>
                      toast.error(
                        t(
                          dbErrorMessage(err, "callNight", {
                            refused: "night.callTooSoon",
                            denied: "common.deniedError",
                          }),
                        ),
                      ),
                  })
                }
              >
                <LuBellRing className="h-4 w-4" aria-hidden />
                {t("night.call")}
              </ConfirmButton>
            )}
          </div>
        </div>

        {/* Said once, quietly, under the board: the admin who just pressed it
            wants to know it went, and the next admin to look wants to know it
            has already gone. */}
        {calledAt !== null && (
          <p className="px-1 text-caption text-ink-faint">
            {t("night.called", { when: calledAt })}
          </p>
        )}

        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {roster.map((p) => {
              const isHere = hereIds.has(p.id);
              const mine = p.id === player?.id;
              const can = mine || canCheckOthers;

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!can || checkIn.isPending}
                    aria-pressed={isHere}
                    onClick={() =>
                      checkIn.mutate(
                        { here: !isHere, playerId: p.id },
                        {
                          onError: (err) =>
                            toast.error(
                              t(
                                dbErrorMessage(err, "checkIn", {
                                  denied: "common.deniedError",
                                }),
                              ),
                            ),
                        },
                      )
                    }
                    className={[
                      "flex w-full flex-col items-center gap-2 rounded-card border p-3",
                      "transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)]",
                      can ? "active:scale-[0.97]" : "cursor-default",
                      // Present is a filled state, not a badge on a face: the
                      // board is read as "which of these are lit".
                      isHere
                        ? "border-strike/60 bg-felt-raised"
                        : "border-hairline opacity-60 hover:opacity-100",
                    ].join(" ")}
                  >
                    {/* No seed: a face without a picture is a grey disc rather
                        than a solid ball colour. Forty of them in the club's own
                        accent is a board that reads as forty buttons — what is
                        being asked here is which of these are lit, and that is
                        the border and the fill saying it. */}
                    <Avatar
                      name={p.name}
                      url={p.avatar_url}
                      className="h-12 w-12"
                    />
                    <span className="w-full truncate text-center text-caption text-ink">
                      {p.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <dialog
        ref={dialogRef}
        className={dialogClasses({ wide: true })}
        aria-label={t("live.start")}
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        {startingOn && player && (
          <StartMatchForm
            me={player}
            opponents={roster.filter((p) => p.id !== player.id)}
            table={startingOn}
            // The day's answer, already filled in. Still a form: one match in an
            // evening is somebody's race to nine and it should not need the bar
            // above changing and changing back.
            defaults={setup}
            onSubmit={(values) =>
              startMatch.mutate(
                {
                  player1: values.player1,
                  player2: values.player2,
                  partner1: values.partner1,
                  partner2: values.partner2,
                  tableId: values.tableId,
                  discipline: values.discipline,
                  raceTo: values.raceTo,
                },
                {
                  // Stay here. Starting a match from the room's list is often
                  // starting somebody else's — the card behind the dialog turns
                  // live on its own, which is the confirmation.
                  onSuccess: close,
                  onError: (err) =>
                    toast.error(
                      t(dbErrorMessage(err, "startMatch", LIVE_MATCH_KEYS)),
                    ),
                },
              )
            }
            onCancel={close}
            isSubmitting={startMatch.isPending}
          />
        )}
      </dialog>
    </div>
  );
}
