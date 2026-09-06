import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Player, TournamentMatch } from "@/types";
import PlayGameForm from "./PlayGameForm";

vi.mock("@/i18n", async (importOriginal) => {
  const { mockI18nModule } = await import("@/test/mockI18n");
  return mockI18nModule(await importOriginal());
});

const player = (id: number, name: string): Player => ({
  id,
  name,
  category: 2,
  club_id: 1,
  joined_at: "1970-01-01T00:00:00Z",
  status: "active",
  person_id: id,
  slug: name.toLowerCase(),
  user_id: null,
  avatar_url: null,
  is_public: true,
  present_since: null,
  queued_table_id: null,
  queued_at: null,
  is_device: false,
  is_caretaker: false,
  device_table_id: null,
});

const entrants = [player(1, "Paula"), player(2, "Alex")];

const match: TournamentMatch = {
  id: "m1",
  tournament_id: 1,
  bracket: "winners",
  round: 1,
  slot: 0,
  group_no: null,
  p1_id: 1,
  p2_id: 2,
  winner_id: null,
  game_id: null,
  winner_to: null,
  winner_to_slot: null,
  loser_to: null,
  loser_to_slot: null,
  game: null,
};

function setup({
  findMatch = () => match,
  raceFor = () => 5,
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
  isSubmitting = false,
}: Partial<{
  findMatch: (a: number, b: number) => TournamentMatch | undefined;
  raceFor: (m: TournamentMatch) => number;
  onSubmit: (values: {
    match: TournamentMatch;
    p1: Player;
    p2: Player;
    p1Score: number;
    p2Score: number;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}> = {}) {
  render(
    <PlayGameForm
      entrants={entrants}
      findMatch={findMatch}
      raceFor={raceFor}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />,
  );
  return { onSubmit, onCancel };
}

const pickPlayers = async (p1: string, p2: string) => {
  await userEvent.selectOptions(screen.getByLabelText("Player 1"), p1);
  await userEvent.selectOptions(screen.getByLabelText("Player 2"), p2);
};

describe("PlayGameForm", () => {
  it("disables save until a valid, outstanding, decisive result is entered", () => {
    setup();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("refuses the same player on both sides", async () => {
    setup();
    await pickPlayers("Paula", "Paula");
    expect(
      screen.getByText("Pick two different players."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("refuses a pairing with nothing outstanding, rather than silently recording it against the wrong match", async () => {
    setup({ findMatch: () => undefined });
    await pickPlayers("Paula", "Alex");
    expect(
      screen.getByText(
        "These two have already played every time they were due to.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("refuses a tied score", async () => {
    setup();
    await pickPlayers("Paula", "Alex");
    await userEvent.type(screen.getByLabelText("Paula"), "3");
    await userEvent.type(screen.getByLabelText("Alex"), "3");
    expect(
      screen.getByText("A match cannot end in a tie."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("refuses a winning score that never reaches the race — a race is won by getting there, not by being ahead at the end", async () => {
    setup({ raceFor: () => 5 });
    await pickPlayers("Paula", "Alex");
    await userEvent.type(screen.getByLabelText("Paula"), "3");
    await userEvent.type(screen.getByLabelText("Alex"), "1");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("submits the resolved match, players and scores once the result is valid", async () => {
    const { onSubmit } = setup({ raceFor: () => 5 });
    await pickPlayers("Paula", "Alex");
    await userEvent.type(screen.getByLabelText("Paula"), "5");
    await userEvent.type(screen.getByLabelText("Alex"), "2");

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await userEvent.click(save);

    expect(onSubmit).toHaveBeenCalledWith({
      match,
      p1: entrants[0],
      p2: entrants[1],
      p1Score: 5,
      p2Score: 2,
    });
  });

  it("calls onCancel from the cancel button", async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables every field and shows Saving… while isSubmitting", () => {
    setup({ isSubmitting: true });
    expect(screen.getByLabelText("Player 1")).toBeDisabled();
    expect(screen.getByLabelText("Player 2")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Saving..." }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
