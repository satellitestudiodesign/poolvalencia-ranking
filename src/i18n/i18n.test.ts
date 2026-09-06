/**
 * Missing keys are already a build error (each dictionary is typed
 * Record<Key, string>); this catches what the types can't: stray keys a
 * translation gained and Spanish never had, and placeholders that don't line
 * up between languages — a `{name}` dropped in translation renders nothing.
 */
import { describe, expect, it } from "vitest";
import { pick } from "./index";
import { ABOUT, CONTACT, PRICING } from "@/content/pages";
import { LEGAL } from "@/content/legal";
import es from "./es.json" with { type: "json" };
import en from "./en.json" with { type: "json" };
import fr from "./fr.json" with { type: "json" };

const dicts = { en, fr } as Record<string, Record<string, string>>;
const base = es as Record<string, string>;
const placeholders = (text: string) =>
  (text.match(/\{(\w+)\}/g) ?? []).sort().join(",");

describe.each(Object.entries(dicts))("%s.json", (lang, dict) => {
  it(`${lang}.json has no keys es.json doesn't`, () => {
    expect(Object.keys(dict).filter((k) => !(k in base))).toEqual([]);
  });

  it(`${lang}.json is missing no keys es.json has`, () => {
    expect(Object.keys(base).filter((k) => !(k in dict))).toEqual([]);
  });

  it(`${lang}.json agrees with es.json on every placeholder`, () => {
    const mismatches = Object.keys(base).filter(
      (key) => placeholders(dict[key]) !== placeholders(base[key]),
    );
    expect(mismatches).toEqual([]);
  });
});

/**
 * Plural forms. The bug this guards is "1 players" on every directory card:
 * `{n}` was substituted into one fixed string whatever n was.
 *
 * French is the case that a hand-rolled `n === 1` gets wrong — it counts zero
 * as singular — so it is tested explicitly rather than assumed.
 */
describe("plurals", () => {
  const PLURALIZED = [
    "public.publicClubs.count",
    "public.publicClubs.members",
    "public.publicClub.hiddenMembers",
    "public.publicDrills.count",
  ] as const;

  it.each(PLURALIZED)("%s has a singular in every language", (key) => {
    for (const dict of [base, en, fr] as Record<string, string>[])
      expect(dict[`${key}_one`]).toBeTypeOf("string");
  });

  it("picks the singular at one and the plural at two", () => {
    expect(pick(en as never, "public.publicClubs.members", "en", { n: 1 })).toBe(
      "{n} player",
    );
    expect(pick(en as never, "public.publicClubs.members", "en", { n: 2 })).toBe(
      "{n} players",
    );
  });

  it("counts zero as plural in es and en, singular in fr", () => {
    const at = (lang: "es" | "en" | "fr", dict: object, n: number) =>
      pick(dict as never, "public.publicClubs.members", lang, { n });

    expect(at("es", base, 0)).toBe("{n} jugadores");
    expect(at("en", en, 0)).toBe("{n} players");
    expect(at("fr", fr, 0)).toBe("{n} joueur");
  });

  it("falls back to the bare key when a language has no such category", () => {
    // en has no `_many`; a large number must still resolve to the plural.
    expect(
      pick(en as never, "public.publicDrills.count", "en", { n: 1000000 }),
    ).toBe("{n} drills");
  });
});

/**
 * No em-dash in anything a visitor reads on the public side.
 *
 * The rule is documented at the top of pages/public/LandingPage.tsx: it reads
 * badly at 14px across es/en/fr. It held for the `landing.*` and `public.*`
 * keys and leaked back in through the translations of the prose pages, which
 * live in src/content and were never covered by anything.
 *
 * Code comments are not visible strings, so this reads the exported documents
 * rather than the source files.
 */
const PAGES = { ABOUT, CONTACT, PRICING };

describe("no em-dash in public copy", () => {
  const strings = (value: unknown): string[] =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.flatMap(strings)
        : value && typeof value === "object"
          ? Object.values(value).flatMap(strings)
          : [];

  it.each(["es", "en", "fr"])("%s dictionary", (lang) => {
    const dict = { es: base, en, fr }[lang] as Record<string, string>;
    const offenders = Object.entries(dict)
      .filter(
        ([key]) =>
          key.startsWith("public.") ||
          key.startsWith("landing.") ||
          key.startsWith("clubRequest."),
      )
      .filter(([, text]) => text.includes("—"))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it("prose and legal documents", () => {
    expect(
      strings({ ...PAGES, ...LEGAL }).filter((s) => s.includes("—")),
    ).toEqual([]);
  });
});
