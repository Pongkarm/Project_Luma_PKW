/**
 * Polling policy.
 *
 * Two things are watched. `status` on GET /generations/{id} decides when a run
 * is over; GET /generations/{id}/progress carries the queue position and step
 * count, and is only worth asking for while a run is actually unfinished.
 */
export const polling = {
  /** While a job is fresh. */
  fastMs: 2000,
  /** After `slowAfterMs`, back off — a long job is not a stuck job. */
  slowMs: 5000,
  slowAfterMs: 60_000,
  /**
   * The backend never times a job out: if a callback is lost, a row can sit at
   * `processing` forever. After this the UI stops polling and says so plainly
   * instead of spinning until the tab is closed.
   */
  giveUpAfterMs: 5 * 60_000,
  /**
   * Progress is asked for more often than status: a step counter that updates
   * every two seconds reads as a stuck bar. It costs one proxied request to the
   * AI node, which is answered from memory, and it stops with the run.
   */
  progressMs: 1200,
} as const;
