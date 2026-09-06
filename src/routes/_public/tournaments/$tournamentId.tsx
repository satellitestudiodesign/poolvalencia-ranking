import { createFileRoute, notFound } from "@tanstack/react-router";
import PublicTournamentPage from "@/pages/public/PublicTournamentPage";
import { publicClubRosterQuery } from "@/queries/public/clubs";
import { publicTournamentQuery } from "@/queries/public/tournaments";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";
import type { TournamentFormat, TournamentStatus } from "@/types";

/**
 * Prose, not the i18n key. FORMAT_KEY maps the column onto "doubleElim" for
 * `t()`, which is the wrong shape for a sentence, and `head` cannot call `t()`
 * anyway — it runs outside React.
 *
 * Which is the honest limit of this file: link previews are Spanish — the app's
 * default language — whatever the visitor's language is. Localising them means
 * reaching the dictionary from outside the provider, and a crawler's
 * Accept-Language is not the reader's.
 */
const FORMAT_PROSE: Record<TournamentFormat, string> = {
  double_elim: "doble eliminación",
  league: "liga",
  group_knockout: "grupos y eliminatoria",
};

/** The entrant count was here instead, and a card cached by a chat app the day
 *  entries opened kept claiming "4 entrants" for the rest of the tournament.
 *  Status goes stale too, but only once per phase and in the safe direction. */
const STATUS_PROSE: Record<TournamentStatus, string> = {
  open: "Inscripciones abiertas",
  groups: "Fase de grupos en juego",
  running: "En juego",
  done: "Finalizado",
};

export const Route = createFileRoute("/_public/tournaments/$tournamentId")({
  loader: async ({ context, params }) => {
    const id = Number(params.tournamentId);
    if (!Number.isInteger(id) || id < 1) throw notFound();

    const tournament = await context.queryClient.query({
      ...publicTournamentQuery(id),
      staleTime: "static",
    });
    if (!tournament) throw notFound();

    // The roster is what turns entrant ids and fixture slots into names. Without
    // it the bracket renders as numbers.
    await context.queryClient.query({
      ...publicClubRosterQuery(tournament.club_id),
      staleTime: "static",
    });

    return { tournament, origin: context.origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { tournament, origin } = loaderData;
    const path = `/tournaments/${tournament.id}`;
    const club = tournament.club?.name;
    return {
      meta: publicMeta({
        title: `${tournament.name} · PoolClubs`,
        description: [
          club && `${club}.`,
          `${STATUS_PROSE[tournament.status]},`,
          `${FORMAT_PROSE[tournament.format]}.`,
          "Cuadro, clasificación y resultados.",
        ]
          .filter(Boolean)
          .join(" "),
        path,
        origin,
        // Never the club's logo_url — that column holds a data: URI, which
        // publicMeta drops and no crawler would fetch anyway. This route hands
        // back the podium card once a member's browser has drawn one, and the
        // app's default card until then.
        image: `/api/og/tournaments/${tournament.id}.png`,
        // 1200x630, whether it is the podium card or the default one the route
        // falls back to. Without this the card previews as a thumbnail.
        wideImage: true,
        fallback: "tournaments",
      }),
      links: canonical(path, origin),
    };
  },
  component: PublicTournamentPage,
});
