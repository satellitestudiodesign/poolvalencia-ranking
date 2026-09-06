import type { TournamentFormat, TournamentStatus } from "@/types";

/**
 * A tournament's status and format as prose, not as an i18n key.
 *
 * Shared by the public tournament route's `head` and by the card its og:image
 * points at, which have to agree: the description saying "Inscripciones
 * abiertas" over a picture of a podium is the bug this module exists to stop.
 *
 * Which is also the honest limit of it: link previews are Spanish — the app's
 * default language — whatever the visitor's language is. Both callers run
 * outside React, where `t()` is not reachable, and a crawler's Accept-Language
 * is not the reader's anyway.
 */
export const STATUS_PROSE: Record<TournamentStatus, string> = {
  open: "Inscripciones abiertas",
  groups: "Fase de grupos en juego",
  running: "En juego",
  done: "Finalizado",
};

/** FORMAT_KEY maps the column onto "doubleElim" for `t()`, which is the wrong
 *  shape for a sentence. */
export const FORMAT_PROSE: Record<TournamentFormat, string> = {
  double_elim: "doble eliminación",
  league: "liga",
  group_knockout: "grupos y eliminatoria",
};
