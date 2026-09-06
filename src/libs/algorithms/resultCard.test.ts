import { describe, expect, it } from "vitest";
import {
  fitText,
  podiumSteps,
  resultCardSpec,
  wrapText,
  type Measure,
} from "./resultCard";

/** One character, one unit — the whole point of taking a measure function. */
const mono: Measure = (text) => text.length;

const nameOf = (id: number) => `Player ${id}`;

describe("podiumSteps", () => {
  it("orders winner, runner-up, then the shared thirds", () => {
    expect(podiumSteps({ first: 1, second: 2, third: [3, 4] }, nameOf)).toEqual(
      [
        { rank: 1, name: "Player 1" },
        { rank: 2, name: "Player 2" },
        { rank: 3, name: "Player 3" },
        { rank: 3, name: "Player 4" },
      ],
    );
  });

  it("skips places nothing decided", () => {
    expect(podiumSteps({ first: 1, second: null, third: [] }, nameOf)).toEqual([
      { rank: 1, name: "Player 1" },
    ]);
  });

  it("never runs past four steps", () => {
    const steps = podiumSteps(
      { first: 1, second: 2, third: [3, 4, 5] },
      nameOf,
    );
    expect(steps).toHaveLength(4);
  });
});

describe("fitText", () => {
  it("leaves a string that fits alone", () => {
    expect(fitText("Ana", 10, mono)).toBe("Ana");
  });

  it("ellipsises one that does not, inside the budget", () => {
    const cut = fitText("Anastasia Fernández", 10, mono);
    expect(mono(cut)).toBeLessThanOrEqual(10);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("wrapText", () => {
  it("wraps on words", () => {
    expect(wrapText("Copa de Otoño", 8, 2, mono)).toEqual(["Copa de", "Otoño"]);
  });

  it("ellipsises the last line rather than growing a third", () => {
    const lines = wrapText("Copa de Otoño de la Ciudad de Madrid", 8, 2, mono);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    lines.forEach((line) => expect(mono(line)).toBeLessThanOrEqual(8));
  });

  it("returns one line when the whole string fits", () => {
    expect(wrapText("Copa", 20, 2, mono)).toEqual(["Copa"]);
  });
});

describe("resultCardSpec", () => {
  const spec = resultCardSpec({
    club: "Paula's Pool",
    clubSlug: "paulas-pool",
    title: "Copa de Otoño",
    subtitle: "14 September 2026",
    places: { first: 1, second: 2, third: [] },
    nameOf,
    origin: "https://poolclubs.app",
  });

  it("shows the club's public page without a scheme", () => {
    expect(spec.url).toBe("poolclubs.app/clubs/paulas-pool");
  });

  it("names the file after the club and the tournament", () => {
    expect(spec.fileName).toBe("paulas-pool-copa-de-otono.png");
  });

  it("carries an undated tournament as an empty subtitle, not null", () => {
    const undated = resultCardSpec({
      club: "Paula's Pool",
      clubSlug: "paulas-pool",
      title: "Copa",
      subtitle: null,
      places: { first: 1, second: null, third: [] },
      nameOf,
      origin: "https://poolclubs.app",
    });
    expect(undated.subtitle).toBe("");
  });
});
