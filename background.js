// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['bookmarks', 'shortcutEnabled'], (result) => {
    if (!result.bookmarks) {
      chrome.storage.sync.set({ bookmarks: [] }, () => {
        console.log('Bookmark storage initialized');
      });
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

// Handle adding a bookmark
async function handleAddBookmark(bookmarkData, sendResponse) {
  if (!bookmarkData || !bookmarkData.videoId || typeof bookmarkData.timestamp === 'undefined') {
    console.error('Invalid bookmark data:', bookmarkData);
    sendResponse({ success: false, error: 'Invalid bookmark data' });
    return;
  }

  // Create a unique ID for the bookmark
  const bookmarkId = `${bookmarkData.videoId}_${bookmarkData.timestamp}`;

  try {
    const result = await chrome.storage.sync.get('bookmarks');
    const bookmarks = result.bookmarks || [];

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

    // Save updated bookmarks
    await chrome.storage.sync.set({ bookmarks });
    console.log('Bookmark saved successfully');
    sendResponse({ success: true });
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
