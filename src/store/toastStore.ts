import { create } from 'zustand';
import { uid } from '../lib/id';

export interface Toast {
  id: string;
  kind: 'info' | 'hit' | 'achievement' | 'error';
  title: string;
  body?: string;
  /** Short mark shown next to the text (achievement glyph, multiplier…). */
  mark?: string;
  action?: { label: string; run: () => void };
  /** ms; 0 keeps it until dismissed. */
  ttl?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToasts = create<ToastState>(set => ({
  toasts: [],
  push: t => {
    const id = uid();
    // Keep the stack short; the oldest one goes first.
    set(s => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    return id;
  },
  dismiss: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t);
