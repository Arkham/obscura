import { useEditStore } from '../../store/editStore';
import { PARAM_RANGES } from '../../types/edits';
import { PanelSection } from './PanelSection';
import { Slider } from './Slider';

const PRESENCE_PARAMS = [
  'texture',
  'clarity',
  'dehaze',
  'vibrance',
  'saturation',
] as const;

const LABELS: Record<string, string> = {
  texture: 'Texture',
  clarity: 'Clarity',
  dehaze: 'Dehaze',
  vibrance: 'Vibrance',
  saturation: 'Saturation',
};

export function PresencePanel() {
  const edits = useEditStore((s) => s.edits);
  const setParam = useEditStore((s) => s.setParam);

  return (
    <PanelSection title="Presence">
      {PRESENCE_PARAMS.map((key) => {
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
