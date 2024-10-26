document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList')
  const deleteAllBtn = document.getElementById('deleteAllBtn')

  function updateBookmarksList(bookmarks) {
    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = `
        <div class="empty-state">
          No bookmarks yet! Click the 🔖 button while watching a video to save timestamps.
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
        <button class="delete-btn" data-index="${index}">×</button>
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
