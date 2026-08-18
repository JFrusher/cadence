# Cadence — Atomic Implementation Roadmap

Build order for [PRD.md](PRD.md). Tasks are sequential within an epic and
epics are ordered by dependency: time → model → engine → persistence → state
→ screen → UI → PDF → outputs → finish.

**Conventions**

- Every `src/core/**` module is pure TypeScript, no React, with a colocated
  `*.test.ts`. Core never imports from `state/`, `ui/` or `render/`.
- Verification commands assume the npm scripts created in T0.2.
- "Green" means `npm run typecheck` and `npm test` both pass. Run both before
  starting the next task.

---

## Epic 0 — Repository scaffold

### T0.1 — Initialise repo and toolchain
**Depends on:** nothing
**Files:** create `package.json`, `vite.config.ts`, `index.html`,
`src/main.tsx`, `src/App.tsx`, `.gitignore`, `LICENSE`
**Do:** `git init`; scaffold Vite React-TS; install `react`, `react-dom`,
`zustand`, `pdf-lib`, `@pdf-lib/fontkit`, `fontkit`, `idb-keyval`; dev-install
`typescript`, `vite`, `vitest`, `@vitejs/plugin-react`, `pdfjs-dist`,
`@types/*`. MIT licence.
**Verify:** `npm run dev` serves at localhost:5173 and renders a placeholder;
`git status` shows a clean ignore of `node_modules` and `dist`.

### T0.2 — Strict TypeScript and test scripts
**Depends on:** T0.1
**Files:** modify `package.json`, `tsconfig.json`; add a vitest config block to
`vite.config.ts`
**Do:** `strict: true`, `noUncheckedIndexedAccess: true`,
`exactOptionalPropertyTypes: true`. Scripts: `dev`, `build` (`tsc -b && vite
build`), `typecheck`, `test` (`vitest run`), `test:watch`.
**Verify:** `npm run typecheck` exits 0. `npm test` reports "no test files"
without erroring.

### T0.3 — Design tokens
**Depends on:** T0.1
**Files:** create `src/index.css`
**Do:** Port the token set from Plaque's `src/index.css` — neutral grey scale,
one accent, warn/danger, 4px spacing base, tight type scale, sidebar and header
dimensions. This is the only global stylesheet; everything else is a CSS
Module. Shift the accent so Cadence is not mistaken for Plaque.
**Verify:** `document.documentElement` computed style resolves `--accent` in
the browser; body renders on the token background.

### T0.4 — Desktop gate
**Depends on:** T0.3
**Files:** create `src/ui/DesktopGate.tsx`, `src/ui/DesktopGate.module.css`;
modify `src/App.tsx`
**Do:** Below 1024px render the gate instead of the editor, via `matchMedia`.
**Verify:** Narrow the browser window below 1024px — the gate appears; widen —
the editor returns without a reload.

### T0.5 — Offline build gate
**Depends on:** T0.2
**Files:** create `scripts/offline-gate.ts`; modify `package.json`
**Do:** Post-build script that scans `dist/` for `http://`, `https://`,
`fetch(`, `XMLHttpRequest` and `WebSocket` in emitted JS, allowing only
comment and licence matches. Non-zero exit on a hit. Wire as `postbuild`.
**Verify:** `npm run build` passes. Temporarily add `fetch("https://example.com")`
to a source file — the build fails. Remove it.

---

## Epic 1 — Time primitives

### T1.1 — Minutes arithmetic and formatting
**Depends on:** T0.2
**Files:** create `src/core/time/minutes.ts`, `src/core/time/minutes.test.ts`
**Do:** `parseClock(s): number | null` accepting `14:30`, `2:30pm`, `2.30pm`,
`1430`. `formatClock(min, opts)` returning `14:30`, and `01:30 +1` past
midnight. `formatDuration(min)` returning `1h 25m`. All integers, all
minutes-from-00:00, values above 1440 legal.
**Verify:** `npx vitest run src/core/time/minutes.test.ts`. Cases must include:
round-trip parse and format for every accepted form, `1530` formatting as
`01:30 +1`, the midnight boundary `1440` as `00:00 +1`, and rejection of
`25:00` and the empty string.

---

## Epic 2 — Document model

### T2.1 — Types
**Depends on:** T1.1
**Files:** create `src/core/model/types.ts`
**Do:** `Block`, `TagDetail`, `DaySettings`, `OutputId`, `OutputSpec`,
`StyleSpec`, `TimelineDoc` exactly as specified in PRD §3. `TimelineDoc` holds
`schemaVersion`, `day`, `blocks`, `tagDetails`, `outputs`, `styles`.
**Verify:** `npm run typecheck` exits 0. No runtime code — types only.

### T2.2 — Identifiers
**Depends on:** T0.2
**Files:** create `src/core/model/ids.ts`, `src/core/model/ids.test.ts`
**Do:** `newId(prefix)` using `crypto.randomUUID()` with a short prefix.
**Verify:** `npx vitest run src/core/model/ids.test.ts` — 1000 ids, no
collision, all prefixed.

### T2.3 — Defaults and fixture document
**Depends on:** T2.1, T2.2
**Files:** create `src/core/model/defaults.ts`,
`src/core/model/defaults.test.ts`, `fixtures/sample-day.cadence.json`
**Do:** `emptyDoc()` and `sampleDoc()` — a realistic wedding day of ~25 blocks
across three lanes, with anchors on the ceremony and the first dance, tags for
photographer, band and caterer, and a curfew. Write the same document to the
fixture file. Every later epic tests against this fixture.
**Verify:** `npx vitest run src/core/model/defaults.test.ts` asserts
`sampleDoc()` deep-equals the parsed fixture, so the two cannot drift.

---

## Epic 3 — Scheduling engine

### T3.1 — resolve()
**Depends on:** T2.3
**Files:** create `src/core/schedule/resolve.ts`,
`src/core/schedule/resolve.test.ts`
**Do:** `resolve(doc): ResolvedBlock[]`. Per lane, in document order: an
anchored block starts at its `anchorMin`; a floating block starts at the
previous block's end plus its `gapMin`. End is start plus `durationMin` plus
`bufferMin`. Pure, no conflict logic yet.
**Verify:** `npx vitest run src/core/schedule/resolve.test.ts`. Cases: a pure
chain of floats accumulates correctly; an anchor mid-chain resets the running
time; blocks after the anchor follow the anchor, not the earlier chain; lanes
do not affect each other; an empty lane returns an empty array.

### T3.2 — Conflict: lane overlap
**Depends on:** T3.1
**Files:** create `src/core/schedule/conflicts.ts`,
`src/core/schedule/conflicts.test.ts`
**Do:** `conflicts(resolved, doc): Conflict[]` with a discriminated `kind`.
First kind: `lane-overlap`, when an anchored block starts before its
predecessor in the same lane has ended.
**Verify:** `npx vitest run src/core/schedule/conflicts.test.ts` — the sample
document yields zero; pulling the ceremony anchor 30 minutes earlier yields
exactly one `lane-overlap` naming both block ids.

### T3.3 — Conflict: tag double-booked
**Depends on:** T3.2
**Files:** modify `src/core/schedule/conflicts.ts`,
`src/core/schedule/conflicts.test.ts`
**Do:** Add `tag-double-booked` — the same tag on two blocks whose resolved
intervals overlap **across different lanes**. Same-lane overlap is already
reported by T3.2 and must not double-report.
**Verify:** Add a supplier-lane block tagged `photographer` overlapping the
main-lane photo block — exactly one conflict, of kind `tag-double-booked`.

### T3.4 — Conflict: anchor collision and curfew overrun
**Depends on:** T3.3
**Files:** modify `src/core/schedule/conflicts.ts`,
`src/core/schedule/conflicts.test.ts`
**Do:** Add `anchor-collision` — a floating chain resolving past a downstream
anchored block's start — and `curfew-overrun`, when the last block in any lane
ends after `day.curfewMin`.
**Verify:** Extend a floating block's duration until it runs into the first
dance anchor — one `anchor-collision`. Extend the last block past curfew — one
`curfew-overrun`. Neither fires on the untouched sample document.

### T3.5 — Slack budget
**Depends on:** T3.4
**Files:** create `src/core/schedule/slack.ts`,
`src/core/schedule/slack.test.ts`
**Do:** `slack(resolved, doc)` returning, per block, minutes until the next
downstream anchor in its lane, and the document-level minutes remaining before
curfew. Negative values are legal and mean the size of the overrun.
**Verify:** `npx vitest run src/core/schedule/slack.test.ts` — slack shrinks by
exactly the minutes added when a block's duration grows, and goes negative in
lockstep with `curfew-overrun` firing.

### T3.6 — Performance guard
**Depends on:** T3.5
**Files:** create `src/core/schedule/perf.test.ts`
**Do:** Generate 200 blocks across four lanes, run `resolve` + `conflicts` +
`slack` 50 times, assert the median is under 16ms.
**Verify:** `npx vitest run src/core/schedule/perf.test.ts` passes and prints
the median. If it is not comfortably under budget, stop and fix it here — every
interaction depends on this.

### T3.7 — What-if diff
**Depends on:** T3.6
**Files:** create `src/core/schedule/whatIf.ts`,
`src/core/schedule/whatIf.test.ts`
**Do:** `whatIf(doc, change): { before, after, movedIds, newConflicts }`.
Applies the change to a copy, resolves both, diffs by block id. No mutation of
the input.
**Verify:** Shifting the ceremony 20 minutes later reports every downstream
block in `movedIds` and nothing upstream; the input document is unchanged
(deep-equal to a pre-call clone).

---

## Epic 4 — Sun position

### T4.1 — Offline solar calculation
**Depends on:** T1.1
**Files:** create `src/core/sun/solar.ts`, `src/core/sun/solar.test.ts`
**Do:** NOAA solar position — `sunTimes(date, lat, lon, utcOffsetMin)`
returning sunrise, sunset and golden-hour start as minutes-from-00:00 local
wall clock. No dependency, no network, no timezone database.
**Verify:** `npx vitest run src/core/sun/solar.test.ts`. Self-checking cases:
day length within 15 minutes of 12h at the equinox for several latitudes;
sunset later in June than December in the northern hemisphere and the reverse
in the southern; golden hour precedes sunset. Plus one hardcoded vector for
your venue's lat/long, checked once against a published almanac, tolerance
±2 minutes.

### T4.2 — Golden-hour advisory
**Depends on:** T4.1, T3.4
**Files:** modify `src/core/schedule/conflicts.ts`,
`src/core/schedule/conflicts.test.ts`
**Do:** Add advisory-severity `past-golden-hour` for blocks tagged as photo
blocks that start after golden hour ends. Advisories carry a separate severity
from conflicts and never block export.
**Verify:** Move the sample document's photo block to 22:00 — one advisory,
zero conflicts. The severity field distinguishes them.

---

## Epic 5 — Tags

### T5.1 — Tag derivation and detail merge
**Depends on:** T2.3
**Files:** create `src/core/model/tags.ts`, `src/core/model/tags.test.ts`
**Do:** `allTags(doc)` — the sorted unique tag set across blocks, each with its
usage count and merged `TagDetail` if one exists. Details for tags no longer
used on any block are retained in the document but flagged `orphan`.
**Verify:** `npx vitest run src/core/model/tags.test.ts` — removing the last
block carrying a tag marks its detail orphaned rather than deleting it.

---

## Epic 6 — Project file

### T6.1 — Serialise and parse
**Depends on:** T2.3
**Files:** create `src/core/project/file.ts`, `src/core/project/file.test.ts`
**Do:** `serialise(doc): string` and `parse(json): { doc } | { error }`.
Stamps `schemaVersion` and an app version. Parse validates shape and returns a
readable error rather than throwing.
**Verify:** Round-trip the fixture — `parse(serialise(sampleDoc()))`
deep-equals `sampleDoc()`. Truncated JSON, an empty string and `{}` each
return an error object, never a throw.

### T6.2 — Version migration
**Depends on:** T6.1
**Files:** modify `src/core/project/file.ts`; create
`src/core/project/migrate.ts`, `src/core/project/migrate.test.ts`
**Do:** `migrate(raw)` chain keyed on `schemaVersion`, identity for the current
version. Unknown fields on a document from a newer version are preserved
through a load and save cycle rather than dropped.
**Verify:** A fixture with `schemaVersion: 999` and an unknown key survives
`parse` then `serialise` with the key intact.

---

## Epic 7 — Application state

### T7.1 — Store
**Depends on:** T6.1
**Files:** create `src/state/store.ts`, `src/state/store.test.ts`
**Do:** Zustand store holding `doc`, `selectedId`, `pendingWhatIf`, `ui`.
Resolved schedule, conflicts and slack are **selectors**, memoised on document
identity — never stored fields.
**Verify:** `npx vitest run src/state/store.test.ts` — the resolve selector
runs once for two reads with no intervening edit, and re-runs after an edit.

### T7.2 — Document actions
**Depends on:** T7.1
**Files:** modify `src/state/store.ts`, `src/state/store.test.ts`
**Do:** `addBlock`, `updateBlock`, `deleteBlock`, `reorderBlock`, `setAnchor`,
`clearAnchor`, `setDay`, `setTagDetail`, `setStyle`. Each replaces `doc`
immutably.
**Verify:** Each action has a test asserting the new document and that the
previous document object is untouched.

### T7.3 — Undo and redo
**Depends on:** T7.2
**Files:** create `src/state/history.ts`, `src/state/history.test.ts`; modify
`src/state/store.ts`
**Do:** Snapshot history, capped at 50 entries, wrapping the document actions.
The redo stack clears on a new edit.
**Verify:** `npx vitest run src/state/history.test.ts` — edit, undo, redo
returns the same document; 60 edits leaves 50 entries; an edit after undo
clears redo.

### T7.4 — Session persistence
**Depends on:** T7.3
**Files:** create `src/state/persist.ts`, `src/state/persist.test.ts`
**Do:** Debounced write of the serialised document to `localStorage`; restore
on boot; a corrupt or unparseable payload falls back to `emptyDoc()` and
surfaces a notice rather than crashing the app.
**Verify:** Edit, reload the browser — the document returns. Put garbage in the
key by hand and reload — the app boots empty with a notice.

### T7.5 — Blob store
**Depends on:** T7.4
**Files:** create `src/state/blobStore.ts`, `src/state/blobStore.test.ts`
**Do:** `idb-keyval` wrapper for the logo and uploaded fonts, keyed by content
hash. The document stores keys; IndexedDB stores bytes.
**Verify:** Store a blob, reload, retrieve by the same key. A key referenced by
the document but missing from IndexedDB reports as missing rather than
throwing.

### T7.6 — Import and export the project file
**Depends on:** T7.5, T6.2
**Files:** create `src/state/projectIO.ts`, `src/ui/ProjectButtons.tsx`,
`src/ui/ProjectButtons.module.css`
**Do:** Save downloads `<couple-names>.cadence.json`. Open reads a file,
migrates, replaces the document, resets history. Blob keys referenced but
absent are reported.
**Verify:** Save, refresh, open the saved file — an identical document on
screen. Open a text file that is not JSON — a readable error, no crash.

---

## Epic 8 — Timeline canvas

### T8.1 — Application shell
**Depends on:** T7.1, T0.4
**Files:** modify `src/App.tsx`; create `src/App.module.css`,
`src/ui/Sidebar.tsx`, `src/ui/Sidebar.module.css`
**Do:** Header, fixed-width left sidebar, flexible canvas region. Empty panel
placeholders.
**Verify:** Visual — the layout holds from 1024px to 2560px with no horizontal
page scroll, and the canvas region takes all remaining width.

### T8.2 — Time ruler
**Depends on:** T8.1, T1.1
**Files:** create `src/render/screen/Ruler.tsx`,
`src/render/screen/Ruler.module.css`, `src/render/screen/ticks.ts`,
`src/render/screen/ticks.test.ts`
**Do:** `ticks(fromMin, toMin, pxPerMin)` choosing a 5, 15, 30 or 60-minute
interval by available pixels. The ruler renders labelled ticks, with
past-midnight labelled by day offset.
**Verify:** `npx vitest run src/render/screen/ticks.test.ts` — labels never
collide at any zoom in the supported range. Visually, a day running to 01:00
shows `01:00 +1`.

### T8.3 — Lanes and blocks
**Depends on:** T8.2, T3.1
**Files:** create `src/render/screen/Timeline.tsx`,
`src/render/screen/Timeline.module.css`, `src/render/screen/BlockView.tsx`,
`src/render/screen/BlockView.module.css`
**Do:** Render lanes stacked, blocks positioned from the resolve selector,
width proportional to duration, buffer drawn as a distinct trailing region.
Anchored blocks carry a pin marker.
**Verify:** Load the sample document — 25 blocks in three lanes, positions
matching the fixture's clock times against the ruler.

### T8.4 — Selection
**Depends on:** T8.3, T7.2
**Files:** modify `src/render/screen/Timeline.tsx`,
`src/render/screen/BlockView.tsx`, `src/state/store.ts`
**Do:** Click selects, Escape clears, arrow keys move selection within a lane.
The selected block is styled with the accent token.
**Verify:** Click each of three blocks — the selection ring follows; Escape
clears it; arrow keys walk the lane in document order.

### T8.5 — Conflict and slack indicators
**Depends on:** T8.4, T3.5, T4.2
**Files:** modify `src/render/screen/BlockView.tsx`; create
`src/ui/WarningsList.tsx`, `src/ui/WarningsList.module.css`
**Do:** Conflicts mark the block in the danger token and advisories in warn.
The warnings list enumerates every conflict and advisory; clicking one selects
its block. The header shows minutes of slack before curfew.
**Verify:** Drag the ceremony earlier until it overlaps — the block changes
colour, the list gains an entry, clicking it selects the block. Curfew slack
decreases as durations grow.

### T8.6 — Drag with what-if ghost
**Depends on:** T8.5, T3.7
**Files:** create `src/render/screen/useDragBlock.ts`,
`src/render/screen/useDragBlock.test.ts`; modify
`src/render/screen/Timeline.tsx`
**Do:** Dragging a block horizontally calls `whatIf` on each pointer move and
renders downstream blocks ghosted at their new positions with new conflicts
lit. Release commits through the store action; Escape cancels with no document
change.
**Verify:** `npx vitest run src/render/screen/useDragBlock.test.ts` covers the
pointer maths. Visually: drag, see the ghosts, press Escape — the document is
unchanged and undo has no new entry.

### T8.7 — Presentation mode
**Depends on:** T8.5
**Files:** create `src/render/screen/Presentation.tsx`,
`src/render/screen/Presentation.module.css`; modify `src/App.tsx`
**Do:** Full-screen read-only timeline via the Fullscreen API — no sidebar, no
handles, larger type, applying the document's style tokens. Escape exits.
**Verify:** Enter presentation mode — no editing affordance responds, type is
legible at 2m from a 27" display, Escape returns to the editor with the
selection intact.

---

## Epic 9 — Sidebar panels

### T9.1 — Day settings panel
**Depends on:** T8.1, T7.2
**Files:** create `src/ui/controls.tsx`, `src/ui/controls.module.css`,
`src/ui/panels/DayPanel.tsx`, `src/ui/panels/DayPanel.module.css`
**Do:** Shared labelled control primitives (text, number, time, select,
colour), then the day panel: date, venue, latitude, longitude, UTC offset,
curfew, couple names.
**Verify:** Every field round-trips to the document and survives a reload. An
invalid latitude is rejected at the input, not on save.

### T9.2 — Blocks panel
**Depends on:** T9.1
**Files:** create `src/ui/panels/BlocksPanel.tsx`,
`src/ui/panels/BlocksPanel.module.css`
**Do:** Blocks grouped by lane in document order, with add, delete, and
reorder within a lane. Selection is shared with the canvas.
**Verify:** Add a block — it appears in both the list and the canvas at the
right time. Reorder — the resolved times of both blocks update.

### T9.3 — Inspector panel
**Depends on:** T9.2
**Files:** create `src/ui/panels/InspectorPanel.tsx`,
`src/ui/panels/InspectorPanel.module.css`
**Do:** The selected block: label, duration, gap, buffer, anchor toggle plus
time, lane, location, notes, tags, output visibility checkboxes.
**Verify:** Toggling the anchor on a floating block pins it at its current
resolved time rather than jumping it. Clearing the anchor returns it to
floating with the gap preserved.

### T9.4 — Tags panel
**Depends on:** T9.3, T5.1
**Files:** create `src/ui/panels/TagsPanel.tsx`,
`src/ui/panels/TagsPanel.module.css`
**Do:** Every tag with its usage count; expanding one edits display name,
phone, arrival and notes. Orphaned tags shown in a separate group with a
delete action.
**Verify:** Type a new tag on a block — it appears in the panel. Remove it
everywhere — it moves to orphans with its details intact.

### T9.5 — Style panel
**Depends on:** T9.4
**Files:** create `src/ui/panels/StylePanel.tsx`,
`src/ui/panels/StylePanel.module.css`
**Do:** Per printed piece: font family, type scale, rule weight, accent colour,
logo upload. Stored per `OutputId` in `doc.styles`.
**Verify:** Change the run-sheet font — the export changes and the order of the
day does not.

### T9.6 — Keyboard
**Depends on:** T9.3, T7.3
**Files:** create `src/state/useKeyboard.ts`; modify `src/App.tsx`
**Do:** Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete removes the selected
block, Escape clears selection or exits presentation mode. Suppressed while a
text input has focus.
**Verify:** Each shortcut works on the canvas and does nothing destructive
while typing in the inspector's notes field.

---

## Epic 10 — PDF output

### T10.1 — Page and unit primitives
**Depends on:** T0.2
**Files:** create `src/render/pdf/units.ts`, `src/render/pdf/units.test.ts`,
`src/render/pdf/page.ts`
**Do:** mm to pt conversion, A4 and A5 page dimensions, and a `PageContext`
wrapping a `pdf-lib` page with a top-left-origin mm coordinate helper.
**Verify:** `npx vitest run src/render/pdf/units.test.ts` — A4 is 595.28 by
841.89pt within 0.01; a point 10mm from the top lands at the correct `pdf-lib`
y coordinate.

### T10.2 — Font embedding
**Depends on:** T10.1
**Files:** create `src/render/pdf/embedFonts.ts`,
`src/assets/fonts/index.ts`; add `src/assets/fonts/*.ttf` with their OFL
licence files
**Do:** Bundle three or four open-licence families covering a serif, a sans and
a script. Embed with `@pdf-lib/fontkit`, subsetting on.
**Verify:** Export a PDF and check Document Properties lists the fonts as
embedded subsets. Text is selectable, not outlines.

### T10.3 — Text measurement and wrapping
**Depends on:** T10.2
**Files:** create `src/render/pdf/text.ts`, `src/render/pdf/text.test.ts`
**Do:** `measure(text, font, size)`, `wrap(text, font, size, maxWidthMm)`
returning lines, and `truncate` with an ellipsis for hard-bounded cells.
**Verify:** `npx vitest run src/render/pdf/text.test.ts` — a wrapped
paragraph's widest line never exceeds the bound; a single word longer than the
bound is broken rather than overflowing; empty input returns one empty line.

### T10.4 — Paginated table layout
**Depends on:** T10.3
**Files:** create `src/render/pdf/table.ts`, `src/render/pdf/table.test.ts`
**Do:** Abstract layout — given rows, column widths, a page box and a header
band, return per-page row assignments with measured heights. Rows never split
across pages; the header repeats.
**Verify:** `npx vitest run src/render/pdf/table.test.ts` — 200 rows paginate
with no row spanning a break, every page's content height within the box, and
the header present on each page.

### T10.5 — Master run-sheet
**Depends on:** T10.4, T3.5, T9.5
**Files:** create `src/render/pdf/runSheet.ts`,
`src/render/pdf/runSheet.test.ts`
**Do:** A4 portrait. Header with couple names, date and venue; columns for
time, duration, block, location, tags and notes; buffer and anchor marked;
conflicts flagged in the margin; page numbers and a generation stamp.
**Verify:** `npx vitest run src/render/pdf/runSheet.test.ts` renders the
fixture and re-reads the output with `pdfjs-dist`, asserting the page count,
that every block label appears exactly once, and that the first block's clock
time string is present.

### T10.6 — Call sheets
**Depends on:** T10.5, T5.1
**Files:** create `src/render/pdf/callSheet.ts`,
`src/render/pdf/callSheet.test.ts`
**Do:** The same layout filtered to one tag, headed with that tag's display
name, phone and arrival time. An option to bundle every tag into one PDF with a
page break between, or emit one PDF per tag.
**Verify:** Render the photographer's sheet from the fixture — via `pdfjs-dist`
it contains only photographer-tagged blocks, and the bundled variant's page
count equals the sum of the individual sheets.

### T10.7 — Export bar
**Depends on:** T10.6
**Files:** create `src/ui/ExportBar.tsx`, `src/ui/ExportBar.module.css`
**Do:** Choose the piece, render, download with a sensible filename. Disabled
with a stated reason while any blocking conflict exists; advisories never
block. Progress state during render.
**Verify:** Export each piece from the running app and open the files. With a
`curfew-overrun` present the button explains why it is disabled.

### T10.8 — Headless sample and export performance
**Depends on:** T10.7
**Files:** create `scripts/sample-pdf.ts`, `src/render/pdf/perf.test.ts`;
modify `package.json`
**Do:** `npm run sample` writes `sample-run-sheet.pdf` and
`sample-call-sheet.pdf` from the fixture without a browser. The performance
test asserts a 200-block run-sheet renders in under 3s.
**Verify:** `npm run sample` writes both files; open them.
`npx vitest run src/render/pdf/perf.test.ts` passes and prints the timing.

---

## Epic 11 — P1 outputs

### T11.1 — Order of the day
**Depends on:** T10.7
**Files:** create `src/render/pdf/orderOfDay.ts`,
`src/render/pdf/orderOfDay.test.ts`
**Do:** A5, guest-facing, centred typographic setting — time and label only,
generous leading, optional logo, no notes, no tags. Only blocks whose `outputs`
include `order-of-day`.
**Verify:** The test asserts via `pdfjs-dist` that no note or tag text appears
and that only opted-in blocks are present. Print one at 100% scale and check
the trimmed size is A5.

### T11.2 — Contact sheet
**Depends on:** T11.1, T5.1
**Files:** create `src/render/pdf/contactSheet.ts`,
`src/render/pdf/contactSheet.test.ts`
**Do:** A4, one row per tag with details: display name, phone, arrival time,
notes. Tags without details are listed with the gap visible rather than
omitted.
**Verify:** The test asserts every non-orphan tag appears, and that a tag with
no phone still renders its row.

### T11.3 — Output visibility defaults
**Depends on:** T11.2
**Files:** modify `src/core/model/defaults.ts`,
`src/ui/panels/InspectorPanel.tsx`, `src/ui/panels/BlocksPanel.tsx`
**Do:** Sensible defaults per block on creation — everything on the run-sheet,
guest-facing pieces opt-in — and a bulk toggle in the blocks panel.
**Verify:** A new block appears on the run-sheet and not on the order of the
day without any manual toggling.

---

## Epic 12 — Finishing

### T12.1 — Custom font upload
**Depends on:** T10.2, T7.5
**Files:** create `src/state/fontLoader.ts`, `src/ui/panels/FontsPanel.tsx`,
`src/ui/panels/FontsPanel.module.css`
**Do:** Accept `.ttf`, `.otf` and `.woff2`; register for screen via `FontFace`;
store bytes in the blob store; embed on export. Reject a file `fontkit` cannot
parse with a readable message.
**Verify:** Upload a font, use it on the run-sheet, export — the PDF embeds it
and the screen preview matches. Reload — the font survives. Upload a renamed
`.txt` — rejected cleanly.

### T12.2 — Documentation
**Depends on:** T11.3
**Files:** create `README.md`, `USER_GUIDE.md`, `docs/screenshot.png`
**Do:** README covers what it is, the zero-backend promise and the development
commands. USER_GUIDE covers building a day, anchors versus floats, reading
conflicts and slack, and printing each piece at the right scale.
**Verify:** Follow the guide end to end on a clean browser profile and produce
a printed run-sheet without referring to the source.

### T12.3 — Accessibility pass
**Depends on:** T12.2
**Files:** create `src/ui/Announcer.tsx`, `src/ui/Announcer.module.css`;
modify `src/ui/**`, `src/render/screen/**`
**Do:** Focus visible on every control, the canvas keyboard-navigable, labelled
form controls, conflicts announced through a live region, and contrast of every
token pair at or above 4.5:1.
**Verify:** Complete a full document build using only the keyboard. Run the
browser's accessibility audit — no critical issues.

### T12.4 — Release gates
**Depends on:** T12.3
**Files:** create `scripts/validate-data.ts`; modify `package.json`
**Do:** `prebuild` validates the fixture against the current schema;
`postbuild` runs the offline gate from T0.5.
**Verify:** `npm run typecheck && npm test && npm run build` all pass from a
clean `node_modules`. `dist/` loads from `file://` with no network requests in
the browser's network panel.
