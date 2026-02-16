const RAW_EXTENSIONS = ['.arw', '.pef', '.dng', '.nef', '.cr2', '.cr3', '.raf'];

export async function openDirectory(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function listRawFiles(
  dir: FileSystemDirectoryHandle
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      if (RAW_EXTENSIONS.includes(ext)) {
        files.push(handle);
      }
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readFile(handle: FileSystemFileHandle): Promise<ArrayBuffer> {
  const file = await handle.getFile();
  return file.arrayBuffer();
}

export async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: string | Blob
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function fileExists(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}
