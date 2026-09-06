


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."BallColor" AS ENUM (
    'yellow',
    'blue',
    'red',
    'purple',
    'orange',
    'green',
    'maroon',
    'black'
);


ALTER TYPE "public"."BallColor" OWNER TO "postgres";


CREATE TYPE "public"."Discipline" AS ENUM (
    '8ball',
    '9ball',
    '10ball'
);


ALTER TYPE "public"."Discipline" OWNER TO "postgres";


CREATE TYPE "public"."GameMode" AS ENUM (
    'single',
    'doubles'
);


ALTER TYPE "public"."GameMode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_guest_player"("cid" integer, "pname" "text", "cat" double precision DEFAULT 3) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  pid BIGINT;
  new_player BIGINT;
BEGIN
  IF NOT is_club_admin(cid) THEN
    RAISE EXCEPTION 'only the club owner may add players';
  END IF;
  IF btrim(COALESCE(pname, '')) = '' THEN
    RAISE EXCEPTION 'a player needs a name';
  END IF;

  -- Deliberately always a new person. Matching a guest onto an existing person
  -- by name is exactly the guess this file's backfill only made because it had
  -- no alternative; going forward, claiming is how two rows become one human.
  INSERT INTO people (name) VALUES (btrim(pname)) RETURNING id INTO pid;

  INSERT INTO players (club_id, person_id, category, status)
  VALUES (cid, pid, cat, 'active')
  RETURNING id INTO new_player;

  RETURN new_player;
END $$;


ALTER FUNCTION "public"."add_guest_player"("cid" integer, "pname" "text", "cat" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_club_request"("p_id" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  req club_requests%ROWTYPE;
  cid INTEGER;
BEGIN
  IF NOT is_drill_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO req FROM club_requests WHERE id = p_id AND status = 'open';
  IF req.id IS NULL THEN RAISE EXCEPTION 'no such open request'; END IF;

  cid := create_club(req.name, req.requested_by);

  -- What the form asked for beyond the name. The owner fills in the rest.
  UPDATE clubs SET city = req.city, country = req.country WHERE id = cid;

  UPDATE club_requests
  SET status = 'approved', club_id = cid, decided_at = now()
  WHERE id = p_id;

  RETURN cid;
END $$;


ALTER FUNCTION "public"."approve_club_request"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approved_member_contact"("p_player_id" bigint) RETURNS TABLE("email" "text", "name" "text", "club_name" "text", "club_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT u.email::text, pe.name, c.name, c.slug
  FROM players pl
  JOIN people pe ON pe.id = pl.person_id
  JOIN clubs  c  ON c.id  = pl.club_id
  JOIN auth.users u ON u.id = pe.user_id
  WHERE pl.id = p_player_id
    -- Only an admin of *this* player's club, which is the same test the UI
    -- gates the Approve button on. is_club_admin reads auth.uid() itself.
    AND public.is_club_admin(pl.club_id)
    -- Only once they are actually in. This is what pins the function to the
    -- moment the mail is legitimate: a pending request, or somebody who was
    -- rejected, returns nothing. It also means the caller cannot use this to
    -- enumerate addresses of people who never joined.
    AND pl.status = 'active'
    -- A claimed roster row that no human has ever signed into has no user and
    -- no address. Nothing to send, and the join would drop it anyway — spelled
    -- out so the intent is not mistaken for an oversight.
    AND pe.user_id IS NOT NULL
    -- The club's own tablet is a player row with no person behind it.
    AND pl.is_device = false;
$$;


ALTER FUNCTION "public"."approved_member_contact"("p_player_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_ranking_night"("p_club_id" integer) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_last timestamp with time zone;
  v_now  timestamp with time zone;
BEGIN
  IF NOT is_club_admin(p_club_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT night_call_at INTO v_last FROM clubs WHERE id = p_club_id FOR UPDATE;

  -- Two hours. Long enough that the second press is somebody wondering whether
  -- the first worked, short enough that a club playing twice in an evening can
  -- still call the second half.
  IF v_last IS NOT NULL AND v_last > now() - interval '2 hours' THEN
    RAISE EXCEPTION 'called too recently' USING ERRCODE = 'P0001';
  END IF;

  UPDATE clubs SET night_call_at = now() WHERE id = p_club_id
    RETURNING night_call_at INTO v_now;

  RETURN v_now;
END;
$$;


ALTER FUNCTION "public"."call_ranking_night"("p_club_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_score_live_match"("cid" integer, "p1" bigint, "p2" bigint, "p1b" bigint, "p2b" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- is_own_player(NULL) is false, so the empty doubles seats need no guard.
  SELECT is_club_admin(cid)
      OR is_club_device(cid)
      OR is_own_player(p1::integer)
      OR is_own_player(p2::integer)
      OR is_own_player(p1b::integer)
      OR is_own_player(p2b::integer);
$$;


ALTER FUNCTION "public"."can_score_live_match"("cid" integer, "p1" bigint, "p2" bigint, "p1b" bigint, "p2b" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_touch_plan"("pid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM training_plans tp
    WHERE tp.id = pid AND can_touch_player(tp.player_id)
  );
$$;


ALTER FUNCTION "public"."can_touch_plan"("pid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_touch_player"("pid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p WHERE p.id = pid AND is_club_member(p.club_id)
  );
$$;


ALTER FUNCTION "public"."can_touch_player"("pid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_device"("p_code" "text") RETURNS TABLE("club_slug" "text", "table_id" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cid integer;
  tid integer;
  table_label text;
  pid bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'a device has to be signed in before it can be paired';
  END IF;

  -- FOR UPDATE, so two tablets typing the same code in the same second cannot
  -- both consume it.
  SELECT c.club_id, c.table_id INTO cid, tid
  FROM club_device_codes c
  WHERE c.code = upper(btrim(p_code)) AND c.expires_at > now()
  FOR UPDATE;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'that code is not valid any more';
  END IF;

  -- Already paired, to this club or another: one device, one membership.
  IF EXISTS (
    SELECT 1 FROM players p JOIN people pe ON pe.id = p.person_id
    WHERE pe.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'this device is already paired';
  END IF;

  SELECT label INTO table_label FROM club_tables WHERE id = tid;

  -- Named after its table, so the owner's list of devices reads as the room.
  -- is_public false and a name that is furniture rather than a person: it is
  -- filtered out of the roster and both rankings by the client, and anywhere it
  -- does surface it should be obvious that it is not somebody.
  INSERT INTO people (name, user_id, is_public)
  VALUES (table_label || ' · tablet', auth.uid(), false)
  RETURNING id INTO pid;

  INSERT INTO players (club_id, person_id, status, is_device, device_table_id)
  VALUES (cid, pid, 'active', true, tid);

  -- One shot. The tablet keeps its session; the code is spent.
  DELETE FROM club_device_codes WHERE code = upper(btrim(p_code));

  RETURN QUERY SELECT c.slug, tid FROM clubs c WHERE c.id = cid;
END $$;


ALTER FUNCTION "public"."claim_device"("p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_claim_contact"("p_slug" "text") RETURNS TABLE("email" "text", "name" "text", "club_name" "text", "club_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    (SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()),
    (SELECT pe.name FROM people pe WHERE pe.user_id = auth.uid() ORDER BY pe.id LIMIT 1),
    c.name,
    c.slug
  FROM clubs c
  JOIN auth.users owner ON owner.id = c.owner_id
  WHERE c.slug = p_slug
    -- A hidden club has no public page to claim it from.
    AND c.is_public
    AND owner.email = 'admin@poolclubs.app';
$$;


ALTER FUNCTION "public"."club_claim_contact"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_photo_club_id"("object_name" "text") RETURNS integer
    LANGUAGE "sql" STABLE STRICT
    SET "search_path" TO 'public'
    AS $_$
  SELECT CASE
    WHEN (storage.foldername(object_name))[1] ~ '^club-\d+$'
    THEN substring((storage.foldername(object_name))[1] from 6)::integer
  END;
$_$;


ALTER FUNCTION "public"."club_photo_club_id"("object_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_preview"("p_slug" "text") RETURNS TABLE("club_id" integer, "club_name" "text", "player_id" integer, "player_name" "text", "claimable" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id, c.name, p.id, pe.name, pe.user_id IS NULL
  FROM clubs c
  LEFT JOIN players p ON p.club_id = c.id
  LEFT JOIN people pe ON pe.id = p.person_id
  WHERE c.slug = lower(btrim(p_slug))
  ORDER BY pe.name;
$$;


ALTER FUNCTION "public"."club_preview"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_request_ops_contact"("p_id" integer) RETURNS TABLE("email" "text", "name" "text", "club_name" "text", "city" "text", "country" "text", "note" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    u.email::text,
    COALESCE((SELECT pe.name FROM people pe WHERE pe.user_id = r.requested_by ORDER BY pe.id LIMIT 1),
             u.email::text),
    r.name, r.city, r.country, r.note
  FROM club_requests r
  JOIN auth.users u ON u.id = r.requested_by
  WHERE r.id = p_id
    AND r.requested_by = auth.uid()
    AND r.status = 'open';
$$;


ALTER FUNCTION "public"."club_request_ops_contact"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_request_owner_contact"("p_id" integer) RETURNS TABLE("email" "text", "name" "text", "club_name" "text", "club_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    u.email::text,
    COALESCE((SELECT pe.name FROM people pe WHERE pe.user_id = r.requested_by ORDER BY pe.id LIMIT 1),
             u.email::text),
    c.name,
    c.slug
  FROM club_requests r
  JOIN auth.users u ON u.id = r.requested_by
  JOIN clubs c ON c.id = r.club_id
  WHERE r.id = p_id
    AND r.status = 'approved'
    AND public.is_drill_admin();
$$;


ALTER FUNCTION "public"."club_request_owner_contact"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."club_slug_reserved"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT ARRAY['login', 'logout', 'join', 'clubs', 'me', 'auth', 'api', 'new']
$$;


ALTER FUNCTION "public"."club_slug_reserved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clubs_recount_members"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    ids integer[] := '{}';
    cid integer;
BEGIN
    -- Both sides, because an UPDATE can move a player between clubs. The TG_OP
    -- checks are statements rather than a CASE inside one expression: plpgsql
    -- raises on any reference to OLD during an INSERT, so the guard has to stop
    -- the reference being evaluated at all.
    IF TG_OP <> 'INSERT' THEN
        ids := ids || OLD.club_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        ids := ids || NEW.club_id;
    END IF;

    FOR cid IN
        SELECT DISTINCT c FROM unnest(ids) AS c WHERE c IS NOT NULL
    LOOP
        UPDATE public.clubs
        SET member_count = (
            SELECT count(*) FROM public.players
            WHERE club_id = cid AND status = 'active'
              -- A caretaker holds the keys; they do not play here.
              AND NOT is_caretaker
        )
        WHERE id = cid;
    END LOOP;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."clubs_recount_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clubs_set_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base text;
BEGIN
    IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
        RETURN NEW;
    END IF;

    base := public.slugify(NEW.name);

    IF base = ANY (public.club_slug_reserved())
        OR EXISTS (SELECT 1 FROM public.clubs WHERE slug = base AND id <> NEW.id)
    THEN
        NEW.slug := base || '-' || NEW.id;
    ELSE
        NEW.slug := base;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clubs_set_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clubs_timezone_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone
  ) THEN
    RAISE EXCEPTION 'unknown timezone: %', NEW.timezone;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."clubs_timezone_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_club"("club_name" "text", "p_owner" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cid INTEGER;
  uid UUID := COALESCE(p_owner, auth.uid());
  me BIGINT;
  pname TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  INSERT INTO clubs (name, owner_id) VALUES (btrim(club_name), uid) RETURNING id INTO cid;

  -- One person per account, shared across every club they belong to. Someone
  -- getting their second club already has one and keeps their name and face.
  SELECT id INTO me FROM people WHERE user_id = uid;

  IF me IS NULL THEN
    -- The JWT is the caller's, so it is only the right name when the caller is
    -- the owner. Approving somebody else's request falls through to 'Player',
    -- and they rename themselves.
    pname := COALESCE(
      CASE WHEN p_owner IS NULL OR p_owner = auth.uid()
        THEN NULLIF(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), '')
      END,
      'Player'
    );
    INSERT INTO people (name, user_id) VALUES (pname, uid) RETURNING id INTO me;
  END IF;

  INSERT INTO players (club_id, person_id, category, status)
  VALUES (cid, me, 3, 'active');

  RETURN cid;
END $$;


ALTER FUNCTION "public"."create_club"("club_name" "text", "p_owner" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_live_match"("p_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  m public.live_matches;
  g uuid;
  w bigint;
BEGIN
  SELECT * INTO m FROM live_matches WHERE id = p_id FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'this match is already finished';
  END IF;

  -- SECURITY DEFINER bypasses RLS, so the policy's predicate is restated here
  -- by hand. Same function, so the two cannot drift.
  IF NOT can_score_live_match(m.club_id, m.player_1_id, m.player_2_id,
                              m.player_1b_id, m.player_2b_id) THEN
    RAISE EXCEPTION 'only the players or the club can finish this match';
  END IF;

  -- The daily table discards a tie as bad data, so it must not be filed at all.
  IF m.player_1_score = m.player_2_score THEN
    RAISE EXCEPTION 'a finished match needs a winner';
  END IF;

  INSERT INTO games (club_id, mode, discipline, played_at,
                     player_1_id, player_2_id, player_1b_id, player_2b_id,
                     player_1_score, player_2_score)
  VALUES (m.club_id, m.mode, m.discipline, now(),
          m.player_1_id, m.player_2_id, m.player_1b_id, m.player_2b_id,
          m.player_1_score, m.player_2_score)
  RETURNING id INTO g;

  IF m.challenge_id IS NOT NULL THEN
    UPDATE challenges SET status = 'played', game_id = g WHERE id = m.challenge_id;
  END IF;

  IF m.tournament_match_id IS NOT NULL THEN
    w := CASE WHEN m.player_1_score > m.player_2_score
              THEN m.player_1_id ELSE m.player_2_id END;
    -- tournament_match_guard still fires and permits exactly these two columns
    -- for a non-admin, which is the validation this would otherwise repeat.
    UPDATE tournament_matches SET game_id = g, winner_id = w
    WHERE id = m.tournament_match_id;
  END IF;

  DELETE FROM live_matches WHERE id = p_id;
  RETURN g;
END $$;


ALTER FUNCTION "public"."finish_live_match"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_member"("p_person_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Despite the name, this asks only "does the caller admin a club this person
  -- plays in" — the guest half of that policy is its own `user_id IS NULL`.
  -- Which is exactly the test wanted here, for members with an account too.
  IF NOT person_is_admins_guest(p_person_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  -- One column, one direction. No branch on the current value: hiding
  -- something already hidden is not an error worth raising.
  UPDATE people SET is_public = false WHERE id = p_person_id;
END $$;


ALTER FUNCTION "public"."hide_member"("p_person_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_admin"("cid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM clubs WHERE id = cid AND owner_id = auth.uid());
$$;


ALTER FUNCTION "public"."is_club_admin"("cid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_device"("cid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN people pe ON pe.id = p.person_id
    WHERE p.club_id = cid AND pe.user_id = auth.uid()
      AND p.status = 'active' AND p.is_device
  );
$$;


ALTER FUNCTION "public"."is_club_device"("cid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_member"("cid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN people pe ON pe.id = p.person_id
    WHERE p.club_id = cid AND pe.user_id = auth.uid() AND p.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_club_member"("cid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_club_requested"("cid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Rejected as well as pending: the panel that tells somebody they were turned
  -- down names the club and offers its phone number, and both come off this row.
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN people pe ON pe.id = p.person_id
    WHERE p.club_id = cid AND pe.user_id = auth.uid()
      AND p.status IN ('pending', 'rejected')
  );
$$;


ALTER FUNCTION "public"."is_club_requested"("cid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_drill_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN people pe ON pe.id = p.person_id
    WHERE p.id = 1 AND pe.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_drill_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_own_person"("pid" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM people pe WHERE pe.id = pid AND pe.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_own_person"("pid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_own_player"("pid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    JOIN people pe ON pe.id = p.person_id
    WHERE p.id = pid AND pe.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_own_player"("pid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_public_club"("cid" integer) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (SELECT 1 FROM clubs WHERE id = cid AND is_public);
$$;


ALTER FUNCTION "public"."is_public_club"("cid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_club"("p_slug" "text", "claim_player_id" integer DEFAULT NULL::integer, "display_name" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cid INTEGER;
  uid UUID := auth.uid();
  me BIGINT;
  claimed BIGINT;
  pname TEXT;
  mine TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  SELECT id INTO cid FROM clubs WHERE clubs.slug = lower(btrim(p_slug));
  IF cid IS NULL THEN RAISE EXCEPTION 'unknown club'; END IF;

  SELECT id INTO me FROM people WHERE user_id = uid;

  -- Already have a row in this club, under whichever person is yours.
  IF me IS NOT NULL THEN
    SELECT status INTO mine FROM players WHERE club_id = cid AND person_id = me;

    -- Turned down before, or left of their own accord, and coming back. The
    -- admin gets told again, because join_request_admin_contact answers for a
    -- pending row and this is one again — which is the point of letting them
    -- ask. The row is reused, so whatever they played is still theirs.
    IF mine IN ('rejected', 'left') THEN
      UPDATE players SET status = 'pending'
      WHERE club_id = cid AND person_id = me;
      RETURN cid;
    END IF;

    IF mine IS NOT NULL THEN RETURN cid; END IF;
  END IF;

  IF claim_player_id IS NOT NULL AND me IS NULL THEN
    UPDATE people pe
    SET user_id = uid
    FROM players p
    WHERE p.id = claim_player_id
      AND p.club_id = cid
      AND pe.id = p.person_id
      AND pe.user_id IS NULL
    RETURNING pe.id INTO claimed;

    IF claimed IS NOT NULL THEN
      UPDATE players SET status = 'pending' WHERE person_id = claimed;
      RETURN cid;
    END IF;
    -- Claimed between the preview and now, or you already had a person: fall
    -- through and join as somebody new.
  END IF;

  IF me IS NULL THEN
    pname := COALESCE(
      NULLIF(btrim(display_name), ''),
      NULLIF(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      'Player'
    );
    INSERT INTO people (name, user_id) VALUES (pname, uid) RETURNING id INTO me;
  END IF;

  INSERT INTO players (club_id, person_id, category, status)
  VALUES (cid, me, 3, 'pending');

  RETURN cid;
END $$;


ALTER FUNCTION "public"."join_club"("p_slug" "text", "claim_player_id" integer, "display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) RETURNS TABLE("email" "text", "name" "text", "club_name" "text", "club_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT u.email::text, pe.name, c.name, c.slug
  FROM players pl
  JOIN people pe ON pe.id = pl.person_id
  JOIN clubs  c  ON c.id  = pl.club_id
  -- Admin is the owner, which is what is_club_admin tests. One recipient.
  JOIN auth.users u ON u.id = c.owner_id
  WHERE pl.club_id = p_club_id
    -- The caller is the person who asked. Nobody can run this for anybody else.
    AND pe.user_id = auth.uid()
    AND pl.status = 'pending'
    -- The club's own tablet is a player row with no human behind it, and it is
    -- never pending anyway — spelled out so the intent is not mistaken for an
    -- oversight.
    AND pl.is_device = false;
$$;


ALTER FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_club"("p_club_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid UUID := auth.uid();
  me BIGINT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  -- The owner is the only admin a club has. Letting them walk out would leave
  -- nobody able to approve a member, and clubs.owner_id pointing at somebody
  -- who is not in the club.
  IF EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = uid) THEN
    RAISE EXCEPTION 'the owner cannot leave their own club' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO me FROM people WHERE user_id = uid;
  IF me IS NULL THEN RETURN; END IF;

  -- Not a DELETE: see the header. The row stays, so the games they played stay
  -- with it and their opponents' history is untouched — it just stops being an
  -- active membership. present_since and the queue go, because a member who
  -- left must not be left standing in a queue for a table.
  UPDATE players
  SET status = 'left', present_since = NULL, queued_table_id = NULL, queued_at = NULL
  WHERE club_id = p_club_id AND person_id = me AND is_device = false;
END $$;


ALTER FUNCTION "public"."leave_club"("p_club_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."live_match_checks_in_seats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Racking up is the strongest check-in there is, and it must not be on loan
  -- from this row. whoIsHere in libs/algorithms/night.ts counts a seat as being
  -- present, and the row is deleted three ways: filed by finish_live_match,
  -- abandoned from the bar, and cleared by anybody at all three hours after it
  -- went quiet. A night that started with four people playing and nobody
  -- tapping "I'm here" emptied its own board on the first result.
  --
  -- Only ever set, never cleared, and never over an existing check-in: leaving
  -- is somebody's decision -- their own, or another member's on the board --
  -- and overwriting would restart the wait clock the queue is sorted on, so
  -- starting a match would send that player to the back of it.
  UPDATE players SET present_since = now()
  WHERE id IN (NEW.player_1_id, NEW.player_2_id, NEW.player_1b_id, NEW.player_2b_id)
    AND present_since IS NULL;

  RETURN NULL;
END $$;


ALTER FUNCTION "public"."live_match_checks_in_seats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."live_match_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM club_tables WHERE id = NEW.table_id AND club_id = NEW.club_id
    ) THEN
      RAISE EXCEPTION 'that table belongs to another club';
    END IF;
    RETURN NEW;
  END IF;

  -- The abandonment clock is the server's, not the client's.
  NEW.updated_at := now();

  IF NEW.club_id IS DISTINCT FROM OLD.club_id THEN
    RAISE EXCEPTION 'a live match cannot change club';
  END IF;

  IF NEW.table_id IS DISTINCT FROM OLD.table_id AND NEW.table_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM club_tables WHERE id = NEW.table_id AND club_id = NEW.club_id
     ) THEN
    RAISE EXCEPTION 'that table belongs to another club';
  END IF;

  IF is_club_admin(OLD.club_id) OR is_club_device(OLD.club_id) THEN
    RETURN NEW;
  END IF;

  IF ROW(NEW.id, NEW.player_1_id, NEW.player_2_id, NEW.player_1b_id,
         NEW.player_2b_id, NEW.mode, NEW.challenge_id,
         NEW.tournament_match_id, NEW.started_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.player_1_id, OLD.player_2_id, OLD.player_1b_id,
         OLD.player_2b_id, OLD.mode, OLD.challenge_id,
         OLD.tournament_match_id, OLD.started_at)
  THEN
    RAISE EXCEPTION 'players may change the score, the table, the race and the discipline';
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."live_match_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."operator_clubs"() RETURNS TABLE("id" integer, "name" "text", "slug" "text", "is_public" boolean, "member_count" integer, "pending_count" integer, "games_total" bigint, "games_7d" bigint, "games_30d" bigint, "last_game_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.name,
    c.slug,
    c.is_public,
    c.member_count,
    (SELECT count(*) FROM players p
      WHERE p.club_id = c.id AND p.status = 'pending')::integer,
    (SELECT count(*) FROM games g WHERE g.club_id = c.id),
    (SELECT count(*) FROM games g
      WHERE g.club_id = c.id AND g.played_at >= now() - interval '7 days'),
    (SELECT count(*) FROM games g
      WHERE g.club_id = c.id AND g.played_at >= now() - interval '30 days'),
    (SELECT max(g.played_at) FROM games g WHERE g.club_id = c.id),
    c.created_at
  FROM clubs c
  WHERE public.is_drill_admin()
  ORDER BY c.created_at DESC;
$$;


ALTER FUNCTION "public"."operator_clubs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."people_drop_orphan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM people
  WHERE id = OLD.person_id
    AND user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM players WHERE person_id = OLD.person_id);
  RETURN NULL;
END $$;


ALTER FUNCTION "public"."people_drop_orphan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."people_guard_edit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- No auth.uid() means service_role or the SQL editor: your own maintenance,
  -- including unlinking a person, still works.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF OLD.user_id IS NOT NULL OR NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION
        'people.user_id may only be set to your own id, and only on an unlinked person';
    END IF;
  END IF;

  -- The URL is written once and then never again, exactly as a club's is.
  NEW.slug := OLD.slug;

  -- Somebody else's row. RLS has already established that you administer a club
  -- they are in; this is what that does and does not entitle you to change. A
  -- guest row has nobody behind it, so none of it applies there — the club owns
  -- that record outright.
  IF OLD.user_id IS DISTINCT FROM auth.uid() AND OLD.user_id IS NOT NULL THEN
    -- Taking somebody off the public site is the club's call (hide_member, which
    -- only ever writes false). Putting them back on is theirs alone.
    IF NEW.is_public AND NOT OLD.is_public THEN
      RAISE EXCEPTION 'only the person may list themselves publicly';
    END IF;

    -- Their face is theirs.
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
      RAISE EXCEPTION 'only the person may change their own picture';
    END IF;
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."people_guard_edit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."people_set_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base text;
BEGIN
    IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
        RETURN NEW;
    END IF;

    base := public.slugify(NEW.name);

    IF EXISTS (SELECT 1 FROM public.people WHERE slug = base AND id <> NEW.id) THEN
        NEW.slug := base || '-' || NEW.id;
    ELSE
        NEW.slug := base;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."people_set_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."person_in_public_club"("pid" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p
    WHERE p.person_id = pid AND p.status = 'active' AND is_public_club(p.club_id)
  );
$$;


ALTER FUNCTION "public"."person_in_public_club"("pid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."person_is_admins_guest"("pid" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p WHERE p.person_id = pid AND is_club_admin(p.club_id)
  );
$$;


ALTER FUNCTION "public"."person_is_admins_guest"("pid" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."person_is_admins_guest"("pid" bigint) IS 'Whether the caller administers a club this person belongs to. Named for its first caller; it says nothing about whether they are a guest.';



CREATE OR REPLACE FUNCTION "public"."person_shares_club"("pid" bigint) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM players p WHERE p.person_id = pid AND is_club_member(p.club_id)
  );
$$;


ALTER FUNCTION "public"."person_shares_club"("pid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."players_guard_membership"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NEW.club_id IS DISTINCT FROM OLD.club_id AND NOT is_club_admin(OLD.club_id) THEN
    RAISE EXCEPTION 'only the club owner may move a player between clubs';
  END IF;

  IF NEW.person_id IS DISTINCT FROM OLD.person_id THEN
    RAISE EXCEPTION 'a membership cannot be reassigned to another person';
  END IF;

  -- The two things you may do to your own membership: ask to be let in, and
  -- walk out. Everything else about a status is the club owner's to decide.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT is_club_admin(OLD.club_id)
     AND NOT (
       NEW.status IN ('pending', 'left')
       AND EXISTS (SELECT 1 FROM people WHERE id = NEW.person_id AND user_id = auth.uid())
     ) THEN
    RAISE EXCEPTION 'only the club owner may change a member''s status';
  END IF;

  IF (NEW.is_device, NEW.device_table_id) IS DISTINCT FROM (OLD.is_device, OLD.device_table_id)
     AND NOT is_club_admin(OLD.club_id) THEN
    RAISE EXCEPTION 'only the club owner may designate a device account';
  END IF;

  -- Anybody in the club may say who is here, either way round. A ranking night
  -- is a room of people telling each other who turned up, and making that the
  -- owner's job left the board wrong every night the owner was mid-rack.
  IF NEW.present_since IS DISTINCT FROM OLD.present_since
     AND NOT is_club_member(OLD.club_id) THEN
    RAISE EXCEPTION 'only the club can check somebody in';
  END IF;

  IF (NEW.queued_table_id, NEW.queued_at)
     IS DISTINCT FROM (OLD.queued_table_id, OLD.queued_at)
     AND NOT (is_own_player(NEW.id::integer)
              OR is_club_admin(OLD.club_id)
              OR is_club_device(OLD.club_id)) THEN
    RAISE EXCEPTION 'you can only queue yourself';
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."players_guard_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_prune"("p_endpoints" "text"[]) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  DELETE FROM push_subscriptions WHERE endpoint = ANY (p_endpoints);
$$;


ALTER FUNCTION "public"."push_prune"("p_endpoints" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) RETURNS TABLE("endpoint" "text", "p256dh" "text", "auth" "text", "lang" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  c challenges;
  t tournaments;
  cm comments;
  cl clubs;
BEGIN
  IF p_kind = 'challengeSent' THEN
    SELECT * INTO c FROM challenges ch WHERE ch.id = p_ref;
    IF c.id IS NULL OR c.status <> 'pending'
       OR NOT is_own_player(c.from_player_id) THEN
      RETURN;
    END IF;

    RETURN QUERY
      SELECT s.endpoint, s.p256dh, s.auth, s.lang
      FROM players p
      JOIN push_subscriptions s ON s.person_id = p.person_id
      WHERE p.id = c.to_player_id AND NOT p.is_device;

  ELSIF p_kind = 'challengeAnswered' THEN
    SELECT * INTO c FROM challenges ch WHERE ch.id = p_ref;
    -- The answer is the challenged player's to give. Either side may write the
    -- row under RLS, but only that direction is news to anybody.
    IF c.id IS NULL OR c.status NOT IN ('accepted', 'declined')
       OR NOT is_own_player(c.to_player_id) THEN
      RETURN;
    END IF;

    RETURN QUERY
      SELECT s.endpoint, s.p256dh, s.auth, s.lang
      FROM players p
      JOIN push_subscriptions s ON s.person_id = p.person_id
      WHERE p.id = c.from_player_id AND NOT p.is_device;

  ELSIF p_kind = 'tournamentOpen' THEN
    SELECT * INTO t FROM tournaments tr WHERE tr.id = p_ref;
    -- 'open' is the row's birth default, so this is also "was just created".
    IF t.id IS NULL OR t.status <> 'open' OR NOT is_club_admin(t.club_id) THEN
      RETURN;
    END IF;

    RETURN QUERY
      SELECT s.endpoint, s.p256dh, s.auth, s.lang
      FROM players p
      JOIN people pe ON pe.id = p.person_id
      JOIN push_subscriptions s ON s.person_id = p.person_id
      WHERE p.club_id = t.club_id
        AND p.status = 'active'
        AND NOT p.is_device
        AND (t.category IS NULL OR p.category = t.category)
        AND pe.user_id IS DISTINCT FROM auth.uid();

  ELSIF p_kind = 'commentMention' THEN
    SELECT * INTO cm FROM comments cc WHERE cc.id = p_ref;
    -- Only the author of the comment may make it buzz, and only for the body
    -- as it was written: the slugs are re-read here, so editing the row later
    -- cannot be used to notify somebody it never named.
    IF cm.id IS NULL OR NOT is_own_player(cm.author_player_id) THEN
      RETURN;
    END IF;

    -- The mention pattern is the one in src/libs/algorithms/mentions.ts. A
    -- thread on a tournament is readable by anyone, so anybody named in it may
    -- be told; a thread on a game or a drill log is club-only, so being named
    -- in one notifies nobody outside that club's active roster.
    RETURN QUERY
      SELECT DISTINCT s.endpoint, s.p256dh, s.auth, s.lang
      FROM regexp_matches(cm.body, '@([a-z0-9]+(?:-[a-z0-9]+)*)', 'g') AS m(parts)
      JOIN people pe ON pe.slug = m.parts[1]
      JOIN push_subscriptions s ON s.person_id = pe.id
      WHERE pe.user_id IS DISTINCT FROM auth.uid()
        AND (
          (cm.tournament_id IS NOT NULL AND is_public_club(cm.club_id))
          OR EXISTS (
            SELECT 1 FROM players p
            WHERE p.person_id = pe.id
              AND p.club_id = cm.club_id
              AND p.status = 'active'
              AND NOT p.is_device
          )
        );

  ELSIF p_kind = 'nightCall' THEN
    -- p_ref is the club, not a row of its own: a call to a ranking night is an
    -- event with nothing to point at but the club it is at, and clubs.night_call_at
    -- is when it happened.
    SELECT * INTO cl FROM clubs c2 WHERE c2.id = p_ref;

    -- Two conditions, and the second is the one that matters. Being an admin is
    -- who may call; night_call_at inside the last minute is *that* they just
    -- did, through call_ranking_night, which is where the two-hour limit lives.
    -- Without it this branch would send a club-wide push on demand, as often as
    -- it was asked.
    IF cl.id IS NULL
       OR NOT is_club_admin(p_ref)
       OR cl.night_call_at IS NULL
       OR cl.night_call_at <= now() - interval '1 minute' THEN
      RETURN;
    END IF;

    -- The whole active roster except the people it would be telling nothing:
    -- the tablets, the caretaker who does not play here, and anybody whose face
    -- is already lit on the board. DISTINCT because push_subscriptions is keyed
    -- by person, and a person in two clubs has one set of devices.
    --
    -- A check-in is never cleared, it expires on being read — the eight hours
    -- are PRESENT_WINDOW_MS in src/libs/algorithms/night.ts, and this is the
    -- second copy of that rule. Testing the column for NULL alone would leave
    -- out everybody who came last week.
    RETURN QUERY
      SELECT DISTINCT s.endpoint, s.p256dh, s.auth, s.lang
      FROM players p
      JOIN people pe ON pe.id = p.person_id
      JOIN push_subscriptions s ON s.person_id = p.person_id
      WHERE p.club_id = p_ref
        AND p.status = 'active'
        AND NOT p.is_device
        AND NOT p.is_caretaker
        AND (p.present_since IS NULL
             OR p.present_since <= now() - interval '8 hours')
        AND pe.user_id IS DISTINCT FROM auth.uid();
  END IF;
END;
$$;


ALTER FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_club_request"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT is_drill_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE club_requests
  SET status = 'rejected', decided_at = now()
  WHERE id = p_id AND status = 'open';
END $$;


ALTER FUNCTION "public"."reject_club_request"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_club"("p_name" "text", "p_city" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  uid UUID := auth.uid();
  rid INTEGER;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  -- A second identical request tells us nothing the first did, and two open
  -- rows for one person is two things to approve.
  SELECT id INTO rid FROM club_requests WHERE requested_by = uid AND status = 'open';
  IF rid IS NOT NULL THEN RETURN rid; END IF;

  INSERT INTO club_requests (name, city, country, note, requested_by)
  VALUES (
    btrim(p_name),
    NULLIF(btrim(p_city), ''),
    NULLIF(upper(btrim(p_country)), ''),
    NULLIF(btrim(p_note), '')
  )
  RETURNING id INTO rid;

  RETURN rid;
END $$;


ALTER FUNCTION "public"."request_club"("p_name" "text", "p_city" "text", "p_country" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("txt" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT COALESCE(NULLIF(
        trim(BOTH '-' FROM
            regexp_replace(
                -- Apostrophes vanish rather than separating, so "Paula's Pool"
                -- is paulas-pool and not paula-s-pool.
                regexp_replace(
                    translate(
                        replace(lower(txt), 'ß', 'ss'),
                        'àáäâãåāèéëêēìíïîīòóöôõøōùúüûūñçÿýž',
                        'aaaaaaaeeeeeiiiiiooooooouuuuuncyyz'
                    ),
                    '[''’]', '', 'g'
                ),
                '[^a-z0-9]+', '-', 'g'
            )
        ), ''),
        -- A name of nothing but punctuation still needs a slug, and the CHECK
        -- below requires it to start with an alphanumeric.
        'club')
$$;


ALTER FUNCTION "public"."slugify"("txt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_device_pairing"("cid" integer, "tid" integer) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  -- No O/0, no I/1/L. This gets read off a phone and typed into a tablet by
  -- somebody standing up, and those are the characters that get typed wrong.
  alphabet CONSTANT text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text := '';
  i integer;
BEGIN
  IF NOT is_club_admin(cid) THEN
    RAISE EXCEPTION 'only the club owner may pair a device';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM club_tables WHERE id = tid AND club_id = cid) THEN
    RAISE EXCEPTION 'that table belongs to another club';
  END IF;

  -- One live code per table, not per club: a club fitting out six tables in an
  -- afternoon wants six codes at once, and a code is only good for the tablet
  -- standing at its own table anyway.
  DELETE FROM club_device_codes WHERE table_id = tid;

  FOR i IN 1..6 LOOP
    new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;

  -- Expired codes anywhere are dead weight; this is the only moment anything
  -- writes this table, so it is the only place they need sweeping.
  DELETE FROM club_device_codes WHERE expires_at < now();

  INSERT INTO club_device_codes (code, club_id, table_id, expires_at)
  VALUES (new_code, cid, tid, now() + interval '10 minutes');

  RETURN new_code;
END $$;


ALTER FUNCTION "public"."start_device_pairing"("cid" integer, "tid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tournament_club"("tid" integer) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT club_id FROM tournaments WHERE id = tid;
$$;


ALTER FUNCTION "public"."tournament_club"("tid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tournament_match_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.is_club_admin(public.tournament_club(NEW.tournament_id)) THEN
    RETURN NEW;
  END IF;

  IF ROW(NEW.id, NEW.tournament_id, NEW.bracket, NEW.round, NEW.slot,
         NEW.group_no, NEW.p1_id, NEW.p2_id,
         NEW.winner_to, NEW.winner_to_slot, NEW.loser_to, NEW.loser_to_slot)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.tournament_id, OLD.bracket, OLD.round, OLD.slot,
         OLD.group_no, OLD.p1_id, OLD.p2_id,
         OLD.winner_to, OLD.winner_to_slot, OLD.loser_to, OLD.loser_to_slot)
  THEN
    RAISE EXCEPTION
      'only the club owner can change a match; members may set game_id and winner_id';
  END IF;

  -- p1_id and p2_id are only stored for the seats known at generation, so the
  -- column CHECK above says nothing about a semi-final. This is the part that
  -- still holds there: whoever goes through has to be in the tournament.
  IF NEW.winner_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM tournament_players
       WHERE tournament_id = NEW.tournament_id AND player_id = NEW.winner_id
     )
  THEN
    RAISE EXCEPTION 'the winner must be an entrant in this tournament';
  END IF;

  RETURN NEW;
END $$;


ALTER FUNCTION "public"."tournament_match_guard"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" integer NOT NULL,
    "club_id" integer NOT NULL,
    "from_player_id" integer NOT NULL,
    "to_player_id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "game_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "challenges_check" CHECK (("from_player_id" <> "to_player_id")),
    CONSTRAINT "challenges_message_check" CHECK (("char_length"("message") <= 500)),
    CONSTRAINT "challenges_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'played'::"text"])))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."challenges_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."challenges_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."challenges_id_seq" OWNED BY "public"."challenges"."id";



CREATE TABLE IF NOT EXISTS "public"."club_device_codes" (
    "code" "text" NOT NULL,
    "club_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "table_id" integer NOT NULL
);


ALTER TABLE "public"."club_device_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_requests" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "city" "text",
    "country" "text",
    "note" "text",
    "requested_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "club_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    CONSTRAINT "club_requests_country_shape" CHECK ((("country" IS NULL) OR ("country" ~ '^[A-Z]{2}$'::"text"))),
    CONSTRAINT "club_requests_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 60))),
    CONSTRAINT "club_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."club_requests" OWNER TO "postgres";


ALTER TABLE "public"."club_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."club_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."club_tables" (
    "id" integer NOT NULL,
    "club_id" integer NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" smallint DEFAULT 0 NOT NULL,
    CONSTRAINT "club_tables_label_check" CHECK ((("char_length"("btrim"("label")) >= 1) AND ("char_length"("btrim"("label")) <= 24)))
);


ALTER TABLE "public"."club_tables" OWNER TO "postgres";


ALTER TABLE "public"."club_tables" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."club_tables_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."clubs" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "logo_url" "text",
    "theme_color" "public"."BallColor" DEFAULT 'yellow'::"public"."BallColor" NOT NULL,
    "slug" "text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "address" "text",
    "city" "text",
    "country" "text",
    "lat" double precision,
    "lon" double precision,
    "phone" "text",
    "description" "text",
    "schedule" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "photo_order" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tables_info" "text",
    "has_logo" boolean GENERATED ALWAYS AS (("logo_url" IS NOT NULL)) STORED,
    "night_call_at" timestamp with time zone,
    "contact_email" "text",
    CONSTRAINT "clubs_contact_email_shape" CHECK ((("contact_email" IS NULL) OR ("contact_email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::"text"))),
    CONSTRAINT "clubs_country_shape" CHECK ((("country" IS NULL) OR ("country" ~ '^[A-Z]{2}$'::"text"))),
    CONSTRAINT "clubs_latlon_pair" CHECK (((("lat" IS NULL) = ("lon" IS NULL)) AND (("lat" IS NULL) OR ((("lat" >= ('-90'::integer)::double precision) AND ("lat" <= (90)::double precision)) AND (("lon" >= ('-180'::integer)::double precision) AND ("lon" <= (180)::double precision)))))),
    CONSTRAINT "clubs_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 60))),
    CONSTRAINT "clubs_slug_shape" CHECK ((("slug" ~ '^[a-z0-9][a-z0-9-]*$'::"text") AND (NOT ("slug" = ANY ("public"."club_slug_reserved"())))))
);


ALTER TABLE "public"."clubs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clubs"."has_logo" IS 'Sortable mirror of "logo_url IS NOT NULL": the directory and the map lead with clubs that have one.';



COMMENT ON COLUMN "public"."clubs"."night_call_at" IS 'When an admin last called the club to a ranking night. Both the rate limit (one call per two hours, in call_ranking_night) and the window push_targets will send a nightCall inside.';



COMMENT ON COLUMN "public"."clubs"."contact_email" IS 'Where to write to the club. Shown to somebody whose join request was turned down, and alongside the phone number wherever the club offers a way to reach it.';



CREATE SEQUENCE IF NOT EXISTS "public"."clubs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clubs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."clubs_id_seq" OWNED BY "public"."clubs"."id";



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" integer NOT NULL,
    "club_id" integer NOT NULL,
    "author_player_id" integer NOT NULL,
    "game_id" "uuid",
    "drill_log_id" integer,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tournament_id" integer,
    CONSTRAINT "comments_body_check" CHECK ((("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 1000))),
    CONSTRAINT "comments_check" CHECK (("num_nonnulls"("game_id", "drill_log_id", "tournament_id") = 1))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."comments_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."comments_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."comments_id_seq" OWNED BY "public"."comments"."id";



CREATE TABLE IF NOT EXISTS "public"."drill_logs" (
    "id" integer NOT NULL,
    "drill_id" integer NOT NULL,
    "player_id" integer NOT NULL,
    "score" integer NOT NULL,
    "max_score" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drill_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."drill_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."drill_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."drill_logs_id_seq" OWNED BY "public"."drill_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."drills" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "skill_type" "text" NOT NULL,
    "setup_instructions" "text" NOT NULL,
    "scoring_method" "text" NOT NULL,
    "max_score" integer NOT NULL,
    "ball_positions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "shot_paths" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "club_id" integer,
    CONSTRAINT "drills_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "drills_skill_type_check" CHECK (("skill_type" = ANY (ARRAY['potting'::"text", 'position'::"text", 'safety'::"text", 'break'::"text", 'banks'::"text", 'kicks'::"text", 'patterns'::"text", 'specials'::"text"])))
);


ALTER TABLE "public"."drills" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."drills_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."drills_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."drills_id_seq" OWNED BY "public"."drills"."id";



CREATE TABLE IF NOT EXISTS "public"."games" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "player_1_score" bigint NOT NULL,
    "player_2_score" bigint NOT NULL,
    "player_1_id" bigint NOT NULL,
    "player_2_id" bigint NOT NULL,
    "mode" "public"."GameMode" DEFAULT 'single'::"public"."GameMode" NOT NULL,
    "player_1b_id" bigint,
    "player_2b_id" bigint,
    "club_id" integer NOT NULL,
    "discipline" "public"."Discipline" DEFAULT '9ball'::"public"."Discipline" NOT NULL,
    "played_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_matches" (
    "id" "uuid" NOT NULL,
    "club_id" integer NOT NULL,
    "table_id" integer,
    "player_1_id" bigint NOT NULL,
    "player_2_id" bigint NOT NULL,
    "player_1b_id" bigint,
    "player_2b_id" bigint,
    "mode" "public"."GameMode" DEFAULT 'single'::"public"."GameMode" NOT NULL,
    "discipline" "public"."Discipline" DEFAULT '9ball'::"public"."Discipline" NOT NULL,
    "player_1_score" smallint DEFAULT 0 NOT NULL,
    "player_2_score" smallint DEFAULT 0 NOT NULL,
    "race_to" smallint DEFAULT 5 NOT NULL,
    "last_side" smallint,
    "challenge_id" integer,
    "tournament_match_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "live_matches_doubles_check" CHECK ((("mode" = 'doubles'::"public"."GameMode") = (("player_1b_id" IS NOT NULL) AND ("player_2b_id" IS NOT NULL)))),
    CONSTRAINT "live_matches_last_side_check" CHECK ((("last_side" IS NULL) OR ("last_side" = ANY (ARRAY[1, 2])))),
    CONSTRAINT "live_matches_origin_check" CHECK (("num_nonnulls"("challenge_id", "tournament_match_id") <= 1)),
    CONSTRAINT "live_matches_race_check" CHECK ((("race_to" >= 1) AND ("race_to" <= 50))),
    CONSTRAINT "live_matches_scores_check" CHECK (((("player_1_score" >= 0) AND ("player_1_score" <= 200)) AND (("player_2_score" >= 0) AND ("player_2_score" <= 200)))),
    CONSTRAINT "live_matches_seats_check" CHECK (("player_1_id" <> "player_2_id"))
);


ALTER TABLE "public"."live_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "user_id" "uuid",
    "is_public" boolean DEFAULT true NOT NULL,
    CONSTRAINT "people_name_check" CHECK (("char_length"("btrim"("name")) >= 1)),
    CONSTRAINT "people_slug_shape" CHECK (("slug" ~ '^[a-z0-9][a-z0-9-]*$'::"text"))
);


ALTER TABLE "public"."people" OWNER TO "postgres";


ALTER TABLE "public"."people" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."people_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" bigint NOT NULL,
    "category" double precision DEFAULT '3'::double precision NOT NULL,
    "club_id" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "person_id" bigint NOT NULL,
    "present_since" timestamp with time zone,
    "queued_table_id" integer,
    "queued_at" timestamp with time zone,
    "is_device" boolean DEFAULT false NOT NULL,
    "device_table_id" integer,
    "is_caretaker" boolean DEFAULT false NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "players_queue_check" CHECK ((("queued_table_id" IS NULL) = ("queued_at" IS NULL))),
    CONSTRAINT "players_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'rejected'::"text", 'left'::"text"])))
);


ALTER TABLE "public"."players" OWNER TO "postgres";


COMMENT ON COLUMN "public"."players"."is_caretaker" IS 'Holds the keys, does not play here: kept out of member_count and out of the roster.';



COMMENT ON COLUMN "public"."players"."joined_at" IS 'When the membership row was created. The notification feed hides anything older — see src/hooks/useNotifications.ts.';



ALTER TABLE "public"."players" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."players_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "endpoint" "text" NOT NULL,
    "person_id" bigint NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "lang" "text" DEFAULT 'es'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "push_subscriptions_endpoint_check" CHECK ((("char_length"("endpoint") >= 20) AND ("char_length"("endpoint") <= 500))),
    CONSTRAINT "push_subscriptions_lang_check" CHECK (("lang" = ANY (ARRAY['es'::"text", 'en'::"text", 'fr'::"text"])))
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" integer NOT NULL,
    "club_id" integer NOT NULL,
    "author_player_id" integer NOT NULL,
    "game_id" "uuid",
    "drill_log_id" integer,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tournament_id" integer,
    CONSTRAINT "reactions_check" CHECK (("num_nonnulls"("game_id", "drill_log_id", "tournament_id") = 1)),
    CONSTRAINT "reactions_emoji_check" CHECK ((("char_length"("emoji") >= 1) AND ("char_length"("emoji") <= 16)))
);


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."reactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."reactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."reactions_id_seq" OWNED BY "public"."reactions"."id";



CREATE TABLE IF NOT EXISTS "public"."tournament_matches" (
    "id" "uuid" NOT NULL,
    "tournament_id" integer NOT NULL,
    "bracket" "text" NOT NULL,
    "round" smallint NOT NULL,
    "slot" smallint NOT NULL,
    "group_no" smallint,
    "p1_id" integer,
    "p2_id" integer,
    "winner_id" integer,
    "game_id" "uuid",
    "winner_to" "uuid",
    "winner_to_slot" smallint,
    "loser_to" "uuid",
    "loser_to_slot" smallint,
    CONSTRAINT "tournament_matches_bracket_check" CHECK (("bracket" = ANY (ARRAY['group'::"text", 'winners'::"text", 'losers'::"text", 'final'::"text", 'league'::"text"]))),
    CONSTRAINT "tournament_matches_group_no_check" CHECK ((("bracket" = 'group'::"text") = ("group_no" IS NOT NULL))),
    CONSTRAINT "tournament_matches_loser_slot_check" CHECK (("loser_to_slot" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "tournament_matches_winner_check" CHECK ((("winner_id" IS NULL) OR ("winner_id" = "p1_id") OR ("winner_id" = "p2_id"))),
    CONSTRAINT "tournament_matches_winner_slot_check" CHECK (("winner_to_slot" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."tournament_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_players" (
    "tournament_id" integer NOT NULL,
    "player_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" integer NOT NULL,
    "club_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "format" "text" NOT NULL,
    "category" smallint,
    "legs" smallint DEFAULT 1 NOT NULL,
    "advance" smallint,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "discipline" "public"."Discipline" DEFAULT '9ball'::"public"."Discipline" NOT NULL,
    "race_to" smallint DEFAULT 5 NOT NULL,
    "race_semi" smallint,
    "race_final" smallint,
    "single_from" smallint DEFAULT 2 NOT NULL,
    "starts_on" "date",
    "ends_on" "date",
    "entry_fee" "text",
    CONSTRAINT "tournaments_advance_check" CHECK ((("format" = 'group_knockout'::"text") = ("advance" IS NOT NULL))),
    CONSTRAINT "tournaments_advance_values_check" CHECK (("advance" = ANY (ARRAY[2, 4, 8, 16]))),
    CONSTRAINT "tournaments_category_check" CHECK (("category" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "tournaments_dates_check" CHECK ((("ends_on" IS NULL) OR (("starts_on" IS NOT NULL) AND ("ends_on" >= "starts_on")))),
    CONSTRAINT "tournaments_format_check" CHECK (("format" = ANY (ARRAY['double_elim'::"text", 'league'::"text", 'group_knockout'::"text"]))),
    CONSTRAINT "tournaments_legs_check" CHECK (("legs" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "tournaments_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 60))),
    CONSTRAINT "tournaments_race_final_check" CHECK ((("race_final" IS NULL) OR (("race_final" >= 1) AND ("race_final" <= 50)))),
    CONSTRAINT "tournaments_race_semi_check" CHECK ((("race_semi" IS NULL) OR (("race_semi" >= 1) AND ("race_semi" <= 50)))),
    CONSTRAINT "tournaments_race_to_check" CHECK ((("race_to" >= 1) AND ("race_to" <= 50))),
    CONSTRAINT "tournaments_single_from_check" CHECK (("single_from" = ANY (ARRAY[2, 4, 8, 16, 32]))),
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'groups'::"text", 'running'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


ALTER TABLE "public"."tournaments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournaments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."training_plan_steps" (
    "id" integer NOT NULL,
    "plan_id" integer NOT NULL,
    "drill_id" integer NOT NULL,
    "step_order" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "drill_log_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "training_plan_steps_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."training_plan_steps" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."training_plan_steps_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."training_plan_steps_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."training_plan_steps_id_seq" OWNED BY "public"."training_plan_steps"."id";



CREATE TABLE IF NOT EXISTS "public"."training_plans" (
    "id" integer NOT NULL,
    "player_id" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."training_plans" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."training_plans_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."training_plans_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."training_plans_id_seq" OWNED BY "public"."training_plans"."id";



ALTER TABLE ONLY "public"."challenges" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."challenges_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."clubs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."clubs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."comments" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."comments_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."drill_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."drill_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."drills" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."drills_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."reactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."reactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."training_plan_steps" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."training_plan_steps_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."training_plans" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."training_plans_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_device_codes"
    ADD CONSTRAINT "club_device_codes_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."club_requests"
    ADD CONSTRAINT "club_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_tables"
    ADD CONSTRAINT "club_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drill_logs"
    ADD CONSTRAINT "drill_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drills"
    ADD CONSTRAINT "drills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_club_person_key" UNIQUE ("club_id", "person_id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("endpoint");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_position_key" UNIQUE NULLS NOT DISTINCT ("tournament_id", "bracket", "group_no", "round", "slot");



ALTER TABLE ONLY "public"."tournament_players"
    ADD CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("tournament_id", "player_id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plan_steps"
    ADD CONSTRAINT "training_plan_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_plan_steps"
    ADD CONSTRAINT "training_plan_steps_plan_id_step_order_key" UNIQUE ("plan_id", "step_order");



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id");



CREATE INDEX "challenges_club_idx" ON "public"."challenges" USING "btree" ("club_id", "status");



CREATE INDEX "club_device_codes_club_idx" ON "public"."club_device_codes" USING "btree" ("club_id");



CREATE UNIQUE INDEX "club_requests_one_open" ON "public"."club_requests" USING "btree" ("requested_by") WHERE ("status" = 'open'::"text");



CREATE INDEX "club_tables_club_idx" ON "public"."club_tables" USING "btree" ("club_id", "sort_order");



CREATE UNIQUE INDEX "club_tables_label_key" ON "public"."club_tables" USING "btree" ("club_id", "lower"("btrim"("label")));



CREATE UNIQUE INDEX "clubs_slug_key" ON "public"."clubs" USING "btree" ("slug");



CREATE INDEX "comments_game_idx" ON "public"."comments" USING "btree" ("game_id", "created_at");



CREATE INDEX "comments_log_idx" ON "public"."comments" USING "btree" ("drill_log_id", "created_at");



CREATE INDEX "comments_tournament_idx" ON "public"."comments" USING "btree" ("tournament_id") WHERE ("tournament_id" IS NOT NULL);



CREATE INDEX "games_club_played_idx" ON "public"."games" USING "btree" ("club_id", "played_at" DESC);



CREATE INDEX "idx_drill_logs_drill" ON "public"."drill_logs" USING "btree" ("drill_id");



CREATE INDEX "idx_drill_logs_player" ON "public"."drill_logs" USING "btree" ("player_id");



CREATE INDEX "idx_training_plan_steps_plan" ON "public"."training_plan_steps" USING "btree" ("plan_id");



CREATE INDEX "idx_training_plans_player" ON "public"."training_plans" USING "btree" ("player_id");



CREATE INDEX "live_matches_club_idx" ON "public"."live_matches" USING "btree" ("club_id", "updated_at" DESC);



CREATE UNIQUE INDEX "live_matches_one_per_table" ON "public"."live_matches" USING "btree" ("table_id") WHERE ("table_id" IS NOT NULL);



CREATE UNIQUE INDEX "people_slug_key" ON "public"."people" USING "btree" ("slug");



CREATE INDEX "players_club_idx" ON "public"."players" USING "btree" ("club_id", "status");



CREATE INDEX "players_device_table_idx" ON "public"."players" USING "btree" ("device_table_id") WHERE ("device_table_id" IS NOT NULL);



CREATE INDEX "players_person_idx" ON "public"."players" USING "btree" ("person_id");



CREATE INDEX "players_queue_idx" ON "public"."players" USING "btree" ("queued_table_id", "queued_at") WHERE ("queued_table_id" IS NOT NULL);



CREATE INDEX "push_subscriptions_person_idx" ON "public"."push_subscriptions" USING "btree" ("person_id");



CREATE INDEX "reactions_game_idx" ON "public"."reactions" USING "btree" ("game_id");



CREATE UNIQUE INDEX "reactions_game_once" ON "public"."reactions" USING "btree" ("author_player_id", "game_id", "emoji") WHERE ("game_id" IS NOT NULL);



CREATE INDEX "reactions_log_idx" ON "public"."reactions" USING "btree" ("drill_log_id");



CREATE UNIQUE INDEX "reactions_log_once" ON "public"."reactions" USING "btree" ("author_player_id", "drill_log_id", "emoji") WHERE ("drill_log_id" IS NOT NULL);



CREATE INDEX "reactions_tournament_idx" ON "public"."reactions" USING "btree" ("tournament_id") WHERE ("tournament_id" IS NOT NULL);



CREATE UNIQUE INDEX "reactions_tournament_once" ON "public"."reactions" USING "btree" ("author_player_id", "tournament_id", "emoji") WHERE ("tournament_id" IS NOT NULL);



CREATE INDEX "tournament_matches_t_idx" ON "public"."tournament_matches" USING "btree" ("tournament_id", "bracket", "group_no", "round", "slot");



CREATE INDEX "tournaments_club_idx" ON "public"."tournaments" USING "btree" ("club_id", "status");



CREATE OR REPLACE TRIGGER "clubs_set_slug" BEFORE INSERT ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."clubs_set_slug"();



CREATE OR REPLACE TRIGGER "clubs_timezone_check" BEFORE INSERT OR UPDATE OF "timezone" ON "public"."clubs" FOR EACH ROW EXECUTE FUNCTION "public"."clubs_timezone_guard"();



CREATE OR REPLACE TRIGGER "live_matches_check_in_seats" AFTER INSERT ON "public"."live_matches" FOR EACH ROW EXECUTE FUNCTION "public"."live_match_checks_in_seats"();



CREATE OR REPLACE TRIGGER "live_matches_guard" BEFORE INSERT OR UPDATE ON "public"."live_matches" FOR EACH ROW EXECUTE FUNCTION "public"."live_match_guard"();



CREATE OR REPLACE TRIGGER "people_drop_orphan" AFTER DELETE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."people_drop_orphan"();



CREATE OR REPLACE TRIGGER "people_guard_edit" BEFORE UPDATE ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."people_guard_edit"();



CREATE OR REPLACE TRIGGER "people_set_slug" BEFORE INSERT ON "public"."people" FOR EACH ROW EXECUTE FUNCTION "public"."people_set_slug"();



CREATE OR REPLACE TRIGGER "players_guard_membership" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."players_guard_membership"();



CREATE OR REPLACE TRIGGER "players_recount_members" AFTER INSERT OR DELETE OR UPDATE OF "status", "club_id" ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."clubs_recount_members"();



CREATE OR REPLACE TRIGGER "tournament_matches_guard" BEFORE UPDATE ON "public"."tournament_matches" FOR EACH ROW EXECUTE FUNCTION "public"."tournament_match_guard"();



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_from_player_id_fkey" FOREIGN KEY ("from_player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_to_player_id_fkey" FOREIGN KEY ("to_player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_device_codes"
    ADD CONSTRAINT "club_device_codes_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_device_codes"
    ADD CONSTRAINT "club_device_codes_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."club_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_requests"
    ADD CONSTRAINT "club_requests_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."club_requests"
    ADD CONSTRAINT "club_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."club_tables"
    ADD CONSTRAINT "club_tables_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clubs"
    ADD CONSTRAINT "clubs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_author_player_id_fkey" FOREIGN KEY ("author_player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_drill_log_id_fkey" FOREIGN KEY ("drill_log_id") REFERENCES "public"."drill_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drill_logs"
    ADD CONSTRAINT "drill_logs_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drill_logs"
    ADD CONSTRAINT "drill_logs_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drills"
    ADD CONSTRAINT "drills_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");



ALTER TABLE ONLY "public"."drills"
    ADD CONSTRAINT "drills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_player_1_id_fkey" FOREIGN KEY ("player_1_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_player_1b_id_fkey" FOREIGN KEY ("player_1b_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_player_2_id_fkey" FOREIGN KEY ("player_2_id") REFERENCES "public"."players"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_player_2b_id_fkey" FOREIGN KEY ("player_2b_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_player_1_id_fkey" FOREIGN KEY ("player_1_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_player_1b_id_fkey" FOREIGN KEY ("player_1b_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_player_2_id_fkey" FOREIGN KEY ("player_2_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_player_2b_id_fkey" FOREIGN KEY ("player_2b_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."club_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_matches"
    ADD CONSTRAINT "live_matches_tournament_match_id_fkey" FOREIGN KEY ("tournament_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people"
    ADD CONSTRAINT "people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_device_table_id_fkey" FOREIGN KEY ("device_table_id") REFERENCES "public"."club_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_queued_table_id_fkey" FOREIGN KEY ("queued_table_id") REFERENCES "public"."club_tables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_author_player_id_fkey" FOREIGN KEY ("author_player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_drill_log_id_fkey" FOREIGN KEY ("drill_log_id") REFERENCES "public"."drill_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_loser_to_fkey" FOREIGN KEY ("loser_to") REFERENCES "public"."tournament_matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_p1_id_fkey" FOREIGN KEY ("p1_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_p2_id_fkey" FOREIGN KEY ("p2_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_matches"
    ADD CONSTRAINT "tournament_matches_winner_to_fkey" FOREIGN KEY ("winner_to") REFERENCES "public"."tournament_matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tournament_players"
    ADD CONSTRAINT "tournament_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_players"
    ADD CONSTRAINT "tournament_players_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plan_steps"
    ADD CONSTRAINT "training_plan_steps_drill_id_fkey" FOREIGN KEY ("drill_id") REFERENCES "public"."drills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plan_steps"
    ADD CONSTRAINT "training_plan_steps_drill_log_id_fkey" FOREIGN KEY ("drill_log_id") REFERENCES "public"."drill_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_plan_steps"
    ADD CONSTRAINT "training_plan_steps_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_plans"
    ADD CONSTRAINT "training_plans_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can add players" ON "public"."players" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can create tournaments" ON "public"."tournaments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can delete matches" ON "public"."tournament_matches" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Admin can delete tournaments" ON "public"."tournaments" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can generate matches" ON "public"."tournament_matches" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_admin"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Admin can manage device codes" ON "public"."club_device_codes" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can manage tables" ON "public"."club_tables" TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can remove players" ON "public"."players" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Admin can update people in their clubs" ON "public"."people" FOR UPDATE TO "authenticated" USING ("public"."person_is_admins_guest"("id")) WITH CHECK ("public"."person_is_admins_guest"("id"));



CREATE POLICY "Admin can update tournaments" ON "public"."tournaments" FOR UPDATE TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Anyone signed in can comment on a public tournament" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK ((("tournament_id" IS NOT NULL) AND "public"."is_public_club"("public"."tournament_club"("tournament_id")) AND ("club_id" = "public"."tournament_club"("tournament_id")) AND "public"."is_own_player"("author_player_id")));



CREATE POLICY "Anyone signed in can react to a public tournament" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK ((("tournament_id" IS NOT NULL) AND "public"."is_public_club"("public"."tournament_club"("tournament_id")) AND ("club_id" = "public"."tournament_club"("tournament_id")) AND "public"."is_own_player"("author_player_id")));



CREATE POLICY "Authenticated users can create clubs" ON "public"."clubs" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Author can edit their comment" ON "public"."comments" FOR UPDATE TO "authenticated" USING ("public"."is_own_player"("author_player_id")) WITH CHECK (("public"."is_own_player"("author_player_id") AND ("public"."is_club_member"("club_id") OR (("tournament_id" IS NOT NULL) AND "public"."is_public_club"("public"."tournament_club"("tournament_id")) AND ("club_id" = "public"."tournament_club"("tournament_id"))))));



CREATE POLICY "Author can remove reactions" ON "public"."reactions" FOR DELETE TO "authenticated" USING (("public"."is_own_player"("author_player_id") OR "public"."is_club_admin"("club_id")));



CREATE POLICY "Author or admin can delete comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("public"."is_own_player"("author_player_id") OR "public"."is_club_admin"("club_id")));



CREATE POLICY "Challenger can withdraw" ON "public"."challenges" FOR DELETE TO "authenticated" USING (("public"."is_own_player"("from_player_id") OR "public"."is_club_admin"("club_id")));



CREATE POLICY "Club admins can delete club games" ON "public"."games" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("club_id"));



CREATE POLICY "Club admins can edit club games" ON "public"."games" FOR UPDATE TO "authenticated" USING ("public"."is_club_admin"("club_id")) WITH CHECK ("public"."is_club_admin"("club_id"));



CREATE POLICY "Creator or admin can delete drills" ON "public"."drills" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_drill_admin"()));



CREATE POLICY "Creator or admin can update drills" ON "public"."drills" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_drill_admin"())) WITH CHECK (((("created_by" = "auth"."uid"()) AND (("club_id" IS NULL) OR "public"."is_club_member"("club_id"))) OR "public"."is_drill_admin"()));



CREATE POLICY "Either side can respond" ON "public"."challenges" FOR UPDATE TO "authenticated" USING (("public"."is_own_player"("to_player_id") OR "public"."is_own_player"("from_player_id"))) WITH CHECK (("public"."is_own_player"("to_player_id") OR "public"."is_own_player"("from_player_id")));



CREATE POLICY "Entrant or admin can withdraw" ON "public"."tournament_players" FOR DELETE TO "authenticated" USING (("public"."is_own_player"("player_id") OR "public"."is_club_admin"("public"."tournament_club"("tournament_id"))));



CREATE POLICY "Entrants of public tournaments are readable by anyone" ON "public"."tournament_players" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Games of public clubs are readable by anyone" ON "public"."games" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("club_id"));



CREATE POLICY "Live matches of public clubs are readable by anyone" ON "public"."live_matches" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("club_id"));



CREATE POLICY "Matches of public tournaments are readable by anyone" ON "public"."tournament_matches" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Members can add club games" ON "public"."games" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can clear an abandoned match" ON "public"."live_matches" FOR DELETE TO "authenticated" USING (("public"."is_club_member"("club_id") AND ("updated_at" < ("now"() - '03:00:00'::interval))));



CREATE POLICY "Members can delete drill logs" ON "public"."drill_logs" FOR DELETE TO "authenticated" USING ("public"."can_touch_player"("player_id"));



CREATE POLICY "Members can enter themselves" ON "public"."tournament_players" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("public"."tournament_club"("tournament_id")) AND (EXISTS ( SELECT 1
   FROM "public"."players"
  WHERE (("players"."id" = "tournament_players"."player_id") AND ("players"."club_id" = "public"."tournament_club"("tournament_players"."tournament_id"))))) AND ("public"."is_own_player"("player_id") OR "public"."is_club_admin"("public"."tournament_club"("tournament_id")))));



CREATE POLICY "Members can insert their own club drills" ON "public"."drills" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("club_id" IS NOT NULL) AND "public"."is_club_member"("club_id")));



CREATE POLICY "Members can read comments" ON "public"."comments" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can read drill logs" ON "public"."drill_logs" FOR SELECT TO "authenticated" USING ("public"."can_touch_player"("player_id"));



CREATE POLICY "Members can read plan steps" ON "public"."training_plan_steps" FOR SELECT TO "authenticated" USING ("public"."can_touch_plan"("plan_id"));



CREATE POLICY "Members can read reactions" ON "public"."reactions" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can read training plans" ON "public"."training_plans" FOR SELECT TO "authenticated" USING ("public"."can_touch_player"("player_id"));



CREATE POLICY "Members can record results" ON "public"."tournament_matches" FOR UPDATE TO "authenticated" USING ("public"."is_club_member"("public"."tournament_club"("tournament_id"))) WITH CHECK ("public"."is_club_member"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Members can see the club's tables" ON "public"."club_tables" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can send challenges" ON "public"."challenges" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("club_id") AND "public"."is_own_player"("from_player_id")));



CREATE POLICY "Members can start a live match" ON "public"."live_matches" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("club_id") AND "public"."can_score_live_match"("club_id", "player_1_id", "player_2_id", "player_1b_id", "player_2b_id")));



CREATE POLICY "Members can update club players" ON "public"."players" FOR UPDATE TO "authenticated" USING ("public"."is_club_member"("club_id")) WITH CHECK ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can update plan steps" ON "public"."training_plan_steps" FOR UPDATE TO "authenticated" USING ("public"."can_touch_plan"("plan_id")) WITH CHECK ("public"."can_touch_plan"("plan_id"));



CREATE POLICY "Members can update training plans" ON "public"."training_plans" FOR UPDATE TO "authenticated" USING ("public"."can_touch_player"("player_id")) WITH CHECK ("public"."can_touch_player"("player_id"));



CREATE POLICY "Members can view club challenges" ON "public"."challenges" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can view club drills or the shared catalog" ON "public"."drills" FOR SELECT TO "authenticated" USING ((("club_id" IS NULL) OR "public"."is_club_member"("club_id")));



CREATE POLICY "Members can view club games" ON "public"."games" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can view club players" ON "public"."players" FOR SELECT TO "authenticated" USING (("public"."is_club_member"("club_id") OR ("person_id" IN ( SELECT "people"."id"
   FROM "public"."people"
  WHERE ("people"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can view club tournaments" ON "public"."tournaments" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can view entrants" ON "public"."tournament_players" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Members can view people in their clubs" ON "public"."people" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."person_shares_club"("id")));



CREATE POLICY "Members can view their clubs" ON "public"."clubs" FOR SELECT TO "authenticated" USING (("public"."is_club_member"("id") OR "public"."is_club_admin"("id")));



CREATE POLICY "Members can view tournament matches" ON "public"."tournament_matches" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("public"."tournament_club"("tournament_id")));



CREATE POLICY "Members can watch live matches" ON "public"."live_matches" FOR SELECT TO "authenticated" USING ("public"."is_club_member"("club_id"));



CREATE POLICY "Members can write comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("club_id") AND "public"."is_own_player"("author_player_id")));



CREATE POLICY "Members can write drill logs" ON "public"."drill_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_touch_player"("player_id"));



CREATE POLICY "Members can write plan steps" ON "public"."training_plan_steps" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_touch_plan"("plan_id"));



CREATE POLICY "Members can write reactions" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_club_member"("club_id") AND "public"."is_own_player"("author_player_id")));



CREATE POLICY "Members can write training plans" ON "public"."training_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_touch_player"("player_id"));



CREATE POLICY "Operator sees every club request" ON "public"."club_requests" FOR SELECT TO "authenticated" USING ("public"."is_drill_admin"());



CREATE POLICY "Own club requests" ON "public"."club_requests" FOR SELECT TO "authenticated" USING (("requested_by" = "auth"."uid"()));



CREATE POLICY "Own person can be updated" ON "public"."people" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Own row can be updated" ON "public"."players" FOR UPDATE TO "authenticated" USING (("person_id" IN ( SELECT "people"."id"
   FROM "public"."people"
  WHERE ("people"."user_id" = "auth"."uid"())))) WITH CHECK (("person_id" IN ( SELECT "people"."id"
   FROM "public"."people"
  WHERE ("people"."user_id" = "auth"."uid"()))));



CREATE POLICY "Own subscriptions are readable" ON "public"."push_subscriptions" FOR SELECT TO "authenticated" USING ("public"."is_own_person"("person_id"));



CREATE POLICY "Own subscriptions can be added" ON "public"."push_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_own_person"("person_id"));



CREATE POLICY "Own subscriptions can be removed" ON "public"."push_subscriptions" FOR DELETE TO "authenticated" USING ("public"."is_own_person"("person_id"));



CREATE POLICY "Own subscriptions can be updated" ON "public"."push_subscriptions" FOR UPDATE TO "authenticated" USING ("public"."is_own_person"("person_id")) WITH CHECK ("public"."is_own_person"("person_id"));



CREATE POLICY "Owner can delete club" ON "public"."clubs" FOR DELETE TO "authenticated" USING ("public"."is_club_admin"("id"));



CREATE POLICY "Owner can update club" ON "public"."clubs" FOR UPDATE TO "authenticated" USING ("public"."is_club_admin"("id")) WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Participants and the club can abandon" ON "public"."live_matches" FOR DELETE TO "authenticated" USING ("public"."can_score_live_match"("club_id", "player_1_id", "player_2_id", "player_1b_id", "player_2b_id"));



CREATE POLICY "Participants and the club can score" ON "public"."live_matches" FOR UPDATE TO "authenticated" USING ("public"."can_score_live_match"("club_id", "player_1_id", "player_2_id", "player_1b_id", "player_2b_id")) WITH CHECK ("public"."can_score_live_match"("club_id", "player_1_id", "player_2_id", "player_1b_id", "player_2b_id"));



CREATE POLICY "Pending members can see the club they asked to join" ON "public"."clubs" FOR SELECT TO "authenticated" USING ("public"."is_club_requested"("id"));



CREATE POLICY "People of public clubs are readable by anyone" ON "public"."people" FOR SELECT TO "authenticated", "anon" USING ("public"."person_in_public_club"("id"));



CREATE POLICY "Players of public clubs are readable by anyone" ON "public"."players" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"text") AND "public"."is_public_club"("club_id")));



CREATE POLICY "Public clubs are readable by anyone" ON "public"."clubs" FOR SELECT TO "authenticated", "anon" USING ("is_public");



CREATE POLICY "Tables of public clubs are readable by anyone" ON "public"."club_tables" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("club_id"));



CREATE POLICY "The shared drill catalog is readable by anyone" ON "public"."drills" FOR SELECT TO "authenticated", "anon" USING (("club_id" IS NULL));



CREATE POLICY "Tournament comments of public clubs are readable by anyone" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING ((("tournament_id" IS NOT NULL) AND "public"."is_public_club"("public"."tournament_club"("tournament_id"))));



CREATE POLICY "Tournament reactions of public clubs are readable by anyone" ON "public"."reactions" FOR SELECT TO "authenticated", "anon" USING ((("tournament_id" IS NOT NULL) AND "public"."is_public_club"("public"."tournament_club"("tournament_id"))));



CREATE POLICY "Tournaments of public clubs are readable by anyone" ON "public"."tournaments" FOR SELECT TO "authenticated", "anon" USING ("public"."is_public_club"("club_id"));



ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_device_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clubs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drill_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."games" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_plan_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_plans" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."challenges";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."club_tables";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."drill_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."games";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."live_matches";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."people";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."players";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tournament_matches";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tournament_players";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tournaments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."training_plan_steps";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_guest_player"("cid" integer, "pname" "text", "cat" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."add_guest_player"("cid" integer, "pname" "text", "cat" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_guest_player"("cid" integer, "pname" "text", "cat" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_club_request"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_club_request"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_club_request"("p_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approved_member_contact"("p_player_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approved_member_contact"("p_player_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approved_member_contact"("p_player_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."call_ranking_night"("p_club_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."call_ranking_night"("p_club_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."call_ranking_night"("p_club_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."call_ranking_night"("p_club_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_score_live_match"("cid" integer, "p1" bigint, "p2" bigint, "p1b" bigint, "p2b" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."can_score_live_match"("cid" integer, "p1" bigint, "p2" bigint, "p1b" bigint, "p2b" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_score_live_match"("cid" integer, "p1" bigint, "p2" bigint, "p1b" bigint, "p2b" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_touch_plan"("pid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."can_touch_plan"("pid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_touch_plan"("pid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_touch_player"("pid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."can_touch_player"("pid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_touch_player"("pid" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_device"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_device"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_device"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."club_claim_contact"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."club_claim_contact"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_claim_contact"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_claim_contact"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."club_photo_club_id"("object_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_photo_club_id"("object_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_photo_club_id"("object_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."club_preview"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."club_preview"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_preview"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."club_request_ops_contact"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."club_request_ops_contact"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_request_ops_contact"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."club_request_owner_contact"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."club_request_owner_contact"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_request_owner_contact"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."club_slug_reserved"() TO "anon";
GRANT ALL ON FUNCTION "public"."club_slug_reserved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."club_slug_reserved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clubs_recount_members"() TO "anon";
GRANT ALL ON FUNCTION "public"."clubs_recount_members"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clubs_recount_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clubs_set_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."clubs_set_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clubs_set_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clubs_timezone_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."clubs_timezone_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clubs_timezone_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_club"("club_name" "text", "p_owner" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_club"("club_name" "text", "p_owner" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_live_match"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_live_match"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_live_match"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."hide_member"("p_person_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hide_member"("p_person_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."hide_member"("p_person_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_member"("p_person_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_admin"("cid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_admin"("cid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_admin"("cid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_device"("cid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_device"("cid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_device"("cid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_member"("cid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_member"("cid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_member"("cid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_club_requested"("cid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_club_requested"("cid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_club_requested"("cid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_drill_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_drill_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_drill_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_own_person"("pid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_own_person"("pid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_own_person"("pid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_own_player"("pid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_own_player"("pid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_own_player"("pid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_public_club"("cid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_public_club"("cid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_public_club"("cid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."join_club"("p_slug" "text", "claim_player_id" integer, "display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_club"("p_slug" "text", "claim_player_id" integer, "display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_club"("p_slug" "text", "claim_player_id" integer, "display_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_request_admin_contact"("p_club_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_club"("p_club_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_club"("p_club_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_club"("p_club_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."live_match_checks_in_seats"() TO "anon";
GRANT ALL ON FUNCTION "public"."live_match_checks_in_seats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."live_match_checks_in_seats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."live_match_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."live_match_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."live_match_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."operator_clubs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."operator_clubs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."operator_clubs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."people_drop_orphan"() TO "anon";
GRANT ALL ON FUNCTION "public"."people_drop_orphan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."people_drop_orphan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."people_guard_edit"() TO "anon";
GRANT ALL ON FUNCTION "public"."people_guard_edit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."people_guard_edit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."people_set_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."people_set_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."people_set_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."person_in_public_club"("pid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."person_in_public_club"("pid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."person_in_public_club"("pid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."person_is_admins_guest"("pid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."person_is_admins_guest"("pid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."person_is_admins_guest"("pid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."person_shares_club"("pid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."person_shares_club"("pid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."person_shares_club"("pid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."players_guard_membership"() TO "anon";
GRANT ALL ON FUNCTION "public"."players_guard_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."players_guard_membership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."push_prune"("p_endpoints" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."push_prune"("p_endpoints" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."push_prune"("p_endpoints" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."push_prune"("p_endpoints" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."push_targets"("p_kind" "text", "p_ref" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_club_request"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reject_club_request"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_club_request"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."request_club"("p_name" "text", "p_city" "text", "p_country" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_club"("p_name" "text", "p_city" "text", "p_country" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_club"("p_name" "text", "p_city" "text", "p_country" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify"("txt" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_device_pairing"("cid" integer, "tid" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_device_pairing"("cid" integer, "tid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_device_pairing"("cid" integer, "tid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."tournament_club"("tid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."tournament_club"("tid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tournament_club"("tid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."tournament_match_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."tournament_match_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tournament_match_guard"() TO "service_role";


















GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."challenges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."challenges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."challenges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."club_device_codes" TO "anon";
GRANT ALL ON TABLE "public"."club_device_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."club_device_codes" TO "service_role";



GRANT ALL ON TABLE "public"."club_requests" TO "anon";
GRANT ALL ON TABLE "public"."club_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."club_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."club_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."club_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."club_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."club_tables" TO "anon";
GRANT ALL ON TABLE "public"."club_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."club_tables" TO "service_role";



GRANT ALL ON SEQUENCE "public"."club_tables_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."club_tables_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."club_tables_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."clubs" TO "anon";
GRANT ALL ON TABLE "public"."clubs" TO "authenticated";
GRANT ALL ON TABLE "public"."clubs" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("name") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("created_at") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("logo_url") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("theme_color") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("slug") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("is_public") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("member_count") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("address") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("city") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("country") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("lat") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("lon") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("phone") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("description") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("schedule") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("timezone") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("photo_order") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("tables_info") ON TABLE "public"."clubs" TO "anon";



GRANT SELECT("has_logo") ON TABLE "public"."clubs" TO "anon";
GRANT SELECT("has_logo") ON TABLE "public"."clubs" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."clubs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clubs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clubs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."drill_logs" TO "anon";
GRANT ALL ON TABLE "public"."drill_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."drill_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."drill_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."drill_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."drill_logs_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."drills" TO "anon";
GRANT ALL ON TABLE "public"."drills" TO "authenticated";
GRANT ALL ON TABLE "public"."drills" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("name") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("description") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("difficulty") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("skill_type") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("setup_instructions") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("scoring_method") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("max_score") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("ball_positions") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("shot_paths") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("created_at") ON TABLE "public"."drills" TO "anon";



GRANT SELECT("club_id") ON TABLE "public"."drills" TO "anon";



GRANT ALL ON SEQUENCE "public"."drills_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."drills_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."drills_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."live_matches" TO "anon";
GRANT ALL ON TABLE "public"."live_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."live_matches" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."people" TO "anon";
GRANT ALL ON TABLE "public"."people" TO "authenticated";
GRANT ALL ON TABLE "public"."people" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."people" TO "anon";



GRANT SELECT("slug") ON TABLE "public"."people" TO "anon";



GRANT SELECT("name") ON TABLE "public"."people" TO "anon";



GRANT SELECT("avatar_url") ON TABLE "public"."people" TO "anon";



GRANT SELECT("is_public") ON TABLE "public"."people" TO "anon";



GRANT ALL ON SEQUENCE "public"."people_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."people_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."people_id_seq" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."players" TO "anon";



GRANT SELECT("category") ON TABLE "public"."players" TO "anon";



GRANT SELECT("club_id") ON TABLE "public"."players" TO "anon";



GRANT SELECT("status") ON TABLE "public"."players" TO "anon";



GRANT SELECT("person_id") ON TABLE "public"."players" TO "anon";



GRANT ALL ON SEQUENCE "public"."players_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."players_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."players_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."reactions" TO "anon";
GRANT ALL ON TABLE "public"."reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_matches" TO "anon";
GRANT ALL ON TABLE "public"."tournament_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_matches" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_players" TO "anon";
GRANT ALL ON TABLE "public"."tournament_players" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_players" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."training_plan_steps" TO "anon";
GRANT ALL ON TABLE "public"."training_plan_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plan_steps" TO "service_role";



GRANT ALL ON SEQUENCE "public"."training_plan_steps_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."training_plan_steps_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."training_plan_steps_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."training_plans" TO "anon";
GRANT ALL ON TABLE "public"."training_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."training_plans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."training_plans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."training_plans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."training_plans_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































