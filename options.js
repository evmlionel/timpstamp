async function loadSettings() {
  const result = await chrome.storage.local.get([
    'shortcutEnabled',
    'darkModeEnabled',
    'multiTimestamps',
    'overlayEnabled',
  ]);
  return {
    shortcutEnabled: result.shortcutEnabled !== false,
    darkModeEnabled: !!result.darkModeEnabled,
    multiTimestamps: result.multiTimestamps !== false, // default true
    overlayEnabled: result.overlayEnabled !== false, // default true
  };
}

async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

function $(id) {
  return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = $('saveBtn');
  const status = $('status');
  const shortcutEnabled = $('shortcutEnabled');
  const darkModeEnabled = $('darkModeEnabled');
  const multiTimestamps = $('multiTimestamps');
  const overlayEnabled = $('overlayEnabled');

  const s = await loadSettings();
  shortcutEnabled.checked = s.shortcutEnabled;
  darkModeEnabled.checked = s.darkModeEnabled;
  multiTimestamps.checked = s.multiTimestamps;
  overlayEnabled.checked = s.overlayEnabled;

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      await saveSettings({
        shortcutEnabled: shortcutEnabled.checked,
        darkModeEnabled: darkModeEnabled.checked,
        multiTimestamps: multiTimestamps.checked,
        overlayEnabled: overlayEnabled.checked,
      });
      status.textContent = 'Saved.';
    } finally {
      saveBtn.disabled = false;
      setTimeout(() => {
        status.textContent = '';
      }, 1200);
    }
  });
});
