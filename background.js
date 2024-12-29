// Initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('bookmarks', (result) => {
    if (!result.bookmarks) {
      chrome.storage.sync.set({ bookmarks: [] }, () => {
        console.log('Storage initialized');
      });
    }
  });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);

  if (request.type === 'ADD_BOOKMARK') {
    cohandleAddBookmark(request.data, sendResponse);
    return true; // Will respond asynchronously
  }
});

// Handle adding a bookmark
async function handleAddBookmark(bookmarkData, sendResponse) {
  if (!bookmarkData || !bookmarkData.videoId) {
    console.error('Invalid bookmark data');
    sendResponse({ success: false, error: 'Invalid bookmark data' });
    return;
  }

  try {
    const result = await chrome.storage.sync.get('bookmarks');
    const bookmarks = result.bookmarks || [];

    // Find existing bookmark for this video
    const existingIndex = bookmarks.findIndex(
      (b) => b.videoId === bookmarkData.videoId
    );

    if (existingIndex >= 0) {
      // Replace existing bookmark
      bookmarks[existingIndex] = {
        ...bookmarkData,
        updatedAt: Date.now(),
      };
      console.log('Updated existing bookmark for video:', bookmarkData.videoId);
    } else {
      // Add new bookmark
      bookmarks.push({
        ...bookmarkData,
        createdAt: Date.now(),
      });
      console.log('Added new bookmark for video:', bookmarkData.videoId);
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

// Keep service worker active
const KEEP_ALIVE_INTERVAL = 20000; // 20 seconds

async function keepAlive() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    if (tabs.length > 0) {
      // We have active YouTube tabs, ping them to keep the service worker alive
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }).catch(() => {
          // Ignore errors - tab might have been closed
        });
      });
    }
  } catch (error) {
    console.error('Keep alive error:', error);
  }
}

// Set up periodic keep-alive
setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

// Handle service worker lifecycle
self.addEventListener('activate', (event) => {
  event.waitUntil(async () => {
    // Take control of all clients
    await clients.claim();
    console.log('Service worker activated and claimed clients');
  });
});
