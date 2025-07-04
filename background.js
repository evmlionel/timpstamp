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

// Get all bookmarks - new simplified approach
async function getAllBookmarks() {
  try {
    // Get bookmarks directly
    const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
    return result[BOOKMARKS_KEY] || [];
  } catch (_error) {
    return [];
  }
}

// Save all bookmarks - new simplified approach
async function saveAllBookmarks(bookmarks) {
  // Check storage quota before saving (Windows may have stricter limits)
  const bytesInUse = await chrome.storage.sync.getBytesInUse();
  const maxBytes = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
  const bookmarksSize = JSON.stringify(bookmarks).length;

  if (bytesInUse + bookmarksSize > maxBytes * 0.9) {
    throw new Error(
      `Storage quota exceeded. Current: ${bytesInUse}, Required: ${bookmarksSize}, Max: ${maxBytes}`
    );
  }

  // Save bookmarks directly
  await chrome.storage.sync.set({ [BOOKMARKS_KEY]: bookmarks });
  return true;
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

    // Save updated bookmarks
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
      sendResponse({
        success: false,
        error: `Failed to save bookmarks: ${saveError.message}`,
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Handle individual bookmark deletion - completely rewritten with direct storage
async function handleDeleteBookmark(bookmarkId, sendResponse) {
  try {
    // Step 1: Get all current bookmarks directly from storage to ensure fresh data
    const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
    const allBookmarks = result[BOOKMARKS_KEY] || [];

    // Step 2: Filter out the deleted bookmark
    const updatedBookmarks = allBookmarks.filter((b) => b.id !== bookmarkId);

    if (updatedBookmarks.length === allBookmarks.length) {
      // If bookmark wasn't found, we'll still continue with the save process
      // to ensure storage is cleaned up properly
    }

    // Step 3: Save the updated bookmarks directly and explicitly to sync storage
    try {
      await chrome.storage.sync.set({ [BOOKMARKS_KEY]: updatedBookmarks });

      // Verify the changes were saved correctly
      const verifyResult = await chrome.storage.sync.get(BOOKMARKS_KEY);
      const _verifiedBookmarks = verifyResult[BOOKMARKS_KEY] || [];

      if (sendResponse) sendResponse({ success: true });
    } catch (_saveError) {
      if (sendResponse)
        sendResponse({
          success: false,
          error: 'Failed to save updated bookmarks to storage',
        });
    }
  } catch (error) {
    if (sendResponse) sendResponse({ success: false, error: error.message });
  }
}

// Handle updating bookmark notes
async function handleUpdateBookmarkNotes(bookmarkId, notes, sendResponse) {
  try {
    // Get all current bookmarks
    const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
    const allBookmarks = result[BOOKMARKS_KEY] || [];

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

    // Save the updated bookmarks
    await chrome.storage.sync.set({ [BOOKMARKS_KEY]: allBookmarks });

    if (sendResponse) sendResponse({ success: true });
  } catch (error) {
    if (sendResponse) sendResponse({ success: false, error: error.message });
  }
}

// Handle service worker lifecycle
self.addEventListener('activate', (event) => {
  event.waitUntil(async () => {
    // Take control of all clients
    await clients.claim();
  });
});
