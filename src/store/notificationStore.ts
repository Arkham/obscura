import { create } from 'zustand';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 1;

interface NotificationState {
  notifications: Notification[];
  notify: (message: string, type?: Notification['type']) => void;
  dismiss: (id: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  notify: (message, type = 'info') => {
    const id = nextId++;
    set((s) => ({ notifications: [...s.notifications, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    }, 3000);
  },
  dismiss: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },
}));
