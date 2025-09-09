# Next Steps – YouTube Timestamp Bookmarker

This document tracks the agreed next steps and backlog for improving the
extension. It complements `specs/DEVELOPMENT_ROADMAP.md` and focuses on
upcoming, user‑visible work items.

Last updated: 2025-09-09

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
  - [x] Replace pagination with chunked group virtualization + infinite scroll
  - [x] Incremental rendering inside large groups (chunked load + sentinel)
- [x] True windowing (unmount off‑screen items) for very large groups
- [x] Perf test with 5k+ timestamps; tune chunk size and thresholds
  - Results (jsdom synthetic):
    - Largest group in sample: 200 items
    - Naive render 200: ~11ms; chunked 200: ~8ms
    - Virtualized overscan 10: ~0.9ms init, ~0.9ms update (19–29 nodes)
    - Virtualized overscan 20: ~0.8–1.4ms (29–49 nodes) — smoother margin
  - Decisions:
    - GROUP_ITEMS_CHUNK_SIZE = 80
    - VIRTUALIZE_THRESHOLD = 200
    - VIRTUAL_OVERSCAN = 20
  - Acceptance: lists feel fast with 5k+ timestamps
- [x] Tag chips — global filters
  - [x] Show top tags above list with counts
  - [x] Click to add/remove filters; show active filters
  - [x] “Clear filters” resets search + favorites + tags
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

## Tooling
- [x] Package manager declaration in `package.json` (`packageManager: bun@1.2.21`)
- [x] Pre‑commit hook: Biome check on changed files (added under `.githooks/`)
- [x] CI: GitHub Actions (bun install, Biome check, Vitest run)
- [x] README: document bun usage and common dev scripts

## Testing
- [ ] Unit tests
  - [x] Popup: favorites UI state (pressed overrides hover)
  - [ ] Overlay: minimize/hide state persistence
  - [x] Tag chips: filter toggle + clear behavior
  - [x] Tag chips: backspace behavior in input
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
  - Global tag chips with counts + click‑to‑filter (top bar)
  - Chunked group virtualization with infinite scroll (replaces pagination)
- Overlay UX:
  - Draggable with persisted position, minimize/expand with persistence
- Brave/Chromium resilience: callback‑based storage wrappers in popup
- Tests updated to `storage.local`; all tests passing

---

If you add or change scope, update this file so we can pick up exactly
where we left off.
