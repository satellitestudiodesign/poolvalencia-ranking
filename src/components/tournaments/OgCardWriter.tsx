import { useEffect } from "react";
import type { Places } from "@/libs/algorithms/bracket";
import { ogCardPath, resultCardSpec } from "@/libs/algorithms/resultCard";
import { drawResultCard } from "@/libs/browser/resultCard";
import { getSupabase } from "@/libs/supabase";
import { CLUB_PHOTOS_BUCKET } from "@/queries/clubPhotos";
import type { Club } from "@/types";

/** Once per tournament per session. Members reopening a finished tournament all
 *  day would otherwise each re-upload the same picture. */
const written = new Set<number>();

/**
 * Draws the tournament's link-preview card and puts it where
 * `/api/og/tournaments/<id>.png` can find it. Renders nothing.
 *
 * This runs in a member's browser rather than on the server because the card is
 * drawn with canvas and real fonts — rendering it server-side would mean a
 * rasteriser and a font pipeline in the SSR function to produce the picture the
 * device already draws for the share sheet (see libs/browser/resultCard.ts).
 * The cost is that the card appears shortly after the tournament finishes,
 * when an admin first opens it, not at the instant the last result is filed.
 * Until then the route serves the app's default card, so a link shared in the
 * meantime still previews.
 *
 * A card is written once and never rewritten: correcting a name afterwards
 * leaves the old card in place. Refreshing it means deleting the object first
 * (admins may) — worth doing the day somebody asks, not before.
 */
export default function OgCardWriter({
  tournamentId,
  club,
  canWrite,
  title,
  subtitle,
  places,
  nameOf,
}: {
  tournamentId: number;
  club: Pick<
    Club,
    "id" | "name" | "slug" | "theme_color" | "logo_url" | "is_public"
  >;
  /** Whether this viewer may write to the club's folder. The storage policy is
   *  "Club admins can add photos", so for anybody else the upload is a round
   *  trip that can only fail. */
  canWrite: boolean;
  title: string;
  subtitle: string | null;
  places: Places;
  nameOf: (playerId: number) => string;
}) {
  useEffect(() => {
    // A private club's card would sit in a public bucket. Nothing else about
    // this page is reachable by a stranger either, so there is no card to draw.
    if (!canWrite || !club.is_public || written.has(tournamentId)) return;
    // Marked before the attempt, and left marked if it fails: whoever is not
    // allowed to write is not going to become allowed by trying again on the
    // next render.
    written.add(tournamentId);

    void (async () => {
      try {
        const spec = resultCardSpec({
          club: club.name,
          clubSlug: club.slug,
          title,
          subtitle,
          places,
          nameOf,
          origin: window.location.origin,
        });
        const blob = await drawResultCard(spec, {
          color: club.theme_color,
          logoUrl: club.logo_url,
          // 1.91:1 — what every preview crops to.
          size: "wide",
        });
        // Insert, not upsert. `club-photos` has INSERT and DELETE policies for
        // club admins and no UPDATE policy at all (checked against the live
        // database — storage policies are not in sql/schema.sql), so an upsert
        // over an existing card is refused. A card that is already there is
        // the card we were about to draw, so the duplicate is the success case.
        const { error } = await getSupabase()
          .storage.from(CLUB_PHOTOS_BUCKET)
          .upload(ogCardPath(club.id, tournamentId), blob, {
            contentType: "image/png",
          });
        if (error) throw error;
      } catch {
        // Storage refused, or there is no bucket on this checkout. Nothing on
        // screen depends on the card, and the route it feeds has its own
        // fallback, so this stays silent rather than toasting at a member who
        // did not ask for it.
      }
    })();
  }, [tournamentId, club, canWrite, title, subtitle, places, nameOf]);

  return null;
}
