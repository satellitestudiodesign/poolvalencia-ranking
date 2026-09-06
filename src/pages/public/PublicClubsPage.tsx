import { useState } from "react";
import { cardClasses } from "@/components/ui/cardStyles";
import {
  keepPreviousData,
  useQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { LuMapPin, LuUsers } from "react-icons/lu";
import PublicShell, { CtaBand } from "@/components/layout/PublicShell";
import PublicPageTitle from "@/components/layout/PublicPageTitle";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterGroup, FilterMenu } from "@/components/ui/FilterMenu";
import { FilterPills } from "@/components/ui/FilterPills";
import { Pager } from "@/components/ui/Pager";
import { SearchInput } from "@/components/ui/SearchInput";
import MapView from "@/components/map/MapView";
import { useDebouncedQuery } from "@/hooks/useDebouncedQuery";
import { PUBLIC_PAGE_SIZE } from "@/queries/public/shared";
import {
  publicClubPinsQuery,
  publicClubsQuery,
  type Bbox,
  type PublicClubCard,
  type PublicClubSort,
} from "@/queries/public/clubs";
import { clubPhotosQuery } from "@/queries/clubPhotos";
import { orderPhotos } from "@/libs/algorithms/photoOrder";
import { useT } from "@/i18n";

const route = getRouteApi("/_public/clubs/");

const SORTS: PublicClubSort[] = ["members", "name", "new"];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const isNew = (createdAt: string | null) =>
  createdAt !== null &&
  Date.now() - new Date(createdAt).getTime() < THIRTY_DAYS_MS;

/**
 * The directory. A hero band, one sorted grid, searched by name.
 *
 * No "active this week" rail: that wants a last-played date per club and there is
 * no column for it, so it would be a subquery per card. Sorting by size is the
 * next best answer to "which of these is worth opening", and it costs nothing.
 */
export default function PublicClubsPage() {
  const { t } = useT();
  const search = route.useSearch();
  const navigate = route.useNavigate();

  // Tying the list to the map is off until asked for: arriving at /clubs should
  // show every club, not the handful the default view happens to frame.
  const [tiedToMap, setTiedToMap] = useState(false);
  // Reported by the map on load and on every settle, whether or not it is being
  // used — so ticking the box filters immediately rather than after a nudge.
  const [view, setView] = useState<Bbox | null>(null);
  const bbox = tiedToMap ? (view ?? undefined) : undefined;

  // useQuery, not useSuspenseQuery: the key changes with every pan, and
  // suspending would tear the whole list down and rebuild it each time. The
  // previous page stays on screen while the next one loads instead. The first
  // render asks for the unfiltered key the route loader has already cached, so
  // this is server-rendered all the same.
  const { data } = useQuery({
    ...publicClubsQuery({ ...search, bbox }),
    placeholderData: keepPreviousData,
  });
  // Only before the loader's data is in the cache, which is never in practice —
  // but `useQuery` cannot know that, and an empty page is a better answer than
  // a crash if it ever is.
  const clubs = data?.clubs ?? [];
  const totalCount = data?.totalCount ?? 0;
  // Loaded by the route alongside the directory itself, so the map's frame is in
  // the server's HTML and the grid below it does not move when the pins arrive.
  const { data: pins } = useSuspenseQuery(publicClubPinsQuery());

  // The route validator leaves these off so /clubs does not redirect to its own
  // canonical form; the defaults belong here and in the query factory instead.
  const sort = search.sort ?? "members";
  const page = search.page ?? 1;

  const setSort = (next: PublicClubSort | undefined) =>
    navigate({ search: { ...search, sort: next ?? "members", page: 1 } });

  const setPage = (page: number) => navigate({ search: { ...search, page } });

  // `replace`: typing is one intent, not one history entry per pause.
  const [q, setQ] = useDebouncedQuery(search.q ?? "", (value) =>
    navigate({
      search: { ...search, q: value || undefined, page: 1 },
      replace: true,
    }),
  );

  /**
   * Page 4 of everything is not page 4 of what the map can see, so a change to
   * the filter goes back to the first one.
   *
   * `replace`, because a pan is not a place someone meant to be able to go back
   * to — without it, crossing the country would leave thirty history entries
   * between the visitor and the page they arrived from.
   */
  const firstPage = () => {
    if (page > 1) navigate({ search: { ...search, page: 1 }, replace: true });
  };

  const tieToMap = (on: boolean) => {
    setTiedToMap(on);
    firstPage();
  };

  const onViewChange = (next: Bbox) => {
    setView(next);
    if (tiedToMap) firstPage();
  };

  return (
    <>
      <PublicPageTitle
        title={t("public.publicClubs.title")}
        lede={t("public.publicClubs.subtitle")}
      />

      <PublicShell>
        {/* Two columns from lg up: the filters and the grid on the left, the
            map beside them. One column below that, and no `items-start` on the
            grid — the map column has to stretch to the row's full height, or
            the sticky inside it would have nothing to travel through.

            The map's column grows in steps rather than as a fraction. A
            percentage would keep it a thumbnail on a laptop to stay modest on a
            large screen; the list can take the rest, because a card grid is
            happy to add a column and a map is not happy to be small. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_42rem]">
          {/* Every listed club with coordinates, not just this page of them:
              "which of these is near me" is a different question than the sort
              answers, and it is the one a map is good at.

              First in the markup so that on a phone, where this is one column,
              it is above the grid rather than below two dozen cards. The grid
              places it on the right from lg up. */}
          {pins.length > 0 && (
            <section
              aria-label={t("public.publicClubs.mapTitle")}
              className="mt-8 lg:col-start-2 lg:row-start-1"
            >
              {/* Sticky here rather than on the section: this is the part that
                  holds still while the list beside it is scrolled. */}
              <div className="lg:sticky lg:top-[calc(5rem+env(safe-area-inset-top))]">
                <MapView
                  className="h-72 w-full sm:h-96 lg:h-[calc(100dvh-8rem)]"
                  pins={pins.map((club) => ({
                    id: club.id,
                    lat: club.lat,
                    lon: club.lon,
                    label: club.name,
                    sublabel: [club.address, club.city]
                      .filter(Boolean)
                      .join(", "),
                    imageUrl: club.logo_url,
                  }))}
                  onSelectPin={(pin) => {
                    const club = pins.find((c) => c.id === pin.id);
                    if (club)
                      navigate({
                        to: "/clubs/$slug",
                        params: { slug: club.slug },
                      });
                  }}
                  onViewChange={onViewChange}
                  overlay={
                    // A plain checkbox, coloured by `accent-strike` — a native
                    // control here is one that already knows how to be focused,
                    // toggled with the keyboard and read out.
                    <label className="flex cursor-pointer items-center gap-2 rounded-control border border-hairline bg-felt/90 px-2.5 py-1.5 text-caption font-medium text-ink shadow-pop backdrop-blur-sm">
                      <input
                        type="checkbox"
                        checked={tiedToMap}
                        onChange={(e) => tieToMap(e.target.checked)}
                        className="h-3.5 w-3.5 accent-strike"
                      />
                      {t("public.publicClubs.tieToMap")}
                    </label>
                  }
                />
              </div>
            </section>
          )}

          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            {/* The negative margins let the bar bleed to the shell's edge on a
                phone. In a column it must not: they would pull it out from
                under the map. */}
            {/* `relative z-20`: the bar's own backdrop-blur is a stacking
                context, so the menu's z-index can only order it within this
                bar. Without a z here the transformed cards below paint over
                the open menu. */}
            <div className="relative z-20 -mx-4 mt-6 bg-pocket/90 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-8 lg:px-0">
              <div className="flex items-center justify-between gap-3">
                <FilterMenu activeCount={sort === "members" ? 0 : 1}>
                  <FilterGroup label={t("public.sort.label")}>
                    <FilterPills
                      label={t("public.sort.label")}
                      anyLabel={t("public.sort.members")}
                      value={sort === "members" ? undefined : sort}
                      onChange={setSort}
                      options={SORTS.filter((s) => s !== "members").map(
                        (s) => ({
                          value: s,
                          label: t(`public.sort.${s}`),
                        }),
                      )}
                    />
                  </FilterGroup>
                </FilterMenu>
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder={t("public.publicClubs.searchPlaceholder")}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 font-mono text-caption tabular-nums text-ink-faint">
                  {t("public.publicClubs.count", { n: totalCount })}
                </span>
              </div>
            </div>

            {clubs.length === 0 ? (
              <Card className="mt-4">
                {/* Three different nothings: nowhere in this view, no match
                    for the search, and no clubs at all. Only the last one is
                    "there is nothing here yet", and saying that to someone who
                    has panned out to sea would be a lie about the product. */}
                <EmptyState
                  icon={<LuUsers className="h-5 w-5" aria-hidden />}
                  title={t(
                    bbox
                      ? "public.publicClubs.noneInView"
                      : search.q
                        ? "public.publicClubs.noResults"
                        : "public.publicClubs.emptyTitle",
                  )}
                  hint={t(
                    bbox
                      ? "public.publicClubs.noneInViewHint"
                      : search.q
                        ? "public.publicClubs.noResultsHint"
                        : "public.publicClubs.emptyHint",
                  )}
                />
              </Card>
            ) : (
              <>
                {/* Two across in the narrower left column, and more as the
                    column widens — without the last step a card on a large
                    screen is half a metre of empty tint. */}
                <div className="mt-8 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                  {clubs.map((club) => (
                    <ClubCard key={club.id} club={club} />
                  ))}
                </div>
                <Pager
                  page={page}
                  pageSize={PUBLIC_PAGE_SIZE}
                  totalCount={totalCount}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        </div>

        {/* ODbL. Part of this directory was seeded from OpenStreetMap (see
            scripts/es-clubs.mjs), and the licence asks for the credit. The
            map's own control credits the tiles, which is a different thing
            from crediting the club rows. */}
        <p className="mt-10 text-caption text-ink-faint">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-hairline underline-offset-2 transition-colors hover:text-ink-soft"
          >
            {t("public.publicClubs.dataCredit")}
          </a>
        </p>

        <CtaBand />
      </PublicShell>
    </>
  );
}

/**
 * The club's own venue if it has published one, and the accent if it has not:
 * a short band, the logo straddling its lower edge, and the two facts a
 * directory reader wants.
 *
 * The band is a fixed height rather than an aspect ratio, so a card does not get
 * taller as the grid gets wider — a directory is something you scan down, and
 * every row of it should cost the same amount of screen.
 *
 * ponytail: one storage list() per card, because the bucket is the photo list
 * and there is no cover column to read (see queries/clubPhotos). At a page of
 * 24 that is 24 cheap parallel requests against a public bucket, cached under
 * the same key the club's own page uses — so clicking a card is already warm.
 * If the directory ever gets long enough for that to matter, the fix is a
 * clubs.cover_url column written at upload time, not a batching layer here.
 */
export function ClubCard({ club }: { club: PublicClubCard }) {
  const { t } = useT();
  // Reconciled against the bucket and against the club's stored order, so the
  // card's picture is the same one the club's own hero leads with.
  const { data: photos = [] } = useQuery(clubPhotosQuery(club.id));
  const cover = orderPhotos(photos, club.photo_order)[0] ?? null;
  const place = [club.city, club.country].filter(Boolean).join(", ");

  return (
    <Link
      to="/clubs/$slug"
      params={{ slug: club.slug }}
      className={cardClasses({ className: "lift group block overflow-hidden" })}
    >
      {/* The venue if there is one, and a drawn pool hall if not.

          The fallback was the club's colour at full strength once; on one
          accent that would be a yellow strip on every photo-less club, in the
          exact colour this app reserves for "act". Bare felt-raised replaced
          it and was worse in a different way: a flat rectangle where every
          neighbouring card has a photograph reads as an image that failed to
          load, not as a club that has not uploaded one.

          One file for every such club and both themes. It is flat vector art,
          so it cannot be mistaken for somebody's actual room, and it is dimmed
          per theme (see .venue-fallback) so a club that did upload a photo
          always wins the grid. */}
      <div className="relative h-36 overflow-hidden bg-felt-raised">
        <img
          src={cover ? cover.url : "/art/venue-fallback.webp"}
          // Decorative either way: the club's name is the heading right below
          // it, and a description here would be read out before the name.
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${
            cover ? "" : "venue-fallback"
          }`}
        />
        {isNew(club.created_at) && (
          <span className="flood absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 font-mono text-caption font-semibold">
            {t("public.publicClubs.new")}
          </span>
        )}
      </div>

      {/* `relative` is load-bearing, not decoration. The band above is positioned
          (it has to be, for the New pill), so it paints in the positioned layer,
          above every non-positioned sibling — which clipped the top half of the
          logo overlapping it. Positioning this too puts it back on top, later in
          document order. It only looked fine for clubs with no logo, because the
          fallback's bg-felt-raised is near enough the band to hide the cut. */}
      <div className="relative px-4 pb-4">
        {/* `flex w-fit`, never `inline-flex`. An inline-level flex box is aligned
            on its baseline, and a flex container takes the baseline of its first
            item — which is real text for the initial fallback and nothing at all
            for an <img>. That put the two kinds of logo on different lines by a
            few pixels. Block-level takes it out of the line box entirely. */}
        <div className="-mt-8 flex w-fit rounded-full bg-felt p-1">
          <Avatar
            name={club.name}
            url={club.logo_url}
            mark
            className="h-14 w-14"
          />
        </div>
        <h3 className="mt-3 truncate text-h4 font-semibold text-ink transition-colors duration-150 group-hover:text-strike">
          {club.name}
        </h3>
        {/* Where it is, in the reader's order: the city first, the country only
            as the thing that disambiguates it. Both are optional columns, so
            the line is skipped rather than left as an empty row. */}
        {place && (
          <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-soft">
            <LuMapPin
              className="h-3.5 w-3.5 shrink-0 text-ink-faint"
              aria-hidden
            />
            <span className="truncate">{place}</span>
          </p>
        )}
        <p className="mt-1 font-mono text-caption tabular-nums text-ink-faint">
          {t("public.publicClubs.members", { n: club.member_count })}
        </p>
      </div>
    </Link>
  );
}
