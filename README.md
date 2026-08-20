# Cadence

Build the run of a wedding day, see what collides, and print the paper that
runs it. Everything happens in your browser — no account, no upload, no
server. The schedule, the phone numbers and the guest-facing pieces never
leave your machine.

- **Hybrid scheduling.** Every block has a duration. A block is either
  *anchored* to a clock time — the registrar will not move — or *floating*,
  starting when the one before it ends. Move anything and everything
  downstream follows.
- **It tells you when the day does not fit.** Two anchored blocks overlapping,
  a supplier in two places at once, a floating chain that has grown into the
  first dance, a finish past the curfew.
- **Slack, not just clashes.** Per-block contingency, headroom to the next
  anchor, and minutes left before curfew in the header — the number a
  coordinator actually runs the day on.
- **What-if before you commit.** Drag a block and every downstream block
  ghosts to where it would land, with any new clash lit up. Release to keep
  it, Escape to put it back.
- **Sunset, worked out offline.** Enter the venue's coordinates and the day's
  UTC offset and Cadence knows when the light goes, and says so when the
  portraits have drifted past it. No network, no timezone database.
- **Five printed pieces.** A master run-sheet, a call sheet per supplier, a
  guest-facing order of the day, a contact sheet of who to ring, and a
  one-page timeline: the whole day to scale, a column per lane.
- **Moments as well as stretches.** A block with no length — the rings handed
  over, the cake cut — sits on the clock as a mark rather than a box, takes no
  time from its lane, and can be pinned inside something already running.
- **Vector PDFs with embedded fonts.** Text stays text — selectable, sharp,
  and the same on the print shop's machine as on yours.
- **One file.** Save the whole day as a `.cadence.json` you can move between
  machines, or export a `.day.json` with the times worked out for another tool
  to read.

Desktop only. A wedding day is twelve hours wide and does not read on a phone.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest, including the PDF read-back tests
npm run build      # static output in dist/, with both build gates
npm run sample     # writes the four sample PDFs from the fixture
```

`npm run build` runs two gates. `validate-data` re-parses the fixture against
the current schema and fails if the sample day has picked up a clash.
`offline-gate` scans the built bundle for anything that could reach another
origin and fails the build if it finds one.

## How it is put together

```
src/core/      pure TypeScript, no React, every module with a colocated test
  time/        minutes-from-midnight arithmetic
  model/       the document, its defaults, its tags
  schedule/    resolve, conflicts, slack, what-if
  sun/         NOAA solar position
  project/     .cadence.json read, write and migrate
src/render/
  pdf/         the five printed pieces
  screen/      the timeline and presentation mode
src/state/     store, history, autosave, blob store, fonts
src/ui/        panels and chrome
```

Two rules hold the shape:

**Time is an integer count of wall-clock minutes from the day's 00:00.**
Values above 1440 belong to the following morning — a reception ending at
01:30 is 1530. No `Date`, no timezone, no DST, and none of the bugs that come
with them.

**`resolve()` is the single derived view.** The screen and every PDF read its
output and nothing else, memoised on document identity. They cannot disagree
about when anything happens.

## Licence

MIT. Bundled fonts are SIL Open Font License 1.1 — see
[src/assets/fonts/LICENSES.md](src/assets/fonts/LICENSES.md).
