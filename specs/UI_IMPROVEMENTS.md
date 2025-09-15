**TL;DR:** Make the popup a fast, keyboard-first library of saved videos → searchable, sortable, tag-filterable, with clear pinned behavior and crisp timestamp management. Use progressive disclosure (collapsed cards that expand to show timestamps), visible focus, subtle toasts, and dark/light themes. Keep information density high but scannable; target <300 ms to interactive and full operability without a mouse.

---

### 1) Core principles (drive every decision)

* **Zero-to-action latency:** one click or `Enter` from popup to open a timestamp; `"/"` focuses search instantly.
* **Predictable hierarchy:** global controls (search/sort/filter) → list of videos → per-video timestamps.
* **Progressive disclosure:** show the minimum to scan; expand a card for details.
* **Keyboard-first:** all actions have shortcuts; visible focus rings; undoable destructive actions.
* **A11y by default:** semantic roles, ARIA states, WCAG AA contrast, reduced-motion respect.
* **Scale gracefully:** virtualization for large lists, debounced search, pre-computed lowercase fields.

---

### 2) Global layout & header (popup)

Current header (title + sort + icons) is visually heavy and ambiguous (the star at top reads like a *global favorite*, not a filter). Replace with:

* **Left:** “YouTube Timestamps” (click = reset filters).
* **Center:** **Search field** (full-width when space allows). Placeholder: “Search titles, channels, tags…”.
* **Right actions (icon+label on hover/tooltip):**

  * **Sort** (Newest ▾, Oldest, Title A→Z, Most timestamps, **Pinned first**).
  * **Pinned only** toggle (pin icon with label on hover).
  * **Layout** toggle (list/grid if you ever add grid; otherwise omit).
  * **Import/Export** (opens mini menu: Export JSON, Export CSV, Import).
  * **Settings** (gear).

**Filter bar (below header, only when active):** tag chips + pinned chip + sort chip; each removable with ⌫.

**Counts:** right-aligned subtle meta: “127 videos · 1,932 timestamps”.

---

### 3) List area behavior

* **Pinned section first** (optional divider “Pinned”), then the rest in chosen sort.
* **Empty states:**

  * Global: “Nothing saved yet. On YouTube, press ⌘⇧S to save a timestamp.” (Windows: Ctrl).
  * Filtered: “No matches. Try fewer filters or clear search.”
* **Virtualization:** window items when list >200 for smooth scroll.
* **Batch selection (optional, power-user):** hold `Shift` or press `x` to select; sticky footer shows batch actions (Export, Delete, Add tag).

---

### 4) Video card anatomy (collapsed state)

Your screenshot shows duplicated title blocks and a passive tag input. Replace with a compact, information-dense card:

* **Thumbnail** (left; fixed 16:9, \~64–72 px tall) with duration badge if known.
* **Title** (2-line clamp, strong), **Channel** (muted), **Saved on** date (muted, right-aligned).
* **Meta row:** tag chips (up to 3 visible; “+N” overflow), **timestamp count** e.g., “(5)”.
* **Primary actions** (right, icon buttons with tooltips):

  * **Open video** (opens last-used timestamp or 0 if none).
  * **Pin/Unpin** (aria-pressed, toggles instantly).
  * **Copy MD** (copies a Markdown block: title + bullet list of timestamps).
  * **⋯ menu** → Open on YouTube, Rename, Edit tags, Export (JSON/CSV), Delete (with undo).
* **Expand affordance**: clicking the card body (not the buttons) expands to show timestamps.

**States:** default / hover (subtle shadow & lift) / focus (clear ring) / pinned (pin icon filled + small “Pinned” badge) / selected (if batch mode).

---

### 5) Expanded card: timestamp management

Inside the expanded card, show a simple table/list:

* **Row content:** `mm:ss` (or `hh:mm:ss`) • **Label** • optional note (muted).
* **Row actions (icon buttons, appear on hover & via keyboard):**
  **Open** (go to `&t=SECONDS`), **Copy link**, **Edit**, **Delete**.
* **Row interactions:**

  * Click time → open at that time.
  * `Enter` → open selected row.
  * `c` → copy link.
  * `e` → edit label/note inline.
  * `⌫` → delete (offers **Undo** toast for 5 s).
* **Add controls:** an inline “+ Add timestamp” (time, label, note). Prefills time if invoked from content script.
* **Reorder:** drag within a video; order persists (nice-to-have).

---

### 6) Tagging & filtering model

* **On card:** tag chips (click = add to filter bar). A “+ Tag” chip opens token input with autocomplete from existing tags; Enter/Comma confirms.
* **Global tag filter bar:** multiple tags behave as **AND** by default (show “AND” label). `Alt-click` a chip toggles to OR (chip shows “OR” pill) if you support advanced filtering.
* **Keyboard:** `t` on a focused card opens tag editor.

---

### 7) Feedback & micro-interactions

* **Toasts** (aria-live polite, bottom): “Copied link”, “Pinned”, “Deleted – Undo”.
* **Motion:** 120–180 ms opacity/translate for add/remove; scale-in for pin toggle; respect `prefers-reduced-motion`.
* **Form affordances:** clear buttons inside inputs; Esc clears search and collapses expanded cards.

---

### 8) Visual system

* **Type scale:** 20 / 16 / 14 / 12 px; line-height 1.4.
* **Spacing:** 8-pt system (4, 8, 12, 16, 24).
* **Cards:** radius 12, subtle shadow (lighter in dark mode), 1 px border using `--border`.
* **Chips:** radius 999, compact padding, readable contrast.
* **Icons:** inline SVG (no icon fonts); consistent stroke; 20 px.
* **Themes:** light/dark via CSS vars (`--bg, --surface, --text, --muted, --border, --accent, --focus`). Default follows system; toggle in Settings. Ensure WCAG AA on both.
* **Popup width:** design to 360–420 px; avoid horizontal scroll; clamp long titles.

---

### 9) Accessibility specifics

* **Semantics:**

  * List has `role="list"`; cards `role="listitem"`.
  * Pin button uses `aria-pressed`.
  * Expand control uses `aria-expanded` and `aria-controls`.
  * Toast region `aria-live="polite"`.
* **Focus management:** opening the popup places focus in Search; expanding a card moves focus to first timestamp; closing returns it to the card.
* **Shortcut help:** `?` opens a cheat sheet modal (close with Esc).

---

### 10) Settings (Options page)

* **General:** Theme toggle; default sort; “Pinned first” default; confirm before delete; open links in new tab.
* **Hotkeys:** show/change the “Save timestamp” command; platform-aware labels.
* **Data:** Export All (JSON/CSV), Import (merge + dedupe by `videoId + seconds`); storage mode banner if sync quota exceeded.
* **Privacy:** plain-language note: stored locally or in Chrome Sync; no external requests.

---

### 11) First-run & empty states

* First run: single-screen onboarding in popup with 3 tips (save shortcut, search `/`, pin `p`).
* Empty card state (no timestamps yet): “No timestamps for this video yet. Add one with + or press `c` on YouTube while playing.”

---

### 12) Performance & resilience

* **Search:** diacritic-insensitive; 120 ms debounce; precompute `title_lc`, `tags_lc`.
* **Large data:** windowed list; memoized tag aggregates; lazy load thumbnails.
* **Storage full:** clear banner with one-click **“Move to local storage”** and explanation.
* **Offline-proof:** everything works without network.

---

### 13) Example flows (how it feels)

* **Save → recall:** On YouTube hit ⌘⇧S → toast “Saved ✓ Add note” → open popup → `"/"` type “claude sec…” → Enter on the first result → arrow to desired timestamp → Enter to open at that moment.
* **Pin & review later:** Focus card → `p` to pin → toggle “Pinned only” in header tomorrow → quick study session list.
* **Share notes:** Open card → “Copy MD” → paste into Obsidian/Notes; retains links and labels.
* **Tag-driven study:** Click “learning” chip → filter narrows → add “ai” chip → export filtered set as CSV.

---

### 14) “Before → After” deltas vs your screenshot

* Replace the **header star** with a **Pinned-only filter** and move pinning to per-card buttons (reduces ambiguity).
* Remove duplicated **title blocks**; make the card single, clean unit with better hierarchy.
* Convert the static **tags input** into **chips** with an explicit “+ Tag” flow and autocomplete.
* Surface **timestamp count** and make the **saved date** unobtrusive meta.
* Consolidate secondary actions under a **⋯ menu**; keep the top-3 actions visible.
* Add **expandable timestamps** with clear time labels and one-tap open/copy.

---

### 15) Acceptance criteria (UI/UX)

* Popup interactive in <**300 ms** with **1k** items (virtualized).
* 100% functionality via keyboard; visible focus everywhere.
* Search + filters update results as you type; pinned behavior is consistent and persistent.
* All destructive actions are **undoable**; no dead-ends.
* Dark/light theme and reduced-motion are respected.
* No horizontal scroll; titles never overlap controls; truncation is graceful.

---

### 16) Next best steps

1. Implement the **header + filter bar** and the **new card** in place (collapsed state first).
2. Add **expandable timestamps** with inline edit + copy/undo.
3. Wire **keyboard map** and visible focus.
4. Add **toasts** and **empty states**.
5. Finish with **tags chips** and **Pinned-only** filter, then theme polish and performance passes.
