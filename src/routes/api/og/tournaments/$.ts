import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/libs/supabase/server";
import { resolveBracket, tournamentPodium } from "@/libs/algorithms/bracket";
import { eventDates } from "@/libs/algorithms/eventDates";
import {
  clubCardSpec,
  podiumIds,
  resultCardSpec,
} from "@/libs/algorithms/cards";
import { STATUS_PROSE } from "@/libs/algorithms/tournamentProse";
import { PERSON_COLS, PLAYER_COLS } from "@/queries/public/shared";
import type { TournamentMatch, TournamentStatus } from "@/types";

/** An hour on the visitor's side, a day on the CDN's: the picture only changes
 *  when the tournament does, and a preview cache holds it far longer than
 *  either anyway. */
const CACHE = "public, max-age=3600, s-maxage=86400";

/** Link previews are Spanish, like every other public head tag in this app —
 *  the crawler's Accept-Language is not the reader's. */
const LOCALE = "es-ES";

/**
 * A tournament's link-preview image: the podium once there is one, and what
 * phase it is in until then.
 *
 * The podium used to be the only card, drawn from whatever `tournamentPodium`
 * returned — and for a league it returns a leader the moment there are
 * entrants, so a tournament whose entries had only just opened previewed as
 * three people on a podium they had not stood on. `status` decides now: only a
 * finished tournament gets a podium, and the rest get their name, their dates
 * and where they stand.
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
/** Wide is the link preview's 1.91:1; square is what a phone shares into
 *  WhatsApp and Instagram. One renderer, asked for either — which is what lets
 *  the share button be a fetch rather than a second implementation in the
 *  browser. */
const sizeOf = (url: string): "square" | "wide" =>
  new URL(url).searchParams.get("size") === "square" ? "square" : "wide";

export const Route = createFileRoute("/api/og/tournaments/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () =>
          Response.redirect(new URL("/og/default.png", request.url), 302);

        // A splat rather than `$tournamentId.png`: the router would name that
        // param after the whole segment, extension included, and warn on every
        // boot that "tournamentId.png" is not an identifier. The URL is the
        // same either way, and the id is the splat with the extension off.
        const id = Number(String(params._splat ?? "").replace(/\.png$/, ""));
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
                 club:clubs!inner(name, slug, logo_url, is_public),
                 tournament_players(player_id),
                 tournament_matches(*)`,
            )
            .eq("id", id)
            .eq("club.is_public", true)
            .maybeSingle();

          const club = tournament?.club;
          if (!tournament || !club) return fallback();

          const origin = new URL(request.url).origin;
          const status = tournament.status as TournamentStatus;
          const dates = eventDates(
            tournament.starts_on,
            tournament.ends_on,
            LOCALE,
          );
          // Imported here, not at the top: the renderer carries three fonts
          // inlined as base64, and no other page's server render should have
          // to parse them.
          const cardImage = await import("@/libs/server/cardImage");
          const chrome = {
            logoUrl: club.logo_url,
            markUrl: `${origin}/ball.png`,
            size: sizeOf(request.url),
          };

          const matches = resolveBracket(
            (tournament.tournament_matches ?? []) as TournamentMatch[],
          );
          const places = tournamentPodium(
            tournament.format as "double_elim" | "league" | "group_knockout",
            (tournament.tournament_players ?? []).map((e) => e.player_id),
            matches,
          );

          // Open, in groups, or still being played — and a finished one whose
          // podium never resolved, which is a tournament with no results
          // rather than one with a winner we failed to find. The club's layout,
          // borrowed: the tournament is the headline, the club the byline, and
          // the phase where a club's member count would be.
          if (status !== "done" || places.first === null) {
            const card = await cardImage.renderClubCard(
              clubCardSpec({
                name: tournament.name,
                place: dates,
                stat: STATUS_PROSE[status],
                club: club.name,
              }),
              chrome,
            );
            return new Response(card.bytes, {
              headers: {
                "content-type": card.contentType,
                "cache-control": CACHE,
              },
            });
          }

          const ids = podiumIds(places);
          const { data: roster } = await supabase
            .from("players")
            .select(`${PLAYER_COLS}, person:people(${PERSON_COLS})`)
            .in("id", ids);

          const people = new Map(
            (roster ?? []).map((row) => [
              row.id,
              row.person as { name?: string; avatar_url?: string } | null,
            ]),
          );

          const png = await cardImage.renderResultCardPng(
            resultCardSpec({
              club: club.name,
              title: tournament.name,
              subtitle: dates,
              places,
              nameOf: (playerId) => people.get(playerId)?.name ?? "—",
            }),
            {
              ...chrome,
              // In podium order, which is what podiumIds is for.
              avatarUrls: ids.map((id) => people.get(id)?.avatar_url),
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
