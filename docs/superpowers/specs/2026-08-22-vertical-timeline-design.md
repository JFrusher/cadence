# Vertical timeline — design

**Date:** 2026-08-22
**Status:** approved in chat, not yet implemented
**Scope:** the screen timeline and the printed timeline. Nothing below changes
the document model, the resolver, conflicts, slack, what-if, or the other three
printed pieces.

## The problem, measured

The screen timeline runs time left-to-right and gives each lane a row. A block's
width is `durationMin × pxPerMin`, and the default zoom is `1.1`. A label needs
roughly 90–110px. So, in the sample day:

| Block | Width at 1.1 px/min | Holds its name? |
|---|---|---|
| Cake cutting, first dance, call to dinner (10m) | 11px | no — and an 11px hit target |
| Confetti (15m) | 17px | no |
| Guests arrive, travel, room turnaround (30m) | 33px | no |
| Ceremony, speeches (45m) | 50px | no |
| Wedding breakfast (1h 30m) | 99px | barely |
| Bridal preparations (3h) | 198px | yes |

**Four of twenty-seven blocks can show their own name.** The lane is 84px tall,
so a 30-minute block is a 33×55 portrait sliver: tall, thin, and empty. The
aspect ratio is upside down for text, and the only remedy on offer is a zoom
control that starts too low and steps too coarsely.

Three further reads fail on the same screen:

- **Anchored vs floating** — the distinction the whole model rests on — is a 6px dot.
- **Gaps are invisible.** Deliberate air and dead space look identical.
- **Nothing degrades.** Blocks print label, start time and duration at every
  size, and `text-overflow: ellipsis` decides what survives. A 33px block
  renders an ellipsis and no information at all.

## What is already right, and stays

- `resolve()` is the only thing that turns anchors, gaps and durations into
  clock times. Screen and every PDF read it and nothing else, memoised on
  document identity. Untouched by this work.
- Anchored/floating as the core primitive; anchoring pins in place rather than
  jumping.
- Moments as zero-length blocks — one type, `isMoment()` derived, not stored.
- Squeeze that never edits `durationMin`, reports `squeezedMin`, and raises an
  advisory.
- Drag as a what-if against a copy, with ghosts and a conflict diff, committing
  only on pointer-up.
- Tick intervals derived from label width, so the ruler cannot crowd itself.
- Conflict vs advisory, with export gated on conflicts only.

## Decisions

| Question | Decision |
|---|---|
| Orientation | Vertical. Time runs down, one column per lane — the shape of the printed timeline. |
| Blocks too short for their name | Stay exactly to scale; the name hangs in adjacent free space on a tether. |
| What the screen answers first | What happens, in order. Names win the space. |
| Audience | The planner, alone. Paper is the product. |
| Scale | Fixed, with scrolling. Not fit-to-window. |
| Many lanes | Columns share the width down to a floor, then the lane strip scrolls sideways. |
| The horizontal layout | Retired, not kept behind a toggle. |
| The Blocks panel | Trimmed to lane management. The timeline takes over picking, reordering and deleting. |
| Presentation mode | Kept. It rides on the same component and costs nothing. |

## Screen: geometry

- Clock gutter 68px, sticky to the left edge.
- One column per lane. Columns share the available width evenly down to a
  **160px floor**; past that the lane strip scrolls horizontally. The day itself
  never scrolls sideways.
- **Default scale 1.3 px/min.** Zoom ×1.25 per step, clamped to 0.4–6.
- An 18-hour day is ~1400px — about two screens.

What that buys against today:

| Block | Today (width) | Vertical at 1.3 (height × column) |
|---|---|---|
| Cake cutting 10m | 11px | 13px × ~200px |
| Confetti 15m | 17px | 20px × ~200px |
| Guests arrive 30m | 33px | 39px × ~200px |
| Ceremony 45m | 50px | 59px × ~200px |
| Bridal prep 3h | 198px | 234px × ~200px |

The win is not the scale. It is that a label reads *across* a column instead of
along a 33px box.

## Screen: what a block shows

Height decides, so a box is never reduced to an ellipsis:

| Box height | Shows |
|---|---|
| ≥ 46px | Name, then `08:00 · 3h`, with the squeeze marker |
| 28–45px | Name, with the start time right-aligned on the same line |
| 16–27px | Name only |
| < 16px | Nothing inside. The name hangs in adjacent free space on a hairline tether — **and that label is the block's click target**, which solves the 5px hit area without bending the geometry. |

Hanging labels take the free space after the block, else before it. Where two
would collide the earlier keeps its place and the later shifts down. They never
overlap and never sit on top of a box.

**Moments become a rule across the column with a chip on it** — what the printed
timeline already does. This supersedes the reserved strip at the foot of each
lane added on 2026-08-22; that CSS is deleted with the horizontal layout.

**Anchors get weight.** Anchored: a solid 2px top edge, a pin in the gutter, and
its clock label set bold in the ruler. Floating: a hairline dashed top edge.

**Gaps become visible.** A gap of 10 minutes or more draws a dashed leader with
its length on it — `+15m`. Deliberate air stops reading as dead space. Buffer
keeps its hatch, now below the box.

**Trouble.** Conflict: a 3px red left border. Advisory: amber. The list beneath
the timeline is unchanged.

## Screen: interaction

- **Drag vertically to shift.** The same `whatIf` machinery; `clientX` becomes
  `clientY`. Ghosts, Escape and the single undo entry are unchanged.
- **Drag never reorders.** Dragging a floating block changes its gap, and order
  within a lane is a separate idea that a pixel gesture should not decide.
  Reorder stays explicit: ↑/↓ controls on the selected block, and the keyboard.
- ↑/↓ walk the lane. ←/→ jump to the nearest block in the next lane.
- **Shift+↑/↓ nudges the selected block ±5 minutes.** **Alt+↑/↓ resizes ±5.**
  Today the arrows only select, and drag is the only way to move anything.
- Ctrl/⌘+wheel zooms about the minute under the cursor. Plain wheel scrolls
  time. A **Fit day** button sets the scale that puts the whole day in view.
- Scroll-selection-into-view flips from X to Y.

## Screen: what is deliberately not added

A now-line (the day is planned in advance and run off paper), colour-by-tag, a
minimap, a second view behind a toggle, per-lane collapse. Each of these earns
its keep in a tool someone watches during the day. This is not that tool.

## Printed timeline: changes

The paper piece is already the right shape, so these are corrections rather than
a rewrite. It keeps its own answer to short blocks — the minimum readable box
with the lane shuffling down and repaying at the first gap — because a hanging
label has nowhere to hang on a sheet with four columns and no zoom.

1. **Displaced boxes admit it.** `boxesFor` pushes a short block down and repays
   the debt at the next gap, so a box can sit a few millimetres below its true
   hour. Draw a hairline tick at the block's true start against the lane's left
   edge whenever the box has been displaced. The clock inside stays true; now
   the geometry says so too.
2. **Contingency becomes geometry.** Buffer prints as `+15m spare` in the notes
   line while the screen draws it as a hatched band. The space between one box
   and the next is exactly the buffer, so draw it: a paler band filling that
   gap, and drop the text.
3. **Anchored blocks are marked.** Nothing on the sheet distinguishes the
   immovable 13:30 from a block that merely lands there. A pin in the gutter
   beside the hour, matching the screen.
4. **Squeezed blocks are marked.** The box prints the squeezed length,
   correctly, but never says it was squeezed. Add the same `↤12m` marker the
   screen uses.
5. **Long gaps are labelled.** A gap of 15 minutes or more inside a lane gets
   its length set small and muted in the white space.
6. **Lane tint follows the lane, not the page.** `fill = 0.09 + laneIndex *
   0.07` uses the index within the page, so the fifth lane on page two is drawn
   in the first lane's tint. Use the lane's index in the document.
7. **A one-line key in the footer.** What the hatch, the pin and the rule mean —
   muted, at meta size, beside the generated-on line.

## Files

| File | Change |
|---|---|
| `src/render/screen/Timeline.tsx` | Rewritten: columns, sticky gutter, Y scrolling |
| `src/render/screen/BlockView.tsx` | Vertical geometry, the height thresholds, anchor and gap treatment |
| `src/render/screen/Ruler.tsx` | Vertical ruler in the gutter |
| `src/render/screen/ticks.ts` | A vertical label pitch (~24px) alongside `MIN_LABEL_PX` |
| `src/render/screen/labelPlacement.ts` | New, pure: boxes and label heights in, placements out |
| `src/render/screen/useDragBlock.ts` | Y instead of X |
| `src/state/useKeyboard.ts` | Nudge, resize, lane jump |
| `src/App.tsx` | Zoom control: ×1.25 steps, Fit day |
| `src/ui/panels/BlocksPanel.tsx` | Trimmed to lanes and the order-of-day toggle |
| `src/render/pdf/timeline.ts` | The seven changes above |
| `*.module.css` | Horizontal layout CSS deleted, including the moment strip |

## Testing

- `labelPlacement.test.ts` — new. A label takes the gap after its block; falls
  back to the gap before; two labels in one gap do not overlap; a label never
  covers a box.
- `ticks.test.ts` — extend for the vertical pitch: at 1.3 px/min the ruler lands
  on half-hours, and no two labels collide anywhere in 0.4–6.
- `useDragBlock.test.ts` — the same maths on Y.
- `useKeyboard.test.ts` — nudge and resize move the block by five minutes and
  leave one undo entry; neither fires while a field has focus.
- `timeline.test.ts` (PDF) — extend: a displaced box draws its true-time tick; a
  block with a buffer draws the band and no longer prints `spare`; the fifth
  lane on page two is not drawn in the first lane's tint.
- The existing 225 tests stay green. `npm run build` and the offline gate stay
  clean.

## Already done, recorded here so it is not re-litigated

- **Clearing a duration no longer makes a moment mid-keystroke.** `NumberField`
  committed on every input event, so backspacing `180` hit `Number("") === 0`,
  the block became a moment, and the field unmounted under the cursor. It now
  holds its own text and commits on blur or Enter, like `TimeField`. The rule is
  `commitNumber`, tested. A deliberate `0` still makes a moment.
- **Moments no longer sit under the blocks that follow them.** Fixed on the
  horizontal layout with a reserved strip; superseded by the rule-and-chip
  treatment above.

## Open question

Reorder-by-drag was decided against (drag = time, reorder = explicit). If
dragging a block past its neighbour should instead reorder the lane, say so —
it changes `useDragBlock` and the ghost preview, not the layout.
