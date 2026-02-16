import type { ImageMetadata } from '../../raw/metadata';
import { PanelSection } from './PanelSection';
import styles from './MetadataPanel.module.css';

interface MetadataPanelProps {
  metadata: ImageMetadata | null;
}

export function MetadataPanel({ metadata }: MetadataPanelProps) {
  const specs: string[] = [];
  if (metadata) {
    if (metadata.iso != null) specs.push(`ISO ${metadata.iso}`);
    if (metadata.focalLength) specs.push(metadata.focalLength);
    if (metadata.aperture) specs.push(metadata.aperture);
    if (metadata.shutterSpeed) specs.push(`${metadata.shutterSpeed}s`);
  }

  return (
    <PanelSection title="Info">
      <div className={styles.info}>
        {metadata?.camera && (
          <span className={styles.camera}>{metadata.camera}</span>
        )}
        {specs.length > 0 && (
          <span className={styles.specs}>
            {specs.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className={styles.separator}>&middot;</span>}
                {s}
              </span>
            ))}
          </span>
        )}
        {!metadata && <span>No metadata</span>}
      </div>
    </PanelSection>
  );
}
