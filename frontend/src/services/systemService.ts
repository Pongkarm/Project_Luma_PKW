import { request } from './apiClient.ts';
import type {
  HealthResponse,
  ModelCatalogue,
  RootResponse,
  SystemStatusResponse,
} from '../contracts/system.ts';

export type EngineStatus =
  | { state: 'online'; aiMode: string | null; supportedTasks: string[] | null }
  | { state: 'unavailable'; reason: string }
  | { state: 'offline' };

/**
 * What the app can honestly say about the backend.
 *
 * /healthz and /api/status used to raise — main.py read `settings` without
 * importing it — and this was written to survive that: GET / is a plain
 * literal and answers regardless, which tells "backend down" apart from
 * "backend cannot describe itself". Both endpoints work now, so the detailed
 * answer is the normal one, but the fallback is kept: it costs one request and
 * it is what makes a half-configured node report as degraded rather than dead.
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

  /**
   * The checkpoints and LoRA adapters actually present on the AI node.
   * The backend proxies this; the browser never reaches Node 3 itself.
   */
  models(): Promise<ModelCatalogue> {
    return request<ModelCatalogue>('/api/models');
  },

  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/healthz', { auth: false });
  },
};
