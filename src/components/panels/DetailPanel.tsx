import { useEditStore } from '../../store/editStore';
import { PARAM_RANGES } from '../../types/edits';
import { PanelSection } from './PanelSection';
import { Slider } from './Slider';

const SHARPENING_PARAMS = [
  { key: 'sharpening.amount', label: 'Amount' },
  { key: 'sharpening.radius', label: 'Radius' },
  { key: 'sharpening.detail', label: 'Detail' },
] as const;

const NOISE_PARAMS = [
  { key: 'noiseReduction.luminance', label: 'Luminance' },
  { key: 'noiseReduction.color', label: 'Color' },
] as const;

export function DetailPanel() {
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
    <PanelSection title="Detail" defaultOpen={false}>
      <PanelSection title="Sharpening">
        {SHARPENING_PARAMS.map(({ key, label }) => {
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
      <PanelSection title="Noise Reduction">
        {NOISE_PARAMS.map(({ key, label }) => {
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
