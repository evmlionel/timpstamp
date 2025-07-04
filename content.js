let currentVideoId = null;
let shortcutEnabled = true; // Default to enabled, will be updated from storage

// Enhanced video element detection with multiple fallbacks
function findVideoElement() {
  const videoSelectors = [
    'video[src*="youtube"]',
    'video[src*="googlevideo"]',
    '.html5-video-container video',
    '.ytp-html5-video',
    'video',
  ];

  for (const selector of videoSelectors) {
    const video = document.querySelector(selector);
    if (video?.duration && !Number.isNaN(video.currentTime)) {
      return video;
    }
  }

  return null;
}

// Enhanced video ID extraction with multiple methods
function extractVideoId() {
  // Method 1: URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('v');
  if (videoId) return videoId;

  // Method 2: URL pathname for embedded videos
  const pathMatch = window.location.pathname.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  // Method 3: Meta tags
  const metaTags = [
    'meta[property="og:url"]',
    'meta[name="twitter:url"]',
    'link[rel="canonical"]',
  ];

  for (const selector of metaTags) {
    const element = document.querySelector(selector);
    if (element) {
      const url =
        element.getAttribute('content') || element.getAttribute('href');
      if (url) {
        const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
      }
    }
  }

  return null;
}

// Enhanced video title extraction with comprehensive fallbacks
function extractVideoTitle() {
  const titleSelectors = [
    // Primary YouTube selectors (most specific first)
    'h1.ytd-watch-metadata yt-formatted-string#title',
    'h1.title.ytd-video-primary-info-renderer yt-formatted-string',
    '#container > h1.title > yt-formatted-string',
    'h1.ytd-video-primary-info-renderer .ytd-video-primary-info-renderer',

    // Alternative selectors for different YouTube layouts
    '.ytd-video-primary-info-renderer h1',
    '.watch-main-col h1',
    '#watch-headline-title',
    '#eow-title',

    // Generic fallbacks
    'h1[class*="title"]',
    'h1[id*="title"]',
    '.title h1',
    'h1',
  ];

  // Try each selector
  for (const selector of titleSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        const title = element.textContent.trim();
        if (title.length > 0 && title !== 'YouTube') {
          return title;
        }
      }
    } catch (_error) {}
  }

  // Meta tag fallbacks
  const metaSelectors = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
  ];

  for (const selector of metaSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element?.getAttribute('content')?.trim()) {
        const title = element.getAttribute('content').trim();
        if (title.length > 0 && !title.includes('YouTube')) {
          return title;
        }
      }
    } catch (_error) {}
  }

  // Document title fallback
  try {
    if (document.title) {
      let title = document.title;

      // Remove YouTube suffix
      const suffixes = [' - YouTube', ' - YouTube TV', ' | YouTube'];
      for (const suffix of suffixes) {
        if (title.endsWith(suffix)) {
          title = title.substring(0, title.length - suffix.length);
          break;
        }
      }

      title = title.trim();
      if (title.length > 0) {
        return title;
      }
    }
  } catch (_error) {
    // Ignore document.title errors
  }

  return 'Unknown Title';
}

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

// Enhanced timestamp saving with retry logic and better error handling
function saveTimestamp(retryCount = 0) {
  const maxRetries = 3;

  try {
    // Enhanced video detection with multiple fallbacks
    const video = findVideoElement();
    if (!video) {
      if (retryCount < maxRetries) {
        setTimeout(() => saveTimestamp(retryCount + 1), 500);
        return;
      }
      showNotification('Error: Video player not found');
      return;
    }

    // Enhanced video ID extraction with fallbacks
    const videoId = extractVideoId();
    if (!videoId) {
      showNotification('Error: Cannot identify video');
      return;
    }

    // Validate video time
    const currentTime = Math.floor(video.currentTime);
    if (Number.isNaN(currentTime) || currentTime < 0) {
      showNotification('Error: Invalid video time');
      return;
    }

    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = currentTime % 60;

    // Enhanced title extraction with multiple selectors and fallbacks
    const videoTitle = extractVideoTitle();

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

    // Enhanced message sending with timeout handling
    const messageTimeout = setTimeout(() => {
      showNotification('Request timed out. Please try again.');
    }, 10000);

    chrome.runtime.sendMessage(
      {
        type: 'ADD_BOOKMARK',
        data: bookmark,
      },
      (response) => {
        clearTimeout(messageTimeout);

        if (chrome.runtime.lastError) {
          if (retryCount < maxRetries) {
            setTimeout(() => saveTimestamp(retryCount + 1), 1000);
            return;
          }
          showNotification('Extension unavailable. Please refresh the page.');
          return;
        }

        if (response?.success) {
          showNotification(response.message || 'Timestamp saved! 🎉');
        } else {
          showNotification(
            response?.error || 'Failed to save timestamp. Please try again.'
          );
        }
      }
    );
  } catch (_error) {
    if (retryCount < maxRetries) {
      setTimeout(() => saveTimestamp(retryCount + 1), 1000);
      return;
    }
    showNotification('Unexpected error. Please refresh the page.');
  }
}

// Announce message to screen readers
function announceToScreenReader(message) {
  try {
    // Remove existing announcements
    const existing = document.querySelectorAll('.ytb-sr-announcement');
    existing.forEach((el) => el.remove());

    // Create new announcement
    const announcement = document.createElement('div');
    announcement.className = 'ytb-sr-announcement';
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText =
      'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.remove();
      }
    }, 5000);
  } catch (_error) {
    // Ignore errors in screen reader announcements
  }
}

// Enhanced notification with accessibility features
function showNotification(message) {
  try {
    const existing = document.querySelector('.ytb-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'ytb-notification';
    notification.textContent = message;

    // Enhanced accessibility attributes
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.setAttribute('aria-atomic', 'true');
    notification.setAttribute('aria-label', message);

    // High contrast support
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 10000;
      max-width: 300px;
      border: 2px solid transparent;
    `;

    // High contrast mode detection and enhancement
    if (window.matchMedia?.('(prefers-contrast: high)').matches) {
      notification.style.border = '2px solid white';
      notification.style.background = 'black';
    }

    document.body.appendChild(notification);

    // Also announce to screen readers
    announceToScreenReader(message);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  } catch (_error) {}
}

// Create bookmark button with enhanced accessibility
function createButton() {
  const button = document.createElement('button');
  button.className = 'ytp-button ytb-bookmark-btn';
  button.title = 'Save timestamp (B)';

  // Enhanced ARIA attributes for accessibility
  button.setAttribute(
    'aria-label',
    'Save timestamp bookmark at current video position'
  );
  button.setAttribute('aria-describedby', 'ytb-bookmark-help');
  button.setAttribute('aria-keyshortcuts', 'b');
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');

  button.innerHTML = `
        <svg height="100%" version="1.1" viewBox="0 0 24 24" width="100%" aria-hidden="true">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
        </svg>
    `;

  // Enhanced click handler with accessibility considerations
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveTimestamp();

    // Announce to screen readers
    announceToScreenReader('Saving timestamp...');
  });

  // Enhanced keyboard navigation support
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      saveTimestamp();
      announceToScreenReader('Saving timestamp...');
    }
  });

  // Create hidden help text for screen readers
  const helpText = document.createElement('div');
  helpText.id = 'ytb-bookmark-help';
  helpText.className = 'sr-only';
  helpText.textContent =
    'Press to save the current video position as a bookmark. You can also use the B key as a shortcut.';
  helpText.style.cssText =
    'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';

  document.body.appendChild(helpText);

  return button;
}

// Enhanced button injection with multiple fallback strategies
function addBookmarkButton(retryCount = 0) {
  const maxRetries = 10;
  const retryDelay = 500;

  try {
    // Check if button already exists
    if (document.querySelector('.ytb-bookmark-btn')) return true;

    // Try multiple control container selectors
    const controlSelectors = [
      '.ytp-right-controls',
      '.ytp-chrome-controls .ytp-right-controls',
      '.ytp-chrome-bottom .ytp-right-controls',
      '.html5-video-controls .ytp-right-controls',
    ];

    let rightControls = null;
    for (const selector of controlSelectors) {
      rightControls = document.querySelector(selector);
      if (rightControls) break;
    }

    if (!rightControls) {
      if (retryCount < maxRetries) {
        setTimeout(() => addBookmarkButton(retryCount + 1), retryDelay);
        return false;
      }
      return false;
    }

    const button = createButton();

    // Try different insertion strategies
    try {
      rightControls.insertBefore(button, rightControls.firstChild);
    } catch {
      try {
        rightControls.appendChild(button);
      } catch {
        return false;
      }
    }

    return true;
  } catch (_error) {
    if (retryCount < maxRetries) {
      setTimeout(() => addBookmarkButton(retryCount + 1), retryDelay);
      return false;
    }
    return false;
  }
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

// Enhanced initialization with better state management
function initialize(retryCount = 0) {
  const maxRetries = 5;

  try {
    // Load initial shortcut setting
    loadShortcutSetting();

    // Enhanced video ID detection
    const videoId = extractVideoId();
    if (!videoId) {
      if (retryCount < maxRetries) {
        setTimeout(() => initialize(retryCount + 1), 1000);
      }
      return;
    }

    // Only reinitialize if video changed
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;

    // Clean up existing button
    const existingButton = document.querySelector('.ytb-bookmark-btn');
    if (existingButton) {
      existingButton.remove();
    }

    // Add button with retry logic
    const buttonAdded = addBookmarkButton();
    if (!buttonAdded && retryCount < maxRetries) {
      setTimeout(() => initialize(retryCount + 1), 1000);
    }
  } catch (_error) {
    if (retryCount < maxRetries) {
      setTimeout(() => initialize(retryCount + 1), 1000);
    }
  }
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
