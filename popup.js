document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList')
  const deleteAllBtn = document.getElementById('deleteAllBtn')
  const searchInput = document.getElementById('searchInput')
  const shortcutToggle = document.getElementById('shortcutToggle')
  const sortSelect = document.getElementById('sortSelect')
  let allBookmarks = [] // Store all bookmarks for filtering

  // Load shortcut setting
  chrome.storage.local.get(['shortcutEnabled'], (result) => {
    shortcutToggle.checked = result.shortcutEnabled !== false // Default to true
  })

  // Save shortcut setting
  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ shortcutEnabled: e.target.checked })
  })

  function sortBookmarks(bookmarks, sortBy) {
    return [...bookmarks].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          // Assuming we add a savedAt timestamp when saving bookmarks
          return b.savedAt - a.savedAt

        case 'oldest':
          return a.savedAt - b.savedAt

        case 'duration':
          return b.timestamp - a.timestamp

        case 'title':
          return a.videoTitle
            .toLowerCase()
            .localeCompare(b.videoTitle.toLowerCase())

        default:
          return 0
      }
    })
  }

  function createBookmarkElement(bookmark, index) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/maxresdefault.jpg`
    const div = document.createElement('div')
    div.className = 'bookmark'

    div.innerHTML = `
      <img class="thumbnail" src="${thumbnailUrl}" alt="Video thumbnail">
      <div class="bookmark-info">
        <div>
          <a href="${bookmark.url}" target="_blank">
            <div class="title">${bookmark.videoTitle}</div>
          </a>
          <div class="timestamp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" fill="currentColor"/>
              <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="currentColor"/>
            </svg>
            ${formatTime(bookmark.timestamp)}
          </div>
        </div>
        <button class="delete-btn" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    `

    return div
  }

  function updateBookmarksList(bookmarks) {
    const sorted = sortBookmarks(bookmarks, sortSelect.value)

    if (sorted.length === 0) {
      bookmarksList.innerHTML = `
        <div class="empty-state">
          No bookmarks yet! Click the bookmark button while watching a video to save timestamps.
        </div>
      `
      deleteAllBtn.disabled = true
      return
    }

    deleteAllBtn.disabled = false
    bookmarksList.innerHTML = ''
    sorted.forEach((bookmark, index) => {
      bookmarksList.appendChild(createBookmarkElement(bookmark, index))
    })
  }

  function filterBookmarks(searchTerm) {
    const filtered = searchTerm
      ? allBookmarks.filter((bookmark) =>
          bookmark.videoTitle.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : allBookmarks
    updateBookmarksList(filtered)
  }

  // Event Listeners
  searchInput.addEventListener('input', (e) => filterBookmarks(e.target.value))
  sortSelect.addEventListener('change', () =>
    filterBookmarks(searchInput.value)
  )

  deleteAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all bookmarks?')) {
      chrome.storage.local.set({ bookmarks: [] }, () => {
        allBookmarks = []
        updateBookmarksList([])
      })
    }
  })

  bookmarksList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn')
    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index)
      chrome.storage.local.get(['bookmarks'], (result) => {
        allBookmarks = result.bookmarks || []
        allBookmarks.splice(allBookmarks.length - 1 - index, 1)
        chrome.storage.local.set({ bookmarks: allBookmarks }, () => {
          filterBookmarks(searchInput.value)
        })
      })
    }
  })

  // Initial load
  chrome.storage.local.get(['bookmarks'], (result) => {
    if (result.bookmarks) {
      allBookmarks = result.bookmarks.map((bookmark) => ({
        ...bookmark,
        savedAt: bookmark.savedAt || Date.now(),
      }))
      chrome.storage.local.set({ bookmarks: allBookmarks })
      updateBookmarksList(allBookmarks)
    }
  })
})

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
