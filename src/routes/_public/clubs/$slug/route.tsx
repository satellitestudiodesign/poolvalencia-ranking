import { createFileRoute, notFound } from "@tanstack/react-router";
import PublicClubPage from "@/pages/public/PublicClubPage";
import {
  publicClubUnclaimedQuery,
  publicClubQuery,
  publicClubRosterQuery,
} from "@/queries/public/clubs";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";

/**
 * A club's public profile: a shared hero, with the four things there are to
 * say about a club — what it is, what is on, who plays
 * there, what they have played — as four sub-routes under it.
 *
 * The loader *returns* the club rather than only priming the cache, because
 * `head` is handed `loaderData` and nothing else it could read a name from — an
 * og:title has to be in the first response for a crawler, so it cannot wait for
 * a component to render.
 */
export const Route = createFileRoute("/_public/clubs/$slug")({
  loader: async ({ context, params }) => {
    // Both by slug and both awaited together: the claim test does not need the
    // club row, so making it wait for one would put two round trips in the way
    // of the first paint instead of one.
    const [club, unclaimed] = await Promise.all([
      context.queryClient.query({
        ...publicClubQuery(params.slug),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...publicClubUnclaimedQuery(params.slug),
        staleTime: "static",
      }),
    ]);
    // No such club, or it opted out. Indistinguishable on purpose: whether a
    // private club exists is itself private.
    if (!club) throw notFound();

    // Only what the frame itself draws: the roster is the hero's face pile, so
    // a page that paints without it paints wrong. Each tab loads its own.
    await context.queryClient.query({
      ...publicClubRosterQuery(club.id),
      staleTime: "static",
    });

    return { club, unclaimed, origin: context.origin };
  },
  head: ({ loaderData }) => {
    // Undefined while the match is pending or errored — the root's own head is
    // the fallback in that case.
    if (!loaderData) return {};
    const { club, origin } = loaderData;
    const path = `/clubs/${club.slug}`;
    return {
      meta: publicMeta({
        title: `${club.name} · PoolClubs`,
        description: `${club.name}: ${club.member_count} miembros, con rankings, resultados de partidas y torneos.`,
        path,
        origin,
        // The club's own card — name, city, the faces of who plays there —
        // drawn on demand by the route below. Never club.logo_url: that column
        // holds a data: URI, which publicMeta drops and no crawler would fetch.
        // The `v` is a cache-buster, not a parameter the route reads: Slack,
        // WhatsApp and Facebook cache a preview image against its URL and may
        // never re-fetch it, so a club that gained a member would keep the old
        // face pile for as long as the link lives. Changing the count changes
        // the URL, and the next scrape gets the new card.
        //
        // It does not catch everything. A club that swaps its cover photograph
        // or its logo, with its roster unchanged, keeps the old card — the
        // cover lives in the storage bucket and finding it here would cost a
        // round trip on every render of this page for a token. If that starts
        // to matter, the fix is a column on `clubs` that the photo mutations
        // touch, not a listing in this loader.
        image: `/api/og/clubs/${club.slug}?v=${club.member_count}-${club.logo_url ? 1 : 0}`,
        wideImage: true,
        fallback: "clubs",
      }),
      links: canonical(path, origin),
    };
  },
  component: PublicClubPage,
});
