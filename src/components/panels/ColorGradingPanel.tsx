import { useCallback } from 'react';
import { useEditStore } from '../../store/editStore';
import { PanelSection } from './PanelSection';
import { ColorWheel } from './ColorWheel';
import styles from './ColorGradingPanel.module.css';

const ZONES = ['shadows', 'midtones', 'highlights', 'global'] as const;
type Zone = (typeof ZONES)[number];

const ZONE_LABELS: Record<Zone, string> = {
  shadows: 'Shadows',
  midtones: 'Midtones',
  highlights: 'Highlights',
  global: 'Global',
};

export function ColorGradingPanel() {
  const colorGrading = useEditStore((s) => s.edits.colorGrading);
  const setParam = useEditStore((s) => s.setParam);

  const handleChange = useCallback(
    (zone: Zone, hue: number, saturation: number, luminance: number) => {
      setParam('colorGrading', {
        ...colorGrading,
        [zone]: { hue, saturation, luminance },
      });
    },
    [colorGrading, setParam],
  );

  return (
    <PanelSection title="Color Grading" defaultOpen={false}>
      <div className={styles.grid}>
        {ZONES.map((zone) => (
          <ColorWheel
            key={zone}
            label={ZONE_LABELS[zone]}
            hue={colorGrading[zone].hue}
            saturation={colorGrading[zone].saturation}
            luminance={colorGrading[zone].luminance}
            onChange={(h, s, l) => handleChange(zone, h, s, l)}
          />
        ))}
      </div>
    </PanelSection>
  );
}
