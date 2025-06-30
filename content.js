let currentVideoId = null;
let shortcutEnabled = true; // Default to enabled, will be updated from storage

// Function to load initial shortcut setting
function loadShortcutSetting() {
  chrome.storage.sync.get('shortcutEnabled', (result) => {
    shortcutEnabled = result.shortcutEnabled !== false; // Default true if undefined
  });
}

// Listen for changes in storage (e.g., when changed via popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.shortcutEnabled) {
    shortcutEnabled = changes.shortcutEnabled.newValue !== false;
  }
});

// Save timestamp
function saveTimestamp() {
  try {
    const video = document.querySelector('video');
    if (!video) {
      showNotification('Error: Video not found');
      return;
    }

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) {
      showNotification('Error: Video ID not found');
      return;
    }

    const currentTime = Math.floor(video.currentTime);
    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = currentTime % 60;

    // More robust title extraction
    let videoTitle = 'Unknown Title';
    const titleElement = document.querySelector(
      'h1.ytd-watch-metadata yt-formatted-string#title, ' + // Refined primary selector
        'h1.title.ytd-video-primary-info-renderer yt-formatted-string, ' + // Refined secondary selector
        '#container > h1.title > yt-formatted-string' // Common alternative structure
    );
    if (titleElement?.textContent) {
      videoTitle = titleElement.textContent.trim();
    } else {
      // Fallback to document title if specific element not found
      if (document.title.endsWith(' - YouTube')) {
        videoTitle = document.title
          .substring(0, document.title.length - ' - YouTube'.length)
          .trim();
      } else {
        videoTitle = document.title.trim(); // Use the full title if it doesn't end as expected
      }
    }

    const formattedTime =
      hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const bookmark = {
      videoId,
      videoTitle: videoTitle,
      timestamp: currentTime,
      formattedTime,
      url: `https://youtube.com/watch?v=${videoId}&t=${currentTime}s`,
      savedAt: Date.now(),
    };

    chrome.runtime.sendMessage(
      {
        type: 'ADD_BOOKMARK',
        data: bookmark,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showNotification('Failed to save timestamp ❌');
          return;
        }

        if (response?.success) {
          showNotification(response.message || 'Timestamp saved! 🎉');
        } else {
          showNotification(
            response?.error ? response.error : 'Failed to save timestamp ❌'
          );
        }
      }
    );
  } catch (_error) {
    showNotification('Failed to save timestamp ❌');
  }
}

// Show notification
function showNotification(message) {
  try {
    const existing = document.querySelector('.ytb-notification'); // Use new class
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'ytb-notification'; // Use new class
    notification.textContent = message;
    // Styles are now applied via content.css

    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  } catch (_error) {}
}

// Create bookmark button
function createButton() {
  const button = document.createElement('button');
  button.className = 'ytp-button ytb-bookmark-btn'; // Use new class
  button.title = 'Save timestamp (B)';
  button.innerHTML = `
        <svg height="100%" version="1.1" viewBox="0 0 24 24" width="100%">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
        </svg>
    `;

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveTimestamp();
  });

  return button;
}

// Add bookmark button to player
function addBookmarkButton() {
  try {
    if (document.querySelector('.ytb-bookmark-btn')) return;

    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    const button = createButton();
    rightControls.insertBefore(button, rightControls.firstChild);
  } catch (_error) {}
}

// Handle keyboard shortcut
function handleKeyPress(event) {
  try {
    // Check if shortcut is enabled
    if (!shortcutEnabled) return;

    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    ) {
      return;
    }

    if (
      event.key.toLowerCase() === 'b' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      saveTimestamp();
    }
  } catch (_error) {}
}

// Initialize extension
function initialize() {
  try {
    // Load initial shortcut setting
    loadShortcutSetting();

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId || videoId === currentVideoId) return;
    currentVideoId = videoId;

    const existingButton = document.querySelector('.ytb-bookmark-btn');
    if (existingButton) {
      existingButton.remove();
    }

    addBookmarkButton();
  } catch (_error) {}
}

// Set up observers and event listeners
try {
  // Watch for player changes
  const observer = new MutationObserver(() => {
    try {
      if (!document.querySelector('.ytb-bookmark-btn')) {
        const controls = document.querySelector('.ytp-right-controls');
        if (controls) {
          addBookmarkButton();
        }
      }
    } catch (_error) {}
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Add event listeners
  document.addEventListener('keydown', handleKeyPress, true);
  window.addEventListener('yt-navigate-finish', initialize);
  window.addEventListener('load', initialize);
  initialize();
} catch (_error) {}
