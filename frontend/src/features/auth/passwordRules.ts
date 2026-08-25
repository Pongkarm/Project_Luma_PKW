/**
 * The API accepts any password string — app/schemas/user.py types it as a bare
 * `str` with no validation. These rules are the interface's own, checked before
 * anything is sent, and they are stated on screen rather than sprung on submit.
 */
export const passwordRules = [
  { id: 'length', labelKey: 'auth.ruleLength', test: (value: string) => value.length >= 8 },
  {
    id: 'variety',
    labelKey: 'auth.ruleVariety',
    test: (value: string) => /[^A-Za-z]/.test(value),
  },
] as const;

export function passwordIsAcceptable(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}
