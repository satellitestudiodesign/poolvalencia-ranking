import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import * as pureimage from "pureimage";
import sans400 from "@/assets/fonts/DMSans-Regular.ttf?inline";
import sans500 from "@/assets/fonts/DMSans-Medium.ttf?inline";
import sans700 from "@/assets/fonts/DMSans-Bold.ttf?inline";
import type {
  ClubCardSpec,
  GameCardSpec,
  PlayerCardSpec,
  ResultCardSpec,
} from "@/libs/algorithms/cards";
import {
  CARD_SIZES,
  paintClubCard,
  paintGameCard,
  paintPlayerCard,
  paintResultCard,
  type CardContext,
  type CardImage,
  type CardSize,
} from "@/libs/cards/paint";

/**
 * The result card, rendered on the server, so a link preview shows the podium
 * the first time anyone — a crawler included — asks for it.
 *
 * pureimage is a Canvas 2D implementation in plain JavaScript: no native
 * binary to build per platform, no WebAssembly blob, and the same drawing calls
 * the browser takes, which is what lets libs/cards/paint.ts be the only place
 * the card's geometry is written down. It also measures text with the real font
 * metrics, so the wrapping and truncation on the server match the browser's
 * rather than estimating.
 *
 * The two things it does not do the browser's way are handled here: it names
 * fonts by family alone (no weight in the string, hence one registered family
 * per weight), and it loads them from a file path, hence the temp directory.
 * The .ttf files it reads are vendored in src/assets/fonts — see the README
 * there for why the browser's variable woff2 fonts cannot be used.
 */

/** The weights the card asks for. A 600 is drawn with the 700 rather than
 *  shipping a fourth file for one line of text. */
const FONTS = [
  { name: "CardSans400", weight: 400, data: sans400 },
  { name: "CardSans500", weight: 500, data: sans500 },
  { name: "CardSans700", weight: 700, data: sans700 },
] as const;

/** Cold start pays for this once; every request after it is a lookup. */
let fontsReady = false;

function registerFonts() {
  if (fontsReady) return;

  const dir = mkdtempSync(join(tmpdir(), "poolclubs-card-fonts-"));
  for (const font of FONTS) {
    // Each font is inlined into this bundle as a data URI, so there is no
    // node_modules to find at runtime and nothing to fetch over the network —
    // it only has to land on disk somewhere, because registerFont takes a path.
    const path = join(dir, `${font.name}.ttf`);
    writeFileSync(path, Buffer.from(font.data.split(",")[1], "base64"));
    pureimage.registerFont(path, font.name).loadSync();
  }
  fontsReady = true;
}

/** No weight in the string: pureimage reads the first token as the size, so
 *  "700 84px X" silently resolves to no font at all. Rounded, because its
 *  parser wants an integer. */
const serverFont = (weight: number, px: number) =>
  `${Math.round(px)}px ${familyFor(weight)}`;

/** Nearest registered weight, so the shared layout can ask for 600 without
 *  this file having to ship one. */
const familyFor = (weight: number) =>
  FONTS.reduce((best, font) =>
    Math.abs(font.weight - weight) < Math.abs(best.weight - weight)
      ? font
      : best,
  ).name;

const PNG_MAGIC = "89504e470d0a1a0a";
const JPEG_MAGIC = "ffd8ff";

/**
 * Image bytes in, decoded bitmap out — or null, because a card missing its
 * logo is still a card.
 *
 * The format is sniffed rather than read off the data URI's own label: club
 * logos in the wild carry `data:image/png` in front of JPEG bytes, and
 * pureimage's PNG decoder answers that with "Invalid file signature". It also
 * decodes from a stream only, hence the Readable.
 */
async function decodeImage(bytes: Buffer): Promise<CardImage | null> {
  const head = bytes.subarray(0, 8).toString("hex");
  const decode = head.startsWith(PNG_MAGIC)
    ? pureimage.decodePNGFromStream
    : head.startsWith(JPEG_MAGIC)
      ? pureimage.decodeJPEGFromStream
      : null;
  if (!decode) return null;

  try {
    return (await decode(Readable.from(bytes))) as unknown as CardImage;
  } catch {
    return null;
  }
}

/**
 * Draw the card at its nominal size, and serve it that way.
 *
 * This was 2 — pureimage antialiases with a single sample, so a glyph edge gets
 * one blended pixel and nothing else, and doubling the resolution hid the
 * staircase that leaves on a curve. It also cost four times the pixels, and
 * pureimage rasterises in plain JavaScript on a Lambda vCPU: the club card,
 * whose cover photograph and scrim are two full-frame passes, took thirteen
 * seconds to draw at 2400x1260 and twenty at the square size. Slack's image
 * proxy gives up long before either, so the card that was sharper was also the
 * card nobody saw.
 *
 * A preview is displayed at about 600px wide, where the single-sample edges are
 * invisible anyway. The cost is only paid by somebody who opens the picture
 * itself, and a card that arrives beats a card that is crisp.
 */
const SCALE = 1;

/** High enough that the type has no visible ringing, low enough that a
 *  photographed room lands well under a hundred kB. */
const JPEG_QUALITY = 82;

export type CardFormat = "png" | "jpeg";

/** What each card comes back as, so a route can set the content type without
 *  guessing. */
export type RenderedCard = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
};

const DATA_URL = /^data:image\/\w+;base64,(.+)$/;

/** Network failures are not the card's problem: a face that will not load is
 *  drawn as the plain rank chip instead. */
async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** An avatar is either inline (uploaded, stored as a data URI) or a URL at
 *  whichever identity provider the person signed in with. */
async function bytesOf(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const inline = url.match(DATA_URL)?.[1];
  if (inline) return Buffer.from(inline, "base64");
  return url.startsWith("http") ? fetchBytes(url) : null;
}

/** Decode whatever of these are there, in order, keeping the nulls. */
const imagesOf = (urls: (string | null | undefined)[]) =>
  Promise.all(
    urls.map(async (url) => {
      const bytes = await bytesOf(url);
      return bytes ? decodeImage(bytes) : null;
    }),
  );

/**
 * Canvas in, image bytes out. Every card is drawn at SCALE and encoded as-is.
 *
 * PNG for flat artwork — type on felt, which is what most of a card is — and
 * JPEG where a photograph fills the frame, because a room in PNG is several
 * hundred kB and the same room at quality 82 is a fraction of that. A link
 * preview that takes a second to arrive is a link preview nobody sees.
 */
async function encode(
  size: CardSize,
  paint: (ctx: CardContext) => void,
  format: CardFormat = "png",
): Promise<Uint8Array<ArrayBuffer>> {
  registerFonts();

  const { width, height } = CARD_SIZES[size];
  const bitmap = pureimage.make(width * SCALE, height * SCALE);
  paint(bitmap.getContext("2d") as unknown as CardContext);

  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  await (format === "jpeg"
    ? pureimage.encodeJPEGToStream(bitmap, sink, JPEG_QUALITY)
    : pureimage.encodePNGToStream(bitmap, sink));
  // A plain Uint8Array rather than the Buffer: it is what a Response body
  // takes, and copying 100kB once is cheaper than explaining a cast.
  return new Uint8Array(Buffer.concat(chunks));
}

/** What every card needs before it can be drawn: the club's logo, our mark,
 *  and the size to draw at. */
type CardRequest = {
  /** `clubs.logo_url` — a base64 data URI, PNG or JPEG whatever it claims to
   *  be. Anything else is skipped rather than guessed at. */
  logoUrl?: string | null;
  /** Absolute URL of the app's ball mark, fetched from our own origin. */
  markUrl?: string | null;
  /** The club's venue photograph, as a public storage URL. */
  coverUrl?: string | null;
  size?: CardSize;
};

const chromeOf = async ({ logoUrl, markUrl, coverUrl }: CardRequest) => {
  const [logo, cover] = await imagesOf([logoUrl, coverUrl]);
  return {
    logo,
    cover,
    mark: markUrl
      ? await decodeImage((await fetchBytes(markUrl)) ?? EMPTY)
      : null,
  };
};

const EMPTY = Buffer.alloc(0);

export async function renderClubCard(
  spec: ClubCardSpec,
  request: CardRequest & {
    /** The roster's faces, in the order the club page lists them. */
    people?: { name: string; avatarUrl?: string | null }[];
  },
): Promise<RenderedCard> {
  const size = request.size ?? "wide";
  const chrome = await chromeOf(request);
  const people = request.people ?? [];
  const images = await imagesOf(people.map((person) => person.avatarUrl));

  // JPEG only when there is a photograph to justify it: without a cover the
  // card is flat colour, which PNG stores better and sharper.
  const format: CardFormat = chrome.cover ? "jpeg" : "png";

  return {
    bytes: await encode(
      size,
      (ctx) =>
        paintClubCard(ctx, spec, {
          size,
          scale: SCALE,
          font: serverFont,
          ...chrome,
          faces: people.map((person, index) => ({
            name: person.name,
            image: images[index],
          })),
        }),
      format,
    ),
    contentType: format === "jpeg" ? "image/jpeg" : "image/png",
  };
}

export async function renderPlayerCardPng(
  spec: PlayerCardSpec,
  request: CardRequest,
): Promise<Uint8Array<ArrayBuffer>> {
  const size = request.size ?? "wide";
  const chrome = await chromeOf(request);

  return encode(size, (ctx) =>
    paintPlayerCard(ctx, spec, {
      size,
      scale: SCALE,
      font: serverFont,
      ...chrome,
    }),
  );
}

export async function renderGameCardPng(
  spec: GameCardSpec,
  request: CardRequest & {
    /** One list per side, lined up with that side's names. */
    avatarUrls?: (string | null | undefined)[][];
  },
): Promise<Uint8Array<ArrayBuffer>> {
  const size = request.size ?? "wide";
  const chrome = await chromeOf(request);
  const avatars = await Promise.all(
    (request.avatarUrls ?? []).map((side) => imagesOf(side)),
  );

  return encode(size, (ctx) =>
    paintGameCard(ctx, spec, {
      size,
      scale: SCALE,
      font: serverFont,
      ...chrome,
      avatars,
    }),
  );
}

export async function renderResultCardPng(
  spec: ResultCardSpec,
  request: CardRequest & {
    /** One per podium step, in `podiumIds` order. Each is a data URI for an
     *  uploaded avatar or an http URL for a Google one; both are fetched, and
     *  either may be null. */
    avatarUrls?: (string | null | undefined)[];
  },
): Promise<Uint8Array<ArrayBuffer>> {
  const size = request.size ?? "wide";
  const chrome = await chromeOf(request);
  const avatars = await imagesOf(request.avatarUrls ?? []);

  return encode(size, (ctx) =>
    paintResultCard(ctx, spec, {
      size,
      scale: SCALE,
      font: serverFont,
      ...chrome,
      avatars,
    }),
  );
}
