import { useState } from "react";
import { toast } from "react-toastify";
import { headlineClasses } from "@/components/layout/publicTitleStyles";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, getRouteApi } from "@tanstack/react-router";
import { LuMapPin, LuX } from "react-icons/lu";
import GamesList from "@/components/games/GamesList";
import ShareButton from "@/components/social/ShareButton";
import PublicShell from "@/components/layout/PublicShell";
import { GROUPS, TournamentCard } from "@/pages/public/PublicTournamentsPage";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHead } from "@/components/ui/SectionHead";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { gamesQuery } from "@/queries/games";
import { clubPhotosQuery, type ClubPhoto } from "@/queries/clubPhotos";
import { orderPhotos } from "@/libs/algorithms/photoOrder";
import { useDialog } from "@/hooks/useDialog";
import {
  publicClubRosterQuery,
  type PublicClub,
  type PublicClubDetail,
  type PublicPlayer,
} from "@/queries/public/clubs";
import { useNow } from "@/hooks/useNow";
import { useSession } from "@/hooks/useAuth";
import { loginLink } from "@/libs/algorithms/nextPath";
import { sendClubClaimMail } from "@/libs/server/mail.functions";
import {
  isAllDay,
  isEmpty,
  isOpenNow,
  parseSchedule,
  weekRows,
} from "@/libs/algorithms/schedule";
import { publicTournamentsQuery } from "@/queries/public/tournaments";
import { useT, type Key } from "@/i18n";

const route = getRouteApi("/_public/clubs/$slug");

/** Enough recent results to show the club is alive, not its whole history —
 *  which is what /clubs/$slug is for and the club's own app is not. */
export const CLUB_GAMES_LIMIT = 30;

/** The address as the page prints it. Empty for a club that never set one. */
const where = (club: PublicClub) =>
  [club.address, club.city].filter(Boolean).join(", ");

/**
 * Coordinates when the club has them, because those are a geocoder's answer and
 * the text is the question — "Sierra Billiards, Valencia" is a search Google can
 * get wrong, a lat/lon is not. The name goes in the text fallback so the pin
 * lands on the venue rather than on the middle of the street.
 */
const mapsUrl = (club: PublicClub) => {
  const query =
    club.lat != null && club.lon != null
      ? `${club.lat},${club.lon}`
      : [club.name, club.address, club.city, club.country]
          .filter(Boolean)
          .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

/**
 * The club itself. It came from the loader, which already threw notFound() if
 * there wasn't one, so it is non-null here where the query's type is nullable.
 * Every tab reads it through this rather than through props — they are route
 * components, so there is nowhere for props to come from.
 */
const useClub = () => route.useLoaderData().club;

/** The roster, listed and unlisted. Primed by the parent loader; the tabs read
 *  the same cache entry the hero does. */
const useRoster = () =>
  useSuspenseQuery(publicClubRosterQuery(useClub().id)).data;

/**
 * The roster grid is the one block that is a list of people, so it is the one
 * place the opt-out applies. Everything else on this page is the club's record.
 *
 * Faces first: the hero shows the first six of these, and six initials in
 * circles say nothing about the club. Stable, so within each group the roster
 * keeps the order it arrived in.
 */
const listedOf = (roster: PublicPlayer[]) =>
  roster
    .filter((player) => player.is_public)
    .sort((a, b) => Number(!!b.avatar_url) - Number(!!a.avatar_url));

/**
 * A club's public face: who plays there, who is winning, what is on, and one way
 * in.
 *
 * The frame only — the hero, the tabs and the closing call to action. Each tab under it is its own route, because a club's players
 * and a club's results are two different things to link somebody at, and one
 * page that stacked all four made the reader scroll past three of them.
 */
/**
 * The visitor's own row in this club, if they have one.
 *
 * A member reading their club's public page is not a lead to convert — they
 * already went through the door, and "join this club" sent them back to a form
 * that only tells them so. The session already carries every membership, so
 * this costs a find, not a request.
 */
const useMyMembership = (slug: string) =>
  useSession().memberships.find((m) => m.club?.slug === slug);

/** Join, or go in. Same button, two different destinations. */
function ClubCta({
  club,
  size,
  className,
}: {
  club: PublicClub;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useT();
  const mine = useMyMembership(club.slug);

  return mine ? (
    <Link
      to="/app/$clubSlug"
      params={{ clubSlug: club.slug }}
      className={buttonClasses({ size, className })}
    >
      {t(
        mine.status === "pending"
          ? "public.cta.membershipPending"
          : "public.cta.openClub",
      )}
    </Link>
  ) : (
    <Link
      to="/app/join/$slug"
      params={{ slug: club.slug }}
      className={buttonClasses({ size, className })}
    >
      {t("public.cta.joinClub")}
    </Link>
  );
}

export default function PublicClubPage() {
  const { t } = useT();
  const { club, unclaimed, origin } = route.useLoaderData();

  const url = `${origin}/clubs/${club.slug}`;
  const listed = listedOf(useRoster());
  const mine = useMyMembership(club.slug);

  return (
    <>
      <ClubHero club={club} listed={listed} url={url} />

      <PublicShell>
        <Outlet />

        {/* Nothing to pitch to somebody who is already in: the band asks a
            stranger to join, and the hero's button already offers a member the
            way into the club itself. */}
        {unclaimed ? (
          <ClaimBand club={club} />
        ) : mine ? null : (
          <section className="wash wash-soft mt-10 flex flex-col items-center gap-3 rounded-sheet border border-hairline p-10 text-center">
            <h2 className={headlineClasses("display", "max-w-[24ch]")}>
              {t("public.publicClub.joinTitle", { name: club.name })}
            </h2>
            <p className="max-w-[46ch] text-body text-ink-soft">
              {t("public.publicClub.joinBody")}
            </p>
            {/* The club's own invite link, which is public now — signed out
                it previews the club and offers a sign-up that comes back to it,
                so there is nothing to gate here. */}
            <ClubCta club={club} className="mt-2 px-6" />
          </section>
        )}
      </PublicShell>
    </>
  );
}

/**
 * The closing section for a club that is in the directory because a federation
 * lists it, not because anybody here put it there — see publicClubUnclaimedQuery.
 *
 * It replaces the "join this club" band rather than sitting above it: there is
 * nobody inside to join yet, and asking a stranger to request membership of an
 * empty club was the confusing half of these pages.
 *
 * Signed out, the button is a sign-up that comes back here — a claim has to
 * arrive from an account, because the account is what the club gets transferred
 * to. Signed in, it files the claim: one mail to us, because handing a club
 * over is a hand operation (sql/clubs-seed-es.sql).
 */
function ClaimBand({ club }: { club: PublicClubDetail }) {
  const { t } = useT();
  const { user } = useSession();

  const claim = useMutation({
    mutationFn: () => sendClubClaimMail({ data: { slug: club.slug } }),
    onSuccess: () => toast.success(t("public.publicClub.claimSent")),
    onError: () => toast.error(t("public.publicClub.claimError")),
  });

  return (
    <section className="wash wash-soft mt-10 flex flex-col items-center gap-3 rounded-sheet border border-hairline p-10 text-center">
      <h2 className={headlineClasses("display", "max-w-[24ch]")}>
        {t("public.publicClub.claimTitle")}
      </h2>
      <p className="max-w-[52ch] text-body text-ink-soft">
        {t("public.publicClub.claimBody", { name: club.name })}
      </p>
      {user ? (
        <button
          type="button"
          onClick={() => claim.mutate()}
          // Once, and once is enough: a second identical mail tells us nothing
          // the first did not.
          disabled={claim.isPending || claim.isSuccess}
          className={buttonClasses({ className: "mt-2 px-6" })}
        >
          {claim.isSuccess
            ? t("public.publicClub.claimSent")
            : t("public.publicClub.claim")}
        </button>
      ) : (
        <a
          href={loginLink(`/clubs/${club.slug}`)}
          className={buttonClasses({ className: "mt-2 px-6" })}
        >
          {t("public.publicClub.claimSignUp")}
        </a>
      )}
    </section>
  );
}

/**
 * The four sub-routes, as tabs standing on the hero's own bottom rule.
 *
 * Underlines rather than the segmented pill the app's ClubTabs wears: this is
 * the page's own navigation, not a control sitting on the page, and the pill
 * read as a widget dropped into the gap between the hero and the content. The
 * active tab's rule replaces the hero's border for its own width, which is what
 * ties the two together — hence `-mb-px` on the row.
 *
 * Links rather than buttons, for the reason the app's ClubTabs gives: each tab
 * is an address, so it can be shared, opened in a new tab and prefetched on
 * hover. `activeProps` rather than comparing pathnames, because the router
 * already knows which one is current.
 */
const TABS = [
  { to: "/clubs/$slug", labelKey: "nav.publicTournaments", exact: true },
  { to: "/clubs/$slug/players", labelKey: "public.publicClub.roster" },
  { to: "/clubs/$slug/games", labelKey: "public.publicClub.statGames" },
  { to: "/clubs/$slug/info", labelKey: "club.tabs.info" },
] as const satisfies { to: string; labelKey: Key; exact?: boolean }[];

const TAB =
  "shrink-0 border-b-2 px-1 py-3 text-body transition-colors duration-150";

function ClubTabs({ slug }: { slug: string }) {
  const { t } = useT();

  return (
    // The scroller is for a narrow phone: four labels in three languages do not
    // all fit on a 320px line, and a row that wraps stops reading as one.
    <nav
      aria-label={t("nav.navigation")}
      className="no-bar relative -mb-px flex gap-5 overflow-x-auto px-4 sm:gap-6 sm:px-6"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          params={{ slug }}
          // Without `exact` the tournaments tab, whose path is a prefix of the
          // other three, would light up on all four.
          activeOptions={{ exact: "exact" in tab }}
          activeProps={{
            className: `${TAB} border-strike font-medium text-ink`,
            "aria-current": "page",
          }}
          inactiveProps={{
            className: `${TAB} border-transparent text-ink-soft hover:text-ink`,
          }}
        >
          {t(tab.labelKey)}
        </Link>
      ))}
    </nav>
  );
}

/**
 * What a stranger needs before turning up: the room, what the club says it is,
 * when it is open and how to phone it.
 */
export function ClubInfoTab() {
  const { t } = useT();
  const club = useClub();

  // Read here rather than inside ClubPhotos so the empty case below can see
  // whether there is anything on this tab at all.
  // slice(1): the leading photo is already the hero's banner
  const { data: storedPhotos = [] } = useQuery(clubPhotosQuery(club.id));
  const photos = orderPhotos(storedPhotos, club.photo_order).slice(1);

  const hasVisit = Boolean(
    club.description ||
    club.phone ||
    club.tables_info ||
    !isEmpty(parseSchedule(club.schedule)),
  );

  if (photos.length === 0 && !hasVisit) {
    return <Empty text={t("public.publicClub.noInfo")} />;
  }

  return (
    <>
      <ClubPhotos photos={photos} />
      <ClubVisit club={club} />
    </>
  );
}

/**
 * What is on at the club, and the shelf of what has been.
 *
 * The same shape /tournaments has — live, then open, then the archive as rows
 * in one card — because it is the same page scoped to one club, and two lists
 * of tournaments that group differently make the reader learn it twice. It
 * shares that page's GROUPS and its two card components; only the club line is
 * dropped, since the club is the page here.
 */
export function ClubTournamentsTab() {
  const { t } = useT();
  const club = useClub();
  const { data } = useSuspenseQuery(
    publicTournamentsQuery({ clubId: club.id }),
  );

  const all = data.tournaments;
  const grouped = GROUPS.map(({ key, statuses }) => ({
    key,
    rows: all.filter((x) => statuses.includes(x.status)),
  })).filter((group) => group.rows.length > 0);

  if (all.length === 0) {
    return <Empty text={t("public.publicTournaments.emptyTitle")} />;
  }

  return (
    <div className="mt-8 space-y-10">
      {grouped.map(({ key, rows }) => (
        <section key={key}>
          <h2 className="px-1 pb-3 text-caption font-medium tracking-[0.08em] text-ink-faint uppercase">
            {t(key)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                hideClub
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Everyone who plays here and chose to be listed. */
export function ClubPlayersTab() {
  const { t } = useT();
  const club = useClub();
  const listed = listedOf(useRoster());

  if (listed.length === 0) {
    return <Empty text={t("public.publicClub.noRosterHint")} />;
  }

  return (
    <section className="mt-8">
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
        {listed.map((player) => (
          <Link
            key={player.id}
            to="/players/$playerSlug"
            params={{ playerSlug: player.slug }}
            className="group flex flex-col items-center gap-1.5 text-center"
          >
            <Avatar
              name={player.name}
              url={player.avatar_url}
              seed={player.id}
              className="h-16 w-16 transition-transform duration-150 group-hover:scale-105 sm:h-20 sm:w-20"
            />
            <span className="w-full truncate text-caption text-ink-soft group-hover:text-ink">
              {player.name}
            </span>
          </Link>
        ))}
      </div>
      {/* Said plainly rather than left as a discrepancy the reader has to spot
          between the count above and the length of this list. */}
      {club.member_count > listed.length && (
        <p className="mt-4 text-caption text-ink-faint">
          {t("public.publicClub.hiddenMembers", {
            n: club.member_count - listed.length,
          })}
        </p>
      )}
    </section>
  );
}

/** The results tape. GamesList draws its own empty state, so this one doesn't. */
export function ClubGamesTab() {
  const { t } = useT();
  const club = useClub();
  const roster = useRoster();
  const { data } = useSuspenseQuery(
    gamesQuery(club.id, { pageSize: CLUB_GAMES_LIMIT }),
  );

  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader title={t("public.publicClub.recentResults")} />
      <div className="p-3">
        <GamesList games={data.games} players={roster} showDates public />
      </div>
    </Card>
  );
}

/** One line where a tab has nothing to show — a heading over an empty grid
 *  reads as a bug, and every tab is reachable whether or not it is filled in. */
function Empty({ text }: { text: string }) {
  return <p className="mt-8 text-body text-ink-faint">{text}</p>;
}

/**
 * Full-bleed, the Patreon creator-header shape: a cover band, the logo plate
 * overlapping it, the name at display size, the roster as the social-proof
 * line underneath. Rendered as a sibling of `PublicShell` rather than inside
 * it — that is what lets it bleed to the edges the shell's own measure would
 * otherwise clip.
 */
function ClubHero({
  club,
  listed,
  url,
}: {
  club: PublicClubDetail;
  listed: PublicPlayer[];
  url: string;
}) {
  const { t } = useT();

  // The club's first photo, as the banner above the title. Absent for a club
  // that has published none, and the hero simply starts at the title. Same
  // order the info tab's gallery and the directory card use, so all three
  // agree about which photo leads.
  const { data: storedPhotos = [] } = useQuery(clubPhotosQuery(club.id));
  const cover = orderPhotos(storedPhotos, club.photo_order)[0] ?? null;

  return (
    <section className="border-b border-hairline">
      {/* The venue as a banner, not as a backdrop.
          It used to sit behind the whole hero under a veil, which is a bargain
          that costs both sides: the photo is dimmed to the point of being
          texture, and the text still has to survive whatever was underneath it.
          In light mode it was worse — an 80% white veil over a bright room is a
          pale smear with no edge, and the title had nothing to sit against.
          Above the title instead, at full strength, with the title on the
          page's own surface. The photo gets to be a photograph and every ink
          token keeps the contrast it was measured for. */}
      {cover && (
        <div className="relative h-40 overflow-hidden sm:h-56">
          <img
            src={cover.url}
            // Decorative: the club's name is the heading directly below.
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {/* `relative` is load-bearing, not decoration. The banner above is
          positioned (it has to be, to clip the photo), so it paints in the
          positioned layer above every non-positioned sibling — which cut off
          the top of the avatar straddling it. Positioning this too puts it
          back on top, later in document order. The directory card carries the
          same note for the same reason. */}
      <div
        className={`relative px-4 pb-6 sm:px-6 sm:pb-8 ${
          // The avatar straddles the banner's lower edge, the same move the
          // directory card makes, so a club reads the same way in both places.
          cover ? "pt-4 sm:pt-5" : "pt-10 sm:pt-16"
        }`}
      >
        {/* Top-aligned, not bottom: the title has a different amount of detail
            under it on a club, a player and a tournament, so aligning the block's
            bottom to the avatar moves the h1 up or down with it — the title
            visibly jumped between the three. Aligning the top pins every profile
            title to the hero's own padding. */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div
            className={`w-fit rounded-full bg-pocket p-1.5 ${
              cover ? "-mt-14 sm:-mt-20" : ""
            }`}
          >
            <Avatar
              name={club.name}
              url={club.logo_url}
              mark
              className="h-20 w-20 sm:h-28 sm:w-28"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className={headlineClasses("display", "truncate")}>
              {club.name}
            </h1>
            {where(club) && (
              <a
                href={mapsUrl(club)}
                target="_blank"
                rel="noopener noreferrer"
                title={t("public.publicClub.directions")}
                className="mt-3 inline-flex max-w-full items-center gap-1.5 text-caption text-ink-soft transition-colors hover:text-ink"
              >
                <LuMapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{where(club)}</span>
              </a>
            )}
            {listed.length > 0 && (
              <div className="mt-3 flex items-center gap-2.5">
                <div className="flex -space-x-2.5">
                  {listed.slice(0, 6).map((player) => (
                    <Avatar
                      key={player.id}
                      name={player.name}
                      url={player.avatar_url}
                      seed={player.id}
                      className="h-8 w-8"
                    />
                  ))}
                </div>
                <span className="text-caption text-ink-soft">
                  {t("public.publicClubs.members", { n: club.member_count })}
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ShareButton title={club.name} url={url} />
            <ClubCta club={club} size="sm" />
          </div>
        </div>
      </div>

      <ClubTabs slug={club.slug} />
    </section>
  );
}

/**
 * The venue itself, if the club has published any pictures of it.
 *
 * Renders nothing at all when there are none — the info tab's own empty line
 * covers the club that has published nothing.
 *
 * The same CSS scroll-snap strip the tabs and the roster use rather than a
 * carousel dependency: it is four utility classes, it works with a thumb, a
 * trackpad and a keyboard, and it degrades to a plain scrolling row with no JS.
 */
function ClubPhotos({ photos }: { photos: ClubPhoto[] }) {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionHead title={t("public.publicClub.photos")} />
      {/* py-2, not pb-1: `overflow-x: auto` clips vertically too, so the 3px a
          card rises on hover — and the shadow above it — was cut off against
          the top edge of the scroller. */}
      <div className="no-bar -mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 py-2 sm:-mx-6 sm:px-6">
        {photos.map((photo, i) => (
          <button
            key={photo.path}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={t("public.publicClub.viewPhoto", { n: String(i + 1) })}
            className="lift shrink-0 snap-start overflow-hidden rounded-card border border-hairline bg-felt-raised"
          >
            <img
              src={photo.url}
              alt=""
              // The first is what the page opens on, so it is the one image
              // here worth blocking layout for; the rest are a scroll away.
              loading={i === 0 ? "eager" : "lazy"}
              className="h-48 w-auto max-w-[85vw] object-cover sm:h-64"
            />
          </button>
        ))}
      </div>

      <PhotoLightbox
        photos={photos}
        index={open}
        onClose={() => setOpen(null)}
        onIndex={setOpen}
      />
    </section>
  );
}

/**
 * One photo, big.
 *
 * A native <dialog> via useDialog, which is where the backdrop, Esc-to-close,
 * the focus trap and the inertness of the page behind all come from for free —
 * see the hook. A div with a fixed overlay would hand-roll four things and get
 * at least one of them wrong.
 *
 * ponytail: no zoom, no pinch, no swipe. Arrows and Esc, on a picture of a pool
 * room. A gallery library is a lot of kilobytes for eight photos.
 */
function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: ClubPhoto[];
  index: number | null;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const { t } = useT();
  const ref = useDialog(index !== null);
  const photo = index === null ? null : photos[index];

  return (
    <dialog
      ref={ref}
      // The dialog's own close (Esc, or the backdrop) has to reach React, or
      // reopening the same photo does nothing because the state never cleared.
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes. The backdrop is the dialog element
        // itself, so this only fires when the click missed the content.
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (index === null) return;
        if (e.key === "ArrowRight" && index < photos.length - 1)
          onIndex(index + 1);
        if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      }}
      className="lightbox m-auto max-h-[92dvh] max-w-[95vw] overflow-hidden rounded-sheet border border-hairline bg-felt p-0 text-ink"
    >
      {photo && (
        <div className="relative">
          <img
            src={photo.url}
            alt=""
            className="max-h-[92dvh] max-w-[95vw] object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-control bg-pocket/90 text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            <LuX className="h-5 w-5" aria-hidden />
          </button>
          {photos.length > 1 && (
            <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-control bg-pocket/90 px-2 py-0.5 font-mono text-caption tabular-nums text-ink-soft">
              {index !== null ? index + 1 : 0} / {photos.length}
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}

/**
 * What the club says it is, when it is open and how to phone it.
 *
 * The whole section is absent for a club that has set none of the three, rather
 * than three empty headings.
 */
function ClubVisit({ club }: { club: PublicClubDetail }) {
  const { t } = useT();
  const schedule = parseSchedule(club.schedule);
  const hasHours = !isEmpty(schedule);

  // Null until an effect runs, which is the point: "open now" is `Date.now()`,
  // and rendering it on the server would be a hydration mismatch that resolves
  // wrong for a few minutes either side of closing time. The server renders no
  // pill and the browser fills it in. Same trick useSuggestions uses.
  const now = useNow();
  const open =
    now !== null && hasHours && isOpenNow(schedule, club.timezone, now);

  if (!club.description && !club.phone && !club.tables_info && !hasHours)
    return null;

  return (
    <section className="mt-8">
      <SectionHead title={t("public.publicClub.visit")} />

      {club.description && (
        // whitespace-pre-line: the admin typed it in a textarea, so their
        // paragraph breaks are the only formatting there is.
        <p className="mt-4 whitespace-pre-line text-body text-ink-soft">
          {club.description}
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {hasHours && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="text-body font-medium text-ink">
                {t("club.schedule.title")}
              </h3>
              {now !== null && (
                <span
                  className={[
                    "shrink-0 rounded-full px-2 py-0.5 text-caption font-medium",
                    open ? "bg-strike text-pocket" : "bg-pocket text-ink-faint",
                  ].join(" ")}
                >
                  {t(
                    open ? "club.schedule.openNow" : "club.schedule.closedNow",
                  )}
                </span>
              )}
            </div>
            <dl className="divide-y divide-hairline">
              {weekRows(schedule).map((row) => (
                <div
                  // The first day names the run, and a run is a set of
                  // consecutive days, so it is unique across the week.
                  key={row.days[0]}
                  className="flex justify-between gap-3 py-1.5"
                >
                  <dt className="text-body text-ink-soft">
                    {row.days.length === 7
                      ? t("club.schedule.everyDay")
                      : row.days.length === 1
                        ? t(`club.schedule.day.${row.days[0]}` as Key)
                        : `${t(`club.schedule.day.${row.days[0]}` as Key)} – ${t(
                            `club.schedule.day.${row.days[row.days.length - 1]}` as Key,
                          )}`}
                  </dt>
                  <dd className="text-right font-mono text-body tabular-nums text-ink">
                    {/* "00:00–00:00" is technically what an all-day row
                        holds, and it reads as a typo. */}
                    {isAllDay(row.ranges)
                      ? t("club.schedule.allDay")
                      : row.ranges.length
                        ? row.ranges.map(([f, s]) => `${f}–${s}`).join(", ")
                        : t("club.schedule.closed")}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {club.tables_info && (
          <Card className="p-4">
            <h3 className="pb-2 text-body font-medium text-ink">
              {t("club.tablesInfo")}
            </h3>
            {/* whitespace-pre-line for the same reason the description has it:
                a textarea's line breaks are the only formatting there is. */}
            <p className="whitespace-pre-line text-body text-ink-soft">
              {club.tables_info}
            </p>
          </Card>
        )}

        {club.phone && (
          <Card className="p-4">
            <h3 className="pb-2 text-body font-medium text-ink">
              {t("club.phone")}
            </h3>
            {/* tel: with the string exactly as typed. Stripping spaces would
                be a guess about a format that differs by country, and every
                dialler already ignores them. */}
            <a
              href={`tel:${club.phone}`}
              className="font-mono text-body text-strike transition-colors duration-150 hover:text-strike-light"
            >
              {club.phone}
            </a>
          </Card>
        )}
      </div>
    </section>
  );
}
