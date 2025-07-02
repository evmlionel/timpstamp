# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "YouTube Timestamp Bookmarker" that allows users to save and manage YouTube video timestamps. The extension integrates directly into YouTube's video player controls and provides a popup interface for managing saved bookmarks.

## Essential Commands

### Linting and Formatting
```bash
# Run lint checks
npm run lint

# Fix lint issues automatically  
npm run lint:fix

# Format code
npm run format

# Format code and fix automatically
npm run format:fix

# Run all checks (lint + format)
npm run check

# Fix all issues automatically
npm run check:fix

# Testing
npm test        # Run tests in watch mode
npm run test:run # Run tests once
npm run test:ui  # Run tests with UI
```

### Development
- Use `bun` as the package manager (bun.lockb exists)
- No build process required - this is a vanilla JavaScript Chrome extension
- Testing framework: Vitest with jsdom for DOM testing and Chrome API mocks

## Architecture

### Core Files Structure
- `manifest.json` - Manifest V3 Chrome extension configuration
- `background.js` - Service worker that handles bookmark storage operations
- `content.js` - Content script injected into YouTube pages
- `popup.js` - Popup interface for managing bookmarks
- `src/utils.js` - Shared utility functions (ES6 modules)

### Key Components

#### Storage Architecture
- Uses Chrome's `chrome.storage.sync` API
- Single storage key: `timpstamp_bookmarks` contains an array of all bookmarks
- Each bookmark has structure: `{id, videoId, videoTitle, timestamp, formattedTime, url, createdAt, savedAt, notes}`
- Bookmark ID is the YouTube video ID for uniqueness
- Supports undo functionality for deletions

#### Content Script Integration
- Dynamically injects a bookmark button into YouTube's video player controls  
- Uses class `ytp-button ytb-bookmark-btn` for styling consistency
- Keyboard shortcut 'B' key (can be toggled on/off)
- Listens for YouTube's SPA navigation via `yt-navigate-finish` event

#### Background Service Worker
- Handles all storage operations (add, delete, clear all bookmarks)
- Implements keep-alive mechanism using `chrome.alarms` API
- Message-based communication with content script and popup

#### Popup Interface
- Real-time search and sorting of bookmarks
- Notes editing with auto-save functionality  
- Undo functionality for bookmark deletions
- Thumbnail loading with error handling

### Code Style
- Uses Biome for linting and formatting (configured in `biome.json`)
- 2-space indentation, single quotes, semicolons required
- ES6 modules for utilities, regular scripts for extension files
- Chrome extension globals pre-configured in biome.json

### Key Technical Details
- Manifest V3 service worker architecture
- Direct storage approach (no chunking) for bookmark data
- MutationObserver for detecting YouTube player changes
- Debounced search and auto-save functionality
- Error handling for thumbnail loading failures
- YouTube video ID extraction from URL parameters

### Error Handling Strategy
- **Storage Operations**: Functions throw specific errors with descriptive messages rather than logging
- **Quota Management**: Storage operations check quota before saving and throw detailed quota exceeded errors
- **User Feedback**: Errors are caught at the UI level and converted to user-friendly notifications
- **No Console Logging**: Production code avoids console.* methods to maintain clean browser console
- **Graceful Degradation**: UI components handle missing data and API failures without breaking
- **Error Propagation**: Lower-level functions throw errors; higher-level functions handle them appropriately