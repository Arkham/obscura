import { useState, useCallback } from 'react';
import { useEditStore } from '../../store/editStore';
import { HSL_LABELS } from '../../types/edits';
import { PanelSection } from './PanelSection';
import { Slider } from './Slider';
import styles from './HslPanel.module.css';

const HSL_TABS = ['hue', 'saturation', 'luminance'] as const;
type HslTab = (typeof HSL_TABS)[number];

const TAB_LABELS: Record<HslTab, string> = {
  hue: 'Hue',
  saturation: 'Saturation',
  luminance: 'Luminance',
};

export function HslPanel() {
  const [tab, setTab] = useState<HslTab>('hue');
  const hsl = useEditStore((s) => s.edits.hsl);
  const setParam = useEditStore((s) => s.setParam);

  const values = hsl[tab];

  const handleChange = useCallback(
    (index: number, value: number) => {
      const newValues = [...values];
      newValues[index] = value;
      setParam('hsl', { ...hsl, [tab]: newValues });
    },
    [hsl, tab, values, setParam],
  );

  return (
    <PanelSection title="HSL / Color">
      <div className={styles.tabs}>
        {HSL_TABS.map((t) => (
          <button
            key={t}
            className={styles.tab}
            data-active={t === tab}
            onClick={() => setTab(t)}
            type="button"
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {HSL_LABELS.map((label, i) => (
        <Slider
          key={`${tab}-${label}`}
          label={label}
          value={values[i]}
          min={-100}
          max={100}
          step={1}
          defaultValue={0}
          onChange={(v) => handleChange(i, v)}
        />
      ))}
    </PanelSection>
  );
}
