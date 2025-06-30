import { debounce, formatTime, showNotification } from './src/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList');
  const searchInput = document.getElementById('searchInput');
  const shortcutToggle = document.getElementById('shortcutToggle');
  const sortSelect = document.getElementById('sortSelect');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const notificationArea = document.getElementById('notificationArea');
  let allBookmarks = []; // Store all bookmarks for filtering/sorting
  let currentSort = 'newest'; // Default sort


  async function loadAllData() {
    try {
      // Get shortcut setting
      const settingResult = await chrome.storage.sync.get(['shortcutEnabled']);
      shortcutToggle.checked = settingResult.shortcutEnabled !== false;

      // Get bookmarks using the new direct storage approach
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];

      // Store bookmarks in global variable
      allBookmarks = bookmarks;

      // Update UI
      loadingState.style.display = 'none';
      sortAndRenderBookmarks(); // Sort and render the bookmarks
    } catch (_error) {
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

  }

  function sortAndRenderBookmarks() {
    allBookmarks = sortBookmarks(allBookmarks, currentSort);
    renderBookmarks();
  }

  // createBookmarkElement function remains largely the same but will be appended directly
  // Ensure createBookmarkElement is defined before this point if it's not hoisted, or move its definition up
  function createBookmarkElement(bookmark, _index) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/hqdefault.jpg`;
    const div = document.createElement('div');
    // Assign a class for general bookmark styling, maybe 'bookmark-card'
    div.className = 'bookmark-card'; // New class for the card itself
    const bookmarkId = bookmark.id;
    const notes = bookmark.notes || '';

    div.dataset.bookmarkId = bookmarkId; // Set the data attribute on the main card div

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
    shareBtn.addEventListener('click', async (_e) => {
      try {
        await navigator.clipboard.writeText(shareBtn.dataset.url);
        showNotification('Link copied!', 'success', notificationArea);
      } catch (_err) {
        showNotification('Failed to copy link', 'error', notificationArea);
      }
    });

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (_e) => {
      const idToDelete = deleteBtn.dataset.bookmarkId;
      initiateDeleteWithUndo(idToDelete);
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

  // --- Undo Notification & Delete/Restore Logic --- //

  const undoNotification = document.getElementById('undoNotification');
  const undoBtn = document.getElementById('undoBtn');

  let undoState = { bookmarkToRestore: null, timeoutId: null }; // Store the whole bookmark for restoration

  // *** NEW: Function to orchestrate instant deletion and then show undo ***
  async function initiateDeleteWithUndo(bookmarkId) {
    const deletedBookmark = await deleteBookmarkFromStorage(bookmarkId); // Delete first

    if (deletedBookmark) {
      loadAllData(); // Refresh UI immediately *after* successful deletion
      showUndoNotification(deletedBookmark); // Show undo option, passing the deleted data
    } else {
      loadAllData(); // Still refresh UI in case of partial failure state
    }
  }

  function showUndoNotification(deletedBookmarkData) {
    // Clear any previous undo state/timeout
    if (undoState.timeoutId) {
      clearTimeout(undoState.timeoutId);
    }
    // Store the data needed for potential restore
    undoState.bookmarkToRestore = deletedBookmarkData;

    // Show the notification bar
    undoNotification.classList.add('show');

    // Set timeout to hide notification and clear state
    undoState.timeoutId = setTimeout(() => {
      undoNotification.classList.remove('show');
      undoState = { bookmarkToRestore: null, timeoutId: null }; // Just clear state
    }, 5000); // 5 seconds to undo
  }

  // *** NEW: Separate function to handle the Undo button click ***
  async function handleUndoClick() {
    if (undoState.timeoutId) {
      clearTimeout(undoState.timeoutId); // Prevent timeout from clearing state
    }
    undoNotification.classList.remove('show');

    const bookmarkToRestore = undoState.bookmarkToRestore;
    undoState = { bookmarkToRestore: null, timeoutId: null }; // Clear state immediately

    if (bookmarkToRestore) {
      await restoreBookmark(bookmarkToRestore);
      loadAllData(); // Refresh UI after successful restore
    } else {
    }
  }

  // Add listener to the Undo button ONCE
  undoBtn.addEventListener('click', handleUndoClick);

  // --- Storage Interaction --- //

  async function deleteBookmarkFromStorage(bookmarkId) {
    let deletedBookmark = null; // To store the data of the bookmark being deleted
    try {
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      let bookmarks = result.timpstamp_bookmarks || [];

      // *** CHANGE: Find the bookmark first to return its data ***
      deletedBookmark = bookmarks.find((b) => b.id === bookmarkId) || null;

      bookmarks = bookmarks.filter((b) => b.id !== bookmarkId);
      const _finalLength = bookmarks.length;

      if (bookmarks.length === 0) {
      } else {
      }
      await chrome.storage.sync.set({ timpstamp_bookmarks: bookmarks });
      showNotification('Bookmark deleted.', 'success', notificationArea);
      return deletedBookmark; // *** CHANGE: Return the data of the deleted item ***
    } catch (_error) {
      showNotification('Failed to delete bookmark.', 'error', notificationArea);
      return null; // Indicate failure
    }
  }

  // *** NEW: Function to restore a bookmark ***
  async function restoreBookmark(bookmarkToRestore) {
    try {
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];

      // Optional: Check if it somehow already exists (e.g., rapid undo/redo?) to avoid duplicates
      if (bookmarks.some((b) => b.id === bookmarkToRestore.id)) {
        return false; // Indicate restore wasn't needed/performed
      }

      bookmarks.push(bookmarkToRestore);

      await chrome.storage.sync.set({ timpstamp_bookmarks: bookmarks });
      showNotification('Bookmark restored.', 'success', notificationArea);
      return true; // Indicate success
    } catch (_error) {
      showNotification(
        'Failed to restore bookmark.',
        'error',
        notificationArea
      );
      return false; // Indicate failure
    }
  }

  async function saveNoteToBookmark(bookmarkId, noteText) {
    try {
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];
      const bookmarkIndex = bookmarks.findIndex((b) => b.id === bookmarkId);

      if (bookmarkIndex !== -1) {
        bookmarks[bookmarkIndex].notes = noteText;
        await chrome.storage.sync.set({ timpstamp_bookmarks: bookmarks });
        // Optional: show success notification, maybe debounced
        // showNotification('Note saved.', 'success', notificationArea);
      } else {
      }
    } catch (_error) {
      showNotification('Failed to save note.', 'error', notificationArea);
    }
  }

  // Debounced notes save listener using event delegation
  bookmarksList.addEventListener(
    'input',
    debounce(async (e) => {
      if (e.target?.classList.contains('notes-textarea')) {
        const bookmarkId = e.target.dataset.bookmarkId;
        const newNotes = e.target.value;
        await saveNoteToBookmark(bookmarkId, newNotes);
      }
    }, 500) // Adjust debounce time as needed
  );
}); // Closing brace and parenthesis for DOMContentLoaded
