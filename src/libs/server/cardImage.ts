import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import * as pureimage from "pureimage";
import sans400 from "@/assets/fonts/DMSans-Regular.ttf?inline";
import sans500 from "@/assets/fonts/DMSans-Medium.ttf?inline";
import sans700 from "@/assets/fonts/DMSans-Bold.ttf?inline";
import mono400 from "@/assets/fonts/GeistMono-Regular.ttf?inline";
import mono600 from "@/assets/fonts/GeistMono-SemiBold.ttf?inline";
import type { ResultCardSpec } from "@/libs/algorithms/resultCard";
import {
  CARD_SIZES,
  paintResultCard,
  type CardContext,
  type CardImage,
  type CardSize,
} from "@/libs/cards/paint";
import { CLUB_THEME_PALETTE } from "@/libs/theme/clubTheme";
import type { BallColor } from "@/types";

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

/** Weights the card asks for, mapped onto the ones actually shipped. 600 is
 *  drawn with 700 rather than pulling a sixth font file over the wire for one
 *  line of text. */
const FONTS = [
  { name: "CardSans400", family: "sans", weight: 400, data: sans400 },
  { name: "CardSans500", family: "sans", weight: 500, data: sans500 },
  { name: "CardSans700", family: "sans", weight: 700, data: sans700 },
  { name: "CardMono400", family: "mono", weight: 400, data: mono400 },
  { name: "CardMono600", family: "mono", weight: 600, data: mono600 },
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

/** Nearest registered weight, so the shared layout can ask for 600 without
 *  this file having to ship one. */
const familyFor = (family: "sans" | "mono", weight: number) => {
  const candidates = FONTS.filter((font) => font.family === family);
  return candidates.reduce((best, font) =>
    Math.abs(font.weight - weight) < Math.abs(best.weight - weight)
      ? font
      : best,
  ).name;
};

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

const DATA_URL = /^data:image\/\w+;base64,(.+)$/;

export async function renderResultCardPng(
  spec: ResultCardSpec,
  {
    color,
    logoUrl,
    markUrl,
    size = "wide",
  }: {
    color: BallColor;
    /** `clubs.logo_url` — a base64 data URI, PNG or JPEG whatever it claims
     *  to be. Anything else is skipped rather than guessed at. */
    logoUrl?: string | null;
    /** Absolute URL of the app's ball mark, fetched from our own origin. */
    markUrl?: string | null;
    size?: CardSize;
  },
): Promise<Uint8Array<ArrayBuffer>> {
  registerFonts();

  const { width, height } = CARD_SIZES[size];
  const bitmap = pureimage.make(width, height);
  const ctx = bitmap.getContext("2d");

  const logoBase64 = logoUrl?.match(DATA_URL)?.[1];
  const markBytes = markUrl
    ? await fetch(markUrl)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .catch(() => null)
    : null;

  paintResultCard(ctx as unknown as CardContext, spec, {
    size,
    accent: CLUB_THEME_PALETTE[color].dark.base,
    // No weight in the string: pureimage reads the first token as the size, so
    // "700 84px X" silently resolves to no font at all. Rounded, because its
    // parser wants an integer.
    font: (family, weight, px) =>
      `${Math.round(px)}px ${familyFor(family, weight)}`,
    logo: logoBase64
      ? await decodeImage(Buffer.from(logoBase64, "base64"))
      : null,
    mark: markBytes ? await decodeImage(Buffer.from(markBytes)) : null,
  });

  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  await pureimage.encodePNGToStream(bitmap, sink);
  // A plain Uint8Array rather than the Buffer: it is what a Response body
  // takes, and copying 100kB once is cheaper than explaining a cast.
  return new Uint8Array(Buffer.concat(chunks));
}
