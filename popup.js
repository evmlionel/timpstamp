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
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const notificationArea = document.getElementById('notificationArea');
  let allBookmarks = []; // Store all bookmarks for filtering
  let currentSort = 'newest'; // Keep track of the current sort
  const lazyLoadObserver = setupLazyLoading(); // Initialize the observer

  // Key for storing folder collapsed states
  const FOLDER_STATE_KEY = 'folderCollapsedStates';

  // Load shortcut setting
  chrome.storage.sync.get(['bookmarks', 'shortcutEnabled'], (result) => {
    shortcutToggle.checked = result.shortcutEnabled !== false; // Default to true
    allBookmarks = result.bookmarks || [];
    // Hide loading state and show bookmarks/empty state
    loadingState.style.display = 'none';
    filterBookmarks(searchInput.value);
  });

  // Save shortcut setting
  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ shortcutEnabled: e.target.checked });
  });

  // --- Grouping Logic ---
  function groupBookmarksByVideo(bookmarks) {
    const grouped = bookmarks.reduce((acc, bookmark) => {
      const { videoId, videoTitle } = bookmark;
      if (!acc[videoId]) {
        acc[videoId] = {
          title: videoTitle || 'Unknown Title', // Use stored title
          bookmarks: [],
          latestTimestamp: 0, // Track latest bookmark time for group sorting
        };
      }
      acc[videoId].bookmarks.push(bookmark);
      // Keep track of the latest bookmark timestamp within the group
      if (bookmark.createdAt > acc[videoId].latestTimestamp) {
        acc[videoId].latestTimestamp = bookmark.createdAt;
      }
      return acc;
    }, {});

    // Sort bookmarks within each group by timestamp (ascending)
    Object.values(grouped).forEach((group) => {
      group.bookmarks.sort((a, b) => a.timestamp - b.timestamp);
    });

    return grouped;
  }

  // --- Sorting Logic ---
  function sortBookmarkGroups(groupedBookmarks, sortBy) {
    // Convert grouped object to an array for sorting
    const groupsArray = Object.entries(groupedBookmarks).map(([videoId, data]) => ({ videoId, ...data }));

    groupsArray.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.latestTimestamp - a.latestTimestamp; // Sort groups by newest bookmark within
        case 'oldest':
          return a.latestTimestamp - b.latestTimestamp; // Sort groups by oldest bookmark within
        case 'title': // New sort option: Alphabetical by video title
          return a.title.localeCompare(b.title);
        default:
          return b.latestTimestamp - a.latestTimestamp; // Default to newest
      }
    });

    return groupsArray; // Return sorted array of groups
  }

  // --- Rendering Logic ---
  function createBookmarkElement(bookmark, index) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/hqdefault.jpg`; // Use hqdefault
    const div = document.createElement('div');
    div.className = 'bookmark';
    const bookmarkId = bookmark.id;
    const notes = bookmark.notes || ''; // Get notes, default to empty string

    // Determine a fallback thumbnail if needed (consider a local placeholder)
    const finalThumbnailUrl = thumbnailUrl; // For now, just use the fetched one

    div.innerHTML = `
      <div class="timestamp-preview">
        Saved on ${new Date(bookmark.createdAt).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })} // Use createdAt for display
      </div>
      <div class="thumbnail-container">
        <img
          class="thumbnail"
          src="" /* Initially empty */
          data-src="${finalThumbnailUrl}"
          alt="Video thumbnail"
          loading="lazy" /* Add native lazy loading */
          onerror="this.style.display='none'; this.parentElement.querySelector('.thumbnail-placeholder').style.display='block';" /* Basic error handling */
        />
        <div class="thumbnail-placeholder" style="display: none; background: #eee; height: 100%; width: 100%; text-align: center; line-height: 68px; color: #aaa; font-size: 12px;">No thumb</div>
        <div class="timestamp-badge">${formatTime(bookmark.timestamp)}</div>
      </div>
      <div class="bookmark-info">
        <div>
          <a href="${bookmark.url}" target="_blank">
            <div class="title">${bookmark.videoTitle}</div>
          </a>
          <div class="timestamp-actions">
            <button class="share-btn" data-url="${bookmark.url}" title="Copy link to clipboard">
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
      <div class="notes-container">
        <textarea class="notes-textarea" data-bookmark-id="${bookmarkId}" placeholder="Add notes...">${notes}</textarea>
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

    return div;
  }

  // Render the list of bookmarks, grouped by video
  function renderBookmarkGroups(filteredBookmarks) {
    bookmarksList.innerHTML = ''; // Clear previous list

    if (filteredBookmarks.length === 0) {
      const searchTerm = searchInput.value.trim();
      emptyState.textContent =
        searchTerm === ''
          ? 'No bookmarks yet. Add some from YouTube!'
          : 'No bookmarks match your search.';
      emptyState.style.display = 'block'; // Show empty state
      bookmarksList.style.display = 'none'; // Hide bookmark list container
      deleteAllBtn.disabled = allBookmarks.length === 0;
    } else {
      emptyState.style.display = 'none';
      bookmarksList.style.display = 'block';

      const grouped = groupBookmarksByVideo(filteredBookmarks);
      const sortedGroups = sortBookmarkGroups(grouped, sortSelect.value);

      sortedGroups.forEach((group) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'video-group collapsed';

        const groupHeader = document.createElement('h3');
        groupHeader.className = 'folder-header';
        // Make title a link to the video (first bookmark's URL without timestamp)
        const videoBaseUrl = group.bookmarks[0].url.split('&t=')[0];
        groupHeader.textContent = group.title; // Use group.title directly
        groupHeader.dataset.folderName = group.title; // Use group.title directly
        groupHeader.addEventListener('click', () => toggleFolder(group.title, groupHeader)); // Use group.title directly

        const bookmarksContainer = document.createElement('div');
        bookmarksContainer.className = 'timestamp-list-container';

        // Sort bookmarks within the folder by time added (descending - newest first)
        const sortedBookmarks = group.bookmarks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        sortedBookmarks.forEach((bookmark, index) => {
          const bookmarkElement = createBookmarkElement(bookmark, index);
          bookmarksContainer.appendChild(bookmarkElement);
          // Observe the thumbnail for lazy loading
          const img = bookmarkElement.querySelector('.thumbnail');
          if (img && img.dataset.src) {
            lazyLoadObserver.observe(img);
          }
        });
        groupDiv.appendChild(groupHeader);
        groupDiv.appendChild(bookmarksContainer);
        bookmarksList.appendChild(groupDiv);
      });

      deleteAllBtn.disabled = allBookmarks.length === 0;
    }
  }

  // --- Filtering Logic ---
  function filterBookmarks(searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? allBookmarks.filter((bookmark) =>
          bookmark.videoTitle.toLowerCase().includes(lowerSearchTerm)
        )
      : allBookmarks;
    renderBookmarkGroups(filtered); // Update the list display using grouped rendering
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

  deleteAllBtn.addEventListener('click', async () => {
    if (window.confirm('Are you sure you want to delete ALL bookmarks? This cannot be undone.')) {
      deleteAllBtn.disabled = true; // Disable while deleting
      try {
        await chrome.storage.sync.set({ bookmarks: [] });
        allBookmarks = [];
        filterBookmarks('');
        showNotification('All bookmarks deleted');
      } catch (error) {
        console.error('Failed to delete all bookmarks:', error);
        showNotification('Error deleting bookmarks', 'error');
      } finally {
        // Re-enable button only if there are bookmarks left (shouldn't happen here, but good practice)
        deleteAllBtn.disabled = allBookmarks.length === 0;
      }
    }
  });

  let lastDeletedBookmark = null;
  let lastDeletedIndex = -1; // Store index for potential undo

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
        // Re-insert at the original position if possible
        if (lastDeletedIndex >= 0 && lastDeletedIndex <= allBookmarks.length) {
          allBookmarks.splice(lastDeletedIndex, 0, lastDeletedBookmark);
        } else {
          allBookmarks.push(lastDeletedBookmark); // Fallback: add to end
        }
        await chrome.storage.sync.set({ bookmarks: allBookmarks });
        filterBookmarks(searchInput.value);
        notification.remove();
        showNotification('Bookmark restored');
        lastDeletedBookmark = null;
        lastDeletedIndex = -1;
      }
    });

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
        lastDeletedBookmark = null;
        lastDeletedIndex = -1;
      }
    }, 5000);
  }

  // More efficient delete function
  async function deleteBookmark(bookmarkId) {
    const indexToDelete = allBookmarks.findIndex((b) => b.id === bookmarkId);

    if (indexToDelete !== -1) {
      lastDeletedBookmark = allBookmarks[indexToDelete];
      lastDeletedIndex = indexToDelete; // Store index before splicing
      allBookmarks.splice(indexToDelete, 1);

      try {
        await chrome.storage.sync.set({ bookmarks: allBookmarks });
        filterBookmarks(searchInput.value); // Update the UI immediately
        showUndoNotification(); // Show undo option
      } catch (error) {
        // If saving fails, revert the change in memory and notify user
        console.error('Failed to save deletion:', error);
        if (lastDeletedBookmark) {
          allBookmarks.splice(lastDeletedIndex, 0, lastDeletedBookmark); // Put it back
          filterBookmarks(searchInput.value); // Update UI again
        }
        showNotification('Failed to delete bookmark', 'error');
        lastDeletedBookmark = null; // Clear undo state
        lastDeletedIndex = -1;
      }
    } else {
      console.warn('Bookmark ID not found for deletion:', bookmarkId);
      showNotification('Could not find bookmark to delete', 'error');
    }
  }

  // --- Add Notes Save Listener (Debounced) ---
  const debouncedSaveNote = debounce(async (bookmarkId, newNotes) => {
    try {
      const result = await chrome.storage.sync.get('bookmarks');
      const bookmarks = result.bookmarks || [];
      const bookmarkIndex = bookmarks.findIndex(b => b.id === bookmarkId);

      if (bookmarkIndex !== -1) {
        bookmarks[bookmarkIndex].notes = newNotes;
        await chrome.storage.sync.set({ bookmarks });
        console.log(`Note saved for bookmark: ${bookmarkId}`);
        // Optional: Show a subtle save indicator
      } else {
        console.error('Bookmark not found for saving note:', bookmarkId);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      showNotification('Error saving note', 'error');
    }
  }, 500); // Save 500ms after user stops typing

  bookmarksList.addEventListener('input', (e) => {
    const textarea = e.target.closest('.notes-textarea');
    if (textarea) {
      const bookmarkId = textarea.dataset.bookmarkId;
      const newNotes = textarea.value;
      debouncedSaveNote(bookmarkId, newNotes);

      // Auto-resize textarea height
      textarea.style.height = 'auto'; // Reset height
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  });

  // --- Initialize Textarea Heights on Render ---
  // We need to ensure heights are set after elements are in the DOM
  // This can be tricky with async rendering. A MutationObserver is robust.
  const resizeObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList.contains('bookmark')) {
            const textarea = node.querySelector('.notes-textarea');
            if (textarea) {
              textarea.style.height = 'auto';
              textarea.style.height = `${textarea.scrollHeight}px`;
            }
          }
          // Also handle cases where the whole group is added
          if (node.nodeType === 1 && node.classList.contains('video-group')) {
             node.querySelectorAll('.notes-textarea').forEach(textarea => {
                 textarea.style.height = 'auto';
                 textarea.style.height = `${textarea.scrollHeight}px`;
             });
          }
        });
      }
    }
  });

  resizeObserver.observe(bookmarksList, { childList: true, subtree: true });

  bookmarksList.addEventListener('click', (e) => {
    const groupTitle = e.target.closest('.folder-header');
    if (groupTitle) {
      e.preventDefault(); // Prevent default anchor tag behavior if title is a link
      const groupDiv = groupTitle.closest('.video-group');
      if (groupDiv) {
        groupDiv.classList.toggle('collapsed');
      }
    }

    // Handle delete button clicks (existing logic)
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn && !deleteBtn.disabled) {
      const bookmarkId = deleteBtn.dataset.bookmarkId;
      if (bookmarkId) {
        // Show loading spinner on the specific button
        const icon = deleteBtn.querySelector('.delete-icon');
        const spinner = deleteBtn.querySelector('.loading-spinner');
        if (icon) icon.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
        deleteBtn.disabled = true; // Disable button during delete

        deleteBookmark(bookmarkId).finally(() => {
          // Restore button state regardless of success/failure
          if (icon) icon.style.display = 'inline-block';
          if (spinner) spinner.style.display = 'none';
          // Re-enable might happen automatically if the element is removed,
          // but good practice to handle it if deletion fails.
          // The element might not exist anymore if deletion was successful.
          const stillExistingBtn = document.querySelector(`.delete-btn[data-bookmark-id="${bookmarkId}"]`);
          if (stillExistingBtn) {
              stillExistingBtn.disabled = false;
          }
        });
      }
    }
  });

  // Initial call to display bookmarks
  // chrome.storage.sync.get('bookmarks', (data) => {
  //     allBookmarks = data.bookmarks || [];

  //     renderBookmarkGroups(allBookmarks);
  // });

  // --- New function to toggle folder visibility ---
  async function toggleFolder(folderName, headerElement) {
    const listContainer = headerElement.nextElementSibling; // The timestamp list container
    const isCollapsed = headerElement.classList.toggle('collapsed');

    // Update display
    listContainer.style.display = isCollapsed ? 'none' : 'block';

     // Update and save state
    const stateResult = await chrome.storage.local.get(FOLDER_STATE_KEY);
    const folderStates = stateResult[FOLDER_STATE_KEY] || {};
    folderStates[folderName] = isCollapsed;
    await chrome.storage.local.set({ [FOLDER_STATE_KEY]: folderStates });
     console.log('Folder states updated:', folderStates);
  }
  // --- End of new function ---

  // Load folder states
  chrome.storage.local.get(FOLDER_STATE_KEY, (result) => {
    const folderStates = result[FOLDER_STATE_KEY] || {};
    const folderHeaders = bookmarksList.querySelectorAll('.folder-header');
    folderHeaders.forEach((header) => {
      const folderName = header.dataset.folderName;
      if (folderStates[folderName]) {
        header.classList.add('collapsed');
        header.nextElementSibling.style.display = 'none';
      }
    });
  });
});
