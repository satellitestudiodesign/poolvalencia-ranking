import { createFileRoute } from "@tanstack/react-router";
import ProsePage from "@/pages/public/ProsePage";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";

/**
 * The price, while there isn't one.
 *
 * A club owner looks for this page before looking at the product, and its
 * absence reads as "there is a price and they won't say it". The answer today
 * is free for the beta, and the page says plainly that a per-club fee comes
 * afterwards, announced before it starts. No free-forever promise.
 */
export const Route = createFileRoute("/_public/pricing")({
  head: ({ match }) => ({
    meta: publicMeta({
      title: "Precios · PoolClubs",
      description:
        "Gratis para los clubes durante la beta. Después, una cuota por club y mes, avisada con antelación. Los jugadores no pagan nunca.",
      path: "/pricing",
      origin: match.context.origin,
      fallback: "default",
    }),
    links: canonical("/pricing", match.context.origin),
  }),
  component: () => <ProsePage id="pricing" />,
});
