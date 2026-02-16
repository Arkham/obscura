import { type EditState, createDefaultEdits } from '../types/edits';
import { writeFile, fileExists, readFile } from './filesystem';

const SIDECAR_VERSION = 1;
const DB_FILENAME = 'db.json';

interface EditDb {
  version: number;
  app: string;
  files: Record<string, Partial<EditState>>;
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

// --- In-memory cache to avoid re-reading db.json on every save ---
let cachedDb: EditDb | null = null;
let cachedDir: FileSystemDirectoryHandle | null = null;

async function readDb(dir: FileSystemDirectoryHandle): Promise<EditDb> {
  if (cachedDir === dir && cachedDb) return cachedDb;

  if (await fileExists(dir, DB_FILENAME)) {
    const handle = await dir.getFileHandle(DB_FILENAME);
    const buffer = await readFile(handle);
    const text = new TextDecoder().decode(buffer);
    cachedDb = JSON.parse(text);
    cachedDir = dir;
    return cachedDb!;
  }

  cachedDb = { version: SIDECAR_VERSION, app: 'fiat-lux', files: {} };
  cachedDir = dir;
  return cachedDb;
}

// Exported for testing
export function serializeSidecar(edits: EditState): string {
  return JSON.stringify(diffFromDefaults(edits));
}

export function deserializeSidecar(json: string): Partial<EditState> {
  return JSON.parse(json);
}

export async function loadSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string
): Promise<Partial<EditState> | null> {
  const db = await readDb(dir);
  const entry = db.files[rawFileName];
  return entry && Object.keys(entry).length > 0 ? entry : null;
}

export async function saveSidecar(
  dir: FileSystemDirectoryHandle,
  rawFileName: string,
  edits: EditState
): Promise<void> {
  const db = await readDb(dir);
  const sparse = diffFromDefaults(edits);
  if (Object.keys(sparse).length === 0) {
    delete db.files[rawFileName];
  } else {
    db.files[rawFileName] = sparse;
  }
  await writeFile(dir, DB_FILENAME, JSON.stringify(db, null, 2));
}

/** Clear the in-memory cache (useful when switching directories) */
export function clearDbCache(): void {
  cachedDb = null;
  cachedDir = null;
}
