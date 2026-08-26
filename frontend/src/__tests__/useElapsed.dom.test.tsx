// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useElapsed } from '../shared/hooks/useElapsed.ts';

afterEach(cleanup);

/**
 * ResultStage calls this as `useElapsed(new Date(startedAt), running)`, which
 * builds a fresh Date on every render. `since` is in the effect's dependency
 * list, so an unstable one tears the interval down and sets it up again on
 * every render — and the effect's own setNow causes the next render.
 */
function Probe({ startedAt, active }: { startedAt: number | null; active: boolean }) {
  const elapsed = useElapsed(startedAt, active);
  return <span>{elapsed}</span>;
}

describe('useElapsed', () => {
  it('sets up its interval once, not once per render', () => {
    const setInterval = vi.spyOn(window, 'setInterval');
    const clearInterval = vi.spyOn(window, 'clearInterval');

    const startedAt = Date.now() - 5000;
    const { rerender } = render(<Probe startedAt={startedAt} active />);
    const afterMount = setInterval.mock.calls.length;

    // Five renders of the same run. Nothing the hook cares about changed.
    for (let i = 0; i < 5; i++) rerender(<Probe startedAt={startedAt} active />);

    expect(setInterval.mock.calls.length - afterMount).toBe(0);
    expect(clearInterval.mock.calls.length).toBe(0);

    setInterval.mockRestore();
    clearInterval.mockRestore();
  });

  it('does set up again when the run actually changes', () => {
    const setInterval = vi.spyOn(window, 'setInterval');
    const { rerender } = render(<Probe startedAt={1000} active />);
    const afterMount = setInterval.mock.calls.length;
    rerender(<Probe startedAt={2000} active />);
    expect(setInterval.mock.calls.length - afterMount).toBe(1);
    setInterval.mockRestore();
  });

  it('stops timing when it goes inactive', () => {
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const startedAt = Date.now() - 1000;
    const { rerender } = render(<Probe startedAt={startedAt} active />);
    rerender(<Probe startedAt={startedAt} active={false} />);
    expect(clearInterval.mock.calls.length).toBeGreaterThan(0);
    clearInterval.mockRestore();
  });

  it('reports zero when there is nothing to time', () => {
    const { container } = render(<Probe startedAt={null} active={false} />);
    expect(container.textContent).toBe('0');
  });

  it('counts forward from the moment it was given', () => {
    const { container } = render(<Probe startedAt={Date.now() - 5000} active />);
    expect(Number(container.textContent)).toBeGreaterThanOrEqual(4900);
    expect(Number(container.textContent)).toBeLessThan(6000);
  });

  it('never reports a negative age for a future timestamp', () => {
    const { container } = render(<Probe startedAt={Date.now() + 10_000} active />);
    expect(Number(container.textContent)).toBe(0);
  });
});
