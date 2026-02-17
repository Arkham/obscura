# Demo Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "or try a demo" link on the landing page that fetches a Turner painting from Wikipedia and opens the editor with it.

**Architecture:** When no recent folders exist, show a demo link in the empty state. Clicking it fetches the JPEG, wraps it in a mock `FileSystemFileHandle`, creates a `CatalogEntry`, and navigates to the editor. The existing JPEG fallback decoder handles rendering; no `dirHandle` means edits stay in-memory only.

**Tech Stack:** React, Zustand, Vitest, @testing-library/react

---

### Task 1: Add demo link UI to CatalogView

**Files:**
- Modify: `src/components/catalog/CatalogView.tsx:167-170`
- Modify: `src/components/catalog/CatalogView.module.css`

**Step 1: Add the demo link in the empty state**

In `CatalogView.tsx`, add a `demoLoading` state and a `handleTryDemo` callback. In the empty state (lines 167-170), when `recentFolders.length === 0`, show "or try a demo" below the existing text.

Add to imports and state:
```tsx
// no new imports needed — useState/useCallback already imported
```

Add state inside `CatalogView`:
```tsx
const [demoLoading, setDemoLoading] = useState(false);
```

Add the handler:
```tsx
const DEMO_URL =
  'https://upload.wikimedia.org/wikipedia/commons/9/99/Joseph_Mallord_William_Turner_%28British_-_Modern_Rome-Campo_Vaccino_-_Google_Art_Project.jpg';

const handleTryDemo = useCallback(async () => {
  setDemoLoading(true);
  try {
    const res = await fetch(DEMO_URL);
    const buffer = await res.arrayBuffer();
    const file = new File([buffer], 'modern-rome.jpg', { type: 'image/jpeg' });
    const thumbUrl = URL.createObjectURL(file);

    const mockHandle = {
      kind: 'file' as const,
      name: 'modern-rome.jpg',
      getFile: async () => file,
    } as unknown as FileSystemFileHandle;

    const entry: CatalogEntry = {
      name: 'modern-rome.jpg',
      fileHandle: mockHandle,
      thumbnailUrl: thumbUrl,
      hasSidecar: false,
    };

    setEntries([entry]);
    setSelectedIndex(0);
    onOpenEditor(0);
  } catch (err) {
    console.error('Failed to load demo image:', err);
  } finally {
    setDemoLoading(false);
  }
}, [setEntries, setSelectedIndex, onOpenEditor]);
```

Replace the empty state JSX (lines 167-170):
```tsx
{!dirHandle ? (
  <div className={styles.empty}>
    <span className={styles.emptyText}>Open a folder to get started</span>
    {recentFolders.length === 0 && (
      <button
        className={styles.demoLink}
        onClick={handleTryDemo}
        disabled={demoLoading}
      >
        {demoLoading ? 'Loading demo...' : 'or try a demo'}
      </button>
    )}
  </div>
)
```

**Step 2: Add CSS for the demo link**

In `CatalogView.module.css`, add:
```css
.demoLink {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0a0);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.demoLink:hover {
  color: var(--text-primary, #e0e0e0);
}

.demoLink:disabled {
  cursor: wait;
  text-decoration: none;
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/catalog/CatalogView.tsx src/components/catalog/CatalogView.module.css
git commit -m "feat: add 'or try a demo' link on landing page"
```

---

### Task 2: Add test for demo link visibility

**Files:**
- Create: `src/components/catalog/__tests__/CatalogView.test.tsx`

**Step 1: Write the test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CatalogView } from '../CatalogView';

// Mock all external dependencies
vi.mock('../../../io/filesystem', () => ({
  openDirectory: vi.fn(),
  listRawFiles: vi.fn(),
  fileExists: vi.fn(),
}));

vi.mock('../../../raw/thumbnail', () => ({
  extractThumbnailUrl: vi.fn(),
}));

vi.mock('../../../io/recentFolders', () => ({
  getRecentFolders: vi.fn().mockResolvedValue([]),
  saveRecentFolder: vi.fn().mockResolvedValue(undefined),
  requestPermission: vi.fn(),
}));

vi.mock('../../../store/catalogStore', () => {
  const store = {
    dirHandle: null,
    entries: [],
    selectedIndex: -1,
    setDirectory: vi.fn(),
    setEntries: vi.fn(),
    setSelectedIndex: vi.fn(),
  };
  return {
    useCatalogStore: (selector: (s: typeof store) => unknown) => selector(store),
  };
});

describe('CatalogView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "or try a demo" when no recent folders exist', async () => {
    render(<CatalogView onOpenEditor={vi.fn()} />);
    // Wait for the async getRecentFolders to resolve
    expect(await screen.findByText('or try a demo')).toBeInTheDocument();
  });
});
```

**Step 2: Run the test**

Run: `npx vitest run src/components/catalog/__tests__/CatalogView.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/catalog/__tests__/CatalogView.test.tsx
git commit -m "test: add CatalogView demo link visibility test"
```
