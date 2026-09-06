import { createFileRoute } from "@tanstack/react-router";
import { clubCardSpec } from "@/libs/algorithms/cards";
import { orderPhotos } from "@/libs/algorithms/photoOrder";
import { clubPhotoFolder } from "@/libs/browser/photoImage";
import { CLUB_PHOTOS_BUCKET } from "@/queries/clubPhotos";
import { getSupabaseServer } from "@/libs/supabase/server";
import { PERSON_COLS, PLAYER_COLS } from "@/queries/public/shared";

/** An hour on the visitor's side, a day on the CDN's. A club's card changes
 *  when somebody joins, which is not often and never urgently. */
const CACHE = "public, max-age=3600, s-maxage=86400";

/** How many faces the pile holds before it stops earning its width. */
const FACES = 8;

/** Spanish, like every public head tag in this app: a crawler's
 *  Accept-Language is not the reader's. */
const players = (n: number) => `${n} ${n === 1 ? "jugador" : "jugadores"}`;

/**
 * A club's link-preview image: its room behind it, its name, where it is, and
 * who plays there.
 *
 * Drawn per request and cached, like the tournament card beside it — see
 * routes/api/og/tournaments for why nothing is stored.
 *
 * No extension on this route, unlike the other two: what comes back is a JPEG
 * for a club that has published a photograph of its room and a PNG for one that
 * has not, and a URL ending ".png" that answers with a JPEG is a lie worth not
 * telling. Crawlers read the content type, not the path.
 */
/** Wide is the link preview's 1.91:1; square is what a phone shares into
 *  WhatsApp and Instagram. One renderer, asked for either — which is what lets
 *  the share button be a fetch rather than a second implementation in the
 *  browser. */
const sizeOf = (url: string): "square" | "wide" =>
  new URL(url).searchParams.get("size") === "square" ? "square" : "wide";

export const Route = createFileRoute("/api/og/clubs/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const fallback = () =>
          Response.redirect(new URL("/og/default.png", request.url), 302);

        const slug = params.slug;
        if (!slug) return fallback();

        try {
          const supabase = getSupabaseServer();
          const { data: club } = await supabase
            .from("clubs")
            .select(
              "id, name, city, country, logo_url, member_count, photo_order",
            )
            .eq("slug", slug)
            .eq("is_public", true)
            .maybeSingle();
          if (!club) return fallback();

          const { data: roster } = await supabase
            .from("players")
            .select(`${PLAYER_COLS}, person:people(${PERSON_COLS})`)
            .eq("club_id", club.id)
            .eq("status", "active");

          // Only the people who chose to be listed, photographs first — the
          // same order and the same opt-out the club's own page applies.
          const people = (roster ?? [])
            .map(
              (row) =>
                row.person as {
                  name: string;
                  avatar_url: string | null;
                  is_public: boolean;
                } | null,
            )
            .filter((person) => person?.is_public)
            .sort((a, b) => Number(!!b?.avatar_url) - Number(!!a?.avatar_url))
            .slice(0, FACES)
            .map((person) => ({
              name: person?.name ?? "",
              avatarUrl: person?.avatar_url,
            }));

          // The club's own photograph of the room, behind the card. Same
          // source, same order and the same first pick as the hero on its
          // public page: the bucket is the list, and photo_order is what the
          // club dragged them into.
          const bucket = supabase.storage.from(CLUB_PHOTOS_BUCKET);
          const { data: objects } = await bucket.list(
            clubPhotoFolder(club.id),
            { limit: 8, sortBy: { column: "name", order: "asc" } },
          );
          const photos = (objects ?? [])
            .filter((object) => object.id !== null)
            .map((object) => ({
              path: `${clubPhotoFolder(club.id)}/${object.name}`,
            }));
          const cover = orderPhotos(photos, club.photo_order)[0];

          const origin = new URL(request.url).origin;
          // Imported here, not at the top: the renderer carries three fonts
          // inlined as base64, and no other page's server render should have
          // to parse them.
          const { renderClubCard } = await import("@/libs/server/cardImage");

          const card = await renderClubCard(
            clubCardSpec({
              name: club.name,
              // The city if there is one, the country only when there is not:
              // "Valencia · ES" reads as a form field, "Valencia" as a place.
              place: club.city || club.country,
              stat: players(club.member_count),
            }),
            {
              logoUrl: club.logo_url,
              markUrl: `${origin}/ball.png`,
              size: sizeOf(request.url),
              coverUrl: cover
                ? bucket.getPublicUrl(cover.path).data.publicUrl
                : null,
              people,
            },
          );

          // The type is whatever the renderer chose: a club with a photograph
          // of its room comes back as JPEG, one without as PNG.
          return new Response(card.bytes, {
            headers: {
              "content-type": card.contentType,
              "cache-control": CACHE,
            },
          });
        } catch {
          return fallback();
        }
      },
    },
  },
});
