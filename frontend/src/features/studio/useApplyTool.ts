/**
 * Running a tool: send a version's bytes to the backend, fetch what comes back,
 * and add it to the studio session as a new version.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toolsService, toolsUnavailable } from '../../services/toolsService.ts';
import { snapKernel } from '../../config/limits.ts';
import { isApiError } from '../../contracts/errors.ts';
import type { PoseLandmark, SplashColor, ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useStudio, type StudioVersion } from './studioStore.ts';
import { measureImage } from './studioImage.ts';

/** One tool and the settings it takes — what a panel or a button asks for. */
export type ToolRequest =
  | { tool: 'pose' }
  | { tool: 'sketch'; blurKsize: number }
  | { tool: 'color-splash'; targetColor: SplashColor }
  | { tool: 'remove-bg' };

/** The four responses, flattened to the parts the studio keeps. */
type Output = {
  resultUrl: string;
  /** The setting that shaped it: the kernel size, or the colour kept. */
  detail: string | null;
  maskUrl?: string;
  landmarks?: PoseLandmark[];
};

/** Call the endpoint for `request` and reduce its response to an Output. */
async function callTool(request: ToolRequest, image: Blob, signal: AbortSignal): Promise<Output> {
  switch (request.tool) {
    case 'pose': {
      const response = await toolsService.pose(image, { signal });
      // An empty list is how "no person found" is expected to arrive.
      return { resultUrl: response.result_image_url, detail: null, landmarks: response.landmarks ?? [] };
    }
    case 'sketch': {
      const response = await toolsService.sketch(image, request.blurKsize, { signal });
      // Prefer the size the server says it used over the one that was asked for.
      const used = response.metadata?.blur_ksize ?? snapKernel(request.blurKsize);
      return { resultUrl: response.result_image_url, detail: String(used) };
    }
    case 'color-splash': {
      const response = await toolsService.colorSplash(image, request.targetColor, { signal });
      const kept = response.metadata?.target_color ?? request.targetColor;
      return { resultUrl: response.result_image_url, detail: kept };
    }
    case 'remove-bg': {
      const response = await toolsService.removeBg(image, { signal });
      return { resultUrl: response.result_image_url, detail: null, maskUrl: response.mask_image_url };
    }
  }
}

/**
 * Run one tool on one version and append what comes back.
 *
 * `unavailable` is kept apart from ordinary errors: it means the backend has no
 * studio at all, which is explained once instead of as a red failure after
 * every click.
 */
export function useApplyTool() {
  const t = useT();
  const add = useStudio((state) => state.add);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  // Leaving the page abandons a run in flight rather than adding to a session
  // nobody is looking at.
  useEffect(() => () => controller.current?.abort(), []);

  const mutation = useMutation({
    async mutationFn({ request, from }: { request: ToolRequest; from: StudioVersion }) {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;

      try {
        // 1. The tool itself, on the version's bytes.
        const output = await callTool(request, from.blob, own.signal);
        // 2. The picture it made — and, for a cut-out, the mask — side by side.
        const [blob, maskBlob] = await Promise.all([
          toolsService.fetchResult(output.resultUrl, own.signal),
          output.maskUrl ? toolsService.fetchResult(output.maskUrl, own.signal) : null,
        ]);
        const size = await measureImage(blob);
        // 3. Into the session, as the new current version.
        return add({
          tool: request.tool,
          blob,
          ...size,
          parentId: from.id,
          detail: output.detail,
          maskBlob,
          landmarks: output.landmarks ?? null,
        });
      } catch (cause) {
        // Abandoned on purpose: not something to report.
        if (own.signal.aborted) return null;
        throw cause;
      }
    },
    onMutate() {
      setError(null);
    },
    onSuccess() {
      setUnavailable(false);
    },
    onError(cause) {
      if (toolsUnavailable(cause)) {
        setUnavailable(true);
        return;
      }
      setError(isApiError(cause) ? cause.message : t('studio.failed'));
    },
  });

  return {
    apply: (request: ToolRequest, from: StudioVersion) => mutation.mutate({ request, from }),
    /** The tool running right now, for the busy overlay and the button label. */
    pendingTool: mutation.isPending ? (mutation.variables?.request.tool ?? null) : (null as ToolName | null),
    unavailable,
    error,
  };
}
