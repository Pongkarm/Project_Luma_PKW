import { request } from './apiClient.ts';
import type {
  AdminMe,
  AdminRoleRow,
  AuditRow,
  AdminRunRow,
  AdminStats,
  AdminUserRow,
  Paged,
} from '../contracts/admin.ts';

/**
 * The admin API. Every path here is behind require_role on the server, so a
 * 403 from any of them is the real boundary — the route guard in the browser
 * only saves someone from seeing a screen that would fail.
 */
export const adminService = {
  me: () => request<AdminMe>('/admin/me'),

  stats: (days = 14) => request<AdminStats>(`/admin/stats?days=${days}`),

  users: (params: {
    q?: string;
    status?: string;
    active_within?: number;
    sort?: string;
    page?: number;
    page_size?: number;
  }) => request<Paged<AdminUserRow>>(`/admin/users?${toQuery(params)}`),

  user: (id: string) =>
    request<{ user: AdminUserRow; recent_runs: AdminRunRow[]; failures: { message: string; count: number }[] }>(
      `/admin/users/${id}`,
    ),

  setUserStatus: (id: string, is_active: boolean, reason: string) =>
    request<{ user: AdminUserRow; recent_runs: AdminRunRow[] }>(
      `/admin/users/${id}/status`,
      { method: 'PATCH', json: { is_active, reason } },
    ),

  roles: () => request<AdminRoleRow[]>('/admin/roles'),

  assignRole: (user_id: string, role: string) =>
    request<void>('/admin/roles', { method: 'POST', json: { user_id, role } }),

  revokeRole: (user_id: string) =>
    request<void>(`/admin/roles/${user_id}`, { method: 'DELETE' }),

  audit: (page = 1) => request<Paged<AuditRow>>(`/admin/audit?page=${page}`),

  generations: (params: {
    user_id?: string;
    status?: string;
    task_type?: string;
    page?: number;
    page_size?: number;
  }) => request<Paged<AdminRunRow>>(`/admin/generations?${toQuery(params)}`),
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}
