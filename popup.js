import { debounce, formatTime, showNotification } from './src/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList');
  const searchInput = document.getElementById('searchInput');
  const shortcutToggle = document.getElementById('shortcutToggle');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const sortSelect = document.getElementById('sortSelect');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const selectModeBtn = document.getElementById('selectModeBtn');
  const bulkActions = document.getElementById('bulkActions');
  const selectedCount = document.getElementById('selectedCount');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const exportSelectedBtn = document.getElementById('exportSelectedBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const notificationArea = document.getElementById('notificationArea');
  let allBookmarks = []; // Store all bookmarks for filtering/sorting
  let filteredBookmarks = []; // Store filtered/sorted bookmarks
  let currentSort = 'newest'; // Default sort
  let isSelectMode = false;
  const selectedBookmarks = new Set();

  // Performance optimization variables
  const ITEMS_PER_PAGE = 50; // Show 50 bookmarks at a time
  let currentPage = 0;
  let isLoading = false;

  async function loadAllData() {
    try {
      // Get settings
      const settingResult = await chrome.storage.sync.get([
        'shortcutEnabled',
        'darkModeEnabled',
      ]);
      shortcutToggle.checked = settingResult.shortcutEnabled !== false;
      darkModeToggle.checked = settingResult.darkModeEnabled || false;

      // Apply dark mode if enabled
      applyTheme(darkModeToggle.checked);

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

  function applyTheme(isDark) {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  loadAllData();

  shortcutToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ shortcutEnabled: e.target.checked });
  });

  darkModeToggle.addEventListener('change', (e) => {
    const isDark = e.target.checked;
    chrome.storage.sync.set({ darkModeEnabled: isDark });
    applyTheme(isDark);
  });

  // Export/Import functionality
  exportBtn.addEventListener('click', () => {
    exportBookmarks();
  });

  importBtn.addEventListener('click', () => {
    importFile.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      importBookmarks(file);
      e.target.value = ''; // Reset file input
    }
  });

  async function exportBookmarks() {
    try {
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];

      if (bookmarks.length === 0) {
        showNotification('No bookmarks to export', 'error', notificationArea);
        return;
      }

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        bookmarks: bookmarks,
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtube-timestamps-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification(
        `Exported ${bookmarks.length} bookmarks`,
        'success',
        notificationArea
      );
    } catch (_error) {
      showNotification('Failed to export bookmarks', 'error', notificationArea);
    }
  }

  async function importBookmarks(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate import data
      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        throw new Error('Invalid file format');
      }

      // Get existing bookmarks
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const existingBookmarks = result.timpstamp_bookmarks || [];

      // Merge bookmarks, avoiding duplicates by video ID
      const existingIds = new Set(existingBookmarks.map((b) => b.id));
      const newBookmarks = data.bookmarks.filter((b) => !existingIds.has(b.id));

      if (newBookmarks.length === 0) {
        showNotification(
          'No new bookmarks to import',
          'error',
          notificationArea
        );
        return;
      }

      const mergedBookmarks = [...existingBookmarks, ...newBookmarks];
      await chrome.storage.sync.set({ timpstamp_bookmarks: mergedBookmarks });

      // Refresh UI
      loadAllData();
      showNotification(
        `Imported ${newBookmarks.length} new bookmarks`,
        'success',
        notificationArea
      );
    } catch (_error) {
      showNotification(
        'Failed to import bookmarks. Please check file format.',
        'error',
        notificationArea
      );
    }
  }

  // Bulk operations
  selectModeBtn.addEventListener('click', () => {
    toggleSelectMode();
  });

  selectAllBtn.addEventListener('click', () => {
    selectAllBookmarks();
  });

  deselectAllBtn.addEventListener('click', () => {
    deselectAllBookmarks();
  });

  exportSelectedBtn.addEventListener('click', () => {
    exportSelectedBookmarks();
  });

  deleteSelectedBtn.addEventListener('click', () => {
    deleteSelectedBookmarks();
  });

  function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    selectModeBtn.classList.toggle('active', isSelectMode);
    document.body.classList.toggle('select-mode', isSelectMode);
    bulkActions.style.display = isSelectMode ? 'flex' : 'none';

    if (!isSelectMode) {
      selectedBookmarks.clear();
      updateSelectedCount();
    }
  }

  function selectAllBookmarks() {
    const visibleCards = document.querySelectorAll(
      '.bookmark-card:not([style*="display: none"])'
    );
    visibleCards.forEach((card) => {
      const bookmarkId = card.dataset.bookmarkId;
      if (bookmarkId) {
        selectedBookmarks.add(bookmarkId);
        const checkbox = card.querySelector('.bookmark-checkbox');
        if (checkbox) checkbox.checked = true;
        card.classList.add('selected-for-bulk');
      }
    });
    updateSelectedCount();
  }

  function deselectAllBookmarks() {
    selectedBookmarks.clear();
    document.querySelectorAll('.bookmark-card').forEach((card) => {
      const checkbox = card.querySelector('.bookmark-checkbox');
      if (checkbox) checkbox.checked = false;
      card.classList.remove('selected-for-bulk');
    });
    updateSelectedCount();
  }

  function updateSelectedCount() {
    selectedCount.textContent = `${selectedBookmarks.size} selected`;
  }

  function checkSelectedBookmarks() {
    if (selectedBookmarks.size === 0) {
      showNotification('No bookmarks selected', 'error', notificationArea);
      return false;
    }
    return true;
  }

  function exportSelectedBookmarks() {
    if (!checkSelectedBookmarks()) return;

    const bookmarksToExport = allBookmarks.filter((b) =>
      selectedBookmarks.has(b.id)
    );
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      bookmarks: bookmarksToExport,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `youtube-timestamps-selected-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(
      `Exported ${bookmarksToExport.length} selected bookmarks`,
      'success',
      notificationArea
    );
  }

  async function deleteSelectedBookmarks() {
    if (!checkSelectedBookmarks()) return;

    if (
      !confirm(
        `Delete ${selectedBookmarks.size} selected bookmarks? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const result = await chrome.storage.sync.get('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];
      const updatedBookmarks = bookmarks.filter(
        (b) => !selectedBookmarks.has(b.id)
      );

      await chrome.storage.sync.set({ timpstamp_bookmarks: updatedBookmarks });

      selectedBookmarks.clear();
      loadAllData();
      showNotification(
        'Selected bookmarks deleted',
        'success',
        notificationArea
      );
    } catch (_error) {
      showNotification(
        'Failed to delete selected bookmarks',
        'error',
        notificationArea
      );
    }
  }

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
  // Performance-optimized rendering with pagination and lazy loading
  function renderBookmarks() {
    if (isLoading) return;

    const searchTerm = searchInput.value.toLowerCase();

    // Filter bookmarks
    filteredBookmarks = allBookmarks.filter(
      (bookmark) =>
        (bookmark.videoTitle || '').toLowerCase().includes(searchTerm) ||
        (bookmark.notes || '').toLowerCase().includes(searchTerm)
    );

    // Reset pagination when filter changes
    currentPage = 0;

    // Clear existing list
    bookmarksList.innerHTML = '';

    // Handle empty states
    if (
      filteredBookmarks.length === 0 &&
      allBookmarks.length > 0 &&
      searchTerm
    ) {
      emptyState.textContent = 'No bookmarks match your search.';
      emptyState.style.display = 'block';
      return;
    } else if (filteredBookmarks.length === 0 && allBookmarks.length === 0) {
      emptyState.textContent =
        'No timestamps saved yet. Save some from YouTube!';
      emptyState.style.display = 'block';
      return;
    } else {
      emptyState.style.display = 'none';
    }

    // Render initial page
    renderBookmarkPage();

    // Set up infinite scroll for large collections
    if (filteredBookmarks.length > ITEMS_PER_PAGE) {
      setupInfiniteScroll();
    }
  }

  // Render a single page of bookmarks
  function renderBookmarkPage() {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = Math.min(
      startIndex + ITEMS_PER_PAGE,
      filteredBookmarks.length
    );
    const pageBookmarks = filteredBookmarks.slice(startIndex, endIndex);

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    pageBookmarks.forEach((bookmark) => {
      const bookmarkElement = createBookmarkElement(bookmark);
      fragment.appendChild(bookmarkElement);
    });

    bookmarksList.appendChild(fragment);

    // Show load more button if there are more items
    if (endIndex < filteredBookmarks.length) {
      const loadMoreBtn = createLoadMoreButton();
      bookmarksList.appendChild(loadMoreBtn);
    }
  }

  // Create load more button for pagination
  function createLoadMoreButton() {
    const button = document.createElement('button');
    button.className = 'load-more-btn';
    button.textContent = `Load More (${filteredBookmarks.length - (currentPage + 1) * ITEMS_PER_PAGE} remaining)`;
    button.setAttribute(
      'aria-label',
      `Load ${Math.min(ITEMS_PER_PAGE, filteredBookmarks.length - (currentPage + 1) * ITEMS_PER_PAGE)} more bookmarks`
    );

    button.addEventListener('click', () => {
      loadMoreBookmarks();
    });

    return button;
  }

  // Load more bookmarks when requested
  function loadMoreBookmarks() {
    if (isLoading) return;

    isLoading = true;
    currentPage++;

    // Remove the load more button
    const loadMoreBtn = bookmarksList.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.remove();
    }

    // Render next page
    renderBookmarkPage();

    isLoading = false;
  }

  // Set up infinite scroll for better UX with large collections
  function setupInfiniteScroll() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            entry.target.classList.contains('load-more-btn')
          ) {
            loadMoreBookmarks();
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );

    // Observe the load more button when it's created
    const loadMoreBtn = bookmarksList.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      observer.observe(loadMoreBtn);
    }
  }

  let sortAndRenderBookmarks = () => {
    allBookmarks = sortBookmarks(allBookmarks, currentSort);
    renderBookmarks();
  };

  // createBookmarkElement function remains largely the same but will be appended directly
  // Ensure createBookmarkElement is defined before this point if it's not hoisted, or move its definition up
  function createBookmarkElement(bookmark) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/mqdefault.jpg`;
    const div = document.createElement('div');
    div.className = 'bookmark-card';
    const bookmarkId = bookmark.id;

    div.dataset.bookmarkId = bookmarkId;

    div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-bookmark-id="${bookmarkId}">
    <div class="bookmark-card-content">
      <a href="${bookmark.url}" target="_blank" class="bookmark-link">
        <div class="bookmark-card-inner">
          <div class="thumbnail-container">
            <img class="thumbnail" src="${thumbnailUrl}" alt="Video thumbnail"/>
            <div class="thumbnail-placeholder"></div>
            <div class="timestamp-badge">${formatTime(bookmark.timestamp)}</div>
          </div>
          <div class="bookmark-details">
            <div class="video-title" title="${bookmark.videoTitle}">${bookmark.videoTitle}</div>
          </div>
        </div>
      </a>
      <div class="bookmark-meta">
          <span class="saved-date">Saved: ${new Date(bookmark.savedAt || bookmark.createdAt).toLocaleDateString()}</span>
          <div class="bookmark-actions">
              <button class="share-btn icon-btn" data-url="${bookmark.url}" title="Copy link to clipboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/></svg>
              </button>
              <button class="delete-btn icon-btn" data-bookmark-id="${bookmarkId}" title="Delete timestamp">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
          </div>
      </div>
    </div>
  `;

    const thumbnailImg = div.querySelector('.thumbnail');
    const thumbnailPlaceholder = div.querySelector('.thumbnail-placeholder');
    thumbnailImg.onerror = () => {
      thumbnailImg.style.display = 'none';
      thumbnailPlaceholder.style.display = 'block';
    };

    const stopPropagation = (e) => e.stopPropagation();

    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(shareBtn.dataset.url);
        showNotification('Link copied!', 'success', notificationArea);
      } catch (_err) {
        showNotification('Failed to copy link', 'error', notificationArea);
      }
    });

    const deleteBtn = div.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const idToDelete = deleteBtn.dataset.bookmarkId;
      initiateDeleteWithUndo(idToDelete);
    });

    const checkbox = div.querySelector('.bookmark-checkbox');
    checkbox.addEventListener('click', stopPropagation);
    checkbox.addEventListener('change', (e) => {
      const bookmarkId = e.target.dataset.bookmarkId;
      if (e.target.checked) {
        selectedBookmarks.add(bookmarkId);
        div.classList.add('selected-for-bulk');
      } else {
        selectedBookmarks.delete(bookmarkId);
        div.classList.remove('selected-for-bulk');
      }
      updateSelectedCount();
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

  // Function to orchestrate instant deletion and then show undo
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

  // Function to handle the Undo button click
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

      // Find the bookmark first to return its data
      deletedBookmark = bookmarks.find((b) => b.id === bookmarkId) || null;

      bookmarks = bookmarks.filter((b) => b.id !== bookmarkId);
      const _finalLength = bookmarks.length;

      await chrome.storage.sync.set({ timpstamp_bookmarks: bookmarks });
      showNotification('Bookmark deleted.', 'success', notificationArea);
      return deletedBookmark;
    } catch (_error) {
      showNotification('Failed to delete bookmark.', 'error', notificationArea);
      return null; // Indicate failure
    }
  }

  // Function to restore a bookmark
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
        showNotification('Note saved.', 'success', notificationArea);
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

  // Keyboard Navigation
  let selectedBookmarkIndex = -1;
  const bookmarkCards = () => document.querySelectorAll('.bookmark-card');

  function updateSelection() {
    bookmarkCards().forEach((card, index) => {
      card.classList.toggle('selected', index === selectedBookmarkIndex);
    });
  }

  function selectBookmark(index) {
    const cards = bookmarkCards();
    if (index >= 0 && index < cards.length) {
      selectedBookmarkIndex = index;
      updateSelection();
      // Scroll into view
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function openSelectedBookmark() {
    const cards = bookmarkCards();
    if (selectedBookmarkIndex >= 0 && selectedBookmarkIndex < cards.length) {
      const link =
        cards[selectedBookmarkIndex].querySelector('.video-title-link');
      if (link) {
        link.click();
      }
    }
  }

  function deleteSelectedBookmark() {
    const cards = bookmarkCards();
    if (selectedBookmarkIndex >= 0 && selectedBookmarkIndex < cards.length) {
      const deleteBtn = cards[selectedBookmarkIndex].querySelector(
        '.delete-bookmark-btn'
      );
      if (deleteBtn) {
        deleteBtn.click();
      }
    }
  }

  // Global keyboard event listener
  document.addEventListener('keydown', (e) => {
    // Only handle if search input or textarea is not focused
    if (
      document.activeElement === searchInput ||
      document.activeElement.tagName === 'TEXTAREA'
    )
      return;

    const cards = bookmarkCards();
    if (cards.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectBookmark(selectedBookmarkIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectBookmark(selectedBookmarkIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        openSelectedBookmark();
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteSelectedBookmark();
        break;
      case 'Escape':
        e.preventDefault();
        selectedBookmarkIndex = -1;
        updateSelection();
        break;
      case '/':
        e.preventDefault();
        searchInput.focus();
        break;
    }
  });

  // Reset selection when bookmarks change
  const originalSortAndRender = sortAndRenderBookmarks;
  sortAndRenderBookmarks = function (...args) {
    originalSortAndRender.apply(this, args);
    selectedBookmarkIndex = -1;
    updateSelection();
  };
}); // Closing brace and parenthesis for DOMContentLoaded
