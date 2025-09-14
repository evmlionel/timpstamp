# Next Steps – YouTube Timestamp Bookmarker

This document tracks the agreed next steps and backlog for improving the
extension. It complements `specs/DEVELOPMENT_ROADMAP.md` and focuses on
upcoming, user‑visible work items.

Last updated: 2025-09-14

## Goals
- Align popup UX with specs/UI_IMPROVEMENTS.md (keyboard‑first, progressive disclosure)
- Keep UI simple: favorites star as the only emphasis, no pinning
- Make the popup manager frictionless for large collections
- Keep the in‑player overlay lightweight, discoverable, and optional
- Maintain reliability (Brave/Chromium quirks), performance, and privacy

## High‑Priority (Next)
- Popup header simplification (specs/UI_IMPROVEMENTS.md §2)
  - Keep star button as global Favorites‑only filter in header (no pinning)
  - Left: title (resets filters); Center: search; Right: Sort ▾, Favorites‑only, Import/Export, Settings
  - Counts: “N videos · M timestamps” in header meta
  - Acceptance: one‑tap Favorites‑only; “/” focuses search; Clear resets search+favorites+tags
- Card polish with progressive disclosure (§3–4)
  - Collapsed card: title, channel, tag chips, timestamp count
  - Expanded card: timestamp list with open/copy/edit; subtle meta; reduce duplication
  - Acceptance: scan‑friendly collapsed cards; expanded card returns focus predictably
- Expandable timestamps + inline actions (§4)
  - Enter/Click to expand; per‑timestamp actions: Open, Copy URL, Copy MD; inline edit; Undo for delete
  - Acceptance: Enter → expand; “Copied” toast; Delete → Undo works
- Keyboard‑first + visible focus (§1, §9)
  - “/” focus search; Arrow keys navigate list; Enter activates; “t” open tag editor; “?” shows cheatsheet
  - Roving tabindex and consistent focus rings; Esc clears search/collapses
  - Acceptance: 100% functionality by keyboard with visible focus
- Toasts + empty/first‑run states (§7, §11)
  - aria‑live polite toasts for Copy/Delete‑Undo; helpful empty states; first‑run 3‑tip panel
- Tags as chips + token input (§6)
  - “+ Tag” chip opens token input w/ autocomplete; click chip filters; optional AND/OR later if needed
- A11y semantics (§9)
  - `aria-pressed` on favorite, `aria-expanded` on card, list/listitem roles, toasts as `aria-live="polite"`
- Performance + search polish (§12)
  - Virtualized/windowed list for large sets; diacritic‑insensitive search; 120 ms debounce; precompute lowercase fields

## Medium Priority
- Settings (Options) alignment (§10)
  - Theme toggle; default sort; confirm before delete; open links in new tab
  - Hotkeys list and edit; platform‑aware labels
  - Data: Export All (JSON/CSV); Import (merge + dedupe by `videoId+seconds`); banner when sync quota exceeded
- Popup polish
  - Compact mode (title + time only)
  - Channel avatar (cheap derive) with fallback
  - “Expand all / Collapse all” control
- Data model and storage
  - Schema version and minimal fields
  - Optional IndexedDB backend behind storage adapter; bulk ops as deltas

## Low Priority / Nice‑to‑Have
- Import/export enhancements
  - Deduplicate across multi‑timestamp records
  - Export selected → Markdown/CSV templates
- Analytics (local, optional)
  - Per‑user stats (e.g., most used tags, most pinned videos)
  - Never send network requests (local only)

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
  - [ ] Popup: pinned UI state (pressed overrides hover) + migration from favorites
  - [ ] Keyboard map: '/', Enter, Arrow, p, t, ?, Esc behaviors
  - [ ] Toasts: Copy/Pin/Delete‑Undo announcements (`aria-live`)
  - [ ] Tag chips: add/remove + global filter bar + clear
  - [ ] Search: diacritic‑insensitive, 120 ms debounce
  - [ ] Overlay: minimize/hide state persistence
- [ ] E2E (optional)
  - [ ] Playwright script: save timestamps, filter/pin, keyboard‑only flows
  - [ ] Brave run to validate storage + CSP quirks

## Acceptance Criteria (UI/UX)
- Popup interactive in < 300 ms with ~1k items (virtualized)
- 100% functionality via keyboard; consistent visible focus
- Search + filters update as you type; favorites filter persists predictably
- All destructive actions are undoable
- Dark/light theme and reduced motion respected
- No horizontal scroll; graceful truncation for long titles

## Release Checklist (next release)
- [ ] Version bump to 1.2.x in `manifest.json`
- [ ] Update `README.md` with header redesign, keyboard shortcuts, favorites filter
- [ ] Update screenshots for popup header, cards, and toasts
- [ ] Add release notes (CHANGELOG excerpt)
- [ ] Manual test on: Chrome, Brave; YouTube and Music; high‑contrast mode

## Notes / Decisions
- Multi‑timestamps mode is default ON; per‑video replacement remains available via Options
- Store minimal fields; derive URL/formatted time on render; precompute lowercase fields for search
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
