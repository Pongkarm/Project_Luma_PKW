import { request } from './apiClient.ts';
import type { LoginRequest, RegisterRequest, TokenResponse, UserResponse } from '../contracts/auth.ts';

export const authService = {
  register(payload: RegisterRequest): Promise<UserResponse> {
    return request<UserResponse>('/auth/register', { method: 'POST', json: payload, auth: false });
  },

  /**
   * The endpoint is an OAuth2 password form, so this is the one call in the app
   * that sends url-encoded fields rather than JSON. `username` accepts either a
   * username or an email address — the backend queries both columns.
   */
  login(payload: LoginRequest): Promise<TokenResponse> {
    return request<TokenResponse>('/auth/login', {
      method: 'POST',
      form: { username: payload.username, password: payload.password },
      auth: false,
      quiet401: true,
    });
  },
};
