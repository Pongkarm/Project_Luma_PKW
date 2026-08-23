/**
 * Read the expiry out of a JWT so the app can prompt before a request fails
 * rather than after. No verification happens here — the server is the only
 * authority on whether a token is good; this is purely a UX affordance.
 */
export function readTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string, skewMs = 5000): boolean {
  const expiry = readTokenExpiry(token);
  if (expiry === null) return false;
  return Date.now() + skewMs >= expiry;
}
