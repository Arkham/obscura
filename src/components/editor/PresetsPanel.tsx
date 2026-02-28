import { useState } from 'react';
import { builtinPresetGroups } from '../../presets';
import type { Preset } from '../../presets';
import { useEditStore } from '../../store/editStore';
import styles from './PresetsPanel.module.css';

export function PresetsPanel() {
  const applyPreset = useEditStore((s) => s.applyPreset);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Presets</div>
      <div className={styles.list}>
        {builtinPresetGroups.map((group) => (
          <PresetGroupSection
            key={group.id}
            name={group.name}
            presets={group.presets}
            onApply={applyPreset}
          />
        ))}
      </div>
    </div>
  );
}

function PresetGroupSection({
  name,
  presets,
  onApply,
}: {
  name: string;
  presets: Preset[];
  onApply: (preset: Preset) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button className={styles.groupHeader} onClick={() => setOpen(!open)}>
        <span className={`${styles.chevron} ${!open ? styles.chevronCollapsed : ''}`}>&#9660;</span>
        {name}
      </button>
      <div className={styles.groupContent} style={{ display: open ? undefined : 'none' }}>
        {presets.map((preset) => (
          <button
            key={preset.id}
            className={styles.preset}
            onClick={() => onApply(preset)}
          >
            <span className={styles.presetName}>{preset.name}</span>
            <span className={styles.presetDesc}>{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
