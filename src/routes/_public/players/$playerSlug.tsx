import { createFileRoute, notFound } from "@tanstack/react-router";
import PublicPlayerPage, {
  PUBLIC_PLAYER_GAMES_LIMIT,
} from "@/pages/public/PublicPlayerPage";
import { gamesQuery } from "@/queries/games";
import { publicClubRosterQuery } from "@/queries/public/clubs";
import { publicPersonQuery } from "@/queries/public/players";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";

export const Route = createFileRoute("/_public/players/$playerSlug")({
  loader: async ({ context, params }) => {
    const person = await context.queryClient.query({
      ...publicPersonQuery(params.playerSlug),
      staleTime: "static",
    });
    // Unknown slug, or every one of their clubs is hidden or their memberships
    // are still pending — all of them are a 404 out here, and for the same
    // reason: none is a public profile.
    if (!person || person.memberships.length === 0) throw notFound();

    // One pair of reads per club they play in. The roster comes along because
    // the games name opponents this page has to label, and the games because
    // the record is computed from them.
    //
    // ponytail: 2N round trips for someone in N clubs, and N is one or two for
    // almost everybody. If a serial multi-club player ever makes this slow, the
    // answer is one RPC returning the merged history, not a cache here.
    await Promise.all(
      person.memberships.flatMap((m) => [
        context.queryClient.query({
          ...publicClubRosterQuery(m.club.id),
          staleTime: "static",
        }),
        context.queryClient.query({
          ...gamesQuery(m.club.id, {
            playerId: m.id,
            pageSize: PUBLIC_PLAYER_GAMES_LIMIT,
          }),
          staleTime: "static",
        }),
      ]),
    );

    return { person, origin: context.origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { person, origin } = loaderData;
    const path = `/players/${person.slug}`;
    const clubs = person.memberships.map((m) => m.club.name);
    return {
      meta: publicMeta({
        title: `${person.name} · PoolClubs`,
        description: clubs.length
          ? `${person.name} juega en ${listed(clubs)}. Historial, porcentaje de victorias y últimas partidas.`
          : `${person.name}: historial, porcentaje de victorias y últimas partidas.`,
        path,
        origin,
        // Their own card — face, clubs, record — drawn on demand. Never
        // person.avatar_url: an uploaded one is a data: URI, which publicMeta
        // drops and no crawler would fetch. `v` is a cache-buster, not a
        // parameter the route reads: see the club route for why.
        image: `/api/og/players/${person.slug}.png?v=${person.memberships.length}`,
        wideImage: true,
        fallback: "players",
      }),
      links: canonical(path, origin),
    };
  },
  component: PublicPlayerPage,
});

/** "A", "A y B", "A, B y C" — a meta description is a sentence. */
function listed(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
