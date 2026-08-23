/**
 * Polling policy.
 *
 * Neither node reports progress, a queue position or a step count — the only
 * signal is the `status` field on GET /generations/{id}. So the app polls, and
 * shows elapsed time rather than inventing a percentage.
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
} as const;
