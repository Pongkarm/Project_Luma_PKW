import { request } from './apiClient.ts';
import type { UserProfile, UserUpdateRequest } from '../contracts/auth.ts';

export const userService = {
  /** PATCH /auth/me — email and password only; nothing else is editable. */
  update(payload: UserUpdateRequest): Promise<UserProfile> {
    return request<UserProfile>('/auth/me', { method: 'PATCH', json: payload, quiet401: true });
  },

  /** Also used on boot to decide whether a stored token is still good. */
  me(options: { quiet401?: boolean } = {}): Promise<UserProfile> {
    return request<UserProfile>('/auth/me', { quiet401: options.quiet401 });
  },
};
