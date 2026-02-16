import { type EditState, createDefaultEdits } from '../types/edits';
import { readFile, writeFile, fileExists } from './filesystem';

const SIDECAR_VERSION = 1;

interface SidecarFile {
  version: number;
  app: string;
  lastModified: string;
  edits: Partial<EditState>;
}

function diffFromDefaults(edits: EditState): Partial<EditState> {
  const defaults = createDefaultEdits();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diff: any = {};

  for (const [key, value] of Object.entries(edits)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultVal = (defaults as any)[key];
    if (JSON.stringify(value) !== JSON.stringify(defaultVal)) {
      diff[key] = value;
    }
  }
  return diff;
}

export function serializeSidecar(edits: EditState): string {
  const sidecar: SidecarFile = {
    version: SIDECAR_VERSION,
    app: 'fiat-lux',
    lastModified: new Date().toISOString(),
    edits: diffFromDefaults(edits),
  };
  return JSON.stringify(sidecar, null, 2);
}

export function deserializeSidecar(json: string): Partial<EditState> {
  const sidecar: SidecarFile = JSON.parse(json);
  return sidecar.edits;
}

export async function loadSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string
): Promise<Partial<EditState> | null> {
  const sidecarName = `${rawFileName}.json`;
  if (!(await fileExists(dir, sidecarName))) return null;
  const handle = await dir.getFileHandle(sidecarName);
  const buffer = await readFile(handle);
  const text = new TextDecoder().decode(buffer);
  return deserializeSidecar(text);
}

export async function saveSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string,
  edits: EditState
): Promise<void> {
  const sidecarName = `${rawFileName}.json`;
  const json = serializeSidecar(edits);
  await writeFile(dir, sidecarName, json);
}
