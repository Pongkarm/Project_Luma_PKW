import { useEffect, useState } from 'react';

/**
 * Milliseconds since `since`, ticking while `active`.
 * Elapsed time is the only honest progress signal the API affords.
 */
export function useElapsed(since: Date | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !since) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, since]);

  if (!since) return 0;
  return Math.max(0, now - since.getTime());
}
