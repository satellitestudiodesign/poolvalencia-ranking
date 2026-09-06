import { useState } from "react";
import { LuShare2 } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";
import type { Places } from "@/libs/algorithms/bracket";
import { resultCardSpec } from "@/libs/algorithms/resultCard";
import { drawResultCard, shareResultCard } from "@/libs/browser/resultCard";
import type { Club } from "@/types";

/**
 * The one button that turns a finished tournament into something a club can
 * post. Draws the card only when it is pressed — nobody opening the page needs
 * a megabyte of canvas.
 */
export default function ShareResultButton({
  club,
  title,
  subtitle,
  places,
  nameOf,
}: {
  club: Pick<Club, "name" | "slug" | "theme_color" | "logo_url">;
  title: string;
  /** The dates line, or null for a tournament nobody dated. */
  subtitle: string | null;
  places: Places;
  nameOf: (playerId: number) => string;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
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
      });
      // A share sheet says what happened by itself; a silent download does not.
      if ((await shareResultCard(blob, spec)) === "saved")
        toast.success(t("tournaments.cardSaved"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={share} disabled={busy}>
      <LuShare2 className="h-4 w-4" aria-hidden />
      {t("tournaments.shareCard")}
    </Button>
  );
}
