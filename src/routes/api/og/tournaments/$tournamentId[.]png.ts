import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/libs/supabase/server";
import { resolveBracket, tournamentPodium } from "@/libs/algorithms/bracket";
import { eventDates } from "@/libs/algorithms/eventDates";
import { resultCardSpec } from "@/libs/algorithms/resultCard";
import { PERSON_COLS, PLAYER_COLS } from "@/queries/public/shared";
import type { TournamentMatch } from "@/types";

/** An hour on the visitor's side, a day on the CDN's: the picture only changes
 *  when the tournament does, and a preview cache holds it far longer than
 *  either anyway. */
const CACHE = "public, max-age=3600, s-maxage=86400";

/** Link previews are Spanish, like every other public head tag in this app —
 *  the crawler's Accept-Language is not the reader's. */
const LOCALE = "es-ES";

/**
 * A tournament's link-preview image: the podium, drawn on demand.
 *
 * Rendered here rather than written by a browser and stored, which is what this
 * route used to serve. Storing it meant the card only existed once a club admin
 * had opened the finished tournament, that nobody else could produce one, and
 * that a correction afterwards left the old picture in place. Drawing it per
 * request costs ~100ms once and then sits in the CDN — see
 * libs/server/cardImage.ts for why that is possible without a native or wasm
 * rasteriser.
 *
 * Anything at all going wrong falls back to the app's default card: a link that
 * previews the wrong picture is a disappointment, a link that previews a broken
 * image is a bug.
 */
export const Route = createFileRoute("/api/og/tournaments/$tournamentId.png")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () =>
          Response.redirect(new URL("/og/default.png", request.url), 302);

        // The route file is `$tournamentId[.]png`, and the router names the
        // param after the whole segment. Strip the extension if it came
        // through in the value too — either way what is wanted is the id.
        const id = Number(
          String(params["tournamentId.png"] ?? "").replace(/\.png$/, ""),
        );
        if (!Number.isInteger(id)) return fallback();

        try {
          const supabase = getSupabaseServer();

          // `!inner` with the is_public filter is what makes a private club's
          // tournament indistinguishable from one that does not exist — the
          // same rule the public page itself is built on.
          const { data: tournament } = await supabase
            .from("tournaments")
            .select(
              `id, name, format, starts_on, ends_on, status,
                 club:clubs!inner(name, slug, logo_url, theme_color, is_public),
                 tournament_players(player_id),
                 tournament_matches(*)`,
            )
            .eq("id", id)
            .eq("club.is_public", true)
            .maybeSingle();

          const club = tournament?.club;
          if (!tournament || !club) return fallback();

          const matches = resolveBracket(
            (tournament.tournament_matches ?? []) as TournamentMatch[],
          );
          const places = tournamentPodium(
            tournament.format as "double_elim" | "league" | "group_knockout",
            (tournament.tournament_players ?? []).map((e) => e.player_id),
            matches,
          );
          // Nothing decided yet: a card whose podium is three dashes says
          // less than the default one.
          if (places.first === null) return fallback();

          const ids = [places.first, places.second, ...places.third].filter(
            (playerId): playerId is number => playerId !== null,
          );
          const { data: roster } = await supabase
            .from("players")
            .select(`${PLAYER_COLS}, person:people(${PERSON_COLS})`)
            .in("id", ids);

          const names = new Map(
            (roster ?? []).map((row) => [
              row.id,
              (row.person as { name?: string } | null)?.name ?? "—",
            ]),
          );

          const origin = new URL(request.url).origin;
          // Imported here, not at the top: the renderer carries five fonts
          // inlined as base64, and that is 300kB no other page's server
          // render should have to parse.
          const { renderResultCardPng } =
            await import("@/libs/server/cardImage");
          const png = await renderResultCardPng(
            resultCardSpec({
              club: club.name,
              clubSlug: club.slug,
              title: tournament.name,
              subtitle: eventDates(
                tournament.starts_on,
                tournament.ends_on,
                LOCALE,
              ),
              places,
              nameOf: (playerId) => names.get(playerId) ?? "—",
              origin,
            }),
            {
              color: club.theme_color,
              logoUrl: club.logo_url,
              markUrl: `${origin}/ball.png`,
            },
          );

          return new Response(png, {
            headers: { "content-type": "image/png", "cache-control": CACHE },
          });
        } catch {
          return fallback();
        }
      },
    },
  },
});
