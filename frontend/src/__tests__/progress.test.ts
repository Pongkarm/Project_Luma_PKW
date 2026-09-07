import { describe, expect, it } from 'vitest';
import { hasRealProgress, queueAhead, type GenerationProgress } from '../contracts/generation.ts';

/**
 * GET /generations/{id}/progress answers 200 whether or not the AI node was
 * reachable, and `live` is the field that says which happened.
 *
 * It used to say nothing: the fallback filled the metrics in from the database
 * with a flat 0.5 for anything processing and a queue of one holding this job,
 * indistinguishable from a real reading. The backend sets `live: false` and
 * nulls every metric now, so these guards read a flag instead of inferring one
 * — and they stay tested because the whole point is that a placeholder must
 * never reach a progress bar.
 */
const reading = (over: Partial<GenerationProgress>): GenerationProgress => ({
  task_id: 'r1',
  status: 'processing',
  live: true,
  queue_position: 0,
  total_queued: 0,
  progress: null,
  step: null,
  total_steps: null,
  elapsed: null,
  seed: null,
  error: null,
  ...over,
});

/** What the backend returns with Node 3 unreachable, or in direct mode. */
const offline = (status: 'pending' | 'processing'): GenerationProgress =>
  reading({
    status,
    live: false,
    progress: null,
    queue_position: null,
    total_queued: null,
    step: null,
    total_steps: 20,
  });

describe('hasRealProgress', () => {
  it('draws nothing when the backend never reached the engine', () => {
    expect(hasRealProgress(offline('processing'))).toBe(false);
    expect(hasRealProgress(offline('pending'))).toBe(false);
  });

  it('accepts a reading the engine actually took', () => {
    expect(hasRealProgress(reading({ progress: 0.4, step: 8, total_steps: 20 }))).toBe(true);
  });

  it('accepts a live zero — a job that has started but not stepped yet', () => {
    expect(hasRealProgress(reading({ progress: 0, step: 0, total_steps: 20 }))).toBe(true);
  });

  it('refuses a live answer that carries no measurement, such as a queued job', () => {
    expect(hasRealProgress(reading({ status: 'pending', progress: null }))).toBe(false);
  });

  it('survives a missing response entirely', () => {
    expect(hasRealProgress(null)).toBe(false);
    expect(hasRealProgress(undefined)).toBe(false);
  });
});

describe('queueAhead', () => {
  it('reports a real place in a real queue', () => {
    expect(queueAhead(reading({ queue_position: 3, total_queued: 5 }))).toBe(3);
  });

  it('says nothing about a queue of one, which tells nobody anything', () => {
    expect(queueAhead(reading({ queue_position: 1, total_queued: 1 }))).toBeNull();
  });

  it('says nothing once the job is running rather than waiting', () => {
    expect(queueAhead(reading({ queue_position: 0, total_queued: 4 }))).toBeNull();
  });

  it('says nothing when the queue was never read', () => {
    expect(queueAhead(offline('pending'))).toBeNull();
  });
});
