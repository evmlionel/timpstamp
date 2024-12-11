import {
  debounce,
  formatTime,
  showNotification,
  setupLazyLoading,
} from './src/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList');
  const deleteAllBtn = document.getElementById('deleteAllBtn');
  const searchInput = document.getElementById('searchInput');
  const shortcutToggle = document.getElementById('shortcutToggle');
  const sortSelect = document.getElementById('sortSelect');
  let allBookmarks = []; // Store all bookmarks for filtering
  const lazyLoadObserver = setupLazyLoading();

  // Load shortcut setting
  chrome.storage.sync.get(['shortcutEnabled'], (result) => {
    shortcutToggle.checked = result.shortcutEnabled !== false; // Default to true
  });

  // Save shortcut setting
  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ shortcutEnabled: e.target.checked });
  });

  function sortBookmarks(bookmarks, sortBy) {
    return [...bookmarks].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (
            (b.savedAt || b.createdAt || 0) - (a.savedAt || a.createdAt || 0)
          );

        case 'oldest':
          return (
            (a.savedAt || a.createdAt || 0) - (b.savedAt || b.createdAt || 0)
          );

        case 'duration':
          return b.timestamp - a.timestamp;

        case 'title':
          return a.videoTitle
            .toLowerCase()
            .localeCompare(b.videoTitle.toLowerCase());

        default:
          return 0;
      }
    });
  }

  function createBookmarkElement(bookmark, index) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/maxresdefault.jpg`;
    const div = document.createElement('div');
    div.className = 'bookmark';
    const bookmarkId = bookmark.savedAt || bookmark.createdAt;

    div.innerHTML = `
      <div class="timestamp-preview">
        Saved on ${new Date(bookmarkId).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
      <div class="thumbnail-container">
        <img class="thumbnail" data-src="${thumbnailUrl}" alt="Video thumbnail">
        <div class="timestamp-badge">${formatTime(bookmark.timestamp)}</div>
      </div>
      <div class="bookmark-info">
        <div>
          <a href="${bookmark.url}" target="_blank">
            <div class="title">${bookmark.videoTitle}</div>
          </a>
          <div class="timestamp-actions">
            <button class="share-btn" data-url="${
              bookmark.url
            }" title="Copy link to clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/>
              </svg>
            </button>
            <button class="delete-btn" data-bookmark-id="${bookmarkId}" title="Delete timestamp">
              <span class="delete-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                </svg>
              </span>
              <span class="loading-spinner" style="display: none;">
                <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add click handler for share button
    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = shareBtn.dataset.url;

      try {
        await navigator.clipboard.writeText(url);
        shareBtn.classList.add('shared');
        setTimeout(() => shareBtn.classList.remove('shared'), 1500);
        showNotification('Link copied to clipboard!');
      } catch (err) {
        showNotification('Failed to copy link', 'error');
      }
    });

    // Initialize lazy loading for the thumbnail
    const thumbnail = div.querySelector('.thumbnail');
    lazyLoadObserver.observe(thumbnail);

    return div;
  }

  function updateBookmarksList(bookmarks) {
    const sorted = sortBookmarks(bookmarks, sortSelect.value);

    if (sorted.length === 0) {
      bookmarksList.innerHTML = `
        <div class="empty-state">
          No bookmarks yet! Click the bookmark button while watching a video to save timestamps.
        </div>
      `;
      deleteAllBtn.disabled = true;
      return;
    }

    deleteAllBtn.disabled = false;
    bookmarksList.innerHTML = '';
    sorted.forEach((bookmark, index) => {
      bookmarksList.appendChild(createBookmarkElement(bookmark, index));
    });
  }

  function filterBookmarks(searchTerm) {
    const filtered = searchTerm
      ? allBookmarks.filter((bookmark) =>
          bookmark.videoTitle.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : allBookmarks;
    updateBookmarksList(filtered);
  }

  // Use debounced search
  const debouncedFilter = debounce(
    (searchTerm) => filterBookmarks(searchTerm),
    300
  );
  searchInput.addEventListener('input', (e) => debouncedFilter(e.target.value));

  sortSelect.addEventListener('change', () =>
    filterBookmarks(searchInput.value)
  );

  deleteAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all bookmarks?')) {
      chrome.storage.sync.set({ bookmarks: [] }, () => {
        allBookmarks = [];
        updateBookmarksList([]);
        showNotification('All bookmarks deleted');
      });
    }
  });

  let lastDeletedBookmark = null;

  function showUndoNotification() {
    const notification = document.createElement('div');
    notification.className = 'notification with-action';
    notification.innerHTML = `
      <span>Bookmark deleted</span>
      <button class="undo-btn">Undo</button>
    `;

    document.body.appendChild(notification);

    const undoBtn = notification.querySelector('.undo-btn');
    undoBtn.addEventListener('click', async () => {
      if (lastDeletedBookmark) {
        allBookmarks.push(lastDeletedBookmark);
        await chrome.storage.sync.set({ bookmarks: allBookmarks });
        filterBookmarks(searchInput.value);
        notification.remove();
        showNotification('Bookmark restored');
        lastDeletedBookmark = null;
      }
    });

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
        lastDeletedBookmark = null;
      }
    }, 5000);
  }

  async function deleteBookmark(deleteBtn, bookmarkId) {
    try {
      // Show loading state
      const deleteIcon = deleteBtn.querySelector('.delete-icon');
      const loadingSpinner = deleteBtn.querySelector('.loading-spinner');
      deleteIcon.style.display = 'none';
      loadingSpinner.style.display = 'block';
      deleteBtn.disabled = true;

      const result = await chrome.storage.sync.get(['bookmarks']);
      allBookmarks = result.bookmarks || [];
      const indexToDelete = allBookmarks.findIndex(
        (b) => (b.savedAt || b.createdAt) === parseInt(bookmarkId)
      );

      if (indexToDelete !== -1) {
        lastDeletedBookmark = allBookmarks[indexToDelete];
        allBookmarks.splice(indexToDelete, 1);
        await chrome.storage.sync.set({ bookmarks: allBookmarks });
        filterBookmarks(searchInput.value);
        showUndoNotification();
      }
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      showNotification('Failed to delete bookmark', 'error');
      // Reset button state
      const deleteIcon = deleteBtn.querySelector('.delete-icon');
      const loadingSpinner = deleteBtn.querySelector('.loading-spinner');
      deleteIcon.style.display = 'block';
      loadingSpinner.style.display = 'none';
      deleteBtn.disabled = false;
    }
  }

  bookmarksList.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      const bookmarkId = deleteBtn.dataset.bookmarkId;
      deleteBookmark(deleteBtn, bookmarkId);
    }
  });

  // Initial load
  chrome.storage.sync.get(['bookmarks'], (result) => {
    console.log('Loading bookmarks:', result.bookmarks);
    if (result.bookmarks) {
      allBookmarks = result.bookmarks;
      updateBookmarksList(allBookmarks);
    } else {
      updateBookmarksList([]);
    }
  });
});
