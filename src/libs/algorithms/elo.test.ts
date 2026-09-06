import { describe, expect, it } from "vitest";
import type { Game, Player } from "@/types";
import { eloRanking } from "./elo";

const player = (id: number, name: string, category: 1 | 2 | 3 = 2): Player => ({
  id,
  name,
  category,
  club_id: 1,
  joined_at: "1970-01-01T00:00:00Z",
  status: "active",
  person_id: id,
  slug: name.toLowerCase(),
  user_id: null,
  avatar_url: null,
  is_public: true,
  present_since: null,
  queued_table_id: null,
  queued_at: null,
  is_device: false,
  is_caretaker: false,
  device_table_id: null,
});

let seq = 0;
const game = (
  p1: number,
  s1: number,
  p2: number,
  s2: number,
  over: Partial<Game> = {},
): Game => ({
  id: `g${++seq}`,
  club_id: 1,
  player_1_id: p1,
  player_2_id: p2,
  player_1_score: s1,
  player_2_score: s2,
  player_1b_id: null,
  player_2b_id: null,
  played_at: `2026-03-${String((seq % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
  created_at: `2026-03-${String((seq % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
  mode: "single",
  discipline: "9ball",
  ...over,
});

const byId = (rows: ReturnType<typeof eloRanking>, id: number) =>
  rows.find((r) => r.playerId === id)!;

describe("eloRanking", () => {
  it("returns nothing for players who never played", () => {
    expect(eloRanking([], [player(1, "Paula"), player(2, "Alex")])).toEqual(
      [],
    );
  });

  it("moves the winner's rating up and the loser's down from the same starting point", () => {
    const rows = eloRanking(
      [game(1, 5, 2, 2)],
      [player(1, "Paula"), player(2, "Alex")],
    );
    expect(byId(rows, 1).points).toBeGreaterThan(500);
    expect(byId(rows, 2).points).toBeLessThan(500);
  });

  it("excludes the seeded guest player entirely", () => {
    const rows = eloRanking(
      [game(1, 5, 2, 2)],
      [player(1, "Paula"), player(2, "_Invitado")],
    );
    expect(rows.some((r) => r.playerName === "_Invitado")).toBe(false);
  });

  it("skips a game whose player is not in the roster, rather than crediting a stranger", () => {
    const rows = eloRanking(
      [game(1, 5, 99, 2)],
      [player(1, "Paula"), player(2, "Alex")],
    );
    expect(rows).toEqual([]);
  });

  it("skips a game with a non-finite score", () => {
    const bad = { ...game(1, 5, 2, 2), player_1_score: NaN };
    const rows = eloRanking([bad], [player(1, "Paula"), player(2, "Alex")]);
    expect(rows).toEqual([]);
  });

  it("evolves ratings in play order regardless of input array order", () => {
    const players = [player(1, "Paula"), player(2, "Alex"), player(3, "Sam")];
    const forward = [
      game(1, 5, 2, 0, { played_at: "2026-03-01T10:00:00.000Z" }),
      game(1, 5, 3, 0, { played_at: "2026-03-02T10:00:00.000Z" }),
    ];
    const reversed = [...forward].reverse();
    expect(eloRanking(forward, players)).toEqual(
      eloRanking(reversed, players),
    );
  });

  it("gives both members of a doubles team the same rating change", () => {
    const players = [
      player(1, "P1"),
      player(2, "P2"),
      player(3, "P3"),
      player(4, "P4"),
    ];
    const rows = eloRanking(
      [
        {
          ...game(1, 5, 3, 2),
          mode: "doubles",
          player_1b_id: 2,
          player_2b_id: 4,
        },
      ],
      players,
    );
    expect(byId(rows, 1).points).toBe(byId(rows, 2).points);
    expect(byId(rows, 3).points).toBe(byId(rows, 4).points);
  });

  it("keeps form to the ten most recent results, most recent first", () => {
    const players = [player(1, "Paula"), player(2, "Alex")];
    const games = Array.from({ length: 12 }, (_, i) =>
      game(1, i === 11 ? 5 : 0, 2, i === 11 ? 0 : 5, {
        played_at: `2026-04-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );
    const rows = eloRanking(games, players);
    const form = byId(rows, 1).last10Games;
    expect(form.length).toBe(10);
    expect(form[0]).toBe(true);
    expect(form.slice(1).some(Boolean)).toBe(false);
    expect(byId(rows, 1).gamesPlayed).toBe(12);
  });

  it("orders by points, then games won, then rack difference", () => {
    const players = [player(1, "P1"), player(2, "P2"), player(3, "P3")];
    const rows = eloRanking(
      [
        game(1, 5, 2, 0, { played_at: "2026-03-01T10:00:00.000Z" }),
        game(1, 5, 3, 4, { played_at: "2026-03-02T10:00:00.000Z" }),
      ],
      players,
    );
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].points).toBeGreaterThanOrEqual(rows[i].points);
    }
  });

  it("leaves the input games array alone — it is react-query's cached data", () => {
    const players = [player(1, "Paula"), player(2, "Alex")];
    const games = [game(1, 5, 2, 0), game(2, 5, 1, 0)];
    const before = games.map((g) => g.id);
    eloRanking(games, players);
    expect(games.map((g) => g.id)).toEqual(before);
  });
});
