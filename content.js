// Keep track of button state
let buttonAdded = false

// Function to show save confirmation
function showSaveConfirmation() {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 9999;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    pointer-events: none;
    animation: fadeInOut 2s ease-in-out;
  `
  notification.textContent = '✓ Timestamp saved'
  document.body.appendChild(notification)

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 2000)
}

// Function to show notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${
      type === 'success' ? 'rgba(22, 163, 74, 0.9)' : 'rgba(220, 38, 38, 0.9)'
    };
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 9999;
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    pointer-events: none;
    animation: fadeInOut 2s ease-in-out;
    display: flex;
    align-items: center;
    gap: 8px;
  `

  notification.innerHTML = `
    ${type === 'success' ? '✓' : '✕'} ${message}
  `

  document.body.appendChild(notification)

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 2000)
}

// Function to save timestamp
function saveTimestamp() {
  const video = document.querySelector('video')
  if (!video) return

  const videoId = window.location.href.match(/[?&]v=([^&]+)/)?.[1]
  const videoTitle = document.querySelector('.ytp-title-link')?.textContent

  if (!videoId || !videoTitle) {
    showNotification('Could not save bookmark', 'error')
    return
  }

  const timestamp = Math.floor(video.currentTime)
  const url = `${window.location.href}&t=${timestamp}s`

  const bookmark = {
    videoId,
    videoTitle,
    timestamp,
    url,
    savedAt: Date.now(),
  }

  chrome.runtime.sendMessage(
    { type: 'SAVE_BOOKMARK', bookmark },
    (response) => {
      if (response?.success) {
        showNotification('Bookmark saved!')
      } else {
        showNotification('Failed to save bookmark', 'error')
      }
    }
  )
}

// Function to add the bookmark button
function addBookmarkButton() {
  try {
    const rightControls = document.querySelector('.ytp-right-controls')
    const existingBtn = document.querySelector('.ytp-bookmark-button')

    if (rightControls && !existingBtn && !buttonAdded) {
      const bookmarkBtn = document.createElement('button')
      bookmarkBtn.className = 'ytp-button ytp-bookmark-button'
      bookmarkBtn.innerHTML = `
        <svg height="100%" version="1.1" viewBox="0 0 24 24" width="100%">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="currentColor"/>
        </svg>
      `
      bookmarkBtn.title = 'Save timestamp (Alt+B)'
      bookmarkBtn.style.cssText = `
        opacity: 0.9;
        width: 48px;
        height: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0 8px;
      `

      bookmarkBtn.onmouseover = () => (bookmarkBtn.style.opacity = '1')
      bookmarkBtn.onmouseout = () => (bookmarkBtn.style.opacity = '0.9')
      bookmarkBtn.onclick = () => {
        saveTimestamp()
        bookmarkBtn.style.transform = 'scale(1.2)'
        setTimeout(() => {
          bookmarkBtn.style.transform = 'scale(1)'
        }, 200)
      }

      const settingsBtn = rightControls.querySelector('.ytp-settings-button')
      if (settingsBtn) {
        rightControls.insertBefore(bookmarkBtn, settingsBtn)
        buttonAdded = true
      }
    }
  } catch (error) {
    console.log('Error in addBookmarkButton:', error)
  }
}

// Add CSS for notification animation
const style = document.createElement('style')
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, 20px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    85% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -20px); }
  }
`
document.head.appendChild(style)

// Initialize extension
function initializeExtension() {
  try {
    if (document.querySelector('.ytp-right-controls')) {
      addBookmarkButton()
    }
  } catch (error) {
    console.log('Error in initializeExtension:', error)
  }
}

// Reset button state
function resetButton() {
  buttonAdded = false
  initializeExtension()
}

// Event listeners
document.addEventListener('yt-navigate-finish', resetButton)
window.addEventListener('load', initializeExtension)

// MutationObserver for dynamic content
const observer = new MutationObserver(() => {
  if (document.querySelector('.ytp-right-controls') && !buttonAdded) {
    initializeExtension()
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// Keyboard shortcut listener
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.altKey && e.key.toLowerCase() === 'b') {
    e.preventDefault(); // Prevent any default Alt+B behavior
    chrome.storage.local.get(['shortcutEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.log(
          'Error checking shortcut setting:',
          chrome.runtime.lastError
        )
        return
      }

      if (result.shortcutEnabled !== false) {
        saveTimestamp()
      }
    })
  }
})

// Initial check
initializeExtension()
