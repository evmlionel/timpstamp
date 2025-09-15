import { BOOKMARKS_KEY } from './src/constants.js';
import {
  debounce,
  formatTime,
  setupLazyLoading,
  showNotification,
} from './src/utils.js';

// Cross-browser safe wrappers for chrome.storage (Promise via callback)
function storageGet(keys) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result || {});
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function storageSet(obj) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime?.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const bookmarksList = document.getElementById('bookmarksList');
  const searchInput = document.getElementById('searchInput');
  const shortcutToggle = document.getElementById('shortcutToggle');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const sortSelect = document.getElementById('sortSelect');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const optionsBtn = document.getElementById('optionsBtn');
  const favoritesFilterBtn = document.getElementById('favoritesFilterBtn');
  const titleButton = document.getElementById('main-title');
  const shortcutModal = document.getElementById('shortcutModal');
  const shortcutModalClose = document.getElementById('shortcutModalClose');
  const shortcutBtn = document.getElementById('shortcutBtn');
  const headerCounts = document.getElementById('headerCounts');
  const firstRun = document.getElementById('firstRun');
  const firstRunDismiss = document.getElementById('firstRunDismiss');
  const expandAllBtn = document.getElementById('expandAllBtn');
  const collapseAllBtn = document.getElementById('collapseAllBtn');
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
  let favoritesOnly = false;
  let expandedGroups = new Set();
  const activeTagFilters = new Set();
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const tagChipsContainer = document.getElementById('tagChips');
  let isEditingTags = false;
  let isComposing = false;
  let lastFocusEl = null;

  // Diacritic-insensitive normalizer
  function normalizeStr(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function filtersActive() {
    return (
      (searchInput.value && searchInput.value.trim().length > 0) ||
      favoritesOnly ||
      activeTagFilters.size > 0
    );
  }

  // --- Virtualization (true windowing) for very large groups ---
  function enableGroupVirtualization(videoId, container) {
    const topSpacer = document.createElement('div');
    const mount = document.createElement('div');
    const bottomSpacer = document.createElement('div');
    topSpacer.className = 'group-virt-spacer top';
    bottomSpacer.className = 'group-virt-spacer bottom';
    mount.className = 'group-virt-mount';
    container.innerHTML = '';
    container.appendChild(topSpacer);
    container.appendChild(mount);
    container.appendChild(bottomSpacer);

    groupVirtual.set(videoId, {
      enabled: true,
      itemHeight: 0,
      mount,
      topSpacer,
      bottomSpacer,
    });

    renderGroupWindow(videoId, container, true);
    const handler = () => renderGroupWindow(videoId, container, false);
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    container.__virtHandler = handler;
  }

  function computeItemHeight(mount) {
    const first = mount.querySelector('.bookmark-card');
    if (first) return Math.max(1, first.getBoundingClientRect().height);
    return 96;
  }

  function getViewportRange(rectTop, itemH, itemsLen) {
    const vh = window.innerHeight || 800;
    const start = Math.max(
      0,
      Math.floor((0 - rectTop) / itemH) - VIRTUAL_OVERSCAN
    );
    const end = Math.min(
      itemsLen,
      Math.ceil((vh - rectTop) / itemH) + VIRTUAL_OVERSCAN
    );
    return [start, end];
  }

  function ensureItemHeight(virt, sampleStart, items) {
    if (virt.itemHeight) return Math.max(1, virt.itemHeight);
    virt.mount.innerHTML = '';
    const sampleEnd = Math.min(sampleStart + 5, items.length);
    for (let i = sampleStart; i < sampleEnd; i++) {
      virt.mount.appendChild(createBookmarkElement(items[i]));
    }
    virt.itemHeight = computeItemHeight(virt.mount) || 96;
    return Math.max(1, virt.itemHeight);
  }

  function applyWindow(virt, items, s, e, itemH) {
    virt.topSpacer.style.height = `${s * itemH}px`;
    virt.bottomSpacer.style.height = `${Math.max(0, items.length - e) * itemH}px`;
    const desiredKey = `${s}:${e}`;
    if (virt.mount.__rangeKey === desiredKey) return;
    virt.mount.__rangeKey = desiredKey;
    virt.mount.innerHTML = '';
    for (let i = s; i < e; i++)
      virt.mount.appendChild(createBookmarkElement(items[i]));
  }

  function renderGroupWindow(videoId, container, isInitial) {
    const virt = groupVirtual.get(videoId);
    if (!virt?.enabled) return;
    const items = groupItems.get(videoId) || [];
    const rect = container.getBoundingClientRect();
    const baseH = Math.max(1, virt.itemHeight || 96);
    const [startIdx, endIdx] = getViewportRange(rect.top, baseH, items.length);
    const itemH = ensureItemHeight(virt, startIdx, items);
    const s = Math.max(0, startIdx);
    const e = Math.max(s, endIdx);
    if (!isInitial) virt.mount.__rangeKey = undefined; // allow update if sizes changed
    applyWindow(virt, items, s, e, itemH);
  }

  function updateClearFiltersVisibility() {
    if (!clearFiltersBtn) return;
    clearFiltersBtn.style.display = filtersActive() ? 'inline-block' : 'none';
  }
  const updateFavoritesButtonLabel = () => {
    try {
      const count = allBookmarks.filter((b) => b.favorite).length;
      const title = `Show favorites only${count ? ` (${count})` : ''}`;
      favoritesFilterBtn.title = title;
      favoritesFilterBtn.setAttribute('aria-label', title);
    } catch {}
  };

  // Performance optimization variables
  const ITEMS_PER_PAGE = 50; // legacy flat list paging
  let currentPage = 0;
  let isLoading = false;
  // Group virtualization
  const GROUPS_CHUNK_SIZE = 25;
  const GROUP_ITEMS_CHUNK_SIZE = 80; // items per render inside a group (non-virtualized)
  const VIRTUALIZE_THRESHOLD = 200; // switch to windowing above this many items
  const VIRTUAL_OVERSCAN = 20; // extra items above/below viewport
  let groupsOrdered = [];
  let groupsRendered = 0;
  let onScrollHandler = null;
  const lazyObserver = setupLazyLoading();
  const groupItems = new Map(); // videoId -> items array
  const groupRenderedCount = new Map(); // videoId -> rendered count
  const groupVirtual = new Map(); // videoId -> { enabled, itemHeight, mount, topSpacer, bottomSpacer }
  function onGroupIntersect(entries, observer) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const vid = el.getAttribute('data-video-id');
      const body = el.parentElement;
      if (!vid || !body) continue;
      try {
        observer.unobserve(el);
      } catch {}
      el.remove();
      if (!groupVirtual.get(vid)?.enabled) renderMoreInGroup(vid, body);
    }
  }
  const groupObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(
          (entries) => onGroupIntersect(entries, groupObserver),
          { rootMargin: '200px' }
        )
      : null;

  async function fetchSettings() {
    return storageGet([
      'shortcutEnabled',
      'darkModeEnabled',
      'expandedGroups',
      'firstRunDismissedV1',
    ]);
  }
  function applySettingsToUI(s) {
    if (shortcutToggle) shortcutToggle.checked = s.shortcutEnabled !== false;
    const darkValue = !!s.darkModeEnabled;
    if (darkModeToggle) darkModeToggle.checked = darkValue;
    applyTheme(darkValue);
    expandedGroups = new Set(s.expandedGroups || []);
  }
  async function fetchBookmarks() {
    const result = await storageGet(BOOKMARKS_KEY);
    return result[BOOKMARKS_KEY] || [];
  }
  function normalizeForSearch(bookmarks) {
    for (const b of bookmarks) {
      b._title_lc = normalizeStr(b.videoTitle || '');
      b._notes_lc = normalizeStr(b.notes || '');
      b._tags_lc = normalizeStr((b.tags || []).join(' '));
    }
    return bookmarks;
  }
  async function loadAllData() {
    try {
      const settings = await fetchSettings();
      applySettingsToUI(settings);
      allBookmarks = normalizeForSearch(await fetchBookmarks());
      updateFavoritesButtonLabel();
      renderTagChips();
      loadingState.style.display = 'none';
      sortAndRenderBookmarks();
      try {
        const none = (allBookmarks || []).length === 0;
        const dismissed = settings.firstRunDismissedV1 === true;
        if (firstRun)
          firstRun.style.display = none && !dismissed ? 'block' : 'none';
      } catch {}
    } catch {
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

  // Refresh live when storage changes (e.g., after pressing B on YouTube)
  chrome.storage.onChanged.addListener((changes, ns) => {
    if (ns === 'local' && changes.timpstamp_bookmarks) {
      // Avoid nuking focus while editing tags
      if (
        isEditingTags ||
        document.activeElement?.classList?.contains('tag-input')
      ) {
        setTimeout(() => {
          if (
            !isEditingTags &&
            !document.activeElement?.classList?.contains('tag-input')
          ) {
            loadAllData();
          }
        }, 1200);
        return;
      }
      loadAllData();
    }
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      searchInput.value = '';
      favoritesOnly = false;
      favoritesFilterBtn.setAttribute('aria-pressed', 'false');
      activeTagFilters.clear();
      sortAndRenderBookmarks();
      updateClearFiltersVisibility();
      searchInput.focus();
    });
  }

  function resetFiltersToDefault() {
    searchInput.value = '';
    favoritesOnly = false;
    favoritesFilterBtn.setAttribute('aria-pressed', 'false');
    activeTagFilters.clear();
    currentSort = 'newest';
    if (sortSelect) sortSelect.value = 'newest';
    sortAndRenderBookmarks();
    updateClearFiltersVisibility();
    renderTagChips();
    updateFavoritesButtonLabel();
  }

  if (titleButton) {
    titleButton.addEventListener('click', () => {
      resetFiltersToDefault();
      searchInput.focus();
    });
    titleButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        resetFiltersToDefault();
        searchInput.focus();
      }
    });
  }

  function openShortcutHelp() {
    if (!shortcutModal) return;
    lastFocusEl = document.activeElement;
    shortcutModal.classList.add('show');
    shortcutModal.setAttribute('aria-hidden', 'false');
    // Focus close button
    shortcutModalClose?.focus();
    document.body.classList.add('modal-open');
    try {
      enableFocusTrap(shortcutModal);
    } catch {}
  }
  function closeShortcutHelp() {
    if (!shortcutModal) return;
    shortcutModal.classList.remove('show');
    shortcutModal.setAttribute('aria-hidden', 'true');
    if (lastFocusEl?.focus) lastFocusEl.focus();
    document.body.classList.remove('modal-open');
    try {
      disableFocusTrap(shortcutModal);
    } catch {}
  }
  shortcutModalClose?.addEventListener('click', () => closeShortcutHelp());
  shortcutModal?.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('modal-backdrop')) {
      closeShortcutHelp();
    }
  });

  // First-run dismiss
  firstRunDismiss?.addEventListener('click', async () => {
    try {
      await storageSet({ firstRunDismissedV1: true });
      if (firstRun) firstRun.style.display = 'none';
    } catch {}
  });

  // --- Focus Trap Utilities for Modal ---
  function getFocusableElements(container) {
    const dialog = container.querySelector('.modal-dialog') || container;
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const nodes = Array.from(dialog.querySelectorAll(selectors));
    return nodes.filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
  }
  function handleTrapKeydown(e) {
    if (e.key !== 'Tab') return;
    const container = document.getElementById('shortcutModal');
    const focusables = getFocusableElements(container);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  function enableFocusTrap(container) {
    container.__trapHandler = handleTrapKeydown;
    document.addEventListener('keydown', handleTrapKeydown, true);
  }
  function disableFocusTrap(container) {
    if (container.__trapHandler) {
      document.removeEventListener('keydown', container.__trapHandler, true);
      delete container.__trapHandler;
    }
  }

  if (shortcutToggle) {
    shortcutToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({ shortcutEnabled: e.target.checked });
    });
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      const isDark = e.target.checked;
      chrome.storage.local.set({ darkModeEnabled: isDark });
      applyTheme(isDark);
    });
  }

  // Header counts updater
  function updateHeaderCounts() {
    try {
      // Use current filtered view if available
      const videos = new Set();
      for (const b of filteredBookmarks.length
        ? filteredBookmarks
        : allBookmarks) {
        if (b.videoId) videos.add(b.videoId);
      }
      const v = videos.size;
      const t = (filteredBookmarks.length ? filteredBookmarks : allBookmarks)
        .length;
      if (headerCounts)
        headerCounts.textContent = `${v} videos · ${t} timestamps`;
    } catch {}
  }

  optionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage().catch(() => {
        const url = chrome.runtime.getURL('options.html');
        // Fallback without requiring tabs permission
        window.open(url, '_blank');
      });
    } else {
      const url = chrome.runtime.getURL('options.html');
      window.open(url, '_blank');
    }
  });

  favoritesFilterBtn.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    favoritesFilterBtn.setAttribute('aria-pressed', String(favoritesOnly));
    sortAndRenderBookmarks();
    updateClearFiltersVisibility();
    updateHeaderCounts();
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

  // Shortcuts button opens modal
  shortcutBtn?.addEventListener('click', () => openShortcutHelp());

  // Expand/Collapse all groups
  async function expandAllGroups() {
    try {
      // Mark all to expand, including those not yet rendered
      expandedGroups = new Set((groupsOrdered || []).map(([vid]) => vid));
      // Apply to visible ones
      document.querySelectorAll('.group-card .group-body').forEach((el) => {
        el.style.display = 'block';
      });
      document.querySelectorAll('.group-card .group-header').forEach((h) => {
        h.setAttribute('aria-expanded', 'true');
      });
      await storageSet({ expandedGroups: [...expandedGroups] });
    } catch {}
  }
  async function collapseAllGroups() {
    try {
      expandedGroups = new Set();
      document.querySelectorAll('.group-card .group-body').forEach((el) => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.group-card .group-header').forEach((h) => {
        h.setAttribute('aria-expanded', 'false');
      });
      await storageSet({ expandedGroups: [] });
    } catch {}
  }
  expandAllBtn?.addEventListener('click', () => expandAllGroups());
  collapseAllBtn?.addEventListener('click', () => collapseAllGroups());

  async function exportBookmarks() {
    try {
      const result = await storageGet(BOOKMARKS_KEY);
      const bookmarks = result[BOOKMARKS_KEY] || [];

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
      const result = await storageGet(BOOKMARKS_KEY);
      const existingBookmarks = result[BOOKMARKS_KEY] || [];

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
      await storageSet({ [BOOKMARKS_KEY]: mergedBookmarks });

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
      const result = await storageGet(BOOKMARKS_KEY);
      const bookmarks = result[BOOKMARKS_KEY] || [];
      const updatedBookmarks = bookmarks.filter(
        (b) => !selectedBookmarks.has(b.id)
      );

      await storageSet({ [BOOKMARKS_KEY]: updatedBookmarks });

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

    const searchTerm = normalizeStr(searchInput.value);

    /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: compact multi-check predicate */
    function matchesFilters(bookmark, q) {
      if (favoritesOnly && !bookmark.favorite) return false;
      if (activeTagFilters.size > 0) {
        const tags = new Set(
          (bookmark.tags || []).map((t) => String(t).toLowerCase())
        );
        for (const t of activeTagFilters) if (!tags.has(t)) return false;
      }
      if (!q) return true;
      const hay = `${bookmark._title_lc || ''} ${bookmark._notes_lc || ''} ${bookmark._tags_lc || ''}`;
      return hay.includes(q);
    }

    // Filter bookmarks
    filteredBookmarks = allBookmarks.filter((bookmark) =>
      matchesFilters(bookmark, searchTerm)
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

    // Group by videoId
    const groups = new Map();
    for (const b of filteredBookmarks) {
      const g = groups.get(b.videoId) || {
        videoTitle: b.videoTitle,
        channelTitle: b.channelTitle || '',
        items: [],
      };
      g.items.push(b);
      groups.set(b.videoId, g);
    }
    // Sort groups by newest savedAt in group
    groupsOrdered = [...groups.entries()].sort((a, b) => {
      const A = a[1];
      const B = b[1];
      const aMax = Math.max(
        ...A.items.map((x) => x.savedAt || x.createdAt || 0)
      );
      const bMax = Math.max(
        ...B.items.map((x) => x.savedAt || x.createdAt || 0)
      );
      return bMax - aMax;
    });

    // Reset counters and detach old listener
    groupsRendered = 0;
    if (onScrollHandler)
      window.removeEventListener('scroll', onScrollHandler, { passive: true });
    bookmarksList.innerHTML = '';

    // Render initial chunk and attach infinite scroll
    renderNextGroupChunk();
    onScrollHandler = () => {
      const scrollPos = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollPos < 600) {
        renderNextGroupChunk();
      }
    };
    window.addEventListener('scroll', onScrollHandler, { passive: true });
    updateHeaderCounts();
  }

  function renderNextGroupChunk() {
    if (groupsRendered >= groupsOrdered.length) return;
    const frag = document.createDocumentFragment();
    const end = Math.min(
      groupsRendered + GROUPS_CHUNK_SIZE,
      groupsOrdered.length
    );
    for (let i = groupsRendered; i < end; i++) {
      const [vid, g] = groupsOrdered[i];
      const card = document.createElement('div');
      card.className = 'group-card';
      const bodyId = `group-body-${CSS.escape(vid)}`;
      card.innerHTML = `
        <div class="group-header" data-video-id="${vid}">
          <div class="group-title">
            <div class="video" title="${g.videoTitle}">${g.videoTitle}</div>
            <div class="channel">${g.channelTitle || ''}</div>
          </div>
          <div><span>(${g.items.length})</span></div>
        </div>
        <div id="${bodyId}" class="group-body" style="display:none;" role="list"></div>
      `;
      const body = card.querySelector('.group-body');
      g.items.sort((a, b) => a.timestamp - b.timestamp);
      groupItems.set(vid, g.items);
      groupRenderedCount.set(vid, 0);
      if (g.items.length >= VIRTUALIZE_THRESHOLD) {
        enableGroupVirtualization(vid, body);
      } else {
        // Render initial chunk inside the group body
        renderMoreInGroup(vid, body, GROUP_ITEMS_CHUNK_SIZE);
      }
      const header = card.querySelector('.group-header');
      // A11y: make header operable and reflect state
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute(
        'aria-expanded',
        g.items.length <= 3 || expandedGroups.has(vid) ? 'true' : 'false'
      );
      header.setAttribute('aria-controls', bodyId);
      const toggleGroup = async () => {
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        header.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (open) {
          expandedGroups.delete(vid);
        } else {
          expandedGroups.add(vid);
        }
        try {
          await storageSet({ expandedGroups: [...expandedGroups] });
        } catch {}
      };
      header.addEventListener('click', async () => {
        await toggleGroup();
      });
      header.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          await toggleGroup();
        }
      });
      // Removed group pinning to simplify UX
      if (g.items.length <= 3 || expandedGroups.has(vid)) {
        body.style.display = 'block';
      }
      frag.appendChild(card);
    }
    bookmarksList.appendChild(frag);
    groupsRendered = end;
  }

  function renderMoreInGroup(
    videoId,
    container,
    count = GROUP_ITEMS_CHUNK_SIZE
  ) {
    if (groupVirtual.get(videoId)?.enabled) return; // virtualization handles rendering
    const items = groupItems.get(videoId) || [];
    const already = groupRenderedCount.get(videoId) || 0;
    const next = Math.min(already + count, items.length);
    if (already >= next) return;

    const frag = document.createDocumentFragment();
    for (let i = already; i < next; i++) {
      const el = createBookmarkElement(items[i]);
      frag.appendChild(el);
    }
    // Remove any existing load-more sentinel
    container.querySelector('.group-load-more')?.remove();
    container.appendChild(frag);
    groupRenderedCount.set(videoId, next);

    if (next < items.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'group-load-more';
      more.setAttribute('data-video-id', videoId);
      more.textContent = `Load more (${items.length - next} remaining)`;
      more.addEventListener('click', (e) => {
        e.preventDefault();
        renderMoreInGroup(videoId, container);
      });
      container.appendChild(more);
      try {
        groupObserver?.observe(more);
      } catch {}
    }
  }

  function aggregateTagCounts(bookmarks) {
    const counts = new Map();
    for (const b of bookmarks)
      for (const t of b.tags || []) {
        const key = String(t).toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    return counts;
  }
  function makeTagChip(tag, count) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `tag-chip${activeTagFilters.has(tag) ? ' active' : ''}`;
    chip.dataset.tag = tag;
    chip.setAttribute(
      'aria-pressed',
      activeTagFilters.has(tag) ? 'true' : 'false'
    );
    chip.title = `Filter by tag: ${tag}`;
    chip.innerHTML = `<span class="hash">#</span>${tag}<span class="count">${count}</span>`;
    chip.addEventListener('click', () => {
      if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
      else activeTagFilters.add(tag);
      renderTagChips();
      sortAndRenderBookmarks();
      updateClearFiltersVisibility();
    });
    return chip;
  }
  function renderTagChips() {
    if (!tagChipsContainer) return;
    const counts = aggregateTagCounts(allBookmarks);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    tagChipsContainer.innerHTML = '';
    for (const [tag, count] of top)
      tagChipsContainer.appendChild(makeTagChip(tag, count));
    tagChipsContainer.style.display = top.length ? 'flex' : 'none';
  }

  // (filter bar removed to simplify UI)

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
  function _setupInfiniteScroll() {
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
    updateHeaderCounts();
  };

  // createBookmarkElement function remains largely the same but will be appended directly
  // Ensure createBookmarkElement is defined before this point if it's not hoisted, or move its definition up
  function createBookmarkElement(bookmark) {
    const thumbnailUrl = `https://i.ytimg.com/vi/${bookmark.videoId}/mqdefault.jpg`;
    const div = document.createElement('div');
    div.className = 'bookmark-card';
    div.setAttribute('role', 'listitem');
    const bookmarkId = bookmark.id;

    div.dataset.bookmarkId = bookmarkId;

    div.innerHTML = `
    <input type="checkbox" class="bookmark-checkbox" data-bookmark-id="${bookmarkId}">
    <div class="bookmark-card-content">
      <a href="https://youtube.com/watch?v=${bookmark.videoId}&t=${bookmark.timestamp}s" target="_blank" class="bookmark-link">
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
              <button class="share-btn icon-btn" data-url="${bookmark.url}" title="Copy link to clipboard" aria-label="Copy link to clipboard">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="currentColor"/></svg>
              </button>
              <button class="copy-md-btn icon-btn" data-bookmark-id="${bookmarkId}" title="Copy Markdown link" aria-label="Copy Markdown link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 4v10h14V7H5zm3 2h2.5l1.5 2 1.5-2H16v6h-2V11l-2 3-2-3v4H8V9z"/></svg>
              </button>
              <button class="favorite-btn icon-btn" data-bookmark-id="${bookmarkId}" title="Toggle favorite" aria-label="Toggle favorite" aria-pressed="${bookmark.favorite ? 'true' : 'false'}">
                  <!-- Outline star (shown when not favorited) -->
                  <svg class="star-outline" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 17.27L5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  </svg>
                  <!-- Filled star (shown when favorited) -->
                  <svg class="star-filled" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
              </button>
              <button class="delete-btn icon-btn" data-bookmark-id="${bookmarkId}" title="Delete timestamp" aria-label="Delete timestamp">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
          </div>
      </div>
      <input class="tag-input" type="text" placeholder="tags (comma-separated)" value="${(bookmark.tags || []).join(', ')}" data-bookmark-id="${bookmarkId}" />
    </div>
  `;

    const thumbnailImg = div.querySelector('.thumbnail');
    const thumbnailPlaceholder = div.querySelector('.thumbnail-placeholder');
    thumbnailImg.onerror = () => {
      // Fallback to CSP-safer hqdefault.jpg once; otherwise show placeholder
      if (!thumbnailImg.dataset.fallbackTried) {
        thumbnailImg.dataset.fallbackTried = '1';
        thumbnailImg.src = `https://i.ytimg.com/vi/${bookmark.videoId}/hqdefault.jpg`;
        return;
      }
      thumbnailImg.style.display = 'none';
      thumbnailPlaceholder.style.display = 'block';
    };
    // Observe for lazy loading only when using data-src
    try {
      if (thumbnailImg.dataset?.src) {
        lazyObserver.observe(thumbnailImg);
      }
    } catch {}

    const stopPropagation = (e) => e.stopPropagation();

    const shareBtn = div.querySelector('.share-btn');
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const url = `https://youtube.com/watch?v=${bookmark.videoId}&t=${bookmark.timestamp}s`;
        await navigator.clipboard.writeText(url);
        showNotification('Link copied!', 'success', notificationArea);
      } catch (_err) {
        showNotification('Failed to copy link', 'error', notificationArea);
      }
    });

    const copyMdBtn = div.querySelector('.copy-md-btn');
    copyMdBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const url = `https://youtube.com/watch?v=${bookmark.videoId}&t=${bookmark.timestamp}s`;
        const md =
          `[${bookmark.videoTitle || 'YouTube'} ${formatTime(bookmark.timestamp)}](${url})` +
          (bookmark.notes ? ` — ${bookmark.notes}` : '');
        await navigator.clipboard.writeText(md);
        showNotification('Markdown copied!', 'success', notificationArea);
      } catch (_err) {
        showNotification('Failed to copy Markdown', 'error', notificationArea);
      }
    });

    const favBtn = div.querySelector('.favorite-btn');
    /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inline UI flow for favorite toggle */
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = favBtn.dataset.bookmarkId;
      const toggled = await toggleFavorite(id);
      favBtn.setAttribute('aria-pressed', String(toggled));
      // Trigger a quick pulse animation when favorited
      if (toggled) {
        const filled = favBtn.querySelector('.star-filled');
        if (filled) {
          filled.classList.remove('pulse');
          // Force reflow to restart animation if needed
          void filled.offsetWidth;
          filled.classList.add('pulse');
        }
      }
      const idx = allBookmarks.findIndex((b) => b.id === id);
      if (idx >= 0) allBookmarks[idx].favorite = toggled;
      // Instant visual + feedback
      try {
        updateFavoritesButtonLabel();
      } catch {}
      showNotification(
        toggled ? 'Added to favorites' : 'Removed from favorites',
        'success',
        notificationArea
      );
      if (favoritesOnly) {
        sortAndRenderBookmarks();
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
    debounce(() => sortAndRenderBookmarks(), 120)
  );

  // Prevent global key handlers when editing tags, and add Enter to blur
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tag editing handler covers several cases */
  bookmarksList.addEventListener('keydown', (e) => {
    if (e.target?.classList?.contains('tag-input')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.target.blur();
      } else if (e.key === 'Backspace') {
        const input = e.target;
        // If input is empty or only spaces, pop last tag
        if (!isComposing && String(input.value || '').trim() === '') {
          e.preventDefault();
          e.stopPropagation();
          const bookmarkId = input.dataset.bookmarkId;
          const i = allBookmarks.findIndex((b) => b.id === bookmarkId);
          if (i !== -1) {
            const current = Array.isArray(allBookmarks[i].tags)
              ? [...allBookmarks[i].tags]
              : [];
            if (current.length > 0) {
              current.pop();
              // Persist and update UI field
              saveTagsToBookmark(bookmarkId, current).then(() => {
                input.value = current.join(', ');
              });
            }
          }
        } else {
          // Normal deletion; just stop bubbling to avoid global handlers
          e.stopPropagation();
        }
      }
    }
  });
  // Track focus state to prevent re-renders stealing focus
  bookmarksList.addEventListener('focusin', (e) => {
    if (e.target?.classList?.contains('tag-input')) {
      isEditingTags = true;
    }
  });
  bookmarksList.addEventListener('focusout', (e) => {
    if (e.target?.classList?.contains('tag-input')) {
      isEditingTags = false;
      try {
        renderTagChips();
      } catch {}
    }
  });
  bookmarksList.addEventListener('compositionstart', (e) => {
    if (e.target?.classList?.contains('tag-input')) {
      isComposing = true;
    }
  });
  bookmarksList.addEventListener('compositionend', (e) => {
    if (e.target?.classList?.contains('tag-input')) {
      isComposing = false;
    }
  });

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
      const result = await chrome.storage.local.get(BOOKMARKS_KEY);
      let bookmarks = result[BOOKMARKS_KEY] || [];

      // Find the bookmark first to return its data
      deletedBookmark = bookmarks.find((b) => b.id === bookmarkId) || null;

      bookmarks = bookmarks.filter((b) => b.id !== bookmarkId);
      const _finalLength = bookmarks.length;

      await chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarks });
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
      const result = await storageGet(BOOKMARKS_KEY);
      const bookmarks = result[BOOKMARKS_KEY] || [];

      // Optional: Check if it somehow already exists (e.g., rapid undo/redo?) to avoid duplicates
      if (bookmarks.some((b) => b.id === bookmarkToRestore.id)) {
        return false; // Indicate restore wasn't needed/performed
      }

      bookmarks.push(bookmarkToRestore);

      await storageSet({ [BOOKMARKS_KEY]: bookmarks });
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
      const result = await storageGet('timpstamp_bookmarks');
      const bookmarks = result.timpstamp_bookmarks || [];
      const bookmarkIndex = bookmarks.findIndex((b) => b.id === bookmarkId);

      if (bookmarkIndex !== -1) {
        bookmarks[bookmarkIndex].notes = noteText;
        await storageSet({ timpstamp_bookmarks: bookmarks });
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
      } else if (e.target?.classList.contains('tag-input')) {
        if (isComposing) return; // don't save mid-IME composition
        const bookmarkId = e.target.dataset.bookmarkId;
        const raw = e.target.value || '';
        const tags = raw
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        await saveTagsToBookmark(bookmarkId, tags);
      }
    }, 500) // Adjust debounce time as needed
  );

  async function toggleFavorite(bookmarkId) {
    const result = await chrome.storage.local.get(BOOKMARKS_KEY);
    const bookmarks = result[BOOKMARKS_KEY] || [];
    const i = bookmarks.findIndex((b) => b.id === bookmarkId);
    if (i === -1) return false;
    const newValue = !bookmarks[i].favorite;
    bookmarks[i].favorite = newValue;
    await chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarks });
    return newValue;
  }

  async function saveTagsToBookmark(bookmarkId, tags) {
    try {
      const result = await chrome.storage.local.get(BOOKMARKS_KEY);
      const bookmarks = result[BOOKMARKS_KEY] || [];
      const i = bookmarks.findIndex((b) => b.id === bookmarkId);
      if (i !== -1) {
        bookmarks[i].tags = tags;
        await chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarks });
        // Keep in-memory state in sync so we avoid a full reload
        const j = allBookmarks.findIndex((b) => b.id === bookmarkId);
        if (j !== -1) allBookmarks[j].tags = tags;
        try {
          renderTagChips();
        } catch {}
      }
    } catch (_e) {}
  }

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
  function isInteractive(el) {
    return (
      el === searchInput ||
      el?.tagName === 'TEXTAREA' ||
      el?.tagName === 'INPUT' ||
      el?.classList?.contains('tag-input')
    );
  }
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: small key-chord state machine */
  function handleChord(e) {
    window.__chord = window.__chord || { active: false, t: 0 };
    const now = Date.now();
    if (window.__chord.active && now - window.__chord.t > 1500)
      window.__chord.active = false;
    if (!window.__chord.active && (e.key === 'g' || e.key === 'G')) {
      window.__chord = { active: true, t: now };
      e.preventDefault();
      return true;
    }
    if (window.__chord.active && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      window.__chord.active = false;
      expandAllGroups();
      return true;
    }
    if (window.__chord.active && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      window.__chord.active = false;
      collapseAllGroups();
      return true;
    }
    return false;
  }
  function handleListKeys(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectBookmark(selectedBookmarkIndex + 1);
        return true;
      case 'ArrowUp':
        e.preventDefault();
        selectBookmark(selectedBookmarkIndex - 1);
        return true;
      case 'Enter':
        e.preventDefault();
        openSelectedBookmark();
        return true;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteSelectedBookmark();
        return true;
      case 'Escape':
        e.preventDefault();
        if (shortcutModal?.classList?.contains('show')) closeShortcutHelp();
        else {
          selectedBookmarkIndex = -1;
          updateSelection();
        }
        return true;
      case '/':
        e.preventDefault();
        if (e.shiftKey) openShortcutHelp();
        else searchInput.focus();
        return true;
      case '?':
        e.preventDefault();
        openShortcutHelp();
        return true;
      case 't':
      case 'T':
        e.preventDefault();
        if (selectedBookmarkIndex >= 0) {
          const card = bookmarkCards()[selectedBookmarkIndex];
          const input = card?.querySelector('.tag-input');
          if (input) {
            input.focus();
            const val = input.value;
            input.setSelectionRange(val.length, val.length);
          }
        }
        return true;
      default:
        return false;
    }
  }
  document.addEventListener('keydown', (e) => {
    if (isInteractive(document.activeElement)) return;
    if (bookmarkCards().length === 0) return;
    if (handleChord(e)) return;
    handleListKeys(e);
  });

  // Reset selection when bookmarks change
  const originalSortAndRender = sortAndRenderBookmarks;
  sortAndRenderBookmarks = function (...args) {
    originalSortAndRender.apply(this, args);
    selectedBookmarkIndex = -1;
    updateSelection();
  };
}); // Closing brace and parenthesis for DOMContentLoaded
