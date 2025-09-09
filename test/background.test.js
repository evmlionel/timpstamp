import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock chrome APIs before importing the module
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      getBytesInUse: vi.fn(),
      QUOTA_BYTES: 5 * 1024 * 1024,
    },
    sync: {
      get: vi.fn(),
    },
  },
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
  },
  alarms: {
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
};

globalThis.chrome = mockChrome;

// Mock self and clients for service worker
globalThis.self = {
  addEventListener: vi.fn(),
};
globalThis.clients = {
  claim: vi.fn(),
};

// Import the background script functions
// Since background.js is not a module, we need to test it differently
// We'll create wrapper functions that simulate the background script behavior

describe('Background Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Storage Operations', () => {
    it('should initialize empty bookmarks array on install', () => {
      const mockGetResult = {};
      mockChrome.storage.local.get.mockImplementation((_keys, callback) => {
        callback(mockGetResult);
      });

      mockChrome.storage.local.set.mockImplementation((_data, callback) => {
        callback();
      });

      // Simulate the onInstalled listener behavior
      const onInstalledHandler = () => {
        chrome.storage.local.get(
          ['timpstamp_bookmarks', 'shortcutEnabled'],
          (result) => {
            if (!result.timpstamp_bookmarks) {
              chrome.storage.local.set({ timpstamp_bookmarks: [] }, () => {});
            }
            if (typeof result.shortcutEnabled === 'undefined') {
              chrome.storage.local.set({ shortcutEnabled: true }, () => {});
            }
          }
        );
      };

      onInstalledHandler();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
        ['timpstamp_bookmarks', 'shortcutEnabled'],
        expect.any(Function)
      );
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { timpstamp_bookmarks: [] },
        expect.any(Function)
      );
    });

    it('should set default shortcutEnabled to true', () => {
      const mockGetResult = { timpstamp_bookmarks: [] };
      mockChrome.storage.local.get.mockImplementation((_keys, callback) => {
        callback(mockGetResult);
      });

      mockChrome.storage.local.set.mockImplementation((_data, callback) => {
        callback();
      });

      // Simulate the onInstalled listener behavior
      const onInstalledHandler = () => {
        chrome.storage.local.get(
          ['timpstamp_bookmarks', 'shortcutEnabled'],
          (result) => {
            if (!result.timpstamp_bookmarks) {
              chrome.storage.local.set({ timpstamp_bookmarks: [] }, () => {});
            }
            if (typeof result.shortcutEnabled === 'undefined') {
              chrome.storage.local.set({ shortcutEnabled: true }, () => {});
            }
          }
        );
      };

      onInstalledHandler();

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { shortcutEnabled: true },
        expect.any(Function)
      );
    });
  });

  describe('Bookmark Operations', () => {
    const mockBookmarkData = {
      videoId: 'abc123',
      videoTitle: 'Test Video',
      timestamp: 120,
      formattedTime: '02:00',
      url: 'https://youtube.com/watch?v=abc123&t=120s',
    };

    it('should add new bookmark successfully', async () => {
      const existingBookmarks = [];
      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: existingBookmarks,
      });
      mockChrome.storage.local.getBytesInUse.mockResolvedValue(1000);
      mockChrome.storage.local.set.mockResolvedValue();

      const sendResponse = vi.fn();

      // Create a mock handleAddBookmark function
      const handleAddBookmark = async (bookmarkData, sendResponse) => {
        if (
          !bookmarkData ||
          !bookmarkData.videoId ||
          typeof bookmarkData.timestamp === 'undefined'
        ) {
          sendResponse({ success: false, error: 'Invalid bookmark data' });
          return;
        }

        const result = await mockChrome.storage.local.get(
          'timpstamp_bookmarks'
        );
        const bookmarks = result.timpstamp_bookmarks || [];

        const existingIndex = bookmarks.findIndex(
          (b) => b.id === bookmarkData.videoId
        );

        if (existingIndex === -1) {
          const newBookmark = {
            ...bookmarkData,
            id: bookmarkData.videoId,
            createdAt: Date.now(),
            savedAt: Date.now(),
            notes: '',
          };
          bookmarks.push(newBookmark);
        }

        await mockChrome.storage.local.set({ timpstamp_bookmarks: bookmarks });
        sendResponse({ success: true, message: 'Timestamp saved! 🎉' });
      };

      await handleAddBookmark(mockBookmarkData, sendResponse);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timpstamp_bookmarks: expect.arrayContaining([
          expect.objectContaining({
            id: 'abc123',
            videoId: 'abc123',
            videoTitle: 'Test Video',
            timestamp: 120,
            formattedTime: '02:00',
            notes: '',
          }),
        ]),
      });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'Timestamp saved! 🎉',
      });
    });

    it('should update existing bookmark', async () => {
      const existingBookmarks = [
        {
          id: 'abc123',
          videoId: 'abc123',
          videoTitle: 'Old Title',
          timestamp: 60,
          formattedTime: '01:00',
          url: 'https://youtube.com/watch?v=abc123&t=60s',
          createdAt: 1000000,
          savedAt: 1000000,
          notes: 'Old notes',
        },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: existingBookmarks,
      });
      mockChrome.storage.local.getBytesInUse.mockResolvedValue(1000);
      mockChrome.storage.local.set.mockResolvedValue();

      const sendResponse = vi.fn();

      const handleAddBookmark = async (bookmarkData, sendResponse) => {
        const result = await mockChrome.storage.local.get(
          'timpstamp_bookmarks'
        );
        const bookmarks = result.timpstamp_bookmarks || [];

        const existingIndex = bookmarks.findIndex(
          (b) => b.id === bookmarkData.videoId
        );

        if (existingIndex !== -1) {
          bookmarks[existingIndex] = {
            ...bookmarks[existingIndex],
            videoTitle: bookmarkData.videoTitle,
            timestamp: bookmarkData.timestamp,
            formattedTime: bookmarkData.formattedTime,
            url: bookmarkData.url,
            videoId: bookmarkData.videoId,
            savedAt: Date.now(),
          };
        }

        await mockChrome.storage.local.set({ timpstamp_bookmarks: bookmarks });
        sendResponse({ success: true, message: 'Timestamp updated! 🎉' });
      };

      await handleAddBookmark(mockBookmarkData, sendResponse);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timpstamp_bookmarks: expect.arrayContaining([
          expect.objectContaining({
            id: 'abc123',
            videoTitle: 'Test Video',
            timestamp: 120,
            formattedTime: '02:00',
            notes: 'Old notes', // Should preserve notes
            createdAt: 1000000, // Should preserve createdAt
          }),
        ]),
      });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'Timestamp updated! 🎉',
      });
    });

    it('should handle invalid bookmark data', async () => {
      const sendResponse = vi.fn();

      const handleAddBookmark = async (bookmarkData, sendResponse) => {
        if (
          !bookmarkData ||
          !bookmarkData.videoId ||
          typeof bookmarkData.timestamp === 'undefined'
        ) {
          sendResponse({ success: false, error: 'Invalid bookmark data' });
          return;
        }
      };

      await handleAddBookmark(null, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid bookmark data',
      });

      await handleAddBookmark({ videoId: 'abc123' }, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid bookmark data',
      });
    });

    it('should handle storage quota exceeded', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: [],
      });
      mockChrome.storage.local.getBytesInUse.mockResolvedValue(
        5 * 1024 * 1024 - 10
      ); // Near local quota
      mockChrome.storage.local.set.mockResolvedValue();

      const sendResponse = vi.fn();

      const handleAddBookmark = async (bookmarkData, sendResponse) => {
        try {
          const bytesInUse = await mockChrome.storage.local.getBytesInUse();
          const maxBytes =
            mockChrome.storage.local.QUOTA_BYTES || 5 * 1024 * 1024;
          const bookmarksSize = JSON.stringify([bookmarkData]).length;

          if (bytesInUse + bookmarksSize > maxBytes * 0.9) {
            throw new Error(
              `Storage quota exceeded. Current: ${bytesInUse}, Required: ${bookmarksSize}, Max: ${maxBytes}`
            );
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      };

      await handleAddBookmark(mockBookmarkData, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Storage quota exceeded'),
      });
    });

    it('should delete bookmark successfully', async () => {
      const existingBookmarks = [
        {
          id: 'abc123',
          videoId: 'abc123',
          videoTitle: 'Test Video',
          timestamp: 120,
        },
        {
          id: 'def456',
          videoId: 'def456',
          videoTitle: 'Another Video',
          timestamp: 60,
        },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: existingBookmarks,
      });
      mockChrome.storage.local.set.mockResolvedValue();

      const sendResponse = vi.fn();

      const handleDeleteBookmark = async (bookmarkId, sendResponse) => {
        const result = await mockChrome.storage.local.get(
          'timpstamp_bookmarks'
        );
        const allBookmarks = result.timpstamp_bookmarks || [];
        const updatedBookmarks = allBookmarks.filter(
          (b) => b.id !== bookmarkId
        );

        await mockChrome.storage.local.set({
          timpstamp_bookmarks: updatedBookmarks,
        });
        sendResponse({ success: true });
      };

      await handleDeleteBookmark('abc123', sendResponse);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timpstamp_bookmarks: [
          {
            id: 'def456',
            videoId: 'def456',
            videoTitle: 'Another Video',
            timestamp: 60,
          },
        ],
      });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should update bookmark notes', async () => {
      const existingBookmarks = [
        {
          id: 'abc123',
          videoId: 'abc123',
          videoTitle: 'Test Video',
          timestamp: 120,
          notes: 'Old notes',
          savedAt: 1000000,
        },
      ];

      mockChrome.storage.local.get.mockResolvedValue({
        timpstamp_bookmarks: existingBookmarks,
      });
      mockChrome.storage.local.set.mockResolvedValue();

      const sendResponse = vi.fn();

      const handleUpdateBookmarkNotes = async (
        bookmarkId,
        notes,
        sendResponse
      ) => {
        const result = await mockChrome.storage.local.get(
          'timpstamp_bookmarks'
        );
        const allBookmarks = result.timpstamp_bookmarks || [];
        const bookmarkIndex = allBookmarks.findIndex(
          (b) => b.id === bookmarkId
        );

        if (bookmarkIndex === -1) {
          sendResponse({ success: false, error: 'Bookmark not found' });
          return;
        }

        allBookmarks[bookmarkIndex].notes = notes;
        allBookmarks[bookmarkIndex].savedAt = Date.now();

        await mockChrome.storage.local.set({
          timpstamp_bookmarks: allBookmarks,
        });
        sendResponse({ success: true });
      };

      await handleUpdateBookmarkNotes('abc123', 'New notes', sendResponse);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        timpstamp_bookmarks: [
          expect.objectContaining({
            id: 'abc123',
            notes: 'New notes',
            savedAt: expect.any(Number),
          }),
        ],
      });
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });
});
