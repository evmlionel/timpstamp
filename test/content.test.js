import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
  },
};

globalThis.chrome = mockChrome;

describe('Content Script', () => {
  let mockVideo;
  let mockDocument;

  beforeEach(() => {
    // Mock video element
    mockVideo = {
      currentTime: 125, // 2 minutes 5 seconds
      play: vi.fn(),
      pause: vi.fn(),
    };

    // Mock document methods
    mockDocument = {
      querySelector: vi.fn(),
      title: 'Test Video Title - YouTube',
      createElement: vi.fn(),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        search: '?v=abc123&t=125s',
        href: 'https://youtube.com/watch?v=abc123&t=125s',
      },
      writable: true,
    });

    // Mock URLSearchParams
    global.URLSearchParams = class URLSearchParams {
      constructor(search) {
        this.params = new Map();
        if (search === '?v=abc123&t=125s') {
          this.params.set('v', 'abc123');
          this.params.set('t', '125s');
        }
      }
      get(key) {
        return this.params.get(key);
      }
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shortcut Settings', () => {
    it('should load shortcut setting from storage', () => {
      mockChrome.storage.local.get.mockImplementation((_key, callback) => {
        callback({ shortcutEnabled: false });
      });

      const loadShortcutSetting = () => {
        chrome.storage.local.get('shortcutEnabled', (result) => {
          return result.shortcutEnabled !== false;
        });
      };

      loadShortcutSetting();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
        'shortcutEnabled',
        expect.any(Function)
      );
    });

    it('should listen for storage changes', () => {
      let shortcutEnabled = true;

      const onStorageChanged = (changes, namespace) => {
        if (namespace === 'local' && changes.shortcutEnabled) {
          shortcutEnabled = changes.shortcutEnabled.newValue !== false;
        }
      };

      // Simulate storage change
      onStorageChanged({ shortcutEnabled: { newValue: false } }, 'local');

      expect(shortcutEnabled).toBe(false);

      // Simulate another storage change
      onStorageChanged({ shortcutEnabled: { newValue: true } }, 'local');

      expect(shortcutEnabled).toBe(true);
    });
  });

  describe('Timestamp Saving', () => {
    it('should save timestamp with correct data', () => {
      // Mock document.querySelector to return our mock video
      const mockTitleElement = {
        textContent: 'Test Video Title',
      };

      mockDocument.querySelector.mockImplementation((selector) => {
        if (selector === 'video') {
          return mockVideo;
        }
        if (selector.includes('h1.ytd-watch-metadata')) {
          return mockTitleElement;
        }
        return null;
      });

      // Mock document globally
      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true,
      });

      mockChrome.runtime.sendMessage.mockImplementation(
        (_message, callback) => {
          callback({ success: true, message: 'Timestamp saved! 🎉' });
        }
      );

      const saveTimestamp = () => {
        const video = document.querySelector('video');
        if (!video) {
          throw new Error('Video not found');
        }

        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) {
          throw new Error('Video ID not found');
        }

        const currentTime = Math.floor(video.currentTime);
        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = currentTime % 60;

        let videoTitle = 'Unknown Title';
        const titleElement = document.querySelector(
          'h1.ytd-watch-metadata yt-formatted-string#title, h1.title.ytd-video-primary-info-renderer yt-formatted-string, #container > h1.title > yt-formatted-string'
        );

        if (titleElement?.textContent) {
          videoTitle = titleElement.textContent.trim();
        } else {
          if (document.title.endsWith(' - YouTube')) {
            videoTitle = document.title
              .substring(0, document.title.length - ' - YouTube'.length)
              .trim();
          } else {
            videoTitle = document.title.trim();
          }
        }

        const formattedTime =
          hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const bookmark = {
          videoId,
          videoTitle: videoTitle,
          timestamp: currentTime,
          formattedTime,
          url: `https://youtube.com/watch?v=${videoId}&t=${currentTime}s`,
          savedAt: Date.now(),
        };

        chrome.runtime.sendMessage(
          {
            type: 'ADD_BOOKMARK',
            data: bookmark,
          },
          (response) => {
            if (response?.success) {
              return response.message;
            }
            throw new Error(response?.error || 'Failed to save timestamp');
          }
        );
      };

      expect(() => saveTimestamp()).not.toThrow();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: 'ADD_BOOKMARK',
          data: expect.objectContaining({
            videoId: 'abc123',
            videoTitle: 'Test Video Title',
            timestamp: 125,
            formattedTime: '2:05',
            url: 'https://youtube.com/watch?v=abc123&t=125s',
            savedAt: expect.any(Number),
          }),
        },
        expect.any(Function)
      );
    });

    it('should handle video not found error', () => {
      mockDocument.querySelector.mockImplementation((selector) => {
        if (selector === 'video') {
          return null; // Video not found
        }
        return null;
      });

      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true,
      });

      const saveTimestamp = () => {
        const video = document.querySelector('video');
        if (!video) {
          throw new Error('Video not found');
        }
      };

      expect(() => saveTimestamp()).toThrow('Video not found');
    });

    it('should handle missing video ID error', () => {
      // Mock location without video ID
      Object.defineProperty(window, 'location', {
        value: {
          search: '?list=playlist123',
          href: 'https://youtube.com/playlist?list=playlist123',
        },
        writable: true,
      });

      global.URLSearchParams = class URLSearchParams {
        constructor(_search) {
          this.params = new Map();
          // No video ID in this search
        }
        get(key) {
          return this.params.get(key);
        }
      };

      mockDocument.querySelector.mockImplementation((selector) => {
        if (selector === 'video') {
          return mockVideo;
        }
        return null;
      });

      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true,
      });

      const saveTimestamp = () => {
        const video = document.querySelector('video');
        if (!video) {
          throw new Error('Video not found');
        }

        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) {
          throw new Error('Video ID not found');
        }
      };

      expect(() => saveTimestamp()).toThrow('Video ID not found');
    });

    it('should format time correctly for different durations', () => {
      const formatTime = (currentTime) => {
        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = currentTime % 60;

        return hours > 0
          ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          : `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };

      // Test various time formats
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3665)).toBe('1:01:05');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(0)).toBe('0:00');
    });

    it('should extract video title from different sources', () => {
      const extractVideoTitle = (document) => {
        let videoTitle = 'Unknown Title';
        const titleElement = document.querySelector(
          'h1.ytd-watch-metadata yt-formatted-string#title, h1.title.ytd-video-primary-info-renderer yt-formatted-string, #container > h1.title > yt-formatted-string'
        );

        if (titleElement?.textContent) {
          videoTitle = titleElement.textContent.trim();
        } else {
          if (document.title.endsWith(' - YouTube')) {
            videoTitle = document.title
              .substring(0, document.title.length - ' - YouTube'.length)
              .trim();
          } else {
            videoTitle = document.title.trim();
          }
        }

        return videoTitle;
      };

      // Test with title element
      const mockDocWithTitle = {
        querySelector: vi.fn().mockReturnValue({
          textContent: '  JavaScript Tutorial  ',
        }),
        title: 'JavaScript Tutorial - YouTube',
      };

      expect(extractVideoTitle(mockDocWithTitle)).toBe('JavaScript Tutorial');

      // Test with document title fallback
      const mockDocWithoutTitle = {
        querySelector: vi.fn().mockReturnValue(null),
        title: 'Python Basics - YouTube',
      };

      expect(extractVideoTitle(mockDocWithoutTitle)).toBe('Python Basics');

      // Test with document title without YouTube suffix
      const mockDocCustomTitle = {
        querySelector: vi.fn().mockReturnValue(null),
        title: 'Custom Video Title',
      };

      expect(extractVideoTitle(mockDocCustomTitle)).toBe('Custom Video Title');
    });
  });

  describe('Button Injection', () => {
    it('should create bookmark button with correct attributes', () => {
      const mockButton = {
        className: '',
        innerHTML: '',
        title: '',
        style: {},
        addEventListener: vi.fn(),
      };

      const mockControls = {
        appendChild: vi.fn(),
        insertBefore: vi.fn(),
      };

      mockDocument.createElement.mockReturnValue(mockButton);
      mockDocument.querySelector.mockImplementation((selector) => {
        if (selector.includes('ytp-right-controls')) {
          return mockControls;
        }
        return null;
      });

      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true,
      });

      const createBookmarkButton = () => {
        const button = document.createElement('button');
        button.className = 'ytp-button ytb-bookmark-btn';
        button.innerHTML = '🔖';
        button.title = 'Save Timestamp (B)';
        button.style.fontSize = '16px';
        button.style.padding = '0 12px';
        button.style.color = 'white';
        button.style.backgroundColor = 'transparent';
        button.style.border = 'none';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => {
          // Mock save timestamp
        });

        return button;
      };

      const injectBookmarkButton = () => {
        const rightControls = document.querySelector('.ytp-right-controls');
        if (rightControls) {
          const button = createBookmarkButton();
          rightControls.appendChild(button);
          return button;
        }
        return null;
      };

      const button = injectBookmarkButton();

      expect(button).toBeTruthy();
      expect(mockDocument.createElement).toHaveBeenCalledWith('button');
      expect(mockControls.appendChild).toHaveBeenCalledWith(button);
      expect(button.className).toBe('ytp-button ytb-bookmark-btn');
      expect(button.innerHTML).toBe('🔖');
      expect(button.title).toBe('Save Timestamp (B)');
    });

    it('should handle missing controls container', () => {
      mockDocument.querySelector.mockReturnValue(null);

      Object.defineProperty(global, 'document', {
        value: mockDocument,
        writable: true,
      });

      const injectBookmarkButton = () => {
        const rightControls = document.querySelector('.ytp-right-controls');
        if (rightControls) {
          return true;
        }
        return false;
      };

      const result = injectBookmarkButton();
      expect(result).toBe(false);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle keyboard shortcut when enabled', () => {
      const shortcutEnabled = true;
      let saveTimestampCalled = false;

      const handleKeydown = (event) => {
        if (event.key === 'b' || event.key === 'B') {
          if (shortcutEnabled) {
            event.preventDefault();
            saveTimestampCalled = true;
          }
        }
      };

      const mockEvent = {
        key: 'b',
        preventDefault: vi.fn(),
      };

      handleKeydown(mockEvent);

      expect(saveTimestampCalled).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should ignore keyboard shortcut when disabled', () => {
      const shortcutEnabled = false;
      let saveTimestampCalled = false;

      const handleKeydown = (event) => {
        if (event.key === 'b' || event.key === 'B') {
          if (shortcutEnabled) {
            event.preventDefault();
            saveTimestampCalled = true;
          }
        }
      };

      const mockEvent = {
        key: 'b',
        preventDefault: vi.fn(),
      };

      handleKeydown(mockEvent);

      expect(saveTimestampCalled).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should ignore other keys', () => {
      const shortcutEnabled = true;
      let saveTimestampCalled = false;

      const handleKeydown = (event) => {
        if (event.key === 'b' || event.key === 'B') {
          if (shortcutEnabled) {
            event.preventDefault();
            saveTimestampCalled = true;
          }
        }
      };

      const mockEvent = {
        key: 'a',
        preventDefault: vi.fn(),
      };

      handleKeydown(mockEvent);

      expect(saveTimestampCalled).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Overlay Persistence', () => {
    beforeEach(() => {
      // Ensure a real JSDOM document for these tests
      Object.defineProperty(global, 'document', {
        value: window.document,
        writable: true,
      });
    });
    it('should toggle overlay minimized and persist state', async () => {
      const hideBtn = { textContent: '' };
      const panel = {
        querySelector: (sel) => (sel === '.ytb-overlay-hide' ? hideBtn : null),
      };
      const list = { style: {} };

      let overlayMinimized = false;
      mockChrome.storage.local.set.mockResolvedValue();

      const onHideClick = async () => {
        overlayMinimized = !overlayMinimized;
        list.style.display = overlayMinimized ? 'none' : 'block';
        const hb = panel.querySelector('.ytb-overlay-hide');
        if (hb) hb.textContent = overlayMinimized ? '👁️' : '🙈';
        await chrome.storage.local.set({ overlayMinimized });
      };

      await onHideClick();
      expect(overlayMinimized).toBe(true);
      expect(list.style.display).toBe('none');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ overlayMinimized: true })
      );

      await onHideClick();
      expect(overlayMinimized).toBe(false);
      expect(list.style.display).toBe('block');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ overlayMinimized: false })
      );
    });

    it('should disable overlay and persist when closed', async () => {
      const panel = { remove: vi.fn() };

      let overlayEnabled = true;
      const renderFab = vi.fn();
      mockChrome.storage.local.set.mockResolvedValue();

      const onCloseClick = async () => {
        overlayEnabled = false;
        await chrome.storage.local.set({ overlayEnabled: false });
        panel.remove();
        renderFab();
      };

      await onCloseClick();
      expect(overlayEnabled).toBe(false);
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ overlayEnabled: false })
      );
      expect(renderFab).toHaveBeenCalled();
    });
  });
});
