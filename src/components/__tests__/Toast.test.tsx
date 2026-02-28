import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../Toast';
import { useNotificationStore } from '../../store/notificationStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotificationStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no notifications', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders notification messages', () => {
    useNotificationStore.getState().notify('File saved');
    render(<ToastContainer />);
    expect(screen.getByText('File saved')).toBeInTheDocument();
  });

  it('dismisses notification on click', () => {
    useNotificationStore.getState().notify('Click me');
    render(<ToastContainer />);
    fireEvent.click(screen.getByText('Click me'));
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('applies success class for success type', () => {
    useNotificationStore.getState().notify('Done!', 'success');
    render(<ToastContainer />);
    const toast = screen.getByText('Done!');
    expect(toast.className).toMatch(/success/);
  });

  it('applies error class for error type', () => {
    useNotificationStore.getState().notify('Oops', 'error');
    render(<ToastContainer />);
    const toast = screen.getByText('Oops');
    expect(toast.className).toMatch(/error/);
  });
});
