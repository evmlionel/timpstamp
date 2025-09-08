# Next Steps – YouTube Timestamp Bookmarker

This document tracks the agreed next steps and backlog for improving the
extension. It complements `specs/DEVELOPMENT_ROADMAP.md` and focuses on
upcoming, user‑visible work items.

Last updated: 2025-09-08

## Goals
- Make the popup manager frictionless for large collections
- Keep the in‑player overlay lightweight, discoverable, and optional
- Maintain reliability (Brave/Chromium quirks), performance, and privacy

## High‑Priority (Next)
- [x] Overlay: persistent toggle and affordance
  - [x] Add a small header toggle to enable/disable overlay globally
  - [x] Optional mini “reopen” button (FAB) when overlay is hidden
  - [x] Persist minimized/hidden state per user
  - Acceptance: user can hide/show overlay without Options page
- [ ] Virtualized list in popup
  - [ ] Replace current pagination with virtualization (windowed rows)
  - [ ] Maintain grouping by video and smooth scrolling
  - Acceptance: lists feel fast with 5k+ timestamps
- [ ] Tag chips — global filters
  - [ ] Show top tags above list with counts
  - [ ] Click to add/remove filters; show active filters
  - [ ] “Clear filters” resets search + favorites + tags
  - Acceptance: user can filter down to a subset in 1–2 clicks

## Medium Priority
- [ ] Data model and storage
  - [ ] Schema version and migrations (v2: minimal fields enforced)
  - [ ] Optional IndexedDB backend behind storage module
  - [ ] Bulk operations operate as deltas (no full array rewrites)
- [ ] Popup polish
  - [ ] Compact mode (title + time only)
  - [ ] Copy actions: title, time, URL variants (Markdown/CSV)
  - [ ] Channel avatar (when cheap to fetch/derive) with fallback
  - [ ] Remember group expansion per video (done) — add “Expand all/Collapse all”
- [ ] Keyboard + a11y
  - [ ] Roving tabindex across items; star/delete accessible by keyboard
  - [ ] Screen reader labels for tags and actions
  - [ ] Focus management after deletes/undo

## Low Priority / Nice‑to‑Have
- [ ] Import/export enhancements
  - [ ] Deduplicate across multi‑timestamp records
  - [ ] Export selected → Markdown/CSV templates
- [ ] Analytics (local, optional)
  - [ ] Per‑user stats (e.g., most used tags, most pinned videos)
  - [ ] Never send network requests (local only)

## Reliability / Cross‑Browser
- [ ] Storage wrappers everywhere (done in popup) — extend to background if needed
- [ ] Guard against Promise‑less storage on older Chromium builds
- [ ] CSP‑safe images (thumbnails) — fall back to `hqdefault.jpg` if needed

## Testing
- [ ] Unit tests
  - [ ] Popup: favorites UI state (pressed overrides hover)
  - [ ] Overlay: minimize/hide state persistence
  - [ ] Tag chips: add/remove, backspace behavior
- [ ] E2E (optional)
  - [ ] Puppeteer/Playwright script to save timestamps and validate popup
  - [ ] Brave run to validate storage + CSP quirks

## Release Checklist (next release)
- [ ] Version bump to 1.2.x in `manifest.json`
- [ ] Update `README.md` with overlay toggle and tag chips
- [ ] Add release notes (CHANGELOG excerpt)
- [ ] Manual test on: Chrome, Brave; YouTube and Music

## Notes / Decisions
- Multi‑timestamps mode is default ON; per‑video replacement remains available via Options
- Store minimal fields; derive URL/formatted time on render
- Keep permissions tight; no external network calls

---

## Completed in this working session (recap)
- Switched to `chrome.storage.local` and added one‑time migration
- Removed 50‑item cap; soft trim near local quota
- Options page: dark mode, B shortcut, multi‑timestamps, overlay toggle
- Popup UX:
  - Grouped by video, pinned videos, remembered expansion state
  - Favorites filter (moved to the right), instant star feedback
  - Thumbnails fixed for Brave; copy title+time action
  - Chip‑style tags with inline add/remove; “Clear filters” pill
- Overlay UX:
  - Draggable with persisted position, minimize/expand with persistence
- Brave/Chromium resilience: callback‑based storage wrappers in popup
- Tests updated to `storage.local`; all tests passing

---

If you add or change scope, update this file so we can pick up exactly
where we left off.
