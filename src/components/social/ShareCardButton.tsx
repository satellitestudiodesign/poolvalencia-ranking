import { useState } from "react";
import { LuShare2 } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";

/**
 * Share this page as a picture.
 *
 * The card comes from the same route that draws the link preview, asked for its
 * square shape — which is what a phone posts to WhatsApp and Instagram. It used
 * to be drawn here on a canvas instead, and that was a second implementation of
 * the same layout with a limitation the server has not got: an avatar hosted at
 * an identity provider is cross-origin, and drawing one taints a canvas so that
 * toBlob throws and there is no card at all. Fetching a rendered PNG has no
 * such problem, and the picture a club shares is now byte-identical to the one
 * a stranger sees in a preview.
 *
 * The trade is that this needs the network, where the canvas did not. A card is
 * shared from a club with wifi, and a failure toasts rather than breaking the
 * page.
 */
export default function ShareCardButton({
  url,
  fileName,
  title,
}: {
  /** The card route, without a size — this asks for the square one. */
  url: string;
  /** What the picture is called in the share sheet and the camera roll. */
  fileName: string;
  title: string;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const separator = url.includes("?") ? "&" : "?";
      const response = await fetch(`${url}${separator}size=square`);
      if (!response.ok) throw new Error(String(response.status));

      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }

      // Most desktops have no share sheet. A download says what happened, so
      // it toasts; a share sheet speaks for itself.
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
      toast.success(t("tournaments.cardSaved"));
    } catch (err) {
      // Dismissing the share sheet is a decision, not a failure.
      if (err instanceof Error && err.name === "AbortError") return;
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
