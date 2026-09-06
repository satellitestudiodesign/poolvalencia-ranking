import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETUP,
  balanceDoubles,
  byWait,
  clampRace,
  decodeSetup,
  encodeSetup,
  pairKey,
  seatsNeeded,
  suggestGroups,
  waitingSince,
} from "./today";

describe("encodeSetup / decodeSetup", () => {
  it("round-trips, which is what the cookie is for", () => {
    const doubles = {
      mode: "doubles" as const,
      discipline: "8ball" as const,
      raceTo: 7,
    };
    expect(encodeSetup(doubles)).toBe("doubles:8ball:7");
    expect(decodeSetup(encodeSetup(doubles))).toEqual(doubles);
  });

  it("defaults when nothing is set yet, which is every club's first night", () => {
    expect(decodeSetup(null)).toEqual(DEFAULT_SETUP);
  });

  it("falls back per-field rather than taking the page down, since a cookie is text a person can edit", () => {
    expect(decodeSetup("nonsense")).toEqual(DEFAULT_SETUP);
    expect(decodeSetup("doubles:snooker:5")).toEqual({
      ...DEFAULT_SETUP,
      mode: "doubles",
    });
    expect(decodeSetup("single:9ball:0").raceTo).toBe(DEFAULT_SETUP.raceTo);
    expect(decodeSetup("single:9ball:900").raceTo).toBe(DEFAULT_SETUP.raceTo);
    expect(decodeSetup("single:9ball:2.5").raceTo).toBe(DEFAULT_SETUP.raceTo);
  });
});

describe("clampRace", () => {
  it("clamps to the 1-50 range", () => {
    expect(clampRace(0)).toBe(1);
    expect(clampRace(99)).toBe(50);
    expect(clampRace(7)).toBe(7);
  });
});

describe("seatsNeeded", () => {
  it("needs four names before a doubles suggestion is one", () => {
    expect(seatsNeeded(DEFAULT_SETUP)).toBe(2);
    expect(seatsNeeded({ ...DEFAULT_SETUP, mode: "doubles" })).toBe(4);
  });
});

describe("waitingSince / byWait — the queue's order", () => {
  const at = (iso: string) => Date.parse(iso);
  const arrived = (id: number, iso: string | null) => ({
    id,
    present_since: iso,
  });
  const order = (
    players: ReturnType<typeof arrived>[],
    last: [number, string][],
  ) =>
    [...players]
      .sort(byWait(new Map(last.map(([id, iso]) => [id, at(iso)]))))
      .map((p) => p.id);

  it("orders by how long somebody has waited, not by how many games they have had", () => {
    // Ana arrived first but played until half past; Bea arrived later and has
    // not played. Bea has been waiting the longest and the table is hers.
    const ana = arrived(1, "2026-09-06T18:00:00Z");
    const bea = arrived(2, "2026-09-06T18:20:00Z");
    expect(order([ana, bea], [[1, "2026-09-06T18:30:00Z"]])).toEqual([2, 1]);
  });

  it("treats somebody who has not played as having waited since they arrived", () => {
    const ana = arrived(1, "2026-09-06T18:00:00Z");
    const bea = arrived(2, "2026-09-06T18:20:00Z");
    expect(order([bea, ana], [])).toEqual([1, 2]);
  });

  it("sorts a browser check-in against a Postgres timestamp", () => {
    // present_since is written by the browser as `...Z`; played_at comes back
    // with a `+00:00`. Compared as strings these two sort the wrong way round.
    expect(
      waitingSince(arrived(1, "2026-09-06T18:00:00.000Z"), undefined),
    ).toBe(waitingSince(arrived(1, "2026-09-06T18:00:00+00:00"), undefined));
  });

  it("takes the later of arriving and finishing, not whichever was written last", () => {
    // Checked in at six, played at eight: the wait started at eight.
    const ana = arrived(1, "2026-09-06T18:00:00Z");
    expect(waitingSince(ana, at("2026-09-06T20:00:00Z"))).toBe(
      at("2026-09-06T20:00:00Z"),
    );
    // And a stale game from before the check-in does not drag them backwards.
    const bea = arrived(2, "2026-09-06T20:00:00Z");
    expect(waitingSince(bea, at("2026-09-06T18:00:00Z"))).toBe(
      at("2026-09-06T20:00:00Z"),
    );
  });

  it("puts somebody with no date at all at the head rather than dropping them", () => {
    // A seat at a live table counts as being here with no present_since of its
    // own — see whoIsHere. Such a player must still be sortable.
    expect(
      order([arrived(1, "2026-09-06T18:00:00Z"), arrived(2, null)], []),
    ).toEqual([2, 1]);
  });
});

describe("suggestGroups — who could play whom", () => {
  const p = (id: number) => ({ id });
  const met = (pairs: [number, number][]) => {
    const seen = new Set(pairs.map(([a, b]) => pairKey(a, b)));
    return (a: number, b: number) => seen.has(pairKey(a, b));
  };

  it("has a symmetric pairKey", () => {
    expect(pairKey(2, 1)).toBe(pairKey(1, 2));
  });

  it("deals the two longest waiters one to each table rather than against each other, when nobody has played", () => {
    // The next two arrivals fill them: both of the long waits get a table.
    expect(
      suggestGroups([p(1), p(2), p(3), p(4)], 2, met([])).map((g) =>
        g.map((x) => x.id),
      ),
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it("seeds a rematched pair to different tables so they never meet again while there is another table", () => {
    expect(
      suggestGroups([p(1), p(2), p(3), p(4)], 2, met([[1, 2]])).map((g) =>
        g.map((x) => x.id),
      ),
    ).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });

  it("still offers something rather than nothing when everybody has played everybody", () => {
    expect(
      suggestGroups([p(1), p(2)], 2, met([[1, 2]])).map((g) =>
        g.map((x) => x.id),
      ),
    ).toEqual([[1, 2]]);
  });

  it("requires all four doubles seats to be new to the other three", () => {
    expect(
      suggestGroups(
        [p(1), p(2), p(3), p(4), p(5)],
        4,
        met([
          [1, 2],
          [1, 3],
        ]),
      ).map((g) => g.map((x) => x.id)),
    ).toEqual([[1, 4, 5, 2]]);
  });

  it("does not move the suggestion when somebody checks in far from the head of the queue — the number of matches formed must not depend on how many people are in the room", () => {
    const queue = [p(1), p(2), p(3), p(4), p(5)];
    const before = suggestGroups(queue, 4, met([]), 1);
    const after = suggestGroups(
      [...queue, p(6), p(7), p(8), p(9)],
      4,
      met([]),
      1,
    );
    expect(before.map((g) => g.map((x) => x.id))).toEqual(
      after.map((g) => g.map((x) => x.id)),
    );
    expect(before[0].map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });

  it("returns as many groups as asked for, however many are waiting", () => {
    const queue = [p(1), p(2), p(3), p(4), p(5)];
    expect(suggestGroups(queue, 2, met([]), 1).length).toBe(1);
  });

  /**
   * The property three screens depend on, and the bug that made this test
   * exist: the ranking-night list, each free table's own page and the scoreboard
   * all hand out `groups[i]` to `freeTables[i]`. That is only one answer if they
   * all ask for the same number of groups.
   *
   * Asking for one group is not "the first of asking for three" — seeding takes
   * one player per table before any table is filled, so the count changes the
   * composition. The scoreboard used to ask for 1 and offer it for a table that
   * might be second in the club's order, which handed the same pair to two
   * tablets. Hence useSuggestions owning the count rather than its callers.
   */
  it("changes what the first group is when asked for a different number, which is why the count is not a caller's to choose", () => {
    const queue = [p(1), p(2), p(3), p(4)];
    const ids = (n: number) =>
      suggestGroups(queue, 2, met([]), n).map((g) => g.map((x) => x.id));

    expect(ids(1)).toEqual([[1, 2]]);
    expect(ids(2)).toEqual([
      [1, 3],
      [2, 4],
    ]);
    // The first group differs, so reading index 0 of the wrong request offers a
    // pair that the other table is also being offered.
    expect(ids(1)[0]).not.toEqual(ids(2)[0]);
  });

  it("gives every free table a group of its own, with nobody in two of them", () => {
    const queue = [p(1), p(2), p(3), p(4), p(5), p(6)];
    const groups = suggestGroups(queue, 2, met([]), 3);

    expect(groups.length).toBe(3);
    const seated = groups.flat().map((x) => x.id);
    expect(new Set(seated).size).toBe(seated.length);
  });

  it("does not suggest a doubles match from three people", () => {
    expect(suggestGroups([p(1), p(2), p(3)], 4, met([]))).toEqual([]);
  });

  it("does not rematch the only pair who have played just because everybody ahead of them is already placed", () => {
    const sixth = suggestGroups(
      [p(1), p(2), p(3), p(4), p(5), p(6)],
      2,
      met([[5, 6]]),
    ).map((g) => g.map((x) => x.id));
    expect(sixth.length).toBe(3);
    for (const [a, b] of sixth) {
      expect(
        !(a === 5 && b === 6) && !(a === 6 && b === 5),
        "5 and 6 rematched",
      ).toBe(true);
    }
  });
});

describe("balanceDoubles — levelling the pairs", () => {
  const div = (id: number, category: number) => ({ id, category });

  it("pairs one of each division against one of each, given two firsts and two thirds", () => {
    expect(
      balanceDoubles([div(1, 1), div(2, 1), div(3, 3), div(4, 3)]).map(
        (x) => x.id,
      ),
    ).toEqual([1, 3, 2, 4]);
  });

  it("leaves the queue's own order standing when already level", () => {
    expect(
      balanceDoubles([div(1, 1), div(2, 3), div(3, 2), div(4, 2)]).map(
        (x) => x.id,
      ),
    ).toEqual([1, 2, 3, 4]);
  });

  it("levels two seconds against a first and a third as closely as it can", () => {
    expect(
      balanceDoubles([div(1, 1), div(2, 2), div(3, 2), div(4, 3)]).map(
        (x) => x.id,
      ),
    ).toEqual([1, 4, 2, 3]);
  });

  it("leaves singles, or anything else that is not four, alone", () => {
    expect(balanceDoubles([div(1, 1), div(2, 3)]).map((x) => x.id)).toEqual([
      1, 2,
    ]);
  });
});
