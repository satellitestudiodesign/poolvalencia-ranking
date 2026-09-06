import { expect, it, vi } from "vitest";
import { Route } from "@/routes/app/_authed/$clubSlug/index";
import { gamesQuery, FEED_PAGE_SIZE } from "@/queries/games";
import { drillsQuery } from "@/queries/drills";
import { myTournamentIdsQuery, tournamentsQuery } from "@/queries/tournaments";
import { challengesQuery } from "@/queries/challenges";

/**
 * The lobby's blocks are SSR'd, and that only holds while the loader primes
 * the same query keys the components read. `pageSize` and the filters object
 * are part of a games key, so a loader asking for the unfiltered list primes
 * a key nobody looks at: the block renders its empty state into the HTML and
 * fills in after hydration, which is what this catches.
 */
it("primes exactly the keys the lobby reads", async () => {
  const primed: unknown[] = [];
  const queryClient = {
    query: vi.fn(async (o: { queryKey: unknown }) => {
      primed.push(o.queryKey);
    }),
  };
  // `loader` is declared as a function or an options object; this one is a
  // function.
  const loader = Route.options.loader as (ctx: unknown) => Promise<void>;
  await loader({
    context: { queryClient, activeClubId: 7, player: { id: 42 } },
  });
  expect(primed).toEqual([
    gamesQuery(7, { pageSize: FEED_PAGE_SIZE }).queryKey,
    tournamentsQuery(7).queryKey,
    challengesQuery(7).queryKey,
    myTournamentIdsQuery(42, 7).queryKey,
    drillsQuery(7).queryKey,
  ]);
});
