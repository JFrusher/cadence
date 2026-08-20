# Using Cadence

A wedding day is a chain of things that have to happen in order, pinned in
place by a few that cannot move. Cadence is built around exactly that.

## Start

Open Cadence and you get an empty day. **Sample day** fills it with a
realistic one you can pull apart — the quickest way to see how anchors and
floats behave. **New** clears it again.

Fill in the day first, in the left sidebar:

- **Couple** and **Venue** — they head every printed piece.
- **Date** — used for the sunset calculation and printed on the sheets.
- **Curfew** — when everything must be finished. Past midnight, type
  `01:00 +1`. Cadence counts minutes from the morning, so half past one in the
  morning is later than eleven at night, not earlier.
- **Latitude, longitude and clocks** — the venue's coordinates and the day's
  offset from UTC. British Summer Time is UTC+1. Cadence works out sunset from
  these, offline. It does not guess the offset, because guessing it is how
  photographs get scheduled in the dark.

## Anchors and floats

Every block has a duration. Then it is one of two things.

**Anchored.** Pinned to a clock time. The ceremony at 13:30, the last dance at
half midnight. Nothing upstream can push it.

**Floating.** Starts when the block before it in the same lane ends, plus its
gap. Most of the day is floating — confetti happens after the ceremony, not at
14:15 specifically.

This is what makes the day recalculate. Lengthen the speeches and everything
floating after them moves; the first dance, anchored at 20:30, does not.

Press **Anchor to the clock** in the inspector and the block pins *where it
already is* — it does not jump. Press it again and it floats once more, gap
intact.

## Lanes

Three to start with: Main day, Suppliers, Transport. Lanes run independently, so
the band setting up at six does not push the wedding breakfast. Put anything
that happens alongside the main day, rather than inside it, in its own lane.

They are yours to change. **+ Lane** at the foot of the Blocks panel adds one;
click a lane's name to rename it, and every block standing in it comes along.
The **×** beside a lane removes it, but only once it is empty — a lane that took
its blocks with it is an hour of the day gone quietly.

## Squeeze

Some blocks have give in them. Drinks can run three quarters of an hour instead
of an hour; a ceremony cannot.

Tick **Can be squeezed** in the inspector and set the shortest the block may run.
When the blocks before an anchored one overrun it, Cadence takes the difference
out of whatever is squeezable in that stretch — sharing it out in proportion to
how much give each has, and never past the floor you set. Contingency is left
alone; it is time you already set aside.

The duration you typed is never edited. The timeline and every printed sheet
show the length the block *actually* runs, with the amount taken beside it and
an advisory in the warnings, so nothing is shortened behind your back. Overrun
that squeezing cannot absorb is still reported as the clash it is.

## Moments

Some things on a day have no length: the rings handed to the best man, the cake
cut, the coach pulling away. Tick **A moment, not a stretch** in the block
panel, or press **+ Moment** on a lane, and the block becomes a point on the
clock instead of a box.

A moment costs its lane nothing. Whatever follows it carries on from the block
it sits inside, so you can pin one in the middle of something already running
without anything having to move — and that is not reported as a clash. A
supplier wanted at a moment and at a block elsewhere raises an advisory rather
than a clash, because a person can step away for a minute; it never blocks the
print run.

On screen a moment is a diamond with its name beside it. On the run-sheet its
length reads *moment*; on the timeline it is a rule drawn across its lane with
the time and the name on it. Turning the tick off again gives the block the
default thirty minutes back — the length you first typed is gone, so check it.

## Reading the timeline

Blocks sit to scale against the ruler. The hatched tail on a block is its
contingency — time you have set aside but do not intend to use. A dot means
anchored. The ruler marks sunset and the curfew.

Colour means trouble:

- **Red** — a clash. Two anchored blocks overlapping, the same supplier in two
  places at once, a floating chain that has run into an anchor, or a lane
  finishing after the curfew.
- **Amber** — an advisory. Photography tagged `photo` scheduled after the light
  has gone. Advisories never stop you exporting; they are a fact about the
  world, not a mistake.

Every one of them is listed under the timeline. Click a line to jump to the
block it is about.

## Moving things

Drag a block sideways. While you drag, every downstream block ghosts at its
new time and any clash the move would cause lights up. Release to keep it.
**Escape** puts it back, and leaves no entry in the undo history.

Ctrl+Z and Ctrl+Shift+Z undo and redo. Delete removes the selected block.
Arrow keys walk along the lane.

## Slack

The header shows minutes left before the curfew. The inspector shows the
headroom between the selected block's segment and the next anchor below it.
When that number goes red you are over — either the block is too long or the
anchor is too early, and Cadence will not choose for you.

Give the parts of the day that always overrun a contingency: the room
turnaround, the drive to the ceremony. It is counted into the timings and
printed on the run-sheet as spare, so a coordinator can see where the give is.

## Tags

Type them into a block, comma separated: `photographer, band`. They are free
text, which means you can tag anything: a supplier, a family group, a room.

Open a tag in the **Tags** panel to add a name, a phone number, an arrival
time and notes. Those details drive the call sheets and the contact sheet.
Take a tag off its last block and Cadence keeps the details, listed under *no
longer on any block* — the phone number is the part that is hard to get back.

## Handing the day to another tool

**Export day** writes a `.day.json`: the whole day with its clock times already
worked out, block by block, plus the tag details as teams. It is what Brigade —
the jobs and crew tool — reads, so that the work of deciding when things happen
stays here and is never done twice.

It is an export, not a project file. The anchors, gaps and squeeze floors that
make the day editable are not in it, so there is nothing to open back into
Cadence. Change the day here, export again, and the other tool reconciles.

## Printing

Pick a piece in the export bar and press **Download PDF**.

**Master run-sheet.** Every block that opts in, in clock order across all
lanes, with times, durations, locations, who is needed and notes. Clashes are
flagged in the margin. This is the coordinator's document.

**Timeline.** One A4, time running down the page, a column per lane, and every
block drawn to length in its lane's tint. It carries whatever is on the master
run-sheet, so there is nothing extra to tick. Press **Download timeline** in the
export bar. The scale bends to fit the day on the sheet, however long the day
runs; past four lanes it continues on a second page. A block too short to hold
its own name is drawn at the shortest readable height and the blocks under it
shuffle down a millimetre or two, catching up again at the next gap — the
printed clock inside each box is always the true one.

**Call sheets.** The same layout filtered to one tag, headed with that
supplier's name, arrival and number. Exports as one PDF with a page per
supplier — hand each of them their page.

**Order of the day.** A5, guest-facing, times and titles only. Nothing
operational reaches it. Blocks opt in individually, in the inspector under
*appears on*; there is a bulk toggle in the Blocks panel.

**Contact sheet.** One page, every supplier, who to ring. A tag with no phone
number still gets a row, because the gap is the point.

Export is blocked while a clash is unresolved. A printed sheet that
contradicts itself is worse than none — fix the clash or accept the change,
then print.

Print at 100%, not "fit to page", or the type will come out smaller than the
sizes you set.

## Design

The **Design** panel styles each piece separately: font, type size, rule
weight, accent colour. Change the run-sheet's font and the order of the day
keeps its own.

Add your own fonts in the **Fonts** panel — `.ttf`, `.otf` or `.woff2`. They
are stored in your browser, embedded into the PDFs you make, and sent nowhere.

## Saving

Cadence saves the day to your browser as you work, so closing the tab does not
lose it. That is one browser on one machine.

**Save day** writes a `.cadence.json` — the whole thing, portable. **Open day**
reads one back. Move that file between machines, keep it as a backup, send it
to whoever is running the day. If it arrives without an uploaded font or logo,
Cadence says which are missing rather than failing to open.

## Presenting

**Present** fills the screen with the timeline, read-only, at a size that reads
across a room. Nothing can be edited by accident while you walk a couple
through their day. Escape returns.
