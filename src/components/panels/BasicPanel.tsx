import { useEditStore } from '../../store/editStore';
import { PARAM_RANGES } from '../../types/edits';
import { PanelSection } from './PanelSection';
import { Slider } from './Slider';

const BASIC_PARAMS = [
  'whiteBalance',
  'tint',
  'exposure',
  'contrast',
  'highlights',
  'shadows',
  'whites',
  'blacks',
] as const;

const LABELS: Record<string, string> = {
  whiteBalance: 'White Balance',
  tint: 'Tint',
  exposure: 'Exposure',
  contrast: 'Contrast',
  highlights: 'Highlights',
  shadows: 'Shadows',
  whites: 'Whites',
  blacks: 'Blacks',
};

export function BasicPanel() {
  const edits = useEditStore((s) => s.edits);
  const setParam = useEditStore((s) => s.setParam);

  return (
    <PanelSection title="Basic">
      {BASIC_PARAMS.map((key) => {
        const range = PARAM_RANGES[key];
        return (
          <Slider
            key={key}
            label={LABELS[key]}
            value={edits[key] as number}
            min={range.min}
            max={range.max}
            step={range.step}
            defaultValue={range.default}
            onChange={(v) => setParam(key, v)}
          />
        );
      })}
    </PanelSection>
  );
}
