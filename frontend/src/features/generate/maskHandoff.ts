import { create } from 'zustand';

type Pending = { mask: Blob; invert: boolean };

type MaskHandoffState = {
  pending: Pending | null;
  send: (mask: Blob, invert: boolean) => void;
  /** Hand the mask over exactly once. */
  take: () => Pending | null;
};

/**
 * A mask made in the studio, waiting for the inpaint canvas to pick it up.
 *
 * A blob cannot go in the persisted draft, and the canvas only exists once the
 * Generate page has mounted with the new source — so it waits here until then.
 */
export const useMaskHandoff = create<MaskHandoffState>()((set, get) => ({
  pending: null,
  send(mask, invert) {
    set({ pending: { mask, invert } });
  },
  take() {
    const pending = get().pending;
    if (pending) set({ pending: null });
    return pending;
  },
}));
