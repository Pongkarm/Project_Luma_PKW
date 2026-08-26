import { describe, expect, it } from 'vitest';
import { ineffectiveIn } from '../features/generate/ineffective.ts';

// Mirrors process_generation in app/services/generation.py. If the backend's
// callback payloads change, this is the file that has to change with them —
// nothing detects the drift automatically.
describe('ineffectiveIn', () => {
  it('disables nothing in direct mode', () => {
    for (const task of ['txt2img', 'img2img', 'inpaint'] as const) {
      expect([...ineffectiveIn('direct', task)]).toEqual([]);
    }
  });

  it('names what callback drops from /ai/generate', () => {
    expect([...ineffectiveIn('callback', 'txt2img')].sort())
      .toEqual(['loraId', 'samplerName', 'seed']);
  });

  it('names the larger set /ai/edit drops', () => {
    for (const task of ['img2img', 'inpaint'] as const) {
      expect([...ineffectiveIn('callback', task)].sort()).toEqual(
        ['denoisingStrength', 'loraId', 'model', 'negativePrompt', 'samplerName', 'seed', 'size'],
      );
    }
  });

  it('reads the mode case-insensitively', () => {
    expect(ineffectiveIn('CALLBACK', 'txt2img').size).toBe(3);
    expect(ineffectiveIn('Callback', 'txt2img').size).toBe(3);
  });

  // Not knowing must never be reported as knowing. An unreachable backend or
  // an unrecognised mode leaves every control alone.
  it('disables nothing when the mode is unknown', () => {
    for (const mode of [null, '', 'weird', 'DIRECT']) {
      expect([...ineffectiveIn(mode, 'img2img')]).toEqual([]);
    }
  });

  // The sets are shared rather than rebuilt per call, so the answer must not
  // depend on how many times it has been asked.
  it('gives the same answer every time it is asked', () => {
    for (const task of ['txt2img', 'img2img', 'inpaint'] as const) {
      const first = [...ineffectiveIn('callback', task)].sort();
      for (let i = 0; i < 5; i++) {
        expect([...ineffectiveIn('callback', task)].sort()).toEqual(first);
      }
    }
  });
});
