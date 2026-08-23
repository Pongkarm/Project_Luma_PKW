import { useEffect, useState } from 'react';
import { generationService } from '../../services/generationService.ts';

type State = { url: string | null; loading: boolean; failed: boolean };

/**
 * GET /generations/{id}/image sits behind the bearer token, so it cannot be an
 * <img src>. This fetches the bytes, hands back an object URL and revokes it on
 * unmount — which is why result images appear a beat after the record does.
 */
export function useAuthedImage(generationId: string | null, enabled = true): State {
  const [state, setState] = useState<State>({ url: null, loading: false, failed: false });

  useEffect(() => {
    if (!generationId || !enabled) {
      setState({ url: null, loading: false, failed: false });
      return;
    }

    let revoke: (() => void) | null = null;
    let cancelled = false;
    const controller = new AbortController();

    setState({ url: null, loading: true, failed: false });

    generationService
      .fetchImage(generationId, controller.signal)
      .then((result) => {
        if (cancelled) {
          result.revoke();
          return;
        }
        revoke = result.revoke;
        setState({ url: result.url, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, loading: false, failed: true });
      });

    return () => {
      cancelled = true;
      controller.abort();
      revoke?.();
    };
  }, [generationId, enabled]);

  return state;
}
