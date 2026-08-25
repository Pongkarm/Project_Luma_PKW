import { request, requestBlob, requestObjectUrl, requestOk } from './apiClient.ts';
import type {
  Generation,
  GenerationList,
  GenerationListParams,
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
