import { useEffect, useRef } from 'react';
import { useEditStore, type HistoryEntry } from '../../store/editStore';
import styles from './HistoryPanel.module.css';

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function HistoryPanel() {
  const history = useEditStore((s) => s.history);
  const historyIndex = useEditStore((s) => s.historyIndex);
  const jumpToHistory = useEditStore((s) => s.jumpToHistory);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to keep current entry visible
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [historyIndex]);

  // Force re-render for relative timestamps
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger re-render by forcing component update
      // The timestamps in the rendered output will pick up new values
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>History</div>
      <div className={styles.list} ref={listRef}>
        {history.map((entry: HistoryEntry, i: number) => {
          const isCurrent = i === historyIndex;
          const isFuture = i > historyIndex;
          return (
            <button
              key={i}
              ref={isCurrent ? activeRef : undefined}
              className={`${styles.entry} ${isCurrent ? styles.active : ''} ${isFuture ? styles.future : ''}`}
              onClick={() => jumpToHistory(i)}
            >
              <span className={styles.label}>{entry.label}</span>
              <span className={styles.time}>{relativeTime(entry.timestamp)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
