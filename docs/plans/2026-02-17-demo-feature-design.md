# Demo Feature Design

## Goal

Add a subtle "or try a demo" link on the landing page when the user has never opened a folder. Clicking it fetches a Turner painting JPEG from Wikipedia and opens the editor with it.

## Behavior

- **Visibility**: The "or try a demo" link appears only when `recentFolders` is empty (no previous folder history).
- **On click**: Fetches the JPEG from Wikipedia, shows loading state, then navigates to editor.
- **File name**: `modern-rome.jpg`
- **Editing**: All edit tools work normally via the existing JPEG fallback decoder.
- **Persistence**: Edits live in the Zustand store for the current session only. No sidecar, no filesystem. Refreshing loses edits.

## Technical Approach

1. **CatalogView landing page**: Add "or try a demo" link in the empty state, conditional on `recentFolders.length === 0`.
2. **Fetch JPEG**: Download from `https://upload.wikimedia.org/wikipedia/commons/9/99/Joseph_Mallord_William_Turner_%28British_-_Modern_Rome-Campo_Vaccino_-_Google_Art_Project.jpg`.
3. **Mock FileSystemFileHandle**: Create a minimal mock that implements `getFile()` returning a `File` wrapping the fetched ArrayBuffer. This lets the existing editor pipeline work unchanged.
4. **Decoder fallback**: `createRawDecoder().decode()` tries dcraw (fails on JPEG), then falls back to `decodeFromEmbeddedJpeg()` which finds the JPEG SOI/EOI markers in the buffer and decodes via `createImageBitmap`.
5. **No dirHandle**: With `dirHandle` as `null`, the editor naturally skips sidecar loading and auto-save.

## Files Changed

- `src/components/catalog/CatalogView.tsx` — add demo link, fetch logic, mock file handle creation
- `src/components/catalog/CatalogView.module.css` — style the demo link

## No Changes Needed

- Editor, decoder, stores, sidecar — all work as-is.
