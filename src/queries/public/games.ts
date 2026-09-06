import { queryOptions } from "@tanstack/react-query";
import { getSupabase } from "@/libs/supabase";
import { keys } from "@/libs/queryKeys";
import type { Game } from "@/types";

/**
 * One result, on its own public page.
 *
 * `select("*")` is right here and wrong in every other file in this folder:
 * `games` and `tournament_matches` keep their table-wide grant to anon (see
 * sql/schema.sql), unlike clubs, players and drills, which are column-granted.
 * The RLS policy — "Games of public clubs are readable by anyone" — is what
 * decides whether a row comes back at all.
 *
 * No names in the row: they are looked up from the club roster the parent route
 * already loads, which is also what keeps an opted-out player's name off this
 * page in exactly the way it is off every other public page.
 */
export const publicGameQuery = (gameId: string) =>
  queryOptions({
    queryKey: [...keys.public.all, "game", gameId] as const,
    queryFn: async (): Promise<PublicGame | null> => {
      const supabase = getSupabase();

      const { data: game } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .maybeSingle();
      if (!game) return null;

      // Which fixture it settled, if any. A separate round trip rather than an
      // embed: the foreign key points the other way — a tournament match holds
      // the game id, not the reverse — and a result filed outside a tournament
      // is the common case, not the exception.
      const { data: fixture } = await supabase
        .from("tournament_matches")
        .select("tournament_id, round, bracket, tournament:tournaments(name)")
        .eq("game_id", gameId)
        .maybeSingle();

      return {
        game: game as Game,
        tournament: fixture?.tournament
          ? { id: fixture.tournament_id, name: fixture.tournament.name }
          : null,
      };
    },
  });

export type PublicGame = {
  game: Game;
  /** The tournament this result belongs to, for the way back up to the draw. */
  tournament: { id: number; name: string } | null;
};
