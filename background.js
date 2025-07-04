// Constants for storage
const BOOKMARKS_KEY = 'timpstamp_bookmarks'; // Single key for all bookmarks

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([BOOKMARKS_KEY, 'shortcutEnabled'], (result) => {
    if (!result[BOOKMARKS_KEY]) {
      // Initialize with an empty array of bookmarks
      chrome.storage.sync.set(
        {
          [BOOKMARKS_KEY]: [], // Empty array - no bookmarks initially
        },
        () => {}
      );
    }
    // Ensure shortcutEnabled has a default value (true)
    if (typeof result.shortcutEnabled === 'undefined') {
      chrome.storage.sync.set({ shortcutEnabled: true }, () => {});
    }
  });
  // Create the alarm when the extension is installed or updated
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 }); // Run every 30 seconds
});

// Listener for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Perform a minimal operation to keep the service worker alive, e.g., check storage
    chrome.storage.sync.get(null, (_items) => {
      if (chrome.runtime.lastError) {
        // Handle error silently - keep-alive check failed
      }
    });
  }
});

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
      const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
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
      if (
        validBookmarks.length !== bookmarks.length &&
        validBookmarks.length > 0
      ) {
        await chrome.storage.sync.set({ [BOOKMARKS_KEY]: validBookmarks });
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
  const bytesInUse = await chrome.storage.sync.getBytesInUse();
  const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
  const bookmarksSize = JSON.stringify(bookmarks).length;
  const totalSize = bytesInUse + bookmarksSize;
  const quotaThreshold = maxBytes * 0.85;

  if (totalSize <= quotaThreshold) {
    return bookmarks;
  }

  if (bookmarks.length > 50) {
    const cleanedBookmarks = await cleanupOldBookmarks(bookmarks);
    const cleanedSize = JSON.stringify(cleanedBookmarks).length;

    if (bytesInUse + cleanedSize <= quotaThreshold) {
      return cleanedBookmarks;
    }
  }

  throw new Error(
    `Storage quota exceeded. Current: ${bytesInUse}B, Required: ${bookmarksSize}B, Max: ${maxBytes}B. Consider exporting and deleting old bookmarks.`
  );
}

// Helper function to verify storage operation
async function verifyStorageOperation(bookmarks) {
  const verification = await chrome.storage.sync.get(BOOKMARKS_KEY);
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
      await chrome.storage.sync.set({ [BOOKMARKS_KEY]: processedBookmarks });

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

  const videoIdForBookmark = bookmarkData.videoId; // Use videoId as the unique identifier

  try {
    const bookmarks = await getAllBookmarks();

    // Check if a bookmark for this videoId already exists
    const existingBookmarkIndex = bookmarks.findIndex(
      (b) => b.id === videoIdForBookmark // Assuming 'id' will now store just the videoId
    );

    if (existingBookmarkIndex !== -1) {
      // Update existing bookmark
      bookmarks[existingBookmarkIndex] = {
        ...bookmarks[existingBookmarkIndex], // Preserve existing fields like notes, original createdAt
        videoTitle: bookmarkData.videoTitle, // Update title in case it changed
        timestamp: bookmarkData.timestamp,
        formattedTime: bookmarkData.formattedTime,
        url: bookmarkData.url,
        // videoId is part of bookmarkData and will be spread via ...bookmarkData if not explicitly listed
        // Ensure videoId from bookmarkData is used if it's part of the spread
        videoId: bookmarkData.videoId,
        savedAt: Date.now(), // Update the savedAt/updatedAt timestamp
      };
      // The 'id' field is already videoIdForBookmark due to the findIndex and preservation logic
    } else {
      // Add new bookmark
      const newBookmark = {
        ...bookmarkData, // Contains videoId, videoTitle, timestamp, formattedTime, url
        id: videoIdForBookmark, // Set id to videoId
        createdAt: Date.now(), // Timestamp for when it was first bookmarked
        savedAt: Date.now(), // Timestamp for this specific save/update
        notes: '', // Initialize notes
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
