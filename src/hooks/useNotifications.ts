import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { CrumbLink } from "@/libs/routeMeta";
import { useAuth } from "@/hooks/useAuth";
import { useChallenges } from "@/hooks/useChallenges";
import {
  useTournaments,
  useMyPendingMatches,
  useMyTournamentIds,
} from "@/hooks/useTournaments";
import { useDrills } from "@/hooks/useDrills";
import { DRILLS_ENABLED } from "@/libs/algorithms/features";
import { useDrillLogs } from "@/hooks/useDrillLogs";
import { usePlayerLookup } from "@/hooks/usePlayers";
import { useComments } from "@/hooks/useSocial";
import { useNow } from "@/hooks/useNow";
import { isPresent } from "@/libs/algorithms/night";
import { mentionedSlugs } from "@/libs/algorithms/mentions";
import { useT } from "@/i18n";

type NotificationKind =
  | "challengeReceived"
  | "challengeAccepted"
  | "challengeDeclined"
  | "tournamentOpen"
  | "tournamentAction"
  | "drillAdded"
  | "mention"
  | "nightCall";

/** How long "the club has been called" stays worth saying. The same two hours
 *  call_ranking_night refuses a second call inside — see sql/schema.sql. */
const NIGHT_CALL_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Whether an event is one this member could have been there for.
 *
 * The feed is derived from the club's own tables, not from a per-player
 * notifications table, so on the day somebody joins every open tournament and
 * every drill in the library is "new" to them — a bell with thirty unread
 * items about things that happened before they had an account here. `joined_at`
 * is the line: their membership row's own timestamp, see sql/schema.sql.
 *
 * Rows backfilled before the column existed sit at the epoch, so nothing an
 * existing member could already see disappears from under them. An event with
 * no timestamp at all counts as new — hiding something we cannot date is the
 * worse of the two mistakes.
 */
export const since = (joinedAt: string | null | undefined) => {
  const start = joinedAt ? new Date(joinedAt).getTime() : 0;
  const from = Number.isNaN(start) ? 0 : start;
  return (at: string | null | undefined) =>
    !at || new Date(at).getTime() >= from;
};

export type AppNotification = {
  /** Stable and unique per underlying event *and* its current state, so an
   *  already-seen row reappears the moment the thing it describes changes
   *  again (a challenge accepted, then later played, is two different ids). */
  id: string;
  kind: NotificationKind;
  /** Something is waiting on you, not just informing you. */
  needsAction: boolean;
  message: string;
  /** Where tapping it goes: a route pattern plus its parameters, so the bell's
   *  links are checked like every other link in the app. */
  link: CrumbLink;
};

const SEEN_PREFIX = "notifications-seen:";
const DISMISSED_PREFIX = "notifications-dismissed:";

/** Both sets plus the player they belong to, so a switch is one comparison. */
type History = {
  playerId: number | undefined;
  seen: Set<string>;
  dismissed: Set<string>;
};

function loadIds(prefix: string, playerId: number): Set<string> {
  try {
    const raw = localStorage.getItem(prefix + playerId);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveIds(prefix: string, playerId: number, ids: Set<string>) {
  try {
    localStorage.setItem(prefix + playerId, JSON.stringify([...ids]));
  } catch {
    // A private window refuses the write. Forgetting the history is survivable;
    // throwing out of the click that cleared the list is not.
  }
}

function loadHistory(playerId: number | undefined): History {
  return {
    playerId,
    seen: playerId ? loadIds(SEEN_PREFIX, playerId) : new Set<string>(),
    dismissed: playerId
      ? loadIds(DISMISSED_PREFIX, playerId)
      : new Set<string>(),
  };
}

/** Nothing read yet — what the server renders, since it has no localStorage,
 *  and so what the client's first pass has to render as well. */
const EMPTY_HISTORY: History = {
  playerId: undefined,
  seen: new Set(),
  dismissed: new Set(),
};

/**
 * One history per tab, rather than one per call of the hook.
 *
 * Two bells are mounted the whole time — the app bar's and the pinned column's,
 * each hiding itself outside its own width — and every tab open on the same
 * player writes the same two keys. While this was `useState` each of those
 * copies was a snapshot taken at mount: clearing in one left the other still
 * believing nothing had been dismissed, and the next write from that stale copy
 * saved its own set over the good one. That is what brought a cleared list back
 * — the bell you cleared had it right, the one beside it never heard, and
 * whichever wrote last won.
 *
 * A module-level store read through useSyncExternalStore hands every bell in the
 * tab the same object, and the `storage` event carries a write to the other tabs.
 */
let history: History = EMPTY_HISTORY;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const isOurKey = (key: string | null, playerId: number) =>
  // A null key is another tab calling localStorage.clear().
  key === null ||
  key === SEEN_PREFIX + playerId ||
  key === DISMISSED_PREFIX + playerId;

function onStorage(event: StorageEvent) {
  const { playerId } = history;
  if (playerId === undefined || !isOurKey(event.key, playerId)) return;
  history = loadHistory(playerId);
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => history;
const getServerSnapshot = () => EMPTY_HISTORY;

/** Read this player's history in. A no-op for the second bell to ask, and the
 *  way a club switch or a sign-out swaps one player's sets for another's. */
function ensureLoaded(playerId: number | undefined) {
  if (history.playerId === playerId) return;
  history = loadHistory(playerId);
  emit();
}

/** Add to one of the two sets and persist it. Nothing new means nothing at all:
 *  no write and no render, so opening the bell twice costs one update. */
function remember(kind: "seen" | "dismissed", ids: readonly string[]) {
  const { playerId } = history;
  if (playerId === undefined) return;

  const next = new Set(history[kind]);
  for (const id of ids) next.add(id);
  if (next.size === history[kind].size) return;

  history = { ...history, [kind]: next };
  saveIds(kind === "seen" ? SEEN_PREFIX : DISMISSED_PREFIX, playerId, next);
  emit();
}

/**
 * A notification feed derived entirely from data the app already fetches —
 * there is no notifications table. "Unread" is tracked client-side, keyed by
 * a composite id per event *and* its current state: once you've seen a
 * challenge marked accepted, that id is done, but if it later moves to
 * played it's a new id and shows up again.
 */
export const useNotifications = () => {
  const { player, activeClub } = useAuth();
  const { t } = useT();
  const now = useNow();
  const { nameOf } = usePlayerLookup();
  const { data: challenges } = useChallenges();
  const { data: tournaments } = useTournaments();
  const { data: myTournamentIds } = useMyTournamentIds();
  const { data: pendingMatches } = useMyPendingMatches();
  const { data: drills } = useDrills();
  const { data: myDrillLogs } = useDrillLogs({ player_id: player?.id });
  const { data: comments } = useComments();

  // Which notifications have been read is per-device UI state in localStorage,
  // which the server cannot read — so the first render is "nothing read yet" on
  // both sides and the real sets arrive just after hydration. Reading storage
  // during render, as this used to, renders different HTML on the server than
  // the client and React throws the whole tree away.
  const { seen, dismissed } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    // A deliberate post-hydration correction, not a cascade: the server rendered
    // "nothing read yet" because it cannot see localStorage, and this is the
    // first moment the real sets are readable. Shared, so only the first bell to
    // reach here reads, and every other one is handed the same two sets.
    ensureLoaded(player?.id);
  }, [player?.id]);

  const allItems = useMemo<AppNotification[]>(() => {
    if (!player) return [];

    const list: AppNotification[] = [];
    // Anything the club did before this member arrived is not news to them.
    const sinceJoined = since(player.joined_at);

    for (const match of pendingMatches ?? []) {
      list.push({
        id: `tournament-action:${match.id}`,
        kind: "tournamentAction",
        needsAction: true,
        message: t("notifications.tournamentAction", {
          name: match.tournament.name,
        }),
        link: {
          to: "/app/$clubSlug/tournaments/$tournamentId",
          params: { tournamentId: String(match.tournament_id) },
        },
      });
    }

    for (const c of challenges ?? []) {
      if (c.to_player_id === player.id && c.status === "pending") {
        list.push({
          id: `challenge:${c.id}:${c.status}`,
          kind: "challengeReceived",
          needsAction: true,
          message: t("notifications.challengeReceived", {
            name: nameOf(c.from_player_id),
          }),
          link: { to: "/app/$clubSlug/challenges" },
        });
        continue;
      }

      if (c.from_player_id !== player.id) continue;
      if (c.status !== "accepted" && c.status !== "declined") continue;

      list.push({
        id: `challenge:${c.id}:${c.status}`,
        kind:
          c.status === "accepted" ? "challengeAccepted" : "challengeDeclined",
        needsAction: false,
        message: t(
          c.status === "accepted"
            ? "notifications.challengeAccepted"
            : "notifications.challengeDeclined",
          { name: nameOf(c.to_player_id) },
        ),
        link: { to: "/app/$clubSlug/challenges" },
      });
    }

    for (const tour of tournaments ?? []) {
      if (tour.status !== "open") continue;
      if (!sinceJoined(tour.created_at)) continue;
      if (tour.category !== null && tour.category !== player.category) continue;
      if (myTournamentIds?.has(tour.id)) continue;

      list.push({
        id: `tournament-open:${tour.id}`,
        kind: "tournamentOpen",
        needsAction: false,
        message: t("notifications.tournamentOpen", { name: tour.name }),
        link: {
          to: "/app/$clubSlug/tournaments/$tournamentId",
          params: { tournamentId: String(tour.id) },
        },
      });
    }

    // Being named in a thread. The comments are already in the cache for the
    // bars that render them, so this costs a filter and no request — and it is
    // the record even when the push never arrives (see push.functions.ts).
    for (const c of comments ?? []) {
      if (c.author_player_id === player.id) continue;
      if (!sinceJoined(c.created_at)) continue;
      if (!player.slug || !mentionedSlugs(c.body).includes(player.slug))
        continue;

      list.push({
        id: `mention:${c.id}`,
        kind: "mention",
        needsAction: false,
        message: t("notifications.mention", {
          name: nameOf(c.author_player_id),
        }),
        // A tournament thread has a page of its own. A game or a drill log does
        // not — the feed on the dashboard is where that conversation shows.
        link: c.tournament_id
          ? {
              to: "/app/$clubSlug/tournaments/$tournamentId",
              params: { tournamentId: String(c.tournament_id) },
            }
          : { to: "/app/$clubSlug" },
      });
    }

    /**
     * The club has been called to a ranking night.
     *
     * Derived from one column on the club row rather than a table of its own —
     * there is nothing to store but when it happened, and the row rides on the
     * session already. This is the path for everybody who declined push or
     * cannot have it (on iOS it needs a home-screen install at all, see
     * usePushNotifications), and it is why the call is worth recording rather
     * than only sending.
     *
     * Two hours, the same window call_ranking_night refuses a second call
     * inside, so the bell says "the night is on" for exactly as long as that
     * claim is the club's latest.
     *
     * ponytail: no realtime. `night_call_at` refreshes with the session, so a
     * tab left open finds out on its next navigation. The push is the timely
     * channel; this is the durable one.
     */
    const calledAt = activeClub?.night_call_at;
    if (
      calledAt &&
      now !== null &&
      now - new Date(calledAt).getTime() < NIGHT_CALL_WINDOW_MS &&
      // Already at the club, so there is nothing to be called to. The same test
      // push_targets makes before it sends — see sql/schema.sql.
      !isPresent(player, now)
    ) {
      list.push({
        // The moment, so a second call is a second unread rather than one the
        // reader has already dismissed.
        id: `night-call:${calledAt}`,
        kind: "nightCall",
        needsAction: false,
        message: t("notifications.nightCall"),
        link: { to: "/app/$clubSlug/night" },
      });
    }

    const triedDrillIds = new Set(
      (myDrillLogs ?? []).map((log) => log.drill_id),
    );
    // Nothing points at a hidden feature: the drill routes 404 while the flag is
    // off, so a "new drill" bell would only lead somewhere broken.
    for (const drill of DRILLS_ENABLED ? (drills ?? []) : []) {
      if (triedDrillIds.has(drill.id)) continue;
      if (!sinceJoined(drill.created_at)) continue;

      list.push({
        id: `drill-added:${drill.id}`,
        kind: "drillAdded",
        needsAction: false,
        message: t("notifications.drillAdded", { name: drill.name }),
        link: {
          to: "/app/$clubSlug/drills/$drillId",
          params: { drillId: String(drill.id) },
        },
      });
    }

    // Things waiting on you float to the top; everything else keeps arrival order.
    return list.sort((a, b) => Number(b.needsAction) - Number(a.needsAction));
  }, [
    player,
    pendingMatches,
    challenges,
    tournaments,
    myTournamentIds,
    drills,
    myDrillLogs,
    comments,
    activeClub,
    now,
    t,
    nameOf,
  ]);

  // Cleared items stay hidden until the thing they describe changes again —
  // its id changes with it (see AppNotification.id), so it comes back as new.
  const items = useMemo(
    () => allItems.filter((i) => !dismissed.has(i.id)),
    [allItems, dismissed],
  );

  const unreadCount = items.filter((i) => !seen.has(i.id)).length;

  const markAllSeen = useCallback(() => {
    remember(
      "seen",
      items.map((i) => i.id),
    );
  }, [items]);

  const clearAll = useCallback(() => {
    remember(
      "dismissed",
      items.map((i) => i.id),
    );
  }, [items]);

  return { items, unreadCount, seen, markAllSeen, clearAll };
};
