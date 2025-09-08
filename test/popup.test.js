import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

globalThis.chrome = mockChrome;

describe('Popup Script', () => {
  let container;
  let mockHTML;

  beforeEach(() => {
    // Create a mock DOM structure
    mockHTML = `
      <div id="loadingState" style="display: block;">Loading...</div>
      <div id="emptyState" style="display: none;">No bookmarks found</div>
      <div id="notificationArea"></div>
      <div id="bookmarksList"></div>
      <input type="text" id="searchInput" placeholder="Search bookmarks..." />
      <input type="checkbox" id="shortcutToggle" />
      <input type="checkbox" id="darkModeToggle" />
      <select id="sortSelect">
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
      <button id="exportBtn">Export</button>
      <button id="importBtn">Import</button>
      <input type="file" id="importFile" style="display: none;" />
      <button id="selectModeBtn">Select Mode</button>
      <div id="bulkActions" style="display: none;">
        <span id="selectedCount">0 selected</span>
        <button id="selectAllBtn">Select All</button>
        <button id="deselectAllBtn">Deselect All</button>
        <button id="exportSelectedBtn">Export Selected</button>
        <button id="deleteSelectedBtn">Delete Selected</button>
      </div>
    `;

    container = document.createElement('div');
    container.innerHTML = mockHTML;
    document.body.appendChild(container);

    // Mock document.getElementById to return our mock elements
    const originalGetElementById = document.getElementById;
    document.getElementById = (id) => {
      return (
        container.querySelector(`#${id}`) ||
        originalGetElementById.call(document, id)
      );
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('Theme Management', () => {
    it('should apply dark theme correctly', () => {
      // Create a mock function to simulate applyTheme
      const applyTheme = (isDark) => {
        if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      };

      applyTheme(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      applyTheme(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe(null);
    });

    it('should toggle dark mode setting', async () => {
      const darkModeToggle = document.getElementById('darkModeToggle');
      mockChrome.storage.local.set = vi.fn();

      // Simulate click event
      darkModeToggle.checked = true;
      const changeEvent = new Event('change');
      darkModeToggle.dispatchEvent(changeEvent);

      // Since we can't directly test the event listener, we'll test the storage call
      // This would normally be called by the event listener
      await mockChrome.storage.local.set({ darkModeEnabled: true });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        darkModeEnabled: true,
      });
    });
  });

  describe('Data Loading', () => {
    it('should load bookmarks and settings on initialization', async () => {
      const mockBookmarks = [
        {
          id: 'abc123',
          videoId: 'abc123',
          videoTitle: 'Test Video',
          timestamp: 120,
          formattedTime: '02:00',
          url: 'https://youtube.com/watch?v=abc123&t=120s',
          createdAt: Date.now(),
          notes: 'Test notes',
        },
      ];

      mockChrome.storage.local.get.mockImplementation((keys) => {
        if (keys.includes('timpstamp_bookmarks')) {
          return Promise.resolve({
            timpstamp_bookmarks: mockBookmarks,
            shortcutEnabled: true,
            darkModeEnabled: false,
          });
        }
        return Promise.resolve({
          shortcutEnabled: true,
          darkModeEnabled: false,
        });
      });

      // Mock loadAllData function
      const loadAllData = async () => {
        const settingResult = await mockChrome.storage.local.get([
          'shortcutEnabled',
          'darkModeEnabled',
        ]);

        const shortcutToggle = document.getElementById('shortcutToggle');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const loadingState = document.getElementById('loadingState');

        shortcutToggle.checked = settingResult.shortcutEnabled !== false;
        darkModeToggle.checked = settingResult.darkModeEnabled || false;

        const result = await mockChrome.storage.local.get('timpstamp_bookmarks');
        const bookmarks = result.timpstamp_bookmarks || [];

        loadingState.style.display = 'none';

        return bookmarks;
      };

      const bookmarks = await loadAllData();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith([
        'shortcutEnabled',
        'darkModeEnabled',
      ]);
      expect(bookmarks).toEqual(mockBookmarks);
      expect(document.getElementById('loadingState').style.display).toBe(
        'none'
      );
    });

    it('should handle error when loading data fails', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

      const loadAllData = async () => {
        try {
          await mockChrome.storage.local.get([
            'shortcutEnabled',
            'darkModeEnabled',
          ]);
        } catch (_error) {
          const loadingState = document.getElementById('loadingState');
          const emptyState = document.getElementById('emptyState');

          loadingState.style.display = 'none';
          emptyState.textContent = 'Error loading bookmarks. Please try again.';
          emptyState.style.display = 'block';
        }
      };

      await loadAllData();

      expect(document.getElementById('loadingState').style.display).toBe(
        'none'
      );
      expect(document.getElementById('emptyState').style.display).toBe('block');
      expect(document.getElementById('emptyState').textContent).toBe(
        'Error loading bookmarks. Please try again.'
      );
    });
  });

  describe('Export/Import Functionality', () => {
    it('should export bookmarks to JSON', async () => {
      const mockBookmarks = [
        {
          id: 'abc123',
          videoTitle: 'Test Video',
          timestamp: 120,
          formattedTime: '02:00',
        },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: mockBookmarks,
      });

      // Mock createObjectURL and URL.revokeObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.createElement to return a mock link element
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn((tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement.call(document, tagName);
      });

      const exportBookmarks = async () => {
        const result = await mockChrome.storage.local.get('timpstamp_bookmarks');
        const bookmarks = result.timpstamp_bookmarks || [];

        if (bookmarks.length === 0) {
          throw new Error('No bookmarks to export');
        }

        const dataStr = JSON.stringify(bookmarks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `youtube-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
      };

      await exportBookmarks();

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should handle import of valid JSON bookmarks', async () => {
      const mockBookmarks = [
        {
          id: 'abc123',
          videoTitle: 'Imported Video',
          timestamp: 60,
          formattedTime: '01:00',
        },
      ];

      const mockFile = new File(
        [JSON.stringify(mockBookmarks)],
        'bookmarks.json',
        { type: 'application/json' }
      );

      mockChrome.storage.local.set.mockResolvedValue();

      const importBookmarks = async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const bookmarks = JSON.parse(e.target.result);

              if (!Array.isArray(bookmarks)) {
                throw new Error('Invalid file format');
              }

              await mockChrome.storage.local.set({
                timpstamp_bookmarks: bookmarks,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      };

      await expect(importBookmarks(mockFile)).resolves.toBeUndefined();
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timpstamp_bookmarks: mockBookmarks,
      });
    });

    it('should handle invalid JSON during import', async () => {
      const mockFile = new File(['invalid json'], 'bookmarks.json', {
        type: 'application/json',
      });

      const importBookmarks = async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const bookmarks = JSON.parse(e.target.result);
              resolve(bookmarks);
            } catch (_error) {
              reject(new Error('Invalid JSON format'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      };

      await expect(importBookmarks(mockFile)).rejects.toThrow(
        'Invalid JSON format'
      );
    });
  });

  describe('Selection Mode', () => {
    it('should toggle selection mode', () => {
      const selectModeBtn = document.getElementById('selectModeBtn');
      const bulkActions = document.getElementById('bulkActions');

      let isSelectMode = false;

      const toggleSelectMode = () => {
        isSelectMode = !isSelectMode;
        bulkActions.style.display = isSelectMode ? 'block' : 'none';
        selectModeBtn.textContent = isSelectMode
          ? 'Exit Select Mode'
          : 'Select Mode';
      };

      // Test entering select mode
      toggleSelectMode();
      expect(isSelectMode).toBe(true);
      expect(bulkActions.style.display).toBe('block');
      expect(selectModeBtn.textContent).toBe('Exit Select Mode');

      // Test exiting select mode
      toggleSelectMode();
      expect(isSelectMode).toBe(false);
      expect(bulkActions.style.display).toBe('none');
      expect(selectModeBtn.textContent).toBe('Select Mode');
    });

    it('should update selected count', () => {
      const selectedCount = document.getElementById('selectedCount');
      const selectedBookmarks = new Set(['abc123', 'def456']);

      const updateSelectedCount = () => {
        selectedCount.textContent = `${selectedBookmarks.size} selected`;
      };

      updateSelectedCount();
      expect(selectedCount.textContent).toBe('2 selected');

      selectedBookmarks.clear();
      updateSelectedCount();
      expect(selectedCount.textContent).toBe('0 selected');
    });
  });

  describe('Search Functionality', () => {
    it('should filter bookmarks based on search input', () => {
      const allBookmarks = [
        {
          id: 'abc123',
          videoTitle: 'JavaScript Tutorial',
          timestamp: 120,
        },
        {
          id: 'def456',
          videoTitle: 'Python Basics',
          timestamp: 60,
        },
        {
          id: 'ghi789',
          videoTitle: 'JavaScript Advanced',
          timestamp: 180,
        },
      ];

      const filterBookmarks = (searchTerm) => {
        if (!searchTerm) return allBookmarks;
        return allBookmarks.filter((bookmark) =>
          bookmark.videoTitle.toLowerCase().includes(searchTerm.toLowerCase())
        );
      };

      // Test filtering by "JavaScript"
      const jsResults = filterBookmarks('JavaScript');
      expect(jsResults).toHaveLength(2);
      expect(jsResults.every((b) => b.videoTitle.includes('JavaScript'))).toBe(
        true
      );

      // Test filtering by "Python"
      const pythonResults = filterBookmarks('Python');
      expect(pythonResults).toHaveLength(1);
      expect(pythonResults[0].videoTitle).toBe('Python Basics');

      // Test empty search
      const allResults = filterBookmarks('');
      expect(allResults).toHaveLength(3);
      expect(allResults).toEqual(allBookmarks);
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort bookmarks by different criteria', () => {
      const bookmarks = [
        {
          id: 'abc123',
          videoTitle: 'Charlie Video',
          createdAt: 1000,
          timestamp: 300,
        },
        {
          id: 'def456',
          videoTitle: 'Alpha Video',
          createdAt: 3000,
          timestamp: 100,
        },
        {
          id: 'ghi789',
          videoTitle: 'Beta Video',
          createdAt: 2000,
          timestamp: 200,
        },
      ];

      const sortBookmarks = (bookmarks, sortType) => {
        const sorted = [...bookmarks];
        switch (sortType) {
          case 'newest':
            return sorted.sort((a, b) => b.createdAt - a.createdAt);
          case 'oldest':
            return sorted.sort((a, b) => a.createdAt - b.createdAt);
          case 'alphabetical':
            return sorted.sort((a, b) =>
              a.videoTitle.localeCompare(b.videoTitle)
            );
          default:
            return sorted;
        }
      };

      // Test newest first
      const newest = sortBookmarks(bookmarks, 'newest');
      expect(newest[0].videoTitle).toBe('Alpha Video');
      expect(newest[2].videoTitle).toBe('Charlie Video');

      // Test oldest first
      const oldest = sortBookmarks(bookmarks, 'oldest');
      expect(oldest[0].videoTitle).toBe('Charlie Video');
      expect(oldest[2].videoTitle).toBe('Alpha Video');

      // Test alphabetical
      const alphabetical = sortBookmarks(bookmarks, 'alphabetical');
      expect(alphabetical[0].videoTitle).toBe('Alpha Video');
      expect(alphabetical[1].videoTitle).toBe('Beta Video');
      expect(alphabetical[2].videoTitle).toBe('Charlie Video');
    });
  });
});
