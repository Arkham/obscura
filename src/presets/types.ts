import type { EditState } from '../types/edits';

export interface Preset {
  id: string;
  name: string;
  description: string;
  edits: Partial<EditState>;
}

export interface PresetGroup {
  id: string;
  name: string;
  presets: Preset[];
}
