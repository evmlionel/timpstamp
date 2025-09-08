async function loadSettings() {
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

  const s = await loadSettings();
  shortcutEnabled.checked = s.shortcutEnabled;
  darkModeEnabled.checked = s.darkModeEnabled;
  multiTimestamps.checked = s.multiTimestamps;

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      await saveSettings({
        shortcutEnabled: shortcutEnabled.checked,
        darkModeEnabled: darkModeEnabled.checked,
        multiTimestamps: multiTimestamps.checked,
      });
      status.textContent = 'Saved.';
    } finally {
      saveBtn.disabled = false;
      setTimeout(() => (status.textContent = ''), 1200);
    }
  });
});

