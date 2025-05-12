// Constants for storage
const BOOKMARKS_KEY = 'timpstamp_bookmarks'; // Single key for all bookmarks

// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get([BOOKMARKS_KEY, 'shortcutEnabled'], (result) => {
    if (!result[BOOKMARKS_KEY]) {
      // Initialize with an empty array of bookmarks
      chrome.storage.sync.set(
        {
          [BOOKMARKS_KEY]: [] // Empty array - no bookmarks initially
        },
        () => {
          console.log('Bookmark storage initialized with direct storage');
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
  } else if (request.type === 'CLEAR_ALL_BOOKMARKS') {
    handleClearAllBookmarks(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.type === 'DELETE_BOOKMARK') {
    // Handle individual bookmark deletion
    handleDeleteBookmark(request.bookmarkId, sendResponse);
    return true; // Will respond asynchronously
  }
});

// Get all bookmarks - new simplified approach
async function getAllBookmarks() {
  try {
    // Get bookmarks directly
    const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
    return result[BOOKMARKS_KEY] || [];
  } catch (error) {
    console.error('Error getting all bookmarks:', error);
    return [];
  }
}

// Save all bookmarks - new simplified approach
async function saveAllBookmarks(bookmarks) {
  try {
    // Save bookmarks directly
    await chrome.storage.sync.set({ [BOOKMARKS_KEY]: bookmarks });
    console.log('Saved', bookmarks.length, 'bookmarks to storage');
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

// Handle clearing all bookmarks - simplified approach
async function handleClearAllBookmarks(sendResponse) {
  try {
    // Just save an empty array - much simpler with our direct storage approach
    await chrome.storage.sync.set({ [BOOKMARKS_KEY]: [] });
    console.log('All bookmarks cleared successfully.');
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing all bookmarks:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle individual bookmark deletion - completely rewritten with direct storage
async function handleDeleteBookmark(bookmarkId, sendResponse) {
  try {
    console.log('Background script handling deletion of bookmark:', bookmarkId);
    
    // Step 1: Get all current bookmarks directly from storage to ensure fresh data
    const result = await chrome.storage.sync.get(BOOKMARKS_KEY);
    const allBookmarks = result[BOOKMARKS_KEY] || [];
    console.log('Current bookmarks count:', allBookmarks.length);
    
    // Step 2: Filter out the deleted bookmark
    const updatedBookmarks = allBookmarks.filter(b => b.id !== bookmarkId);
    console.log('After filtering, bookmarks count:', updatedBookmarks.length);
    
    if (updatedBookmarks.length === allBookmarks.length) {
      console.warn('Bookmark not found in current bookmarks:', bookmarkId);
      // If bookmark wasn't found, we'll still continue with the save process
      // to ensure storage is cleaned up properly
    }
    
    // Step 3: Save the updated bookmarks directly and explicitly to sync storage
    try {
      await chrome.storage.sync.set({ [BOOKMARKS_KEY]: updatedBookmarks });
      console.log('Bookmark successfully deleted and saved to sync storage:', bookmarkId);
      
      // Verify the changes were saved correctly
      const verifyResult = await chrome.storage.sync.get(BOOKMARKS_KEY);
      const verifiedBookmarks = verifyResult[BOOKMARKS_KEY] || [];
      console.log('Verified bookmarks count after deletion:', verifiedBookmarks.length);
      
      if (sendResponse) sendResponse({ success: true });
    } catch (saveError) {
      console.error('Error saving updated bookmarks to sync storage:', saveError);
      if (sendResponse) sendResponse({ success: false, error: 'Failed to save updated bookmarks to storage' });
    }
  } catch (error) {
    console.error('Error handling bookmark deletion:', error);
    if (sendResponse) sendResponse({ success: false, error: error.message });
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
