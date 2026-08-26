import { describe, expect, it } from 'vitest';
import { dictionary, languages, translate, type TKey } from '../config/i18n.ts';

const en = Object.keys(dictionary.en) as TKey[];
const th = Object.keys(dictionary.th) as TKey[];

describe('dictionary', () => {
  // This check was being run by hand after every copy change. A missing Thai
  // key falls back to English silently, so nothing else would catch it.
  it('has the same keys in both languages', () => {
    expect(th.sort()).toEqual(en.sort());
  });

  it('lists every language it defines', () => {
    expect(languages.map((l) => l.value).sort()).toEqual(Object.keys(dictionary).sort());
  });

  it('leaves no string empty', () => {
    for (const lang of Object.keys(dictionary) as (keyof typeof dictionary)[]) {
      for (const key of Object.keys(dictionary[lang]) as TKey[]) {
        expect(String(dictionary[lang][key]).trim(), `${lang}.${key}`).not.toBe('');
      }
    }
  });

  // A placeholder present in one language but not the other renders a literal
  // "{name}" to whoever is reading the other one.
  it('uses the same placeholders in both languages', () => {
    const holes = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');
    for (const key of en) {
      expect(holes(String(dictionary.th[key])), `placeholders differ for ${key}`)
        .toBe(holes(String(dictionary.en[key])));
    }
  });
});

describe('translate', () => {
  it('returns the chosen language', () => {
    expect(translate('en', 'auth.signIn')).toBe(dictionary.en['auth.signIn']);
    expect(translate('th', 'auth.signIn')).toBe(dictionary.th['auth.signIn']);
  });

  it('fills placeholders', () => {
    const out = translate('en', 'size.scaled', { w: 4096, h: 2160, max: 768 });
    expect(out).toContain('4096');
    expect(out).toContain('2160');
    expect(out).toContain('768');
    expect(out).not.toContain('{');
  });

  it('never returns a raw key', () => {
    for (const key of en) {
      for (const lang of ['en', 'th'] as const) {
        expect(translate(lang, key)).not.toBe(key);
      }
    }
  });
});
