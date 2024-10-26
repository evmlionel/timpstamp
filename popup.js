document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList')
  const deleteAllBtn = document.getElementById('deleteAllBtn')

  // Add settings section to HTML
  const settingsDiv = document.createElement('div')
  settingsDiv.className = 'settings'
  settingsDiv.innerHTML = `
    <div class="settings-item">
      <label class="toggle-label">
        <input type="checkbox" id="shortcutToggle">
        Enable keyboard shortcut (B)
      </label>
    </div>
  `

  document.querySelector('.header').appendChild(settingsDiv)

  // Load shortcut setting
  const shortcutToggle = document.getElementById('shortcutToggle')
  chrome.storage.local.get(['shortcutEnabled'], (result) => {
    shortcutToggle.checked = result.shortcutEnabled !== false // Default to true
  })

  // Save shortcut setting
  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ shortcutEnabled: e.target.checked })
  })

  function updateBookmarksList(bookmarks) {
    if (bookmarks.length === 0) {
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

    bookmarks.reverse().forEach((bookmark, index) => {
      const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/mqdefault.jpg`
      const div = document.createElement('div')
      div.className = 'bookmark'

      div.innerHTML = `
        <img class="thumbnail" src="${thumbnailUrl}" alt="Video thumbnail">
        <div class="bookmark-info">
          <a href="${bookmark.url}" target="_blank">
            <div class="title">${bookmark.videoTitle}</div>
          </a>
          <div class="timestamp">${formatTime(bookmark.timestamp)}</div>
        </div>
        <button class="delete-btn" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
          </svg>
        </button>
      `

      bookmarksList.appendChild(div)
    })
  }

  // Load initial bookmarks
  chrome.storage.local.get(['bookmarks'], (result) => {
    const bookmarks = result.bookmarks || []
    updateBookmarksList(bookmarks)
  })

  // Delete all bookmarks
  deleteAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all bookmarks?')) {
      chrome.storage.local.set({ bookmarks: [] }, () => {
        updateBookmarksList([])
      })
    }
  })

  // Delete individual bookmark
  bookmarksList.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const index = parseInt(e.target.dataset.index)
      chrome.storage.local.get(['bookmarks'], (result) => {
        const bookmarks = result.bookmarks || []
        bookmarks.splice(bookmarks.length - 1 - index, 1)
        chrome.storage.local.set({ bookmarks }, () => {
          updateBookmarksList(bookmarks)
        })
      })
    }
  })
})

function formatTime(timestamp) {
  const minutes = Math.floor(timestamp / 60)
  const seconds = timestamp % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
