// YouTube Timestamp Bookmarker Extension
console.log('Timpstamp Extension Loaded');

let currentVideoId = null;
let port = null;

// Connect to background script
function connectToBackground() {
  try {
    port = chrome.runtime.connect({ name: 'timpstamp' });
    console.log('Connected to background script');
  } catch (error) {
    console.error('Failed to connect to background:', error);
  }
}

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

    const formattedTime =
      hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const bookmark = {
      videoId,
      videoTitle: document.title.split(' - YouTube')[0].trim(),
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
          console.error('Failed to save bookmark:', chrome.runtime.lastError);
          showNotification('Failed to save timestamp ❌');
          // Try to reconnect
          connectToBackground();
          return;
        }

        if (response && response.success) {
          showNotification('Timestamp saved! 🎉');
        } else {
          showNotification('Failed to save timestamp ❌');
        }
      }
    );
  } catch (error) {
    console.error('Error saving timestamp:', error);
    showNotification('Failed to save timestamp ❌');
  }
}

// Show notification
function showNotification(message) {
  try {
    const existing = document.querySelector('.yt-timestamp-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'yt-timestamp-notification';
    notification.textContent = message;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--yt-spec-brand-background-primary, #0f0f0f);
            color: var(--yt-spec-text-primary, #fff);
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 999999;
            font-family: "YouTube Sans","Roboto",sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 32px rgba(0,0,0,0.4);
            border: 1px solid var(--yt-spec-10-percent-layer, #ffffff1a);
            pointer-events: none;
        `;

    document.body.appendChild(notification);
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Create bookmark button
function createButton() {
  const button = document.createElement('button');
  button.className = 'ytp-button timpstamp-btn';
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
    if (document.querySelector('.timpstamp-btn')) return;

    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    const button = createButton();
    rightControls.insertBefore(button, rightControls.firstChild);
    console.log('Bookmark button added');
  } catch (error) {
    console.error('Error adding bookmark button:', error);
  }
}

// Handle keyboard shortcut
function handleKeyPress(event) {
  try {
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
  } catch (error) {
    console.error('Error handling keyboard shortcut:', error);
  }
}

// Initialize extension
function initialize() {
  try {
    console.log('Initializing extension...');

    // Connect to background script
    connectToBackground();

    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId || videoId === currentVideoId) return;

    console.log('New video detected:', videoId);
    currentVideoId = videoId;

    const existingButton = document.querySelector('.timpstamp-btn');
    if (existingButton) {
      existingButton.remove();
    }

    addBookmarkButton();
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Set up observers and event listeners
try {
  // Watch for player changes
  const observer = new MutationObserver(() => {
    try {
      if (!document.querySelector('.timpstamp-btn')) {
        const controls = document.querySelector('.ytp-right-controls');
        if (controls) {
          addBookmarkButton();
        }
      }
    } catch (error) {
      console.error('Error in mutation observer:', error);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Add event listeners
  document.addEventListener('keydown', handleKeyPress, true);
  window.addEventListener('yt-navigate-finish', initialize);
  window.addEventListener('load', initialize);

  // Initial setup
  console.log('Running initial setup...');
  initialize();
} catch (error) {
  console.error('Error setting up extension:', error);
}
