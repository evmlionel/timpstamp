// Simple storage abstraction for settings and bookmarks

const BOOKMARKS_KEY = 'timpstamp_bookmarks';

export async function getSettings() {
  const result = await chrome.storage.local.get([
    'shortcutEnabled',
    'darkModeEnabled',
    'multiTimestamps',
  ]);
  return {
    shortcutEnabled: result.shortcutEnabled !== false,
    darkModeEnabled: !!result.darkModeEnabled,
    multiTimestamps: result.multiTimestamps !== false, // default true
  };
}

export async function setSettings(partial) {
  await chrome.storage.local.set(partial);
}

export async function getBookmarks() {
  const res = await chrome.storage.local.get(BOOKMARKS_KEY);
  const list = Array.isArray(res[BOOKMARKS_KEY]) ? res[BOOKMARKS_KEY] : [];
  return list.filter(
    (b) =>
      b && typeof b === 'object' && b.videoId && typeof b.timestamp === 'number'
  );
}

export async function saveBookmarks(list) {
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: list });
}

export async function addBookmark(rawBookmark) {
  const settings = await getSettings();
  const bookmarks = await getBookmarks();

  // Decide ID shape
  const id = settings.multiTimestamps
    ? `${rawBookmark.videoId}:${rawBookmark.timestamp}`
    : rawBookmark.videoId;

  const now = Date.now();
  const newEntry = {
    ...rawBookmark,
    id,
    createdAt: now,
    savedAt: now,
    notes: rawBookmark.notes || '',
  };

  if (settings.multiTimestamps) {
    const idx = bookmarks.findIndex((b) => b.id === id);
    if (idx >= 0) bookmarks[idx] = { ...bookmarks[idx], ...newEntry };
    else bookmarks.push(newEntry);
  } else {
    const idx = bookmarks.findIndex((b) => b.id === rawBookmark.videoId);
    if (idx >= 0) bookmarks[idx] = { ...bookmarks[idx], ...newEntry };
    else bookmarks.push(newEntry);
  }

  await saveBookmarks(bookmarks);
  return { id, multi: settings.multiTimestamps };
}

export async function deleteBookmark(id) {
  const bookmarks = await getBookmarks();
  const updated = bookmarks.filter((b) => b.id !== id);
  await saveBookmarks(updated);
}
