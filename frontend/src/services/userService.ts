import { request } from './apiClient.ts';
import type { UserProfile } from '../contracts/auth.ts';

export const userService = {
  /** Also used on boot to decide whether a stored token is still good. */
  me(options: { quiet401?: boolean } = {}): Promise<UserProfile> {
    return request<UserProfile>('/auth/me', { quiet401: options.quiet401 });
  },
};
