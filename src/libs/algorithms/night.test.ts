import { describe, expect, it } from "vitest";
import type { ClubTable, LiveMatch, Player } from "@/types";
import {
  ABANDON_AFTER_MS,
  PRESENT_WINDOW_MS,
  bump,
  freeTables,
  isAbandoned,
  isMatchOver,
  isPresent,
  leaderOf,
  seatsOf,
  seatsOfSide,
  unbump,
  whoIsHere,
} from "./night";

const NOW = new Date("2026-08-25T21:00:00.000Z").getTime();

const match = (over: Partial<LiveMatch> = {}): LiveMatch => ({
  id: "l1",
  club_id: 1,
  table_id: 1,
  player_1_id: 1,
  player_2_id: 2,
  player_1b_id: null,
  player_2b_id: null,
  mode: "single",
  discipline: "9ball",
  player_1_score: 0,
  player_2_score: 0,
  race_to: 5,
  last_side: null,
  challenge_id: null,
  tournament_match_id: null,
  started_at: new Date(NOW).toISOString(),
  updated_at: new Date(NOW).toISOString(),
  ...over,
});

const player = (over: Partial<Player> = {}): Player => ({
  id: 1,
  name: "p1",
  category: 2,
  club_id: 1,
  joined_at: "1970-01-01T00:00:00Z",
  status: "active",
  person_id: 1,
  slug: "p1",
  user_id: null,
  avatar_url: null,
  is_public: true,
  present_since: null,
  queued_table_id: null,
  queued_at: null,
  is_device: false,
  is_caretaker: false,
  device_table_id: null,
  ...over,
});

describe("isPresent", () => {
  it("is false with no check-in", () => {
    expect(isPresent(player(), NOW)).toBe(false);
  });

  it("is true inside the presence window", () => {
    expect(
      isPresent(
        player({ present_since: new Date(NOW - 60_000).toISOString() }),
        NOW,
      ),
    ).toBe(true);
  });

  it("expires the check-in once the window ends, since nobody has to remember to check out", () => {
    expect(
      isPresent(
        player({
          present_since: new Date(NOW - PRESENT_WINDOW_MS - 1).toISOString(),
        }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe("isAbandoned", () => {
  it("is false for a freshly updated match", () => {
    expect(isAbandoned(match(), NOW)).toBe(false);
  });

  it("counts exactly at the boundary as abandoned, because the RLS policy's updated_at < now() - interval '3 hours' will let it be deleted from here on, and a row the client still calls live but cannot clear is the bug this pair exists to prevent", () => {
    expect(
      isAbandoned(
        match({ updated_at: new Date(NOW - ABANDON_AFTER_MS).toISOString() }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe("isMatchOver / leaderOf — the race", () => {
  it("is not over while tied below the race", () => {
    expect(isMatchOver(match({ player_1_score: 4, player_2_score: 4 }))).toBe(
      false,
    );
  });

  it("is won by getting there, not by being ahead at the end", () => {
    expect(isMatchOver(match({ player_1_score: 5, player_2_score: 4 }))).toBe(
      true,
    );
  });

  it("has no leader when tied", () => {
    expect(
      leaderOf(match({ player_1_score: 2, player_2_score: 2 })),
    ).toBeNull();
  });

  it("names whoever is ahead as the leader", () => {
    expect(leaderOf(match({ player_1_score: 2, player_2_score: 3 }))).toBe(2);
  });
});

describe("bump", () => {
  it("adds a rack to the scoring side", () => {
    expect(bump(match({ player_1_score: 1, player_2_score: 3 }), 1)).toEqual({
      player_1_score: 2,
      player_2_score: 3,
      last_side: 1,
    });
  });

  it("does nothing for a tap landing behind the finish sheet", () => {
    expect(bump(match({ player_1_score: 5 }), 2)).toBeNull();
  });
});

describe("unbump", () => {
  it("takes a rack off, clearing last_side since a corrected score has no last rack — the next correction cannot take one off whoever happened to score before", () => {
    expect(
      unbump(match({ player_1_score: 4, player_2_score: 1, last_side: 2 }), 2),
    ).toEqual({
      player_1_score: 4,
      player_2_score: 0,
      last_side: null,
    });
  });

  it("has nothing to take off a side already on zero — the floor, same as the database's CHECK constraint", () => {
    expect(
      unbump(match({ player_1_score: 0, player_2_score: 3 }), 1),
    ).toBeNull();
  });

  it("is allowed once the race is reached — this is what 'keep playing' is, and the only way back from a mis-tap that ended the match", () => {
    expect(unbump(match({ player_1_score: 5, player_2_score: 2 }), 1)).toEqual({
      player_1_score: 4,
      player_2_score: 2,
      last_side: null,
    });
  });
});

describe("seatsOfSide / seatsOf", () => {
  const pairs = match({
    mode: "doubles",
    player_1b_id: 11,
    player_2b_id: 22,
    player_1_score: 5,
    player_2_score: 3,
  });

  it("seats a single side as one player", () => {
    expect(seatsOfSide(match(), 1)).toEqual([1]);
  });

  it("seats both of a doubles side — a partner at the table has to count as playing, not waiting for one", () => {
    expect(seatsOfSide(pairs, 2)).toEqual([2, 22]);
  });

  it("seats everyone in the match, doubles or singles", () => {
    expect(seatsOf(pairs)).toEqual([1, 11, 2, 22]);
    expect(seatsOf(match())).toEqual([1, 2]);
  });
});

describe("freeTables", () => {
  const table = (id: number): ClubTable => ({
    id,
    club_id: 1,
    label: `T${id}`,
    sort_order: id,
  });

  it("is every table with no live row pointing at it", () => {
    expect(
      freeTables([table(1), table(2), table(3)], [match({ table_id: 2 })]).map(
        (t) => t.id,
      ),
    ).toEqual([1, 3]);
  });

  it("keeps the club's own order, which is what makes the i'th group the i'th table's", () => {
    const tables = [table(3), table(1), table(2)];
    expect(freeTables(tables, []).map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("ignores a match that is on no table at all", () => {
    expect(freeTables([table(1)], [match({ table_id: null })]).length).toBe(1);
  });
});

describe("whoIsHere", () => {
  const roster = [1, 2, 3, 4, 5].map((id) => player({ id, name: `p${id}` }));

  it("counts a check-in inside the window", () => {
    const checkedIn = player({
      id: 9,
      present_since: new Date(NOW - 1000).toISOString(),
    });
    expect(whoIsHere([checkedIn], [], NOW).map((p) => p.id)).toEqual([9]);
  });

  it("counts everyone at a table, checked in or not — the club is not empty above a live match", () => {
    const doubles = match({
      player_1_id: 1,
      player_1b_id: 2,
      player_2_id: 3,
      player_2b_id: 4,
      mode: "doubles",
    });
    expect(whoIsHere(roster, [doubles], NOW).map((p) => p.id)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("does not double-count somebody both playing and checked in", () => {
    const playing = [
      player({ id: 1, present_since: new Date(NOW - 1000).toISOString() }),
      player({ id: 2 }),
    ];
    expect(whoIsHere(playing, [match()], NOW).map((p) => p.id)).toEqual([1, 2]);
  });

  it("still counts seats before the browser knows the time", () => {
    expect(whoIsHere(roster, [match()], null).map((p) => p.id)).toEqual([1, 2]);
  });

  it("is empty with no check-ins and no matches", () => {
    expect(whoIsHere(roster, [], NOW)).toEqual([]);
  });
});
