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
      console.log('Updated existing bookmark:', videoIdForBookmark);
      // The 'id' field is already videoIdForBookmark due to the findIndex and preservation logic
    } else {
      // Add new bookmark
      const newBookmark = {
        ...bookmarkData, // Contains videoId, videoTitle, timestamp, formattedTime, url
        id: videoIdForBookmark, // Set id to videoId
        createdAt: Date.now(),   // Timestamp for when it was first bookmarked
        savedAt: Date.now(),     // Timestamp for this specific save/update
        notes: '',             // Initialize notes
      };
      bookmarks.push(newBookmark);
      console.log('Added new bookmark:', newBookmark);
    }

    // Save updated bookmarks using chunking
    const saveResult = await saveAllBookmarks(bookmarks);
    if (saveResult) {
      console.log('Bookmark operation successful for video:', videoIdForBookmark);
      // Send a more specific message
      sendResponse({ 
        success: true, 
        message: existingBookmarkIndex !== -1 ? 'Timestamp updated! 🎉' : 'Timestamp saved! 🎉' 
      });
    } else {
      console.error('Failed to save bookmark changes for video:', videoIdForBookmark);
      sendResponse({ success: false, error: 'Failed to save bookmark changes' });
    }
  } catch (error) {
    console.error('Error processing bookmark for video:', videoIdForBookmark, error);
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
