# YouTube Timestamp Bookmarker

A Chrome extension that enhances your YouTube watching experience by letting you save and manage video timestamps with ease. Perfect for students, researchers, content creators, or anyone who needs to reference specific moments in YouTube videos.

## 🔄 Changelog

v1.1
- Switched storage from `chrome.storage.sync` to `chrome.storage.local` to avoid strict sync quotas and enable thousands of bookmarks.
- One‑time migration copies existing sync data to local on update.
- Minor robustness improvements to background worker.

## ✨ Features

- 🎯 **Quick Bookmark Button**: Integrated bookmark button in YouTube's video player controls
- ⌨️ **Keyboard Shortcut**: Press 'B' to instantly save timestamps (can be disabled in settings)
- 📋 **Clean Interface**: Intuitive popup interface to manage all your bookmarks
- 🔍 **Smart Search**: Quickly find bookmarks by searching video titles
- 🗂️ **Sorting Options**: Sort bookmarks by newest, oldest, or title
- 🖼️ **Rich Preview**: Video thumbnails and titles for easy reference
- 🔗 **Direct Links**: One-click access to saved timestamps
- 🗑️ **Easy Management**: Delete individual bookmarks or clear all at once
- 💫 **Visual Feedback**: Smooth animations and notifications for all actions

## 🚀 Installation

1. Install from the [Chrome Web Store](link-to-store)
2. The bookmark button (🔖) will appear in YouTube's video player controls
3. Click the button or press 'B' to save timestamps while watching

## 💡 Usage

### Saving Timestamps
- Click the bookmark icon (🔖) in the video player
- Press 'B' on your keyboard (unless disabled)
- A confirmation notification will appear when saved

### Managing Bookmarks
1. Click the extension icon in your Chrome toolbar
2. View all your saved timestamps
3. Search bookmarks using the search bar
4. Sort using the dropdown menu
5. Click timestamps to jump to that moment
6. Delete individual bookmarks or use "Clear All"

### Settings
- Toggle keyboard shortcut (B) on/off
- Settings persist across browser sessions

## 🛠️ Development

### Prerequisites
- Node.js (v18+ recommended)
- Bun package manager (1.2.21)

### Setup
- Install deps: `bun install`
- Run tests: `bun run test` (or `bun run test:run` for CI mode)
- Lint/format check: `bun run check`
- Auto-fix: `bun run check:fix` (or `bun run format:fix`, `bun run lint:fix`)

### Git Hooks
- Hooks live in `.githooks/`. Enable them once per clone:
  - `git config core.hooksPath .githooks`
- Pre-commit runs Biome on staged files and writes fixes.
