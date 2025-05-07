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
  let allBookmarks = []; // Store all bookmarks for filtering/sorting
  let currentSort = 'newest'; // Default sort

  // Event listener for Clear All button (existing)
  deleteAllBtn.addEventListener('click', async () => {
    if (
      window.confirm(
        'Are you sure you want to delete all timestamps? This action cannot be undone.'
      )
    ) {
      chrome.runtime.sendMessage(
        { type: 'CLEAR_ALL_BOOKMARKS' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              'Error clearing bookmarks:',
              chrome.runtime.lastError.message
            );
            showNotification(
              'Error clearing bookmarks. Please try again.',
              'error',
              notificationArea
            );
            return;
          }
          if (response && response.success) {
            allBookmarks = []; // Clear local cache
            renderBookmarks(); // Refresh the UI to show empty state
            showNotification(
              'All timestamps cleared successfully!',
              'success',
              notificationArea
            );
          } else {
            const errorMessage =
              response && response.error
                ? response.error
                : 'Failed to clear bookmarks.';
            console.error('Failed to clear bookmarks:', errorMessage);
            showNotification(errorMessage, 'error', notificationArea);
          }
        }
      );
    }
  });

  async function loadAllData() {
    try {
      const settingResult = await chrome.storage.sync.get(['shortcutEnabled']);
      shortcutToggle.checked = settingResult.shortcutEnabled !== false;

      const indexResult = await chrome.storage.sync.get('bookmarkIndex');
      const bookmarkIndex = indexResult.bookmarkIndex || {
        totalCount: 0,
        chunks: [],
      };

      if (bookmarkIndex.totalCount === 0) {
        allBookmarks = [];
        loadingState.style.display = 'none';
        renderBookmarks(); // Use new render function
        return;
      }

      const BOOKMARK_CHUNK_PREFIX = 'bookmarks_chunk_';
      const chunkKeys = bookmarkIndex.chunks.map(
        (chunkId) => `${BOOKMARK_CHUNK_PREFIX}${chunkId}`
      );
      const chunksResult = await chrome.storage.sync.get(chunkKeys);

      let loadedBookmarks = [];
      bookmarkIndex.chunks.forEach((chunkId) => {
        const chunkKey = `${BOOKMARK_CHUNK_PREFIX}${chunkId}`;
        if (chunksResult[chunkKey]) {
          loadedBookmarks = loadedBookmarks.concat(chunksResult[chunkKey]);
        }
      });
      allBookmarks = loadedBookmarks;
      loadingState.style.display = 'none';
      sortAndRenderBookmarks(); // Initial sort and render
    } catch (error) {
      console.error('Error loading data:', error);
      loadingState.style.display = 'none';
      emptyState.textContent = 'Error loading bookmarks. Please try again.';
      emptyState.style.display = 'block';
    }
  }

  loadAllData();

  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ shortcutEnabled: e.target.checked });
  });

  // --- Sorting Logic (for flat list) ---
  function sortBookmarks(bookmarks, sortBy) {
    return bookmarks.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.savedAt || b.createdAt) - (a.savedAt || a.createdAt); // Use savedAt or createdAt
        case 'oldest':
          return (a.savedAt || a.createdAt) - (b.savedAt || b.createdAt);
        case 'title':
          return (a.videoTitle || '').localeCompare(b.videoTitle || '');
        default:
          return (b.savedAt || b.createdAt) - (a.savedAt || a.createdAt);
      }
    });
  }

  // --- Rendering Logic (for flat list) ---
  function renderBookmarks() {
    bookmarksList.innerHTML = ''; // Clear existing list
    const searchTerm = searchInput.value.toLowerCase();

    const filteredBookmarks = allBookmarks.filter(
      (bookmark) =>
        (bookmark.videoTitle || '').toLowerCase().includes(searchTerm) ||
        (bookmark.notes || '').toLowerCase().includes(searchTerm)
    );

    if (
      filteredBookmarks.length === 0 &&
      allBookmarks.length > 0 &&
      searchTerm
    ) {
      emptyState.textContent = 'No bookmarks match your search.';
      emptyState.style.display = 'block';
    } else if (filteredBookmarks.length === 0 && allBookmarks.length === 0) {
      emptyState.textContent =
        'No timestamps saved yet. Save some from YouTube!';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }

    filteredBookmarks.forEach((bookmark, index) => {
      const bookmarkElement = createBookmarkElement(bookmark, index);
      bookmarksList.appendChild(bookmarkElement);
    });

    // Update delete all button state
    deleteAllBtn.disabled = allBookmarks.length === 0;
  }

  function sortAndRenderBookmarks() {
    allBookmarks = sortBookmarks(allBookmarks, currentSort);
    renderBookmarks();
  }

  // createBookmarkElement function remains largely the same but will be appended directly
  // Ensure createBookmarkElement is defined before this point if it's not hoisted, or move its definition up
  function createBookmarkElement(bookmark, index) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/hqdefault.jpg`;
    const div = document.createElement('div');
    // Assign a class for general bookmark styling, maybe 'bookmark-card'
    div.className = 'bookmark-card'; // New class for the card itself
    const bookmarkId = bookmark.id;
    const notes = bookmark.notes || '';

    div.innerHTML = `
      <div class="thumbnail-container">
        <img
          class="thumbnail"
          src="${thumbnailUrl}"
          alt="Video thumbnail"
        />
        <div class="thumbnail-placeholder" style="display: none; background: #eee; height: 100%; width: 100%; text-align: center; line-height: 68px; color: #aaa; font-size: 12px;">No thumb</div>
        <div class="timestamp-badge">${formatTime(bookmark.timestamp)}</div>
      </div>
      <div class="bookmark-info">
        <a href="${bookmark.url}" target="_blank" class="video-title-link" title="${bookmark.videoTitle}">
          <h3 class="video-title">${bookmark.videoTitle}</h3>
        </a>
        <!-- Start of new wrapper -->
        <div class="bookmark-details-row">
          <div class="timestamp-actions">
            <button class="share-btn icon-btn" data-url="${bookmark.url}" title="Copy link to clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/></svg>
            </button>
            <button class="delete-btn icon-btn" data-bookmark-id="${bookmarkId}" title="Delete timestamp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
          <div class="saved-date">Saved: ${new Date(bookmark.savedAt || bookmark.createdAt).toLocaleDateString()}</div>
        </div>
        <!-- End of new wrapper -->
      </div>
      <div class="notes-container">
        <div class="note-display">
          <span class="note-preview"></span>
          <button class="edit-note-btn" title="Edit Note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
        </div>
        <textarea class="notes-textarea" data-bookmark-id="${bookmarkId}" placeholder="Add notes..." style="display: none;" rows="3">${notes}</textarea>
      </div>
    `;

    const thumbnailImg = div.querySelector('.thumbnail');
    const thumbnailPlaceholder = div.querySelector('.thumbnail-placeholder');
    thumbnailImg.onerror = () => {
      // Simpler error assignment
      thumbnailImg.style.display = 'none';
      thumbnailPlaceholder.style.display = 'block';
    };

    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(shareBtn.dataset.url);
        showNotification('Link copied!', 'success', notificationArea);
      } catch (err) {
        showNotification('Failed to copy link', 'error', notificationArea);
      }
    });

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      const idToDelete = deleteBtn.dataset.bookmarkId;
      showUndoNotification(idToDelete, index); // Pass index for potential re-insertion
      // deleteBookmark(idToDelete); // This will be called by the undo notification or directly if no undo
    });

    const noteDisplay = div.querySelector('.note-display');
    const notePreview = div.querySelector('.note-preview');
    const editNoteBtn = div.querySelector('.edit-note-btn');
    const notesTextarea = div.querySelector('.notes-textarea');

    function updateNotePreview() {
      const currentNotes = notesTextarea.value.trim();
      if (currentNotes) {
        notePreview.textContent =
          currentNotes.split('\n')[0].substring(0, 30) +
          (currentNotes.length > 30 || currentNotes.includes('\n')
            ? '...'
            : '');
        editNoteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
        editNoteBtn.title = 'Edit Note';
      } else {
        notePreview.textContent = '';
        editNoteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
        editNoteBtn.title = 'Add Note';
      }
    }
    updateNotePreview();

    editNoteBtn.addEventListener('click', () => {
      noteDisplay.style.display = 'none';
      notesTextarea.style.display = 'block';
      notesTextarea.style.width = '100%';
      notesTextarea.focus();
    });

    notesTextarea.addEventListener('blur', () => {
      setTimeout(() => {
        updateNotePreview();
        notesTextarea.style.display = 'none';
        noteDisplay.style.display = 'flex';
      }, 100);
    });
    return div;
  }

  searchInput.addEventListener(
    'input',
    debounce(() => sortAndRenderBookmarks(), 300)
  );

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    sortAndRenderBookmarks();
  });

  // --- Undo Notification & Delete Logic ---
  let undoTimeout = null;
  let bookmarkToUndo = null;
  let originalIndexForUndo = -1; // Store original index for re-insertion

  function showUndoNotification(bookmarkId, originalIndex) {
    const undoNotification = document.getElementById('undoNotification');
    const undoBtn = document.getElementById('undoBtn');

    bookmarkToUndo = allBookmarks.find((b) => b.id === bookmarkId);
    originalIndexForUndo = originalIndex; // Capture original index relative to current filtered/sorted view

    // Temporarily remove from UI and allBookmarks for visual effect
    allBookmarks = allBookmarks.filter((b) => b.id !== bookmarkId);
    renderBookmarks(); // Re-render without the item

    undoNotification.classList.add('show');

    undoBtn.onclick = () => {
      // Use onclick to easily reassign
      clearTimeout(undoTimeout);
      undoNotification.classList.remove('show');
      if (bookmarkToUndo) {
        // Re-insert at original position or sort again
        // For simplicity now, just add back and re-sort/re-render
        allBookmarks.push(bookmarkToUndo);
        sortAndRenderBookmarks(); // This will re-sort and re-render
      }
      bookmarkToUndo = null;
      originalIndexForUndo = -1;
    };

    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
      undoNotification.classList.remove('show');
      if (bookmarkToUndo) {
        // If undo was not clicked, proceed with actual deletion from storage
        deleteBookmarkFromStorage(bookmarkToUndo.id);
      }
      bookmarkToUndo = null;
      originalIndexForUndo = -1;
    }, 5000); // 5 seconds to undo
  }

  async function deleteBookmarkFromStorage(bookmarkId) {
    try {
      let bookmarks = await getAllBookmarksFromStorage(); // Helper to get all raw bookmarks
      bookmarks = bookmarks.filter((b) => b.id !== bookmarkId);
      const success = await saveAllBookmarksToStorage(bookmarks); // Helper to save all raw bookmarks

      if (success) {
        console.log('Bookmark permanently deleted:', bookmarkId);
        // allBookmarks is already updated visually, no need to call loadAllData unless you want a full refresh from storage
      } else {
        showNotification(
          'Failed to delete bookmark permanently.',
          'error',
          notificationArea
        );
        // Potentially add back to allBookmarks and re-render if save failed
        loadAllData(); // Re-sync with storage if permanent delete failed
      }
    } catch (error) {
      console.error('Error deleting bookmark from storage:', error);
      showNotification('Error deleting bookmark.', 'error', notificationArea);
      loadAllData(); // Re-sync
    }
  }

  // Helper functions for direct storage interaction (need to be robust)
  async function getAllBookmarksFromStorage() {
    const indexResult = await chrome.storage.sync.get('bookmarkIndex');
    const bookmarkIndex = indexResult.bookmarkIndex || {
      totalCount: 0,
      chunks: [],
    };
    if (bookmarkIndex.totalCount === 0) return [];

    const BOOKMARK_CHUNK_PREFIX = 'bookmarks_chunk_';
    const chunkKeys = bookmarkIndex.chunks.map(
      (chunkId) => `${BOOKMARK_CHUNK_PREFIX}${chunkId}`
    );
    const chunksResult = await chrome.storage.sync.get(chunkKeys);

    let loadedBookmarks = [];
    bookmarkIndex.chunks.forEach((chunkId) => {
      const chunkKey = `${BOOKMARK_CHUNK_PREFIX}${chunkId}`;
      if (chunksResult[chunkKey]) {
        loadedBookmarks = loadedBookmarks.concat(chunksResult[chunkKey]);
      }
    });
    return loadedBookmarks;
  }

  async function saveAllBookmarksToStorage(bookmarks) {
    try {
      const BOOKMARK_CHUNK_PREFIX = 'bookmarks_chunk_';
      const BOOKMARK_CHUNK_SIZE = 100; // Make sure this constant is available or defined
      const chunkCount = Math.ceil(bookmarks.length / BOOKMARK_CHUNK_SIZE);
      const newChunksData = {};
      const newChunkIds = [];

      for (let i = 0; i < chunkCount; i++) {
        const chunkId = i.toString();
        const chunkKey = `${BOOKMARK_CHUNK_PREFIX}${chunkId}`;
        const startIndex = i * BOOKMARK_CHUNK_SIZE;
        const endIndex = Math.min(
          startIndex + BOOKMARK_CHUNK_SIZE,
          bookmarks.length
        );
        newChunksData[chunkKey] = bookmarks.slice(startIndex, endIndex);
        newChunkIds.push(chunkId);
      }

      // Remove old chunks that are no longer needed
      const oldIndexResult = await chrome.storage.sync.get('bookmarkIndex');
      const oldBookmarkIndex = oldIndexResult.bookmarkIndex || { chunks: [] };
      const keysToRemove = oldBookmarkIndex.chunks
        .filter((oldChunkId) => !newChunkIds.includes(oldChunkId))
        .map((oldChunkId) => `${BOOKMARK_CHUNK_PREFIX}${oldChunkId}`);

      if (keysToRemove.length > 0) {
        await chrome.storage.sync.remove(keysToRemove);
      }

      // Save new chunks and the updated index
      await chrome.storage.sync.set(newChunksData);
      await chrome.storage.sync.set({
        bookmarkIndex: {
          totalCount: bookmarks.length,
          chunks: newChunkIds,
        },
      });
      return true;
    } catch (error) {
      console.error('Error in saveAllBookmarksToStorage:', error);
      return false;
    }
  }

  // Debounced notes save listener (event delegation on bookmarksList)
  bookmarksList.addEventListener(
    'input',
    debounce(async (e) => {
      if (e.target && e.target.classList.contains('notes-textarea')) {
        const bookmarkId = e.target.dataset.bookmarkId;
        const newNotes = e.target.value;

        const targetBookmark = allBookmarks.find((b) => b.id === bookmarkId);
        if (targetBookmark) {
          targetBookmark.notes = newNotes;
          // Also update in storage
          const success = await saveAllBookmarksToStorage(allBookmarks);
          if (success) {
            // Optionally show a subtle save confirmation, but debouncing often makes it implicit
            console.log('Note saved for', bookmarkId);
          } else {
            showNotification('Error saving note.', 'error', notificationArea);
          }
        }
      }
    }, 500)
  );

  // No FOLDER_STATE_KEY logic needed anymore
});
