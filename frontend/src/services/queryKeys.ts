export const queryKeys = {
  me: ['me'] as const,
  generations: (page: number, pageSize: number) => ['generations', page, pageSize] as const,
  generationsAll: ['generations'] as const,
  generation: (id: string) => ['generation', id] as const,
  engineStatus: ['engine-status'] as const,
  models: ['models'] as const,
};
