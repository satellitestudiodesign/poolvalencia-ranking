import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/libs/supabase/server";
import { ogCardPath } from "@/libs/algorithms/resultCard";
import { CLUB_PHOTOS_BUCKET } from "@/queries/clubPhotos";

/** Long enough that a crawler re-fetching the same link is served from the
 *  edge, short enough that a card redrawn after a correction is picked up the
 *  same day. Preview caches are their own thing and honour neither. */
const CACHE = "public, max-age=3600";

/**
 * A tournament's link-preview image: its podium if one has been drawn, and the
 * app's default card if not.
 *
 * The indirection is the point. `og:image` has to be a URL that answers on the
 * first request a crawler makes, and the podium PNG is written by a member's
 * browser some time after the tournament finishes (see
 * pages/app/TournamentPage.tsx). Pointing the meta tag straight at storage
 * would mean a 404 — and a preview with no image at all — for every tournament
 * whose card has not been drawn yet. This route decides at fetch time instead.
 *
 * Read through the anon-facing client, so a private club's tournament falls
 * back like anything else: the card is only ever drawn for public clubs, and
 * the bucket is public, so nothing here can leak a club that opted out.
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

        const supabase = getSupabaseServer();
        const { data: tournament } = await supabase
          .from("tournaments")
          .select("club_id")
          .eq("id", id)
          .maybeSingle();
        if (!tournament) return fallback();

        const { data } = supabase.storage
          .from(CLUB_PHOTOS_BUCKET)
          .getPublicUrl(ogCardPath(tournament.club_id, id));

        const card = await fetch(data.publicUrl);
        if (!card.ok) return fallback();

        return new Response(card.body, {
          headers: { "content-type": "image/png", "cache-control": CACHE },
        });
      },
    },
  },
});
