import { create } from 'zustand';
import type { PoseLandmark, ToolName } from '../../contracts/tools.ts';

export type StudioVersion = {
  id: string;
  /** null for the image the session started from. */
  tool: ToolName | null;
  blob: Blob;
  /** Object URL for `blob`, owned by the store and revoked when the version goes. */
  url: string;
  width: number;
  height: number;
  /** The version the tool was applied to — what "before" means in the compare view. */
  parentId: string | null;
  /** The parameter that shaped it, for the caption: "21", "green". */
  detail: string | null;
  /** remove-bg only: the mask it was cut with. */
  mask: { blob: Blob; url: string } | null;
  /** pose only. */
  landmarks: PoseLandmark[] | null;
};

/** What a tool run hands to add(); the store fills in the id and object URLs. */
type NewVersion = {
  tool: ToolName;
  blob: Blob;
  width: number;
  height: number;
  parentId: string;
  detail?: string | null;
  maskBlob?: Blob | null;
  landmarks?: PoseLandmark[] | null;
};

/**
 * Enough to undo a long chain of edits; each one is a full PNG in memory, so the
 * list cannot grow for as long as a tab stays open.
 */
export const MAX_VERSIONS = 12;

type StudioState = {
  versions: StudioVersion[];
  currentId: string | null;
  /** What the original was, for the caption: "Result 1a2b3c4d", "beach.jpg". */
  sourceLabel: string | null;
  /**
   * The run the original came from, or null for a dropped file. The result
   * stage shows this session's current version in place of that run's image,
   * which is what lets the quick-edit bar and this page share one history.
   */
  originRunId: string | null;

  /** Start over from a new image, releasing every previous version. Returns the original. */
  open: (
    blob: Blob,
    size: { width: number; height: number },
    label: string,
    originRunId?: string | null,
  ) => StudioVersion;
  /** Append a tool's output and make it current. Returns its id. */
  add: (version: NewVersion) => string;
  select: (id: string) => void;
  close: () => void;
};

let counter = 0;
const nextId = () => `v${Date.now().toString(36)}${(counter++).toString(36)}`;

function release(version: StudioVersion) {
  URL.revokeObjectURL(version.url);
  if (version.mask) URL.revokeObjectURL(version.mask.url);
}

/**
 * The studio session: the image being worked on and every version made from it.
 *
 * Deliberately NOT persisted. The versions are blobs, the tool outputs are not
 * recorded by the backend, and the page says so — a reload starting clean is
 * the honest behaviour. It does survive moving between pages, so a trip to
 * Generate and back loses nothing.
 */
export const useStudio = create<StudioState>()((set, get) => ({
  versions: [],
  currentId: null,
  sourceLabel: null,
  originRunId: null,

  open(blob, size, label, originRunId = null) {
    get().versions.forEach(release);
    const original: StudioVersion = {
      id: nextId(),
      tool: null,
      blob,
      url: URL.createObjectURL(blob),
      width: size.width,
      height: size.height,
      parentId: null,
      detail: null,
      mask: null,
      landmarks: null,
    };
    set({ versions: [original], currentId: original.id, sourceLabel: label, originRunId });
    return original;
  },

  add(input) {
    const version: StudioVersion = {
      id: nextId(),
      tool: input.tool,
      blob: input.blob,
      url: URL.createObjectURL(input.blob),
      width: input.width,
      height: input.height,
      parentId: input.parentId,
      detail: input.detail ?? null,
      mask: input.maskBlob ? { blob: input.maskBlob, url: URL.createObjectURL(input.maskBlob) } : null,
      landmarks: input.landmarks ?? null,
    };
    let versions = [...get().versions, version];
    // Drop the oldest edits, never the original: it is what "start again" means.
    while (versions.length > MAX_VERSIONS) {
      const [original, dropped, ...rest] = versions;
      release(dropped);
      versions = [original, ...rest];
    }
    set({ versions, currentId: version.id });
    return version.id;
  },

  select(id) {
    if (get().versions.some((version) => version.id === id)) set({ currentId: id });
  },

  close() {
    get().versions.forEach(release);
    set({ versions: [], currentId: null, sourceLabel: null, originRunId: null });
  },
}));

export function currentVersion(state: Pick<StudioState, 'versions' | 'currentId'>): StudioVersion | null {
  return state.versions.find((version) => version.id === state.currentId) ?? null;
}

/** The version a tool was applied to, or the original if that one has been dropped. */
export function parentOf(
  state: Pick<StudioState, 'versions'>,
  version: StudioVersion,
): StudioVersion | null {
  if (version.parentId === null) return null;
  return state.versions.find((v) => v.id === version.parentId) ?? state.versions[0] ?? null;
}
