import { describe, expect, it } from "vitest";
import { playerRecord, sideOf, type PlayedGame } from "./playerRecord";

const game = (over: Partial<PlayedGame> = {}): PlayedGame => ({
  player_1_id: 1,
  player_1b_id: null,
  player_2_id: 2,
  player_2b_id: null,
  player_1_score: 5,
  player_2_score: 3,
  ...over,
});

describe("sideOf", () => {
  it("finds them on either side", () => {
    expect(sideOf(game(), new Set([1]))).toBe(1);
    expect(sideOf(game(), new Set([2]))).toBe(2);
  });

  it("counts a doubles partner's seat", () => {
    expect(sideOf(game({ player_2b_id: 9 }), new Set([9]))).toBe(2);
  });

  it("returns null for a game that is not theirs", () => {
    expect(sideOf(game(), new Set([7]))).toBeNull();
  });
});

describe("playerRecord", () => {
  it("counts wins from whichever side they were on", () => {
    const record = playerRecord(
      [
        game(), // 1 beats 2
        game({ player_1_score: 2, player_2_score: 5 }), // 2 beats 1
        game({ player_1_id: 7, player_2_id: 8 }), // neither
      ],
      new Set([1]),
    );

    expect(record).toEqual({ played: 2, won: 1, winRate: 50 });
  });

  it("adds up one person's rows across their clubs", () => {
    // The same human, two clubs, two player ids.
    const record = playerRecord(
      [game(), game({ player_1_id: 42, player_2_id: 8 })],
      new Set([1, 42]),
    );

    expect(record.played).toBe(2);
    expect(record.won).toBe(2);
  });

  it("gives somebody who has never played a rate of zero, not NaN", () => {
    expect(playerRecord([], new Set([1]))).toEqual({
      played: 0,
      won: 0,
      winRate: 0,
    });
  });
});
