import { useEffect, useRef } from 'react';
import type { CatalogEntry } from '../../store/catalogStore';
import styles from './ThumbnailGrid.module.css';

interface ThumbnailGridProps {
  entries: CatalogEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
}

function ThumbnailCard({
  entry,
  index,
  isSelected,
  onSelect,
  onOpen,
}: {
  entry: CatalogEntry;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      className={styles.card}
      data-selected={isSelected}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className={styles.thumbWrapper}>
        {entry.thumbnailUrl === null ? (
          <span className={styles.placeholder}>Loading...</span>
        ) : entry.thumbnailUrl ? (
          <img
            className={styles.thumb}
            src={entry.thumbnailUrl}
            alt={entry.name}
            loading="lazy"
          />
        ) : (
          <span className={styles.placeholder}>No preview</span>
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{entry.name}</span>
        {entry.hasSidecar && <span className={styles.sidecarDot} title="Has edits" />}
      </div>
    </div>
  );
}

export function ThumbnailGrid({ entries, selectedIndex, onSelect, onOpen }: ThumbnailGridProps) {
  return (
    <div className={styles.grid}>
      {entries.map((entry, i) => (
        <ThumbnailCard
          key={entry.name}
          entry={entry}
          index={i}
          isSelected={i === selectedIndex}
          onSelect={() => onSelect(i)}
          onOpen={() => onOpen(i)}
        />
      ))}
    </div>
  );
}
