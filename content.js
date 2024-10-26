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

  // Remove after animation
  setTimeout(() => {
    document.body.removeChild(notification)
  }, 2000)
}

// Function to add the bookmark button
function addBookmarkButton() {
  // Look for the right controls container
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
    bookmarkBtn.title = 'Save timestamp (B)'

    // Match YouTube's native button styling
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

    // Add hover effects
    bookmarkBtn.onmouseover = () => (bookmarkBtn.style.opacity = '1')
    bookmarkBtn.onmouseout = () => (bookmarkBtn.style.opacity = '0.9')
    bookmarkBtn.onclick = () => {
      saveTimestamp()
      showSaveConfirmation()

      // Add click animation
      bookmarkBtn.style.transform = 'scale(1.2)'
      setTimeout(() => {
        bookmarkBtn.style.transform = 'scale(1)'
      }, 200)
    }

    // Insert before the settings button
    const settingsBtn = rightControls.querySelector('.ytp-settings-button')
    rightControls.insertBefore(bookmarkBtn, settingsBtn)
    buttonAdded = true
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

// Watch for player initialization
const initializeExtension = () => {
  if (document.querySelector('.ytp-right-controls')) {
    addBookmarkButton()
  }
}

// Reset on navigation
const resetButton = () => {
  buttonAdded = false
  initializeExtension()
}

// Event listeners for page changes
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

// Initial check
initializeExtension()

// Listen for keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Only trigger if typing in an input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.key.toLowerCase() === 'b') {
    chrome.storage.local.get(['shortcutEnabled'], (result) => {
      if (result.shortcutEnabled !== false) {
        // Default to enabled
        saveTimestamp()
        showSaveConfirmation()
      }
    })
  }
})

function saveTimestamp() {
  const video = document.querySelector('video')
  const timestamp = Math.floor(video.currentTime)
  const videoTitle = document.querySelector('#title h1')?.textContent?.trim()
  const currentUrl = window.location.href.split('&t=')[0]
  const videoId = new URLSearchParams(window.location.search).get('v')

  const bookmark = {
    videoId,
    videoTitle: videoTitle || 'Untitled Video',
    timestamp,
    url: `${currentUrl}&t=${timestamp}s`,
    created: new Date().toISOString(),
  }

  chrome.storage.local.get(['bookmarks'], (result) => {
    const bookmarks = result.bookmarks || []

    // Find index of existing bookmark for this video
    const existingIndex = bookmarks.findIndex((b) => b.videoId === videoId)

    if (existingIndex !== -1) {
      // Update existing bookmark
      bookmarks[existingIndex] = bookmark
    } else {
      // Add new bookmark
      bookmarks.push(bookmark)
    }

    chrome.storage.local.set({ bookmarks }, () => {
      showSaveConfirmation()

      // Visual feedback on button
      const btn = document.querySelector('.ytp-bookmark-button')
      if (btn) {
        btn.style.transform = 'scale(1.2)'
        setTimeout(() => {
          btn.style.transform = 'scale(1)'
        }, 200)
      }
    })
  })
}
