import { useEditStore } from '../../store/editStore';
import { PARAM_RANGES } from '../../types/edits';
import { PanelSection } from './PanelSection';
import { Slider } from './Slider';

const VIGNETTE_PARAMS = [
  { key: 'vignette.amount', label: 'Amount' },
  { key: 'vignette.midpoint', label: 'Midpoint' },
  { key: 'vignette.roundness', label: 'Roundness' },
  { key: 'vignette.feather', label: 'Feather' },
] as const;

export function EffectsPanel() {
  const edits = useEditStore((s) => s.edits);
  const setNestedParam = useEditStore((s) => s.setNestedParam);

  const getNestedValue = (path: string): number => {
    const parts = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = edits;
    for (const part of parts) {
      obj = obj[part];
    }
    return obj as number;
  };

  return (
    <PanelSection title="Effects" defaultOpen={false}>
      <PanelSection title="Vignette">
        {VIGNETTE_PARAMS.map(({ key, label }) => {
          const range = PARAM_RANGES[key];
          return (
            <Slider
              key={key}
              label={label}
              value={getNestedValue(key)}
              min={range.min}
              max={range.max}
              step={range.step}
              defaultValue={range.default}
              onChange={(v) => setNestedParam(key, v)}
            />
          );
        })}
      </PanelSection>
    </PanelSection>
  );
}
