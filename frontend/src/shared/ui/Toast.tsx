import { create } from 'zustand';
import { useEffect } from 'react';
import { Icon } from './Icon.tsx';

type Toast = { id: number; message: string };

type ToastState = {
  toasts: Toast[];
  show: (message: string) => void;
  dismiss: (id: number) => void;
};

/**
 * Confirmation for actions that otherwise complete in silence — saving a preset
 * or an image looked identical to doing nothing at all.
 */
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show(message) {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, message }] });
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((state) => state.dismiss);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 2600);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <div className="toast" role="status">
      <Icon name="checkCircle" size={14} className="toast__icon" />
      {toast.message}
    </div>
  );
}

export function Toasts() {
  const toasts = useToasts((state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
