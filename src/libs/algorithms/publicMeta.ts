/**
 * The head tags a shared link needs, in one place.
 *
 * Every public route's `head` calls this. Written as one helper rather than
 * spelled out nine times because the failure mode is silent: a page missing
 * og:url still renders perfectly and only looks broken in somebody else's chat
 * app, which is not a place we can see.
 *
 * Absolute URLs throughout. A crawler fetching og:image resolves it against
 * nothing, so a leading-slash path is a broken image in the card — which is why
 * `origin` is threaded down from the root route's context (readOrigin()) instead
 * of read from `window`, which does not exist while this runs.
 */

/** Fallback card art per section, for entities with no image of their own.
 *
 *  Only the default card exists so far (public/og/default.png, 1200×630). The
 *  four sections point at it rather than at files that are not there: a card
 *  with the product in it beats the empty rectangle a 404 renders as, and the
 *  day /og/clubs.png is drawn, one line here picks it up. */
type OgFallback = "default" | "clubs" | "players" | "tournaments" | "drills";

const DEFAULT_IMAGE = "/og/default.png";

const FALLBACK_IMAGE: Record<OgFallback, string> = {
  /** The pages that are not a section of the directory: the landing page and the
   *  prose pages (pricing, about, contact, legal). */
  default: DEFAULT_IMAGE,
  clubs: DEFAULT_IMAGE,
  players: DEFAULT_IMAGE,
  tournaments: DEFAULT_IMAGE,
  drills: DEFAULT_IMAGE,
};

/** The size of every file in FALLBACK_IMAGE, and of the generated cards in
 *  libs/browser/resultCard.ts — they are all 1.91:1. Declaring it lets a
 *  preview renderer lay the card out before the image has downloaded, which is
 *  the difference between a wide card and a small one in the feeds that give up
 *  waiting. Omitted for a club logo or an avatar, whose size we do not know. */
const FALLBACK_SIZE = { width: "1200", height: "630" } as const;

/** What the generated cards are actually served at: the same 1.91:1, drawn at
 *  twice the density so the picture is sharp when somebody opens it rather than
 *  only when a preview shrinks it (see libs/server/cardImage.ts). Declared
 *  honestly rather than as the nominal 1200x630 — a renderer reserves the box
 *  from the ratio, which is identical either way, and a stated size that is not
 *  the file's is the sort of thing that is true until it matters.
 *
 *  A card route falls back to /og/default.png when there is nothing to draw, so
 *  a card page occasionally states this while serving that. Same ratio, same
 *  layout, and the alternative is a second round trip in `head` to find out. */
const CARD_SIZE = { width: "2400", height: "1260" } as const;

/** Long descriptions are truncated by every preview renderer anyway, and a
 *  sentence cut mid-word reads as a bug rather than a limit. */
const MAX_DESCRIPTION = 200;

const clamp = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_DESCRIPTION) return clean;
  const cut = clean.slice(0, MAX_DESCRIPTION);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : cut.length)}…`;
};

export function publicMeta({
  title,
  description,
  path,
  origin,
  image,
  wideImage = false,
  fallback,
}: {
  /** The document title. Already includes " · PoolClubs" if it wants it. */
  title: string;
  description: string;
  /** Root-relative, with the leading slash: "/clubs/paulas-pool". */
  path: string;
  origin: string;
  /** The entity's own image — a club logo or a player avatar. A data: URI is
   *  skipped: uploaded avatars are stored inline, and no crawler will fetch one. */
  image?: string | null;
  /** Set when `image` is a 1.91:1 card rather than a square logo or avatar —
   *  the tournament podium card, say. It decides the two things a preview
   *  renderer reads to lay the card out: the declared size, and whether Twitter
   *  gets the large card or the small one. Wrong either way is a real, visible
   *  bug: a wide card announced as square renders as a thumbnail beside the
   *  text, which is what happened to the podium card before this existed. */
  wideImage?: boolean;
  fallback: OgFallback;
}) {
  const url = `${origin}${path}`;
  const ownImage = image && !image.startsWith("data:") ? image : null;
  const imageUrl = ownImage
    ? ownImage.startsWith("http")
      ? ownImage
      : `${origin}${ownImage}`
    : `${origin}${FALLBACK_IMAGE[fallback]}`;
  const clamped = clamp(description);

  return [
    { title },
    { name: "description", content: clamped },
    { property: "og:site_name", content: "PoolClubs" },
    // The " · PoolClubs" suffix belongs in the tab title, not in the card: a
    // preview renderer already prints og:site_name above the title, so keeping
    // it here says "PoolClubs" twice in three lines.
    { property: "og:title", content: title.replace(/ · PoolClubs$/, "") },
    { property: "og:description", content: clamped },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:image", content: imageUrl },
    { property: "og:image:alt", content: title.replace(/ · PoolClubs$/, "") },
    // Declared for anything known to be 1200x630 — the fallback cards and the
    // wide ones — and omitted for a logo or an avatar, whose size we do not
    // know. It is what lets a renderer reserve the wide slot before the image
    // has downloaded, instead of guessing small.
    ...(!ownImage || wideImage
      ? [
          {
            property: "og:image:width",
            content: wideImage ? CARD_SIZE.width : FALLBACK_SIZE.width,
          },
          {
            property: "og:image:height",
            content: wideImage ? CARD_SIZE.height : FALLBACK_SIZE.height,
          },
        ]
      : []),
    // summary_large_image only pays off with a wide card. A club logo is square,
    // so it gets the small one and fills it rather than being letterboxed.
    {
      name: "twitter:card",
      content: ownImage && !wideImage ? "summary" : "summary_large_image",
    },
  ];
}

/** The canonical link, kept apart because `head` takes links and meta in
 *  separate arrays. */
export const canonical = (path: string, origin: string) => [
  { rel: "canonical", href: `${origin}${path}` },
];
