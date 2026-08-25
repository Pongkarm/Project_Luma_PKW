/** POST /auth/register — request body (JSON). */
export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
};

/** POST /auth/register — 201 response. */
export type UserResponse = {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

/**
 * POST /auth/login — the API uses OAuth2PasswordRequestForm, so this is sent as
 * `application/x-www-form-urlencoded`, NOT JSON. `username` also accepts an email.
 */
export type LoginRequest = {
  username: string;
  password: string;
};

/** POST /auth/login — 200 response. */
export type TokenResponse = {
  access_token: string;
  token_type: string;
};

/** GET /auth/me — 200 response. */
export type UserProfile = UserResponse & {
  total_generations: number;
};

/**
 * PATCH /auth/me — change your own email or password.
 * The current password is required for either, so a stolen token cannot lock
 * the owner out of their own account.
 */
export type UserUpdateRequest = {
  current_password: string;
  email?: string;
  new_password?: string;
};
