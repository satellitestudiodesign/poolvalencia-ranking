/**
 * What somebody's results add up to.
 *
 * Extracted from PublicPlayerPage, which still owns the parts only that page
 * shows — the rack percentage, the last ten, the rivalries — but no longer owns
 * the three figures a stranger reads first. Those are also on the player's
 * link-preview card (routes/api/og/players), and two implementations of "how
 * many did they win" would eventually disagree in public.
 *
 * Cross-club by construction: a person holds one `players` row per club, so the
 * caller passes all of their ids and a game counts if any of them is on it.
 */

export type PlayedGame = {
  player_1_id: number;
  player_1b_id: number | null;
  player_2_id: number;
  player_2b_id: number | null;
  player_1_score: number;
  player_2_score: number;
};

/** Which side of the table they were on, or null for a game that is not
 *  theirs. Doubles counts both seats. */
export function sideOf(game: PlayedGame, mine: Set<number>): 1 | 2 | null {
  if (
    mine.has(game.player_1_id) ||
    (game.player_1b_id !== null && mine.has(game.player_1b_id))
  )
    return 1;
  if (
    mine.has(game.player_2_id) ||
    (game.player_2b_id !== null && mine.has(game.player_2b_id))
  )
    return 2;
  return null;
}

export type PlayerRecord = {
  played: number;
  won: number;
  /** Whole percent, and 0 for somebody who has not played — not NaN, which is
   *  what dividing by nothing gives and what would end up drawn on a card. */
  winRate: number;
};

export function playerRecord(
  games: PlayedGame[],
  mine: Set<number>,
): PlayerRecord {
  let played = 0;
  let won = 0;

  for (const game of games) {
    const side = sideOf(game, mine);
    if (side === null) continue;

    played++;
    const forThem = side === 1 ? game.player_1_score : game.player_2_score;
    const against = side === 1 ? game.player_2_score : game.player_1_score;
    // A draw is not a win. The app has no draws — every game runs to a race —
    // but the column is a number and nothing enforces that.
    if (forThem > against) won++;
  }

  return {
    played,
    won,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
  };
}
