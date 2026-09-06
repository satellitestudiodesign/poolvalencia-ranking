import { createFileRoute } from "@tanstack/react-router";
import { playerCardSpec } from "@/libs/algorithms/cards";
import { playerRecord, type PlayedGame } from "@/libs/algorithms/playerRecord";
import { getSupabaseServer } from "@/libs/supabase/server";
import { PERSON_COLS, PLAYER_COLS } from "@/queries/public/shared";

/** An hour on the visitor's side, a day on the CDN's. A record changes every
 *  time they play, and the meta tag carries a version token for the rest. */
const CACHE = "public, max-age=3600, s-maxage=86400";

/** Enough to be their whole history for anyone short of an obsessive, and a
 *  bound on what one preview can cost. */
const GAMES_LIMIT = 1000;

/** The four seats a person can occupy. A game is theirs if any of their player
 *  rows — one per club — is in any of them. */
const SEATS = [
  "player_1_id",
  "player_2_id",
  "player_1b_id",
  "player_2b_id",
] as const;

/** Spanish, like every public head tag in this app: a crawler's
 *  Accept-Language is not the reader's. */
const LABELS = { played: "Partidas", won: "Ganadas", winRate: "Victorias" };

/** "A", "A y B", "A, B y C" — the same sentence the page's description uses. */
const listed = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;

/**
 * A player's link-preview image: their face, their clubs, their record.
 *
 * Drawn per request and cached, like the other cards — see
 * routes/api/og/tournaments for why nothing is stored.
 */
/** Wide is the link preview's 1.91:1; square is what a phone shares into
 *  WhatsApp and Instagram. One renderer, asked for either — which is what lets
 *  the share button be a fetch rather than a second implementation in the
 *  browser. */
const sizeOf = (url: string): "square" | "wide" =>
  new URL(url).searchParams.get("size") === "square" ? "square" : "wide";

export const Route = createFileRoute("/api/og/players/$slug.png")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () =>
          Response.redirect(new URL("/og/default.png", request.url), 302);

        // The router names the param after the whole segment; the slug is the
        // part before the extension.
        const slug = String(params["slug.png"] ?? "").replace(/\.png$/, "");
        if (!slug) return fallback();

        try {
          const supabase = getSupabaseServer();
          // Only their memberships of public clubs, and only active ones —
          // somebody whose every club is hidden has no public profile, so
          // there is no card to draw either.
          const { data: person } = await supabase
            .from("people")
            .select(
              `${PERSON_COLS}, memberships:players!inner(${PLAYER_COLS}, club:clubs!inner(id, name, logo_url, is_public))`,
            )
            .eq("slug", slug)
            .eq("memberships.status", "active")
            .eq("memberships.club.is_public", true)
            .maybeSingle();

          const memberships = (person?.memberships ?? []) as {
            id: number;
            club: { id: number; name: string; logo_url: string | null };
          }[];
          if (!person || memberships.length === 0) return fallback();

          // Every game any of their player rows appears in, across every club
          // they play in — which is what makes the record cross-club, the same
          // as the page's.
          const mine = memberships.map((membership) => membership.id);
          const { data: games } = await supabase
            .from("games")
            .select(
              "player_1_id, player_1b_id, player_2_id, player_2b_id, player_1_score, player_2_score",
            )
            .in(
              "club_id",
              memberships.map((membership) => membership.club.id),
            )
            .or(SEATS.map((seat) => `${seat}.in.(${mine.join(",")})`).join(","))
            .limit(GAMES_LIMIT);

          const record = playerRecord(
            (games ?? []) as PlayedGame[],
            new Set(mine),
          );

          const origin = new URL(request.url).origin;
          // Imported here, not at the top: the renderer carries three fonts
          // inlined as base64, and no other page's server render should have
          // to parse them.
          const { renderPlayerCardPng } =
            await import("@/libs/server/cardImage");

          const png = await renderPlayerCardPng(
            playerCardSpec({
              name: person.name,
              clubs: listed(memberships.map((m) => m.club.name)),
              stats: [
                { value: String(record.played), label: LABELS.played },
                { value: String(record.won), label: LABELS.won },
                { value: `${record.winRate}%`, label: LABELS.winRate },
              ],
            }),
            {
              // Their face fills the slot a club's logo has on the other
              // cards — on this one they are the subject.
              logoUrl: person.avatar_url,
              markUrl: `${origin}/ball.png`,
              size: sizeOf(request.url),
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
