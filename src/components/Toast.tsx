import { useNotificationStore } from '../store/notificationStore';
import styles from './Toast.module.css';

export function ToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className={styles.container}>
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`${styles.toast} ${n.type === 'success' ? styles.success : n.type === 'error' ? styles.error : ''}`}
          onClick={() => dismiss(n.id)}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
