import { createFileRoute } from "@tanstack/react-router";
import { gameCardSpec, type GameSide } from "@/libs/algorithms/cards";
import { getSupabaseServer } from "@/libs/supabase/server";
import { PERSON_COLS, PLAYER_COLS } from "@/queries/public/shared";
import type { Discipline } from "@/types";

/** A filed result never changes, so this one could cache for a year. It does
 *  not, because a player renaming themselves should not be stuck on every card
 *  they ever appeared on. */
const CACHE = "public, max-age=3600, s-maxage=86400";

/** Spanish, like every public head tag in this app — `head` and these routes
 *  both run outside React, where `t()` is not reachable. */
const DISCIPLINE: Record<Discipline, string> = {
  "8ball": "Bola 8",
  "9ball": "Bola 9",
  "10ball": "Bola 10",
};

const DATE = { day: "numeric", month: "long", year: "numeric" } as const;

/**
 * One result's link-preview image: two sides, two scores.
 *
 * Drawn per request and cached, like the other two cards — see
 * routes/api/og/tournaments for why nothing is stored.
 */
/** Wide is the link preview's 1.91:1; square is what a phone shares into
 *  WhatsApp and Instagram. One renderer, asked for either — which is what lets
 *  the share button be a fetch rather than a second implementation in the
 *  browser. */
const sizeOf = (url: string): "square" | "wide" =>
  new URL(url).searchParams.get("size") === "square" ? "square" : "wide";

export const Route = createFileRoute("/api/og/games/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () =>
          Response.redirect(new URL("/og/default.png", request.url), 302);

        // A splat rather than `$gameId.png`: the router would name that param
        // after the whole segment, extension included, and warn on every boot
        // that "gameId.png" is not an identifier. The URL is the same either
        // way, and the id is the splat with the extension taken off.
        const id = String(params._splat ?? "").replace(/\.png$/, "");
        if (!id) return fallback();

        try {
          const supabase = getSupabaseServer();
          // `!inner` with the is_public filter is what makes a private club's
          // result indistinguishable from one that does not exist.
          const { data: game } = await supabase
            .from("games")
            .select("*, club:clubs!inner(name, logo_url, is_public)")
            .eq("id", id)
            .eq("club.is_public", true)
            .maybeSingle();

          const club = game?.club;
          if (!game || !club) return fallback();

          const seats = [
            [
              game.player_1_id,
              game.mode === "doubles" ? game.player_1b_id : null,
            ],
            [
              game.player_2_id,
              game.mode === "doubles" ? game.player_2b_id : null,
            ],
          ].map((side) => side.filter((seat): seat is number => seat !== null));

          const { data: roster } = await supabase
            .from("players")
            .select(`${PLAYER_COLS}, person:people(${PERSON_COLS})`)
            .in("id", seats.flat());

          const people = new Map(
            (roster ?? []).map((row) => [
              row.id,
              row.person as { name?: string; avatar_url?: string } | null,
            ]),
          );
          const nameOf = (seat: number) => people.get(seat)?.name ?? "—";

          const scores = [game.player_1_score, game.player_2_score];
          const sides = seats.map((side, index) => ({
            names: side.map(nameOf),
            score: scores[index],
            won: scores[index] > scores[1 - index],
          })) as [GameSide, GameSide];

          const origin = new URL(request.url).origin;
          // Imported here, not at the top: the renderer carries three fonts
          // inlined as base64, and no other page's server render should have
          // to parse them.
          const { renderGameCardPng } = await import("@/libs/server/cardImage");

          const png = await renderGameCardPng(
            gameCardSpec({
              club: club.name,
              subtitle: [
                DISCIPLINE[game.discipline],
                game.mode === "doubles" ? "Parejas" : "Individual",
                new Intl.DateTimeFormat("es-ES", DATE).format(
                  new Date(game.played_at),
                ),
              ].join(" · "),
              sides,
            }),
            {
              logoUrl: club.logo_url,
              markUrl: `${origin}/ball.png`,
              size: sizeOf(request.url),
              avatarUrls: seats.map((side) =>
                side.map((seat) => people.get(seat)?.avatar_url),
              ),
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
