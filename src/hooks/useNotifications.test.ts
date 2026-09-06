import { describe, expect, it } from "vitest";
import { since } from "./useNotifications";

describe("since", () => {
  const isNew = since("2026-01-10T12:00:00Z");

  it("hides what happened before the member joined", () => {
    expect(isNew("2026-01-09T23:59:59Z")).toBe(false);
  });

  it("keeps what happened after, and the join itself", () => {
    expect(isNew("2026-01-10T12:00:00Z")).toBe(true);
    expect(isNew("2026-01-11T00:00:00Z")).toBe(true);
  });

  it("keeps anything it cannot date", () => {
    expect(isNew(null)).toBe(true);
    expect(isNew(undefined)).toBe(true);
  });

  it("shows everything when the membership has no date either", () => {
    expect(since(null)("2020-01-01T00:00:00Z")).toBe(true);
    expect(since("not a date")("2020-01-01T00:00:00Z")).toBe(true);
  });
});
