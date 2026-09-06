import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServer } from "@/libs/supabase/server";
import { DRILLS_ENABLED } from "@/libs/algorithms/features";

/**
 * The sitemap, built per request from what is actually public.
 *
 * A server route rather than a build step, because the set of public clubs and
 * players changes without a deploy — a club opting out has to disappear from
 * here, and a file baked at build time would keep advertising it. Cached for an
 * hour at the edge, which is far more often than a crawler asks.
 *
 * The filename is `sitemap[.]xml.ts`: the brackets escape the dot so the router
 * treats it as one literal segment instead of a `.xml` extension on a `sitemap`
 * route.
 *
 * Read with the server client so the anon policies apply — the sitemap is a list
 * of URLs a stranger can open, so it must be built by something that can only
 * see what a stranger sees. No club-owned drills, for the same reason.
 *
 * Not the per-result pages under /clubs/:slug/game/:id. There is one for every
 * frame every club has ever filed — tens of thousands and growing daily, each a
 * scoreline between two people — and a sitemap that is 95% of those buries the
 * clubs, players and tournaments a crawler should actually be spending its
 * budget on. They stay linked from each club's results tab, which is how a
 * crawler finds the ones worth having.
 *
 * The players query filters is_public even though the policy does not: an
 * unlisted profile is still reachable (a name in a result links to it), it is
 * just never advertised, and a sitemap is the most explicit advertising there is.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const supabase = getSupabaseServer();

        const [clubs, people, tournaments, drills] = await Promise.all([
          supabase
            .from("clubs")
            .select("slug")
            .eq("is_public", true)
            .order("member_count", { ascending: false })
            .limit(MAX_PER_KIND),
          // people, not players: one URL per person, which is what the public
          // profile is keyed on now. The status filter moves onto the embed and
          // !inner is what makes it drop somebody with no active membership
          // rather than return them with an empty array.
          supabase
            .from("people")
            .select("slug, players!inner(id)")
            .eq("is_public", true)
            .eq("players.status", "active")
            .order("slug")
            .limit(MAX_PER_KIND),
          supabase
            .from("tournaments")
            .select("id")
            .order("created_at", { ascending: false })
            .limit(MAX_PER_KIND),
          supabase
            .from("drills")
            .select("id")
            .is("club_id", null)
            .order("id")
            .limit(MAX_PER_KIND),
        ]);

        const paths = [
          "/",
          "/clubs",
          "/players",
          "/tournaments",
          // /drills and every drill page are hidden for now (libs/features), and
          // the routes answer 404 — listing them would only earn crawl errors.
          ...(DRILLS_ENABLED ? ["/drills"] : []),
          // The prose pages. Static, so they need no query — but they do need
          // listing: /pricing is the page a club owner looks for by name.
          "/pricing",
          "/about",
          "/contact",
          "/legal/privacy",
          "/legal/terms",
          "/legal/aviso-legal",
          ...(clubs.data ?? []).map((c) => `/clubs/${c.slug}`),
          ...(people.data ?? []).map((p) => `/players/${p.slug}`),
          ...(tournaments.data ?? []).map((x) => `/tournaments/${x.id}`),
          ...(DRILLS_ENABLED
            ? (drills.data ?? []).map((d) => `/drills/${d.id}`)
            : []),
        ];

        const body =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          paths
            .map(
              (path) => `  <url><loc>${origin}${escapeXml(path)}</loc></url>`,
            )
            .join("\n") +
          "\n</urlset>\n";

        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

/**
 * A sitemap may hold 50,000 URLs; this stops well short of that per kind so the
 * response stays one page and one query each. If a kind ever reaches it the
 * overflow is simply not listed — crawlers still reach those pages by following
 * links from the directories, they just find them later.
 */
const MAX_PER_KIND = 2000;

/** Slugs are [a-z0-9-] by CHECK constraint and ids are numbers, so nothing here
 *  can currently need escaping. Done anyway: the day a path is built from
 *  something freer, a raw `&` is a malformed sitemap and nothing says so. */
const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
