import { useState, type ReactNode } from 'react';
import styles from './PanelSection.module.css';

interface PanelSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function PanelSection({ title, defaultOpen = true, children }: PanelSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        className={styles.header}
        onClick={() => setIsOpen((o) => !o)}
        type="button"
      >
        <span className={styles.chevron} data-open={isOpen}>&#9654;</span>
        <span className={styles.title}>{title}</span>
      </button>
      <div
        className={styles.content}
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
