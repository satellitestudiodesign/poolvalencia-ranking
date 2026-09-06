import { describe, expect, it } from "vitest";
import {
  clubCardSpec,
  fitText,
  gameCardSpec,
  podiumIds,
  podiumSteps,
  resultCardSpec,
  wrapText,
  type Measure,
} from "./cards";

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

/** The card draws one avatar per step by index, so these two must stay in
 *  lockstep — a mismatch would put the runner-up's face on the winner. */
describe("podiumIds", () => {
  it("lines up with podiumSteps, one for one", () => {
    const places = { first: 7, second: 2, third: [9, 4] };
    const ids = podiumIds(places);
    const steps = podiumSteps(places, (id) => `Player ${id}`);

    expect(ids).toEqual([7, 2, 9, 4]);
    expect(steps.map((step) => step.name)).toEqual(
      ids.map((id) => `Player ${id}`),
    );
    expect(steps.map((step) => step.rank)).toEqual([1, 2, 3, 3]);
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
    title: "Copa de Otoño",
    subtitle: "14 September 2026",
    places: { first: 1, second: 2, third: [] },
    nameOf,
  });

  it("names the file after the club and the tournament", () => {
    expect(spec.fileName).toBe("paulas-pool-copa-de-otono.png");
  });

  it("carries an undated tournament as an empty subtitle, not null", () => {
    const undated = resultCardSpec({
      club: "Paula's Pool",
      title: "Copa",
      subtitle: null,
      places: { first: 1, second: null, third: [] },
      nameOf,
    });
    expect(undated.subtitle).toBe("");
  });
});

describe("clubCardSpec", () => {
  it("names the file after the club, and carries an unplaced club as empty", () => {
    const spec = clubCardSpec({
      name: "Club de Billar Paula",
      place: null,
      stat: "21 jugadores",
    });

    expect(spec.fileName).toBe("club-de-billar-paula.png");
    expect(spec.subtitle).toBe("");
  });
});

describe("gameCardSpec", () => {
  const side = (name: string, score: number, won: boolean) => ({
    names: [name],
    score,
    won,
  });

  it("names the file after who played, not after a uuid", () => {
    const spec = gameCardSpec({
      club: "Paula's Pool",
      subtitle: "Bola 9 · Individual",
      sides: [side("Ana Fernández", 5, true), side("Luis Martín", 3, false)],
    });

    expect(spec.fileName).toBe("ana-fernandez-vs-luis-martin.png");
  });

  it("survives a side whose player is not on the roster", () => {
    const spec = gameCardSpec({
      club: "Paula's Pool",
      subtitle: "",
      sides: [
        { names: [], score: 5, won: true },
        side("Luis Martín", 3, false),
      ],
    });

    expect(spec.fileName).toBe("x-vs-luis-martin.png");
  });
});
