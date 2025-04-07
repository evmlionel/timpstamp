// Constants for storage
const BOOKMARK_CHUNK_SIZE = 100; // Number of bookmarks per chunk
const BOOKMARK_CHUNK_PREFIX = 'bookmarks_chunk_';

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['bookmarkIndex', 'shortcutEnabled'], (result) => {
    if (!result.bookmarkIndex) {
      // Initialize with an empty index
      chrome.storage.sync.set(
        {
          bookmarkIndex: {
            totalCount: 0,
            chunks: [],
          },
        },
        () => {
          console.log('Bookmark storage initialized with chunking support');
        }
      );
    }
    // Ensure shortcutEnabled has a default value (true)
    if (typeof result.shortcutEnabled === 'undefined') {
      chrome.storage.sync.set({ shortcutEnabled: true }, () => {
        console.log('Shortcut setting initialized');
      });
    }
  });
  // Create the alarm when the extension is installed or updated
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 }); // Run every 30 seconds
});

// Listener for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Perform a minimal operation to keep the service worker alive, e.g., check storage
    chrome.storage.sync.get(null, (items) => {
      if (chrome.runtime.lastError) {
        console.log('Keep-alive check failed:', chrome.runtime.lastError);
      } else {
        // Optional: log successful keep-alive check
        // console.log('Keep-alive check successful.');
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (request.type === 'ADD_BOOKMARK') {
    handleAddBookmark(request.data, sendResponse);
    return true; // Will respond asynchronously
  }
});

// Get all bookmarks from chunked storage
async function getAllBookmarks() {
  try {
    // Get the bookmark index
    const indexResult = await chrome.storage.sync.get('bookmarkIndex');
    const bookmarkIndex = indexResult.bookmarkIndex || {
      totalCount: 0,
      chunks: [],
    };

    if (bookmarkIndex.totalCount === 0) {
      return [];
    }

    // Get all chunks
    const chunkKeys = bookmarkIndex.chunks.map(
      (chunkId) => `${BOOKMARK_CHUNK_PREFIX}${chunkId}`
    );
    const chunksResult = await chrome.storage.sync.get(chunkKeys);

    // Combine all bookmarks from chunks
    let allBookmarks = [];
    bookmarkIndex.chunks.forEach((chunkId) => {
      const chunkKey = `${BOOKMARK_CHUNK_PREFIX}${chunkId}`;
      if (chunksResult[chunkKey]) {
        allBookmarks = allBookmarks.concat(chunksResult[chunkKey]);
      }
    });

    return allBookmarks;
  } catch (error) {
    console.error('Error getting all bookmarks:', error);
    return [];
  }
}

// Save bookmarks to chunked storage
async function saveAllBookmarks(bookmarks) {
  try {
    // Calculate how many chunks we need
    const chunkCount = Math.ceil(bookmarks.length / BOOKMARK_CHUNK_SIZE);
    const chunks = [];

    // Create chunks
    for (let i = 0; i < chunkCount; i++) {
      const chunkId = i.toString();
      const chunkKey = `${BOOKMARK_CHUNK_PREFIX}${chunkId}`;
      const startIndex = i * BOOKMARK_CHUNK_SIZE;
      const endIndex = Math.min(
        startIndex + BOOKMARK_CHUNK_SIZE,
        bookmarks.length
      );
      const chunkBookmarks = bookmarks.slice(startIndex, endIndex);

      // Save this chunk
      await chrome.storage.sync.set({ [chunkKey]: chunkBookmarks });
      chunks.push(chunkId);
    }

    // Update the bookmark index
    await chrome.storage.sync.set({
      bookmarkIndex: {
        totalCount: bookmarks.length,
        chunks: chunks,
      },
    });

    return true;
  } catch (error) {
    console.error('Error saving all bookmarks:', error);
    return false;
  }
}

// Handle adding a bookmark
async function handleAddBookmark(bookmarkData, sendResponse) {
  if (
    !bookmarkData ||
    !bookmarkData.videoId ||
    typeof bookmarkData.timestamp === 'undefined'
  ) {
    console.error('Invalid bookmark data:', bookmarkData);
    sendResponse({ success: false, error: 'Invalid bookmark data' });
    return;
  }

  // Create a unique ID for the bookmark
  const bookmarkId = `${bookmarkData.videoId}_${bookmarkData.timestamp}`;

  try {
    // Get all bookmarks from chunked storage
    const bookmarks = await getAllBookmarks();

    // Check if a bookmark with the exact same ID already exists
    const existingIndex = bookmarks.findIndex((b) => b.id === bookmarkId);

    if (existingIndex >= 0) {
      // Bookmark for this exact video and timestamp already exists
      console.log('Bookmark already exists:', bookmarkId);
      sendResponse({ success: false, error: 'Bookmark already exists' });
      return; // Don't add duplicates
    } else {
      // Add new bookmark with unique ID
      const newBookmark = {
        ...bookmarkData,
        id: bookmarkId, // Store the unique ID
        createdAt: Date.now(), // Keep track of creation time
        notes: '', // Add an empty notes field
      };
      bookmarks.push(newBookmark);
      console.log('Added new bookmark:', newBookmark);
    }

    // Save updated bookmarks using chunking
    const saveResult = await saveAllBookmarks(bookmarks);
    if (saveResult) {
      console.log('Bookmark saved successfully');
      sendResponse({ success: true });
    } else {
      console.error('Failed to save bookmark');
      sendResponse({ success: false, error: 'Failed to save bookmark' });
    }
  } catch (error) {
    console.error('Error processing bookmark:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Handle service worker lifecycle
self.addEventListener('activate', (event) => {
  event.waitUntil(async () => {
    // Take control of all clients
    await clients.claim();
    console.log('Service worker activated and claimed clients');
  });
});
