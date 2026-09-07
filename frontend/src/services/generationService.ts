import { request, requestBlob, requestObjectUrl, requestOk } from './apiClient.ts';
import type {
  Generation,
  GenerationList,
  GenerationListParams,
  GenerationProgress,
  GenerationRequest,
} from '../contracts/generation.ts';

export const generationService = {
  /** POST /generations — returns immediately with status "pending". */
  create(payload: GenerationRequest): Promise<Generation> {
    return request<Generation>('/generations', { method: 'POST', json: payload });
  },

  /** GET /generations — newest first. The API offers no status or type filter. */
  list(params: GenerationListParams = {}): Promise<GenerationList> {
    return request<GenerationList>('/generations', {
      query: { page: params.page ?? 1, page_size: params.page_size ?? 20 },
    });
  },

  /** DELETE /generations/{id} — removes the record and the file. Not reversible. */
  remove(id: string): Promise<boolean> {
    return requestOk(`/generations/${id}`, { method: 'DELETE' });
  },

  /**
   * POST /generations/{id}/cancel — stops a pending or processing run.
   *
   * The backend forwards this to the AI node's DELETE /ai/task/{id} and then
   * marks the row `failed` with error_message "Cancelled by user" — there is no
   * separate "cancelled" status, so the UI reads that message to tell a
   * cancellation apart from a real failure. Answers 409 if the run finished
   * first, which is a race the caller should expect rather than treat as a bug.
   */
  cancel(id: string): Promise<Generation> {
    return request<Generation>(`/generations/${id}/cancel`, { method: 'POST' });
  },

  /**
   * GET /generations/{id}/progress — queue position and live step count.
   *
   * The backend proxies the AI node for this; the browser never reaches Node 3.
   * It answers 200 even when the node is unreachable, filling the numbers in
   * from the database — see hasRealProgress() before believing them.
   */
  progress(id: string, signal?: AbortSignal): Promise<GenerationProgress> {
    return request<GenerationProgress>(`/generations/${id}/progress`, { signal });
  },

  /** GET /generations/{id} — the polling target. */
  get(id: string, signal?: AbortSignal): Promise<Generation> {
    return request<Generation>(`/generations/${id}`, { signal });
  },

  /**
   * GET /generations/{id}/image — behind the bearer token, so it comes back as a
   * blob and is shown from an object URL. The caller revokes it.
   */
  fetchImage(id: string, signal?: AbortSignal): Promise<{ url: string; revoke: () => void }> {
    return requestObjectUrl(`/generations/${id}/image`, { signal });
  },

  /** The raw bytes — used when a result is re-uploaded as the next run's source. */
  fetchImageBlob(id: string, signal?: AbortSignal): Promise<Blob> {
    return requestBlob(`/generations/${id}/image`, { signal });
  },
};
