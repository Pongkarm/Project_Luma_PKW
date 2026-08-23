import { create } from 'zustand';

type RunState = {
  /** The job the stage is currently showing. */
  activeRunId: string | null;
  /** When the app started watching it — the elapsed clock counts from here. */
  startedAt: number | null;
  setActiveRun: (id: string | null) => void;
};

export const useRun = create<RunState>()((set) => ({
  activeRunId: null,
  startedAt: null,
  setActiveRun: (id) => set({ activeRunId: id, startedAt: id ? Date.now() : null }),
}));
