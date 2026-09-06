import { Avatar } from "@/components/ui/Avatar";
import PlayerLink from "@/components/players/PlayerLink";

/** One player on a side of a match. The name and the face come from the roster
 *  rather than from the game — games carry only the id since names moved to
 *  people — and the slug is what the public side's /players/:slug needs. */
export type SidePerson = {
  id: number;
  name: string;
  avatar_url?: string | null;
  slug?: string;
};

/** One side of a match: faces on top, names under them, so the card reads as
 *  two people rather than as two rows of text.
 *
 *  The people are resolved by the caller, because the roster they come out of
 *  is not the same on both sides of the app: inside a club it is
 *  usePlayerLookup, out on the public side it is the club's public roster. */
export default function Side({
  people,
  won,
}: {
  people: SidePerson[];
  won: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <div className="flex -space-x-3">
        {people.map((person) => (
          <Avatar
            key={person.id}
            name={person.name}
            url={person.avatar_url}
            className={`h-12 w-12 ${won ? "" : "opacity-70"}`}
          />
        ))}
      </div>
      <span
        className={`w-full truncate text-body ${
          won ? "font-semibold text-ink" : "text-ink-faint"
        }`}
      >
        {/* Nobody the roster still has: the game keeps its id, the club let the
            membership go. The em dash is what the rest of the app shows. */}
        {people.length === 0 && "—"}
        {people.map((person, i) => (
          <span key={person.id}>
            {i > 0 && " / "}
            <PlayerLink
              playerId={person.id}
              playerSlug={person.slug}
              className="transition-colors duration-150 hover:text-strike"
            >
              {person.name}
            </PlayerLink>
          </span>
        ))}
      </span>
    </div>
  );
}
