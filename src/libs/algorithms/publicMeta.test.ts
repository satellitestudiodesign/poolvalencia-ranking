import { describe, it, expect } from "vitest";
import { publicMeta } from "./publicMeta";

const get = (meta: ReturnType<typeof publicMeta>, key: string) =>
  meta.find((tag) => "property" in tag && tag.property === key)?.content;

describe("publicMeta", () => {
  it("keeps the brand in the tab title but drops it from the card title", () => {
    const meta = publicMeta({
      title: "Torneo apertura · PoolClubs",
      description: "PoolValencia. Inscripciones abiertas, doble eliminación.",
      path: "/tournaments/7",
      origin: "https://poolclubs.app",
      fallback: "tournaments",
    });

    expect(meta.find((tag) => "title" in tag)?.title).toBe(
      "Torneo apertura · PoolClubs",
    );
    // og:site_name already prints "PoolClubs" above the title in every card.
    expect(get(meta, "og:title")).toBe("Torneo apertura");
    expect(get(meta, "og:site_name")).toBe("PoolClubs");
  });

  it("leaves a title that only mentions the brand mid-string alone", () => {
    const meta = publicMeta({
      title: "Ejercicio · PoolClubs · algo",
      description: "x",
      path: "/drills/1",
      origin: "https://poolclubs.app",
      fallback: "drills",
    });
    expect(get(meta, "og:title")).toBe("Ejercicio · PoolClubs · algo");
  });
});

/**
 * The bug these pin: a tournament's podium card is 1200x630, but publicMeta
 * treated every `image` as a square logo — so the card went out as
 * twitter:card=summary with no declared size and previewed as a thumbnail
 * beside the text instead of above it.
 */
describe("publicMeta image shape", () => {
  const args = {
    title: "Copa de Otoño · PoolClubs",
    description: "Cuadro y resultados.",
    path: "/tournaments/17",
    origin: "https://poolclubs.app",
    fallback: "tournaments" as const,
  };
  const find = (tags: Record<string, unknown>[], key: string) =>
    tags.find((tag) => tag.property === key || tag.name === key)?.content;

  it("announces a wide image as the large card, with its size", () => {
    const tags = publicMeta({
      ...args,
      image: "/api/og/tournaments/17.png",
      wideImage: true,
    }) as Record<string, unknown>[];

    expect(find(tags, "twitter:card")).toBe("summary_large_image");
    expect(find(tags, "og:image:width")).toBe("1200");
    expect(find(tags, "og:image:height")).toBe("630");
  });

  it("leaves a square logo as the small card, with no size claimed", () => {
    const tags = publicMeta({
      ...args,
      image: "/api/clubs/paulas-pool/logo",
    }) as Record<string, unknown>[];

    expect(find(tags, "twitter:card")).toBe("summary");
    expect(find(tags, "og:image:width")).toBeUndefined();
  });

  it("still sends the default card wide when there is no image", () => {
    const tags = publicMeta({ ...args }) as Record<string, unknown>[];

    expect(find(tags, "twitter:card")).toBe("summary_large_image");
    expect(find(tags, "og:image")).toBe("https://poolclubs.app/og/default.png");
  });
});
