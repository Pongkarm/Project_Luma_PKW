import { useEffect, useState } from 'react';

/**
 * Milliseconds since `since`, ticking while `active`.
 * Elapsed time is the only honest progress signal the API affords.
 *
 * `since` is a timestamp rather than a Date on purpose. It used to take a Date
 * and the one caller built it inline — `new Date(startedAt)` — which produced a
 * fresh object on every render. Being in the effect's dependency list, that
 * tore the interval down and set it up again each time, and since the effect's
 * own setNow triggers the next render, the pair span: the interval was cleared
 * before it could ever fire, and the clock only advanced because the loop kept
 * re-running. A number compares by value, so the effect runs when the run
 * actually changes and not otherwise.
 */
export function useElapsed(since: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || since === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, since]);

  if (since === null) return 0;
  return Math.max(0, now - since);
}
