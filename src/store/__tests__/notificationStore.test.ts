import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotificationStore } from '../notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotificationStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a notification with default type info', () => {
    useNotificationStore.getState().notify('hello');
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].message).toBe('hello');
    expect(notifs[0].type).toBe('info');
  });

  it('adds a notification with explicit type', () => {
    useNotificationStore.getState().notify('done', 'success');
    expect(useNotificationStore.getState().notifications[0].type).toBe('success');
  });

  it('dismisses a notification by id', () => {
    useNotificationStore.getState().notify('msg');
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().dismiss(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('auto-dismisses after 3 seconds', () => {
    useNotificationStore.getState().notify('temp');
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('assigns unique ids to each notification', () => {
    useNotificationStore.getState().notify('a');
    useNotificationStore.getState().notify('b');
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs[0].id).not.toBe(notifs[1].id);
  });
});
