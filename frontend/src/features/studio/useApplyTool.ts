import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toolsService, toolsUnavailable } from '../../services/toolsService.ts';
import { snapKernel } from '../../config/limits.ts';
import { isApiError } from '../../contracts/errors.ts';
import type { PoseLandmark, SplashColor, ToolName } from '../../contracts/tools.ts';
import { useT } from '../../shared/hooks/useT.ts';
import { useStudio, type StudioVersion } from './studioStore.ts';
import { measureImage } from './studioActions.ts';

export type ToolRequest =
  | { tool: 'pose' }
  | { tool: 'sketch'; blurKsize: number }
  | { tool: 'color-splash'; targetColor: SplashColor }
  | { tool: 'remove-bg' };

type Output = {
  resultUrl: string;
  detail: string | null;
  maskUrl?: string;
  landmarks?: PoseLandmark[];
};

async function callTool(request: ToolRequest, image: Blob, signal: AbortSignal): Promise<Output> {
  switch (request.tool) {
    case 'pose': {
      const response = await toolsService.pose(image, { signal });
      return { resultUrl: response.result_image_url, detail: null, landmarks: response.landmarks ?? [] };
    }
    case 'sketch': {
      const response = await toolsService.sketch(image, request.blurKsize, { signal });
      return {
        resultUrl: response.result_image_url,
        detail: String(response.metadata?.blur_ksize ?? snapKernel(request.blurKsize)),
      };
    }
    case 'color-splash': {
      const response = await toolsService.colorSplash(image, request.targetColor, { signal });
      return { resultUrl: response.result_image_url, detail: response.metadata?.target_color ?? request.targetColor };
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
 * studio at all, which the panel explains once instead of as a red failure
 * after every click.
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

      const output = await callTool(request, from.blob, own.signal);
      const [blob, maskBlob] = await Promise.all([
        toolsService.fetchResult(output.resultUrl, own.signal),
        output.maskUrl ? toolsService.fetchResult(output.maskUrl, own.signal) : Promise.resolve(null),
      ]);
      const size = await measureImage(blob);
      if (own.signal.aborted) return null;

      return add({
        tool: request.tool,
        blob,
        ...size,
        parentId: from.id,
        detail: output.detail,
        maskBlob,
        landmarks: output.landmarks ?? null,
      });
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

  const pendingTool: ToolName | null = mutation.isPending ? (mutation.variables?.request.tool ?? null) : null;

  return {
    apply: (request: ToolRequest, from: StudioVersion) => mutation.mutate({ request, from }),
    pendingTool,
    unavailable,
    error,
  };
}
