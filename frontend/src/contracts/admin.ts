/** Mirrors app/schemas/admin.py. The backend is the authority on these shapes. */

export type AdminRole = 'owner' | 'admin' | 'reviewer';

export type AdminMe = {
  user_id: string;
  username: string;
  role: AdminRole;
  can_manage_users: boolean;
  can_view_audit: boolean;
  can_manage_admins: boolean;
};

export type FailureGroup = { message: string; count: number };
export type NamedCount = { name: string; count: number };

export type AdminStats = {
  total_users: number;
  active_users: number;
  disabled_users: number;
  generations_24h: number;
  success_rate: number;
  median_duration_seconds: number | null;
  failures: FailureGroup[];
  per_day: { day: string; total: number }[];
  by_task: NamedCount[];
  by_model: NamedCount[];
  window_days: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  /** Masked to a•••@domain for reviewers — the backend does the masking. */
  email: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  last_generated_at: string | null;
  generation_count: number;
  failure_count: number;
  admin_role: AdminRole | null;
};

export type AdminRunRow = {
  id: string;
  user_id: string;
  username: string;
  task_type: string;
  model_name: string;
  width: number;
  height: number;
  status: string;
  error_message: string | null;
  duration_seconds: number | null;
  created_at: string;
  /** null for reviewers — prompts are gated at admin. */
  prompt: string | null;
};

export type Paged<T> = { items: T[]; total: number; page: number; page_size: number };

export type AuditRow = {
  id: string;
  actor_id: string;
  actor_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, string> | null;
  created_at: string;
};
