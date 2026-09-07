import { describe, expect, it } from 'vitest';
import {
  CANCELLED_MESSAGE,
  isTerminal,
  wasCancelled,
  type Generation,
} from '../contracts/generation.ts';

/**
 * The backend has no "cancelled" status. POST /generations/{id}/cancel marks
 * the row `failed` and writes an exact sentence into error_message, so the only
 * thing separating "you stopped this" from "the engine broke" is that string.
 * If the backend ever rewords it, every cancelled run silently starts telling
 * people their prompt failed — which is why it is pinned here.
 */
const run = (over: Partial<Generation>): Generation =>
  ({ status: 'failed', error_message: null, ...over }) as Generation;

describe('wasCancelled', () => {
  it('recognises the sentence the backend actually writes', () => {
    expect(wasCancelled(run({ error_message: CANCELLED_MESSAGE }))).toBe(true);
  });

  it('leaves a real engine failure reported as a failure', () => {
    expect(wasCancelled(run({ error_message: 'CUDA out of memory' }))).toBe(false);
    expect(wasCancelled(run({ error_message: null }))).toBe(false);
  });

  it('does not read the message on a run that did not fail', () => {
    for (const status of ['pending', 'processing', 'completed'] as const) {
      expect(wasCancelled(run({ status, error_message: CANCELLED_MESSAGE }))).toBe(false);
    }
  });

  // Cancelling ends a run, so polling has to stop — a cancelled job left
  // non-terminal would be polled until the five-minute stall cutoff.
  it('leaves the run terminal, so polling stops', () => {
    expect(isTerminal(run({ error_message: CANCELLED_MESSAGE }).status)).toBe(true);
  });
});
