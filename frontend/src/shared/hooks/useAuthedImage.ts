import { useEffect, useState } from 'react';
import { generationService } from '../../services/generationService.ts';
import { uploadService } from '../../services/uploadService.ts';

type State = { url: string | null; loading: boolean; failed: boolean };

/** Which authed endpoint the bytes come from. Both need the bearer token. */
type Kind = 'generation' | 'upload';

/**
 * Fetch an image that sits behind the bearer token and hand back an object URL.
 *
 * Neither of these can be a plain <img src>: they answer 401 without an
 * Authorization header, and a browser will not attach one to an image request.
 * So the bytes are fetched, wrapped in an object URL, and revoked on unmount —
 * which is why an image appears a beat after the record does.
 */
function useAuthedObjectUrl(kind: Kind | null, ref: string | null, enabled: boolean): State {
  const [state, setState] = useState<State>({ url: null, loading: false, failed: false });

  useEffect(() => {
    if (!kind || !ref || !enabled) {
      setState({ url: null, loading: false, failed: false });
      return;
    }

    let revoke: (() => void) | null = null;
    let cancelled = false;
    const controller = new AbortController();

    setState({ url: null, loading: true, failed: false });

    const load =
      kind === 'generation'
        ? generationService.fetchImage(ref, controller.signal)
        : uploadService.fetchImage(ref, controller.signal);

    load
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
  }, [kind, ref, enabled]);

  return state;
}

/** The finished output of a run — GET /generations/{id}/image. */
export function useAuthedImage(generationId: string | null, enabled = true): State {
  return useAuthedObjectUrl('generation', generationId, enabled);
}

/**
 * An image someone uploaded — GET /uploads/{filename}.
 *
 * This endpoint used to be world-readable, so it was shown with a plain
 * <img src>. It is behind the token now, and that <img> answered 401 and drew
 * a broken image; it has to be fetched the same way a result is.
 */
export function useUploadedImage(serverPath: string | null, enabled = true): State {
  return useAuthedObjectUrl('upload', serverPath, enabled);
}
