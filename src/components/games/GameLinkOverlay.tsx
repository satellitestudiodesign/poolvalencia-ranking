import { Link, useParams } from "@tanstack/react-router";
import { useT } from "@/i18n";

/**
 * The way into a result's own page, laid over the whole row it sits in.
 *
 * Absolute rather than wrapping, for the same reason as the tape's rows: the
 * names inside a fixture are interactive in their own right — a link to the
 * person inside the club, a highlighter on a tournament page — and neither a
 * link nor a button nests inside a link. Anything that must stay tappable sits
 * above this on the z axis (`relative` is enough, since a positioned sibling
 * paints over a positioned one that came before it).
 *
 * Which page is settled from the route, like PlayerLink: inside a club a result
 * has the club's own page. Out on the public side it has /clubs/$slug/game/...,
 * and there the slug has to be handed in — a public tournament's URL is keyed
 * on the tournament, so it carries no club.
 */
export default function GameLinkOverlay({
  gameId,
  clubSlug,
}: {
  gameId: string;
  /** The club's slug, for the public side. Without it there is nowhere to
   *  point out there, and the row stays a plain fact. */
  clubSlug?: string;
}) {
  const { t } = useT();
  const { clubSlug: appClub } = useParams({ strict: false });

  const className = "absolute inset-0 rounded-control";
  const label = t("games.openResult");

  if (appClub) {
    return (
      <Link
        to="/app/$clubSlug/games/$gameId"
        params={{ clubSlug: appClub, gameId }}
        aria-label={label}
        className={className}
      />
    );
  }

  if (!clubSlug) return null;

  return (
    <Link
      to="/clubs/$slug/game/$gameId"
      params={{ slug: clubSlug, gameId }}
      aria-label={label}
      className={className}
    />
  );
}
