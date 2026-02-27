import type { PresetGroup } from './types';
import { fujifilmPresets } from './fujifilm';

export const builtinPresetGroups: PresetGroup[] = [
  fujifilmPresets,
];

export type { Preset, PresetGroup } from './types';
