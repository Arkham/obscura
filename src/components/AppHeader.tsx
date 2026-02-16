import type { ReactNode } from 'react';
import styles from './AppHeader.module.css';

interface AppHeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ children, actions }: AppHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandName}>
          <span className={styles.brandO}>o</span>bscura
        </span>
      </div>
      <div className={styles.center}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
