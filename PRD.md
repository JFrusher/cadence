# Cadence — Product Requirements

**A day-of wedding timeline creator.** Build the run of the day on a desktop
canvas, see what collides, and print the paper that runs the day: a master
run-sheet, call sheets for each supplier, an order of the day for guests.

Everything runs in the browser. No account, no upload, no server. Third
standalone repo alongside Tableaux (seating) and Plaque (stationery) — shared
design language only, no shared code and no cross-app data.

## 1. Vision

On the day, nobody opens an app. The coordinator holds paper, the
photographer holds paper, the band holds paper. Cadence is the desktop tool
that designs that paper, and the scheduling engine that keeps it honest while
the plan is still moving.

Existing tools are either spreadsheets — which do not recalculate, do not
detect conflicts, and print badly — or venue-locked planners that charge per
export. Cadence is neither.

## 2. Personas

**Couples** building the day themselves, moving one block and needing
everything downstream to follow.

**Coordinators and planners** who run the day off the printed sheet and live
on the question "how much slack is left before the curfew".

**Suppliers** — photographer, band, caterer, florist — who need their own
arrival and cue times, not the whole document.

## 3. Domain model

### 3.1 Time

Wall-clock **minutes from the day's 00:00**, integer, may exceed 1440 for a
reception running past midnight (01:30 next day = 1530). No `Date`, no
timezone, no ISO strings inside the document. Formatting happens at the edges
only. This removes the entire DST and timezone bug class.

### 3.2 Blocks

```ts
interface Block {
  id: string;
  label: string;
  durationMin: number;
  /** Anchored: pinned to a clock time. Floating: starts after its predecessor. */
  anchorMin: number | null;
  /** Minutes of gap after the predecessor. Floating blocks only. */
  gapMin: number;
  /** Contingency padding inside this block, counted separately from duration. */
  bufferMin: number;
  lane: string;
  tags: string[];
  location: string;
  notes: string;
  /** Which printed pieces this block appears on. */
  outputs: OutputId[];
}
```

**Hybrid scheduling.** Every block has a duration. A block is either
*anchored* to a clock time (the registrar will not move) or *floating* — it
starts at its predecessor's end plus its gap. Editing any block recalculates
everything downstream of it.

**Lanes** are parallel tracks (main day, suppliers, transport), each
resolving independently. Not a dependency graph — a real day is sequential
with a few parallel strands, and a DAG scheduler buys nothing for the cost.

### 3.3 Tags

Free text on a block. Any tag may optionally carry details:

```ts
interface TagDetail {
  tag: string;
  displayName?: string;
  phone?: string;
  arrivalMin?: number | null;
  notes?: string;
}
```

Tags are authored by typing. Details are optional and attach to a tag name
that already exists on some block. No entity management, no vendor CRUD — but
call sheets can filter by tag and the contact sheet has numbers to print.

### 3.4 The day

Date, venue name, venue latitude and longitude, the day's UTC offset in
minutes, curfew time, couple names, optional logo.

The UTC offset is entered by the user (BST = +60). This is what lets sunset
be computed offline without shipping a timezone database.

## 4. Functional requirements

| ID | Category | Description | Pri |
|---|---|---|---|
| FR-CAD-01 | Model | Timeline of blocks: label, duration, lane, tags, location, notes | P0 |
| FR-CAD-02 | Engine | Hybrid scheduling — anchored and floating blocks; edit one, downstream recalculates | P0 |
| FR-CAD-03 | Engine | Conflict detection: lane overlap, tag double-booked, floating chain colliding with a downstream anchor, overrun past curfew | P0 |
| FR-CAD-04 | Engine | Slack budget: per-block buffer, and minutes remaining before the next anchor and before curfew | P0 |
| FR-CAD-05 | Engine | What-if preview: move a block, see downstream ghosted with conflicts lit, commit or cancel | P0 |
| FR-CAD-06 | Engine | Offline sunset and golden hour from venue lat/long, date and UTC offset; advisory warning when photo blocks drift past it | P1 |
| FR-CAD-07 | Editing | Add, edit, reorder, delete blocks; undo and redo | P0 |
| FR-CAD-08 | Editing | Tag details table: phone, arrival, display name | P1 |
| FR-CAD-09 | Design | Style controls per printed piece: font, type scale, rule weight, colour, logo | P0 |
| FR-CAD-10 | Output | Master run-sheet PDF — every block, full detail, paginated A4 vector | P0 |
| FR-CAD-11 | Output | Call sheets — the same document filtered to one tag, one PDF per tag or bundled | P0 |
| FR-CAD-12 | Output | Order of the day — guest-facing, typographic, subset of blocks, A5 | P1 |
| FR-CAD-13 | Output | Contact sheet — tag details, arrival times, phone numbers | P1 |
| FR-CAD-14 | Presentation | Full-screen read-only timeline for walking through the day on screen | P1 |
| FR-CAD-15 | Persistence | `.cadence.json` project file: whole job, exportable, importable, versioned | P0 |
| FR-CAD-16 | Typography | Custom font upload (.ttf/.otf/.woff2), embedded into the PDF | P2 |

Every printed piece is a template plus style controls. There is no freeform
element editor — that is Plaque's job, and a run-sheet is a data-dense
document that a template serves better than a canvas.

## 5. UI specification

Desktop only. Below 1024px the editor is not offered.

**Left sidebar** — Day settings (date, venue, lat/long, UTC offset, curfew);
Blocks list with lane grouping; Inspector for the selected block; Tags and
details; Style controls per output; Export.

**Main canvas** — the timeline, lanes stacked vertically, blocks to scale
against a time ruler. Conflicts marked on the block and listed. Slack shown
against the next anchor and the curfew. Dragging a block shows the what-if
ghost of everything downstream before it commits.

**Presentation mode** — full-screen, read-only, chrome gone, the timeline
alone at a size that reads across a room.

## 6. Non-functional requirements

**Zero-backend execution.** All parsing, scheduling and PDF generation runs
client-side in browser memory. No guest, supplier or schedule data is
transmitted anywhere. The build gate fails if runtime code references a
network origin.

**Storage.** localStorage for application state, IndexedDB for uploaded
blobs (logo, fonts), `.cadence.json` export as the portable format.

**Browsers.** Desktop Chrome, Safari, Firefox, Edge.

**Performance.** Schedule recalculation under 16ms for 200 blocks. PDF export
under 3.0s for a 200-block run-sheet on desktop.

**Output quality.** Vector PDF at true page dimensions, fonts embedded and
subset, text selectable.
