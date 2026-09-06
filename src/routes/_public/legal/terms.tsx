import { createFileRoute } from "@tanstack/react-router";
import ProsePage from "@/pages/public/ProsePage";
import { publicMeta, canonical } from "@/libs/algorithms/publicMeta";

/** The rules of the service, including the two promises the pitch makes: 16+
 *  accounts with juniors as guest players, and the beta's free period. */
export const Route = createFileRoute("/_public/legal/terms")({
  head: ({ match }) => ({
    meta: publicMeta({
      title: "Condiciones de uso · PoolClubs",
      description:
        "Quién puede usar PoolClubs, qué esperar del servicio y qué espera el servicio de ti.",
      path: "/legal/terms",
      origin: match.context.origin,
      fallback: "default",
    }),
    links: canonical("/legal/terms", match.context.origin),
  }),
  component: () => <ProsePage id="terms" />,
});
