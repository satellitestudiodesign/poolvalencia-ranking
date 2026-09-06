import { createFileRoute, notFound } from "@tanstack/react-router";
import PublicGamePage from "@/pages/public/PublicGamePage";
import { publicClubQuery } from "@/queries/public/clubs";
import { publicGameQuery } from "@/queries/public/games";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";

/**
 * One result, linkable. `game/` rather than under the `games` tab so the tab
 * stays a leaf: making it a layout would mean the tape rendering above every
 * single result.
 *
 * The club is already in the cache — the parent loader put it there — so this
 * reads it rather than fetching it again, the same as the tab beside it.
 *
 * A game whose club is not the one in the URL is a 404 rather than a redirect:
 * the id is a uuid nobody guesses, and the two ways to arrive at that state are
 * a typo and someone probing.
 */
export const Route = createFileRoute("/_public/clubs/$slug/game/$gameId")({
  loader: async ({ context, params }) => {
    const [club, result] = await Promise.all([
      context.queryClient.query({
        ...publicClubQuery(params.slug),
        staleTime: "static",
      }),
      context.queryClient.query({
        ...publicGameQuery(params.gameId),
        staleTime: "static",
      }),
    ]);
    if (!club || !result || result.game.club_id !== club.id) throw notFound();

    return { club, ...result, origin: context.origin };
  },

  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { club, game, origin } = loaderData;
    const path = `/clubs/${club.slug}/game/${game.id}`;
    // Prose in Spanish, like every other public head: `head` runs outside React
    // and cannot reach the dictionary. The score is the title because that is
    // what a result is — names would need the roster, which the head does not
    // have and would be a second query to get.
    const score = `${game.player_1_score}-${game.player_2_score}`;
    return {
      meta: publicMeta({
        title: `${score} · ${club.name} · PoolClubs`,
        description: `Resultado ${score} en ${club.name}. Marcador, jugadores y torneo.`,
        path,
        origin,
        image: club.logo_url ? `/api/clubs/${club.slug}/logo` : null,
        fallback: "clubs",
      }),
      links: canonical(path, origin),
    };
  },

  component: PublicGamePage,
});
