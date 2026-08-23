import { request } from './apiClient.ts';
import type { HealthResponse, RootResponse, SystemStatusResponse } from '../contracts/system.ts';

export type EngineStatus =
  | { state: 'online'; aiMode: string | null; supportedTasks: string[] | null }
  | { state: 'unavailable'; reason: string }
  | { state: 'offline' };

/**
 * What the app can honestly say about the backend.
 *
 * GET /healthz and GET /api/status both raise on the server today — main.py
 * reads `settings` without importing it — so they are attempted, and their
 * failure is reported as "unavailable" rather than as the backend being down.
 * GET / is a plain literal and does answer, which is enough to tell the two
 * apart. When the import is fixed this function starts returning real detail
 * with no change anywhere else.
 */
export const systemService = {
  async engineStatus(): Promise<EngineStatus> {
    try {
      await request<RootResponse>('/', { auth: false });
    } catch {
      return { state: 'offline' };
    }

    try {
      const status = await request<SystemStatusResponse>('/api/status', { auth: false });
      return {
        state: 'online',
        aiMode: status.ai_mode ?? null,
        supportedTasks: status.supported_tasks ?? null,
      };
    } catch {
      return { state: 'unavailable', reason: 'The backend does not report its status yet.' };
    }
  },

  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/healthz', { auth: false });
  },
};
