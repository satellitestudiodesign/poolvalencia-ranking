export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      challenges: {
        Row: {
          club_id: number
          created_at: string | null
          from_player_id: number
          game_id: string | null
          id: number
          message: string | null
          status: string
          to_player_id: number
        }
        Insert: {
          club_id: number
          created_at?: string | null
          from_player_id: number
          game_id?: string | null
          id?: number
          message?: string | null
          status?: string
          to_player_id: number
        }
        Update: {
          club_id?: number
          created_at?: string | null
          from_player_id?: number
          game_id?: string | null
          id?: number
          message?: string | null
          status?: string
          to_player_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_from_player_id_fkey"
            columns: ["from_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_to_player_id_fkey"
            columns: ["to_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      club_device_codes: {
        Row: {
          club_id: number
          code: string
          created_at: string
          expires_at: string
          table_id: number
        }
        Insert: {
          club_id: number
          code: string
          created_at?: string
          expires_at: string
          table_id: number
        }
        Update: {
          club_id?: number
          code?: string
          created_at?: string
          expires_at?: string
          table_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_device_codes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_device_codes_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "club_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      club_requests: {
        Row: {
          city: string | null
          club_id: number | null
          country: string | null
          created_at: string
          decided_at: string | null
          id: number
          name: string
          note: string | null
          requested_by: string
          status: string
        }
        Insert: {
          city?: string | null
          club_id?: number | null
          country?: string | null
          created_at?: string
          decided_at?: string | null
          id?: number
          name: string
          note?: string | null
          requested_by: string
          status?: string
        }
        Update: {
          city?: string | null
          club_id?: number | null
          country?: string | null
          created_at?: string
          decided_at?: string | null
          id?: number
          name?: string
          note?: string | null
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_tables: {
        Row: {
          club_id: number
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          club_id: number
          id?: number
          label: string
          sort_order?: number
        }
        Update: {
          club_id?: number
          id?: number
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_tables_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          country: string | null
          created_at: string | null
          description: string | null
          has_logo: boolean | null
          id: number
          is_public: boolean
          lat: number | null
          logo_url: string | null
          lon: number | null
          member_count: number
          name: string
          night_call_at: string | null
          owner_id: string
          phone: string | null
          photo_order: Json
          schedule: Json
          slug: string
          tables_info: string | null
          theme_color: Database["public"]["Enums"]["BallColor"]
          timezone: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          has_logo?: boolean | null
          id?: number
          is_public?: boolean
          lat?: number | null
          logo_url?: string | null
          lon?: number | null
          member_count?: number
          name: string
          night_call_at?: string | null
          owner_id: string
          phone?: string | null
          photo_order?: Json
          schedule?: Json
          slug: string
          tables_info?: string | null
          theme_color?: Database["public"]["Enums"]["BallColor"]
          timezone?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          has_logo?: boolean | null
          id?: number
          is_public?: boolean
          lat?: number | null
          logo_url?: string | null
          lon?: number | null
          member_count?: number
          name?: string
          night_call_at?: string | null
          owner_id?: string
          phone?: string | null
          photo_order?: Json
          schedule?: Json
          slug?: string
          tables_info?: string | null
          theme_color?: Database["public"]["Enums"]["BallColor"]
          timezone?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_player_id: number
          body: string
          club_id: number
          created_at: string | null
          drill_log_id: number | null
          game_id: string | null
          id: number
          tournament_id: number | null
        }
        Insert: {
          author_player_id: number
          body: string
          club_id: number
          created_at?: string | null
          drill_log_id?: number | null
          game_id?: string | null
          id?: number
          tournament_id?: number | null
        }
        Update: {
          author_player_id?: number
          body?: string
          club_id?: number
          created_at?: string | null
          drill_log_id?: number | null
          game_id?: string | null
          id?: number
          tournament_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_player_id_fkey"
            columns: ["author_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_drill_log_id_fkey"
            columns: ["drill_log_id"]
            isOneToOne: false
            referencedRelation: "drill_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_logs: {
        Row: {
          created_at: string
          drill_id: number
          id: number
          max_score: number
          notes: string | null
          player_id: number
          score: number
        }
        Insert: {
          created_at?: string
          drill_id: number
          id?: number
          max_score: number
          notes?: string | null
          player_id: number
          score: number
        }
        Update: {
          created_at?: string
          drill_id?: number
          id?: number
          max_score?: number
          notes?: string | null
          player_id?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "drill_logs_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          ball_positions: Json
          club_id: number | null
          created_at: string
          created_by: string | null
          description: string
          difficulty: string
          id: number
          max_score: number
          name: string
          scoring_method: string
          setup_instructions: string
          shot_paths: Json
          skill_type: string
        }
        Insert: {
          ball_positions?: Json
          club_id?: number | null
          created_at?: string
          created_by?: string | null
          description: string
          difficulty: string
          id?: number
          max_score: number
          name: string
          scoring_method: string
          setup_instructions: string
          shot_paths?: Json
          skill_type: string
        }
        Update: {
          ball_positions?: Json
          club_id?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          difficulty?: string
          id?: number
          max_score?: number
          name?: string
          scoring_method?: string
          setup_instructions?: string
          shot_paths?: Json
          skill_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "drills_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          club_id: number
          created_at: string | null
          discipline: Database["public"]["Enums"]["Discipline"]
          id: string
          mode: Database["public"]["Enums"]["GameMode"]
          played_at: string
          player_1_id: number
          player_1_score: number
          player_1b_id: number | null
          player_2_id: number
          player_2_score: number
          player_2b_id: number | null
        }
        Insert: {
          club_id: number
          created_at?: string | null
          discipline?: Database["public"]["Enums"]["Discipline"]
          id?: string
          mode?: Database["public"]["Enums"]["GameMode"]
          played_at?: string
          player_1_id: number
          player_1_score: number
          player_1b_id?: number | null
          player_2_id: number
          player_2_score: number
          player_2b_id?: number | null
        }
        Update: {
          club_id?: number
          created_at?: string | null
          discipline?: Database["public"]["Enums"]["Discipline"]
          id?: string
          mode?: Database["public"]["Enums"]["GameMode"]
          played_at?: string
          player_1_id?: number
          player_1_score?: number
          player_1b_id?: number | null
          player_2_id?: number
          player_2_score?: number
          player_2b_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_1_id_fkey"
            columns: ["player_1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_1b_id_fkey"
            columns: ["player_1b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_2_id_fkey"
            columns: ["player_2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_2b_id_fkey"
            columns: ["player_2b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      live_matches: {
        Row: {
          challenge_id: number | null
          club_id: number
          discipline: Database["public"]["Enums"]["Discipline"]
          id: string
          last_side: number | null
          mode: Database["public"]["Enums"]["GameMode"]
          player_1_id: number
          player_1_score: number
          player_1b_id: number | null
          player_2_id: number
          player_2_score: number
          player_2b_id: number | null
          race_to: number
          started_at: string
          table_id: number | null
          tournament_match_id: string | null
          updated_at: string
        }
        Insert: {
          challenge_id?: number | null
          club_id: number
          discipline?: Database["public"]["Enums"]["Discipline"]
          id: string
          last_side?: number | null
          mode?: Database["public"]["Enums"]["GameMode"]
          player_1_id: number
          player_1_score?: number
          player_1b_id?: number | null
          player_2_id: number
          player_2_score?: number
          player_2b_id?: number | null
          race_to?: number
          started_at?: string
          table_id?: number | null
          tournament_match_id?: string | null
          updated_at?: string
        }
        Update: {
          challenge_id?: number | null
          club_id?: number
          discipline?: Database["public"]["Enums"]["Discipline"]
          id?: string
          last_side?: number | null
          mode?: Database["public"]["Enums"]["GameMode"]
          player_1_id?: number
          player_1_score?: number
          player_1b_id?: number | null
          player_2_id?: number
          player_2_score?: number
          player_2b_id?: number | null
          race_to?: number
          started_at?: string
          table_id?: number | null
          tournament_match_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_player_1_id_fkey"
            columns: ["player_1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_player_1b_id_fkey"
            columns: ["player_1b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_player_2_id_fkey"
            columns: ["player_2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_player_2b_id_fkey"
            columns: ["player_2b_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "club_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          avatar_url: string | null
          id: number
          is_public: boolean
          name: string
          slug: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          id?: number
          is_public?: boolean
          name: string
          slug: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: number
          is_public?: boolean
          name?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      players: {
        Row: {
          category: number
          club_id: number
          device_table_id: number | null
          id: number
          is_caretaker: boolean
          is_device: boolean
          joined_at: string
          person_id: number
          present_since: string | null
          queued_at: string | null
          queued_table_id: number | null
          status: string
        }
        Insert: {
          category?: number
          club_id: number
          device_table_id?: number | null
          id?: number
          is_caretaker?: boolean
          is_device?: boolean
          joined_at?: string
          person_id: number
          present_since?: string | null
          queued_at?: string | null
          queued_table_id?: number | null
          status?: string
        }
        Update: {
          category?: number
          club_id?: number
          device_table_id?: number | null
          id?: number
          is_caretaker?: boolean
          is_device?: boolean
          joined_at?: string
          person_id?: number
          present_since?: string | null
          queued_at?: string | null
          queued_table_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_device_table_id_fkey"
            columns: ["device_table_id"]
            isOneToOne: false
            referencedRelation: "club_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_queued_table_id_fkey"
            columns: ["queued_table_id"]
            isOneToOne: false
            referencedRelation: "club_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          lang: string
          p256dh: string
          person_id: number
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          lang?: string
          p256dh: string
          person_id: number
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          lang?: string
          p256dh?: string
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          author_player_id: number
          club_id: number
          created_at: string | null
          drill_log_id: number | null
          emoji: string
          game_id: string | null
          id: number
          tournament_id: number | null
        }
        Insert: {
          author_player_id: number
          club_id: number
          created_at?: string | null
          drill_log_id?: number | null
          emoji: string
          game_id?: string | null
          id?: number
          tournament_id?: number | null
        }
        Update: {
          author_player_id?: number
          club_id?: number
          created_at?: string | null
          drill_log_id?: number | null
          emoji?: string
          game_id?: string | null
          id?: number
          tournament_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reactions_author_player_id_fkey"
            columns: ["author_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_drill_log_id_fkey"
            columns: ["drill_log_id"]
            isOneToOne: false
            referencedRelation: "drill_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          bracket: string
          game_id: string | null
          group_no: number | null
          id: string
          loser_to: string | null
          loser_to_slot: number | null
          p1_id: number | null
          p2_id: number | null
          round: number
          slot: number
          tournament_id: number
          winner_id: number | null
          winner_to: string | null
          winner_to_slot: number | null
        }
        Insert: {
          bracket: string
          game_id?: string | null
          group_no?: number | null
          id: string
          loser_to?: string | null
          loser_to_slot?: number | null
          p1_id?: number | null
          p2_id?: number | null
          round: number
          slot: number
          tournament_id: number
          winner_id?: number | null
          winner_to?: string | null
          winner_to_slot?: number | null
        }
        Update: {
          bracket?: string
          game_id?: string | null
          group_no?: number | null
          id?: string
          loser_to?: string | null
          loser_to_slot?: number | null
          p1_id?: number | null
          p2_id?: number | null
          round?: number
          slot?: number
          tournament_id?: number
          winner_id?: number | null
          winner_to?: string | null
          winner_to_slot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_loser_to_fkey"
            columns: ["loser_to"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_p1_id_fkey"
            columns: ["p1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_p2_id_fkey"
            columns: ["p2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_to_fkey"
            columns: ["winner_to"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          created_at: string
          player_id: number
          tournament_id: number
        }
        Insert: {
          created_at?: string
          player_id: number
          tournament_id: number
        }
        Update: {
          created_at?: string
          player_id?: number
          tournament_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          advance: number | null
          category: number | null
          club_id: number
          created_at: string
          discipline: Database["public"]["Enums"]["Discipline"]
          ends_on: string | null
          entry_fee: string | null
          format: string
          id: number
          legs: number
          name: string
          race_final: number | null
          race_semi: number | null
          race_to: number
          single_from: number
          starts_on: string | null
          status: string
        }
        Insert: {
          advance?: number | null
          category?: number | null
          club_id: number
          created_at?: string
          discipline?: Database["public"]["Enums"]["Discipline"]
          ends_on?: string | null
          entry_fee?: string | null
          format: string
          id?: number
          legs?: number
          name: string
          race_final?: number | null
          race_semi?: number | null
          race_to?: number
          single_from?: number
          starts_on?: string | null
          status?: string
        }
        Update: {
          advance?: number | null
          category?: number | null
          club_id?: number
          created_at?: string
          discipline?: Database["public"]["Enums"]["Discipline"]
          ends_on?: string | null
          entry_fee?: string | null
          format?: string
          id?: number
          legs?: number
          name?: string
          race_final?: number | null
          race_semi?: number | null
          race_to?: number
          single_from?: number
          starts_on?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_steps: {
        Row: {
          created_at: string
          drill_id: number
          drill_log_id: number | null
          id: number
          plan_id: number
          status: string
          step_order: number
        }
        Insert: {
          created_at?: string
          drill_id: number
          drill_log_id?: number | null
          id?: number
          plan_id: number
          status?: string
          step_order: number
        }
        Update: {
          created_at?: string
          drill_id?: number
          drill_log_id?: number | null
          id?: number
          plan_id?: number
          status?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_steps_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plan_steps_drill_log_id_fkey"
            columns: ["drill_log_id"]
            isOneToOne: false
            referencedRelation: "drill_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plan_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          active: boolean
          created_at: string
          id: number
          player_id: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          player_id: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          player_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_guest_player: {
        Args: { cat?: number; cid: number; pname: string }
        Returns: number
      }
      approve_club_request: { Args: { p_id: number }; Returns: number }
      approved_member_contact: {
        Args: { p_player_id: number }
        Returns: {
          club_name: string
          club_slug: string
          email: string
          name: string
        }[]
      }
      call_ranking_night: { Args: { p_club_id: number }; Returns: string }
      can_score_live_match: {
        Args: { cid: number; p1: number; p1b: number; p2: number; p2b: number }
        Returns: boolean
      }
      can_touch_plan: { Args: { pid: number }; Returns: boolean }
      can_touch_player: { Args: { pid: number }; Returns: boolean }
      claim_device: {
        Args: { p_code: string }
        Returns: {
          club_slug: string
          table_id: number
        }[]
      }
      club_claim_contact: {
        Args: { p_slug: string }
        Returns: {
          club_name: string
          club_slug: string
          email: string
          name: string
        }[]
      }
      club_photo_club_id: { Args: { object_name: string }; Returns: number }
      club_preview: {
        Args: { p_slug: string }
        Returns: {
          claimable: boolean
          club_id: number
          club_name: string
          player_id: number
          player_name: string
        }[]
      }
      club_request_ops_contact: {
        Args: { p_id: number }
        Returns: {
          city: string
          club_name: string
          country: string
          email: string
          name: string
          note: string
        }[]
      }
      club_request_owner_contact: {
        Args: { p_id: number }
        Returns: {
          club_name: string
          club_slug: string
          email: string
          name: string
        }[]
      }
      club_slug_reserved: { Args: never; Returns: string[] }
      create_club: {
        Args: { club_name: string; p_owner?: string }
        Returns: number
      }
      finish_live_match: { Args: { p_id: string }; Returns: string }
      hide_member: { Args: { p_person_id: number }; Returns: undefined }
      is_club_admin: { Args: { cid: number }; Returns: boolean }
      is_club_device: { Args: { cid: number }; Returns: boolean }
      is_club_member: { Args: { cid: number }; Returns: boolean }
      is_club_requested: { Args: { cid: number }; Returns: boolean }
      is_drill_admin: { Args: never; Returns: boolean }
      is_own_person: { Args: { pid: number }; Returns: boolean }
      is_own_player: { Args: { pid: number }; Returns: boolean }
      is_public_club: { Args: { cid: number }; Returns: boolean }
      join_club: {
        Args: {
          claim_player_id?: number
          display_name?: string
          p_slug: string
        }
        Returns: number
      }
      join_request_admin_contact: {
        Args: { p_club_id: number }
        Returns: {
          club_name: string
          club_slug: string
          email: string
          name: string
        }[]
      }
      leave_club: { Args: { p_club_id: number }; Returns: undefined }
      operator_clubs: {
        Args: never
        Returns: {
          created_at: string
          games_30d: number
          games_7d: number
          games_total: number
          id: number
          is_public: boolean
          last_game_at: string
          member_count: number
          name: string
          pending_count: number
          slug: string
        }[]
      }
      person_in_public_club: { Args: { pid: number }; Returns: boolean }
      person_is_admins_guest: { Args: { pid: number }; Returns: boolean }
      person_shares_club: { Args: { pid: number }; Returns: boolean }
      push_prune: { Args: { p_endpoints: string[] }; Returns: undefined }
      push_targets: {
        Args: { p_kind: string; p_ref: number }
        Returns: {
          auth: string
          endpoint: string
          lang: string
          p256dh: string
        }[]
      }
      reject_club_request: { Args: { p_id: number }; Returns: undefined }
      request_club: {
        Args: {
          p_city?: string
          p_country?: string
          p_name: string
          p_note?: string
        }
        Returns: number
      }
      slugify: { Args: { txt: string }; Returns: string }
      start_device_pairing: {
        Args: { cid: number; tid: number }
        Returns: string
      }
      tournament_club: { Args: { tid: number }; Returns: number }
    }
    Enums: {
      BallColor:
        | "yellow"
        | "blue"
        | "red"
        | "purple"
        | "orange"
        | "green"
        | "maroon"
        | "black"
      Discipline: "8ball" | "9ball" | "10ball"
      GameMode: "single" | "doubles"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      BallColor: [
        "yellow",
        "blue",
        "red",
        "purple",
        "orange",
        "green",
        "maroon",
        "black",
      ],
      Discipline: ["8ball", "9ball", "10ball"],
      GameMode: ["single", "doubles"],
    },
  },
} as const
