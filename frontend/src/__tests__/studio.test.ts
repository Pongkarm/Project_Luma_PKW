import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maskToPaint } from '../features/generate/canvas/maskImage.ts';
import { MAX_VERSIONS, currentVersion, parentOf, useStudio, type StudioVersion } from '../features/studio/studioStore.ts';
import { versionDetail, versionLabel } from '../features/studio/toolMeta.ts';
import { translate } from '../config/i18n.ts';

const PAINT = [224, 164, 88] as const;

/** One RGBA pixel per entry. */
const pixels = (...rgba: [number, number, number, number][]) => new Uint8ClampedArray(rgba.flat());
const alphas = (data: Uint8ClampedArray) => [...data].filter((_, i) => i % 4 === 3);

describe('maskToPaint', () => {
  it('paints the white of a mask and clears the black', () => {
    const data = pixels([255, 255, 255, 255], [0, 0, 0, 255]);
    maskToPaint(data, false, PAINT);
    expect(alphas(data)).toEqual([255, 0]);
    expect([...data.slice(0, 3)]).toEqual([...PAINT]);
  });

  // Replacing the background of a cut-out means repainting what the mask left black.
  it('swaps the sides when inverted', () => {
    const data = pixels([255, 255, 255, 255], [0, 0, 0, 255]);
    maskToPaint(data, true, PAINT);
    expect(alphas(data)).toEqual([0, 255]);
  });

  it('reads a transparent pixel as black, whatever its colour', () => {
    const data = pixels([255, 255, 255, 0]);
    maskToPaint(data, false, PAINT);
    expect(alphas(data)).toEqual([0]);
  });

  // An anti-aliased edge is either in or out: the editor exports alpha, and a
  // half-painted pixel would reach the engine as a partial mask.
  it('never produces a partial alpha', () => {
    const data = pixels(...Array.from({ length: 256 }, (_, v) => [v, v, v, 255] as [number, number, number, number]));
    maskToPaint(data, false, PAINT);
    expect(new Set(alphas(data))).toEqual(new Set([0, 255]));
  });
});

describe('studio store', () => {
  const blob = () => new Blob(['x'], { type: 'image/png' });
  const size = { width: 10, height: 10 };

  beforeEach(() => {
    useStudio.getState().close();
  });

  it('starts from the original and makes each new version current', () => {
    const studio = useStudio.getState();
    studio.open(blob(), size, 'a.png');
    const originalId = useStudio.getState().currentId!;
    const id = studio.add({ tool: 'sketch', blob: blob(), ...size, parentId: originalId, detail: '21' });

    const state = useStudio.getState();
    expect(state.versions).toHaveLength(2);
    expect(currentVersion(state)?.id).toBe(id);
    expect(parentOf(state, currentVersion(state)!)?.id).toBe(originalId);
  });

  it('keeps the original when the oldest edits are dropped', () => {
    const studio = useStudio.getState();
    studio.open(blob(), size, 'a.png');
    const originalId = useStudio.getState().currentId!;
    for (let i = 0; i < MAX_VERSIONS + 5; i += 1) {
      studio.add({ tool: 'sketch', blob: blob(), ...size, parentId: useStudio.getState().currentId! });
    }
    const state = useStudio.getState();
    expect(state.versions).toHaveLength(MAX_VERSIONS);
    expect(state.versions[0].id).toBe(originalId);
  });

  // "Before" for a version whose parent was dropped falls back to the original
  // rather than to nothing, so the compare view keeps working.
  it('falls back to the original when a parent is gone', () => {
    const studio = useStudio.getState();
    studio.open(blob(), size, 'a.png');
    const originalId = useStudio.getState().currentId!;
    const orphan = { ...currentVersion(useStudio.getState())!, parentId: 'gone', tool: 'pose' as const };
    expect(parentOf(useStudio.getState(), orphan)?.id).toBe(originalId);
  });

  it('releases every object URL when the session closes', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const studio = useStudio.getState();
    studio.open(blob(), size, 'a.png');
    studio.add({
      tool: 'remove-bg',
      blob: blob(),
      ...size,
      parentId: useStudio.getState().currentId!,
      maskBlob: blob(),
    });
    revoke.mockClear();
    studio.close();
    // The original, the cut-out and its mask.
    expect(revoke).toHaveBeenCalledTimes(3);
    expect(useStudio.getState().versions).toEqual([]);
    revoke.mockRestore();
  });

  // The result stage shows a session's current version in place of a run's
  // image only when the session was opened on that run.
  it('remembers which run it was opened on, and forgets on close', () => {
    const studio = useStudio.getState();
    studio.open(blob(), size, 'Result 1a2b', 'run-1');
    expect(useStudio.getState().originRunId).toBe('run-1');
    studio.open(blob(), size, 'dropped.png');
    expect(useStudio.getState().originRunId).toBeNull();
    studio.open(blob(), size, 'Result 1a2b', 'run-1');
    studio.close();
    expect(useStudio.getState().originRunId).toBeNull();
  });

  it('ignores a select for a version that does not exist', () => {
    const studio = useStudio.getState();
    studio.open(blob(), size, 'a.png');
    const before = useStudio.getState().currentId;
    studio.select('nope');
    expect(useStudio.getState().currentId).toBe(before);
  });
});

describe('version names', () => {
  const th = (key: Parameters<typeof translate>[1]) => translate('th', key);
  const version = (over: Partial<StudioVersion>) => ({ tool: null, detail: null, ...over }) as StudioVersion;

  it('numbers edits by their place, so two sketches can be told apart', () => {
    const original = version({});
    const first = version({ tool: 'sketch' });
    const second = version({ tool: 'sketch' });
    const all = [original, first, second];
    expect(versionLabel(all, original, th)).toBe(translate('th', 'studio.original'));
    expect(versionLabel(all, second, th)).toBe(`2. ${translate('th', 'studio.toolSketch')}`);
  });

  // The API spells the colour in English; a Thai screen must not show "red".
  it('translates the colour a splash kept', () => {
    expect(versionDetail(version({ tool: 'color-splash', detail: 'red' }), th)).toBe(translate('th', 'studio.red'));
    expect(versionDetail(version({ tool: 'color-splash', detail: 'green' }), th)).toBe(translate('th', 'studio.green'));
  });

  it('shows a sketch kernel as the number it is, and nothing when there is no setting', () => {
    expect(versionDetail(version({ tool: 'sketch', detail: '21' }), th)).toBe('21');
    expect(versionDetail(version({ tool: 'pose' }), th)).toBeNull();
  });
});
