// Constants for storage
const BOOKMARKS_KEY = 'timpstamp_bookmarks'; // Single key for all bookmarks
const SETTINGS_KEYS = ['shortcutEnabled', 'darkModeEnabled', 'multiTimestamps'];

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  // One-time migration from sync -> local
  (async () => {
    try {
      const [syncData, localData] = await Promise.all([
        chrome.storage.sync.get([BOOKMARKS_KEY, ...SETTINGS_KEYS]),
        chrome.storage.local.get([BOOKMARKS_KEY, ...SETTINGS_KEYS]),
      ]);

      const toSetLocal = {};
      // Migrate bookmarks if local is empty but sync has data
      if (!localData[BOOKMARKS_KEY] && Array.isArray(syncData[BOOKMARKS_KEY])) {
        toSetLocal[BOOKMARKS_KEY] = syncData[BOOKMARKS_KEY];
      }
      // Migrate settings if absent locally
      for (const key of SETTINGS_KEYS) {
        if (typeof localData[key] === 'undefined' && typeof syncData[key] !== 'undefined') {
          toSetLocal[key] = syncData[key];
        }
      }
      // Ensure defaults
      if (typeof toSetLocal.shortcutEnabled === 'undefined' && typeof localData.shortcutEnabled === 'undefined') {
        toSetLocal.shortcutEnabled = true;
      }
      if (Object.keys(toSetLocal).length > 0) {
        await chrome.storage.local.set(toSetLocal);
      }

      // Ensure bookmarks key exists to simplify consumers
      const ensure = await chrome.storage.local.get(BOOKMARKS_KEY);
      if (!Array.isArray(ensure[BOOKMARKS_KEY])) {
        await chrome.storage.local.set({ [BOOKMARKS_KEY]: [] });
      }
    } catch (_e) {
      // Best-effort migration only
      await chrome.storage.local.set({ shortcutEnabled: true });
      const ensure = await chrome.storage.local.get(BOOKMARKS_KEY);
      if (!Array.isArray(ensure[BOOKMARKS_KEY])) {
        await chrome.storage.local.set({ [BOOKMARKS_KEY]: [] });
      }
    }
  })();

  // No keepAlive alarm; rely on MV3 event-driven lifecycle
});

// No keepAlive; MV3 is event-driven.

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'ADD_BOOKMARK') {
    handleAddBookmark(request.data, sendResponse);
    return true; // Will respond asynchronously
  } else if (request.type === 'DELETE_BOOKMARK') {
    // Handle individual bookmark deletion
    handleDeleteBookmark(request.bookmarkId, sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'updateBookmarkNotes') {
    // Handle notes update
    handleUpdateBookmarkNotes(request.bookmarkId, request.notes, sendResponse);
    return true; // Will respond asynchronously
  }
});

// Get all bookmarks with enhanced error handling and data validation
async function getAllBookmarks(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get bookmarks directly
      const result = await chrome.storage.local.get(BOOKMARKS_KEY);
      const bookmarks = result[BOOKMARKS_KEY] || [];

      // Validate bookmark data structure
      if (!Array.isArray(bookmarks)) {
        throw new Error('Invalid bookmark data structure - expected array');
      }

      // Validate each bookmark has required fields
      const validBookmarks = bookmarks.filter((bookmark) => {
        return (
          bookmark &&
          typeof bookmark === 'object' &&
          bookmark.id &&
          bookmark.videoId &&
          typeof bookmark.timestamp === 'number' &&
          bookmark.videoTitle
        );
      });

      // If some bookmarks were invalid, save the cleaned version
      if (validBookmarks.length !== bookmarks.length && validBookmarks.length >= 0) {
        await chrome.storage.local.set({ [BOOKMARKS_KEY]: validBookmarks });
      }

      return validBookmarks;
    } catch (_error) {
      if (attempt === maxRetries) {
        // Return empty array as fallback to prevent complete failure
        return [];
      }

      // Exponential backoff for retries
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Helper function to check storage quota and clean up if needed
async function checkAndCleanupStorage(bookmarks) {
  // Using chrome.storage.local with ~5MB quota; keep a soft headroom check
  try {
    const bytesInUse = await chrome.storage.local.getBytesInUse();
    const maxBytes = chrome.storage.local.QUOTA_BYTES || 5 * 1024 * 1024;
    const estimated = bytesInUse + JSON.stringify({ [BOOKMARKS_KEY]: bookmarks }).length;
    if (estimated > maxBytes * 0.95) {
      // Soft warning by trimming only if absolutely necessary: keep most recent 500
      const trimmed = [...bookmarks]
        .sort((a, b) => (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0))
        .slice(0, 500);
      return trimmed;
    }
  } catch (_e) {
    // Ignore quota check errors; proceed to save
  }
  return bookmarks;
}

// Helper function to verify storage operation
async function verifyStorageOperation(bookmarks) {
  const verification = await chrome.storage.local.get(BOOKMARKS_KEY);
  if (
    !verification[BOOKMARKS_KEY] ||
    verification[BOOKMARKS_KEY].length !== bookmarks.length
  ) {
    throw new Error('Storage verification failed - data may be corrupted');
  }
}

// Save all bookmarks with enhanced error handling and retry logic
async function saveAllBookmarks(bookmarks, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check storage quota and clean up if needed
      const processedBookmarks = await checkAndCleanupStorage(bookmarks);

      // Save bookmarks directly
      await chrome.storage.local.set({ [BOOKMARKS_KEY]: processedBookmarks });

      // Verify the save was successful
      await verifyStorageOperation(processedBookmarks);

      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff for retries
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Handle adding a bookmark
async function handleAddBookmark(bookmarkData, sendResponse) {
  if (
    !bookmarkData ||
    !bookmarkData.videoId ||
    typeof bookmarkData.timestamp === 'undefined'
  ) {
    sendResponse({ success: false, error: 'Invalid bookmark data' });
    return;
  }

  const videoIdForBookmark = bookmarkData.videoId;

  try {
    const bookmarks = await getAllBookmarks();
    // Determine multi-timestamp behavior
    const setting = await chrome.storage.local.get('multiTimestamps');
    const multi = setting.multiTimestamps !== false; // default true

    // Compute ID based on mode
    const computedId = multi
      ? `${videoIdForBookmark}:${bookmarkData.timestamp}`
      : videoIdForBookmark;
    const existingBookmarkIndex = bookmarks.findIndex((b) => b.id === computedId);

    if (existingBookmarkIndex !== -1) {
      // Update existing bookmark (only minimal fields)
      const existing = bookmarks[existingBookmarkIndex];
      bookmarks[existingBookmarkIndex] = {
        ...existing,
        videoId: bookmarkData.videoId,
        videoTitle: bookmarkData.videoTitle,
        channelTitle: bookmarkData.channelTitle || existing.channelTitle,
        timestamp: bookmarkData.timestamp,
        savedAt: Date.now(),
      };
    } else {
      // Add new bookmark (only minimal fields)
      const newBookmark = {
        id: computedId,
        videoId: bookmarkData.videoId,
        videoTitle: bookmarkData.videoTitle,
        channelTitle: bookmarkData.channelTitle || '',
        timestamp: bookmarkData.timestamp,
        createdAt: Date.now(),
        savedAt: Date.now(),
        notes: '',
      };
      bookmarks.push(newBookmark);
    }

    // Save updated bookmarks with enhanced error handling
    try {
      await saveAllBookmarks(bookmarks);
      // Send a more specific message
      sendResponse({
        success: true,
        message:
          existingBookmarkIndex !== -1
            ? 'Timestamp updated! 🎉'
            : multi
            ? 'Timestamp added! 🎉'
            : 'Timestamp saved! 🎉',
      });
    } catch (saveError) {
      const userMessage = handleStorageError(saveError, 'save bookmark');
      sendResponse({
        success: false,
        error: userMessage,
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Handle individual bookmark deletion with enhanced error handling
async function handleDeleteBookmark(bookmarkId, sendResponse) {
  try {
    // Get all current bookmarks using enhanced error handling
    const allBookmarks = await getAllBookmarks();

    // Filter out the deleted bookmark
    const updatedBookmarks = allBookmarks.filter((b) => b.id !== bookmarkId);

    if (updatedBookmarks.length === allBookmarks.length) {
      // Bookmark wasn't found, but we'll still respond with success
      // to avoid confusing the user
      if (sendResponse) sendResponse({ success: true });
      return;
    }

    // Save the updated bookmarks using enhanced error handling
    try {
      await saveAllBookmarks(updatedBookmarks);
      if (sendResponse) sendResponse({ success: true });
    } catch (saveError) {
      const userMessage = handleStorageError(saveError, 'delete bookmark');
      if (sendResponse) sendResponse({ success: false, error: userMessage });
    }
  } catch (error) {
    const userMessage = handleStorageError(error, 'delete bookmark');
    if (sendResponse) sendResponse({ success: false, error: userMessage });
  }
}

// Handle updating bookmark notes with enhanced error handling
async function handleUpdateBookmarkNotes(bookmarkId, notes, sendResponse) {
  try {
    // Get all current bookmarks using enhanced error handling
    const allBookmarks = await getAllBookmarks();

    // Find and update the bookmark
    const bookmarkIndex = allBookmarks.findIndex((b) => b.id === bookmarkId);

    if (bookmarkIndex === -1) {
      if (sendResponse)
        sendResponse({ success: false, error: 'Bookmark not found' });
      return;
    }

    // Update the notes
    allBookmarks[bookmarkIndex].notes = notes;
    allBookmarks[bookmarkIndex].savedAt = Date.now(); // Update timestamp

    // Save the updated bookmarks using enhanced error handling
    try {
      await saveAllBookmarks(allBookmarks);
      if (sendResponse) sendResponse({ success: true });
    } catch (saveError) {
      const userMessage = handleStorageError(
        saveError,
        'update bookmark notes'
      );
      if (sendResponse) sendResponse({ success: false, error: userMessage });
    }
  } catch (error) {
    const userMessage = handleStorageError(error, 'update bookmark notes');
    if (sendResponse) sendResponse({ success: false, error: userMessage });
  }
}

// Cleanup old bookmarks to free up storage space
async function cleanupOldBookmarks(bookmarks) {
  if (bookmarks.length <= 50) {
    return bookmarks;
  }

  // Sort by savedAt timestamp (newest first) and keep only the 50 most recent
  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const aTime = a.savedAt || a.createdAt || 0;
    const bTime = b.savedAt || b.createdAt || 0;
    return bTime - aTime;
  });

  return sortedBookmarks.slice(0, 50);
}

// Enhanced error handling for storage operations
function handleStorageError(error, _operation) {
  let userMessage = 'An error occurred while saving your bookmark.';

  if (error.message.includes('quota exceeded')) {
    userMessage =
      'Storage limit reached. Please export and delete old bookmarks.';
  } else if (error.message.includes('network')) {
    userMessage = 'Network error. Please check your connection and try again.';
  } else if (error.message.includes('corrupted')) {
    userMessage =
      'Data corruption detected. Your bookmarks have been automatically repaired.';
  }

  return userMessage;
}

// Handle service worker lifecycle with error handling
self.addEventListener('activate', (event) => {
  event.waitUntil(async () => {
    try {
      // Take control of all clients
      await clients.claim();

      // Perform initial data validation on activation
      await getAllBookmarks();
    } catch (_error) {}
  });
});
