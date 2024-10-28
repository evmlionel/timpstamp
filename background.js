chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_BOOKMARK') {
    // Validate bookmark data
    if (!message.bookmark?.videoId || !message.bookmark?.videoTitle) {
      sendResponse({ success: false, error: 'Invalid bookmark data' })
      return true
    }

    chrome.storage.local.get(['bookmarks'], (result) => {
      const bookmarks = result.bookmarks || []

      // Find index of existing bookmark for this video
      const existingIndex = bookmarks.findIndex(
        (b) => b.videoId === message.bookmark.videoId
      )

      // Add savedAt timestamp if not present
      const newBookmark = {
        ...message.bookmark,
        savedAt: Date.now(),
      }

      let updatedBookmarks
      if (existingIndex !== -1) {
        // Replace existing bookmark
        updatedBookmarks = [...bookmarks]
        updatedBookmarks[existingIndex] = newBookmark
      } else {
        // Add new bookmark
        updatedBookmarks = [...bookmarks, newBookmark]
      }

      chrome.storage.local.set({ bookmarks: updatedBookmarks }, () => {
        sendResponse({ success: true })
      })
    })
    return true // Keep message channel open for async response
  }
})
