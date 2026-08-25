/** GET / */
export type RootResponse = { message: string };

/**
 * GET /healthz and GET /api/status.
 *
 * Both are declared by the backend but currently raise on the server: main.py
 * reads `settings.…` without importing it, so each returns 500. The types are
 * written to the documented shape so the UI can adopt them the moment that
 * one-line fix lands; until then systemService reports them as unavailable.
 */
export type HealthResponse = {
  status: string;
  service: string;
  version: string;
  ai_mode: string;
  database: string;
};

export type SystemStatusResponse = {
  status: string;
  supported_tasks: string[];
  max_upload_mb: number;
  ai_mode: string;
};

/** GET /api/models — the AI node's catalogue, proxied by the backend. */
export type ModelEntry = { id: string; name: string; path?: string };

export type ModelCatalogue = {
  checkpoints: ModelEntry[];
  loras: ModelEntry[];
  /** False when the AI node could not be reached; lists may be stale or empty. */
  available: boolean;
};
