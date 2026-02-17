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
