import { describe, expect, it } from 'vitest';
import { passwordIsAcceptable, passwordRules } from '../features/auth/passwordRules.ts';
import { dictionary } from '../config/i18n.ts';

describe('passwordRules', () => {
  it('accepts a password only when every rule is met', () => {
    for (const candidate of ['', 'short', 'nodigitshere', '12345678', 'Passw0rd!', 'abcdefg1']) {
      const everyRuleMet = passwordRules.every((rule) => rule.test(candidate));
      expect(passwordIsAcceptable(candidate), candidate).toBe(everyRuleMet);
    }
  });

  it('rejects what it should reject', () => {
    expect(passwordIsAcceptable('')).toBe(false);
    expect(passwordIsAcceptable('abc')).toBe(false);          // too short
    expect(passwordIsAcceptable('abcdefghij')).toBe(false);   // letters only
  });

  it('accepts what clears the bar', () => {
    expect(passwordIsAcceptable('Passw0rd!')).toBe(true);
    expect(passwordIsAcceptable('abcdefg1')).toBe(true);
  });

  // A rule whose key is missing renders as nothing at all, so the person is
  // told their password is wrong without being told why.
  it('every rule points at a key that exists in both languages', () => {
    for (const rule of passwordRules) {
      for (const lang of ['en', 'th'] as const) {
        expect(dictionary[lang][rule.labelKey], `${lang}.${rule.labelKey}`).toBeTruthy();
      }
    }
  });

  it('has no duplicate ids', () => {
    const ids = passwordRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
