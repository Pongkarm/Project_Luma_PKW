import { create } from 'zustand';
import type { RegisterRequest, UserProfile } from '../../contracts/auth.ts';
import { authService } from '../../services/authService.ts';
import { userService } from '../../services/userService.ts';
import { getToken, onUnauthorized, setToken } from '../../services/tokenStore.ts';
import { isExpired, readTokenExpiry } from '../../shared/utils/jwt.ts';

type Status = 'booting' | 'anonymous' | 'authenticated';

type SessionState = {
  status: Status;
  user: UserProfile | null;
  /**
   * The token stopped working while someone was in the middle of something.
   * Distinct from being signed out: their drafts are intact and the app asks
   * them to sign back in over the workspace rather than throwing them out of it.
   */
  expired: boolean;
  bootstrap: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile) => void;
  signOut: () => void;
};

let expiryTimer: number | null = null;

function scheduleExpiryPrompt(token: string, onExpire: () => void) {
  if (expiryTimer !== null) window.clearTimeout(expiryTimer);
  const expiresAt = readTokenExpiry(token);
  if (expiresAt === null) return;
  const delay = expiresAt - Date.now();
  if (delay <= 0) {
    onExpire();
    return;
  }
  // setTimeout caps out around 24.8 days; token lifetimes here are far shorter.
  expiryTimer = window.setTimeout(onExpire, delay);
}

export const useSession = create<SessionState>()((set, get) => ({
  status: 'booting',
  user: null,
  expired: false,

  /** Restore a session on boot: a stored token is only trusted once /auth/me agrees. */
  async bootstrap() {
    const token = getToken();
    if (!token || isExpired(token)) {
      setToken(null);
      set({ status: 'anonymous', user: null, expired: false });
      return;
    }
    try {
      const user = await userService.me({ quiet401: true });
      set({ status: 'authenticated', user, expired: false });
      scheduleExpiryPrompt(token, () => set({ expired: true }));
    } catch {
      setToken(null);
      set({ status: 'anonymous', user: null, expired: false });
    }
  },

  async signIn(username, password) {
    const { access_token } = await authService.login({ username, password });
    setToken(access_token);
    const user = await userService.me();
    set({ status: 'authenticated', user, expired: false });
    scheduleExpiryPrompt(access_token, () => set({ expired: true }));
  },

  async register(payload) {
    await authService.register(payload);
    await get().signIn(payload.username, payload.password);
  },

  setUser(user) {
    set({ user });
  },

  async refreshUser() {
    if (get().status !== 'authenticated') return;
    try {
      set({ user: await userService.me({ quiet401: true }) });
    } catch {
      /* the count is decoration; a failure here should never interrupt anyone */
    }
  },

  signOut() {
    if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    setToken(null);
    // There is no logout endpoint on the API — signing out is entirely local.
    set({ status: 'anonymous', user: null, expired: false });
  },
}));

/**
 * The server rejected a token we believed was good. One listener, registered
 * once, is the whole of the app's 401 handling.
 */
onUnauthorized(() => {
  const { status } = useSession.getState();
  setToken(null);
  if (status === 'authenticated') useSession.setState({ expired: true });
  else useSession.setState({ status: 'anonymous', user: null });
});
