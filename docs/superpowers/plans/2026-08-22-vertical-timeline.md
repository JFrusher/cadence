# Vertical Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the screen timeline from lane-rows running left-to-right into lane-columns running top-to-bottom, so every block can show its own name, and correct seven honesty and consistency faults in the printed timeline.

**Architecture:** All layout decisions move into small pure modules (`ticks.ts`, `labelPlacement.ts`, store zoom actions, exported helpers in `pdf/timeline.ts`) which carry the tests. The React components and the pdf-lib drawing code stay dumb: they turn numbers into elements. `resolve()`, conflicts, slack and what-if are not touched — this is a rendering change only.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Vite, Vitest (node environment by default; `// @vitest-environment jsdom` docblock where the DOM is needed), pdf-lib + fontkit for the PDFs.

**Spec:** `docs/superpowers/specs/2026-08-22-vertical-timeline-design.md`

## Global Constraints

- **No new dependencies.** The offline gate (`npm run gate:offline`) fails the build if anything in the bundle can reach another origin.
- **`resolve()` and the schedule modules are read-only in this work.** If a task seems to need a change in `src/core/`, stop and raise it.
- **The printed length is always `contentEndMin - startMin`,** never `block.durationMin`. A squeezed block prints what it actually runs.
- **Every duration the user typed stays in the document.** Nothing here may write `durationMin`, except the explicit keyboard resize in Task 9, which floors at 5 minutes so it can never silently create a moment.
- **Existing tests stay green:** 225 tests at the time of writing, plus the ones added here. `npm run build` (which runs `tsc -b`, Vite, then the offline gate) must pass at the end of every task.
- **Commit style:** the repo uses Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- **Units:** the screen works in pixels and minutes; the PDF works in millimetres and minutes. Never mix.
- **`tsconfig.json` is strict in four ways that bite:** `verbatimModuleSyntax` (types must be imported with `import type`), `noUnusedLocals` and `noUnusedParameters` (a selector left behind after an edit fails the build — delete it), `noUncheckedIndexedAccess` (`array[i]` is `T | undefined`, so guard or `as`), and `exactOptionalPropertyTypes` (never pass `undefined` explicitly for an optional prop; spread it conditionally, as the existing code does with `{...(readOnly ? {} : { onSelect: select })}`).

---

### Task 1: A vertical tick pitch for the ruler

The ruler currently picks its interval from how *wide* a clock label is (`MIN_LABEL_PX = 58`). Running down the page, what matters is how *tall* a line of type is. Same algorithm, different constant, so `tickInterval` and `ticks` take the pitch as an argument.

**Files:**
- Modify: `src/render/screen/ticks.ts`
- Test: `src/render/screen/ticks.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MIN_LABEL_PITCH_PX: number` (24), `tickInterval(pxPerMin: number, minLabelPx?: number): number`, `ticks(fromMin: number, toMin: number, pxPerMin: number, minLabelPx?: number): Tick[]`. Both new parameters default to the existing horizontal constant, so current callers keep working.

- [ ] **Step 1: Write the failing test**

Add to `src/render/screen/ticks.test.ts`:

```ts
import { MIN_LABEL_PITCH_PX, tickInterval, ticks } from "./ticks";

describe("vertical pitch", () => {
  it("lands on half hours at the default vertical scale", () => {
    // 1.3 px/min: a 15 minute interval is 19.5px, under the 24px a line of
    // type needs. 30 minutes is 39px, which clears it.
    expect(tickInterval(1.3, MIN_LABEL_PITCH_PX)).toBe(30);
  });

  it("never lets two labels collide anywhere in the supported zoom range", () => {
    for (let pxPerMin = 0.4; pxPerMin <= 6; pxPerMin += 0.1) {
      const interval = tickInterval(pxPerMin, MIN_LABEL_PITCH_PX);
      expect(interval * pxPerMin).toBeGreaterThanOrEqual(MIN_LABEL_PITCH_PX);
    }
  });

  it("opens up as the day is zoomed out", () => {
    expect(tickInterval(0.4, MIN_LABEL_PITCH_PX)).toBeGreaterThan(
      tickInterval(2, MIN_LABEL_PITCH_PX),
    );
  });

  it("labels only the ticks the pitch allows", () => {
    const labelled = ticks(600, 780, 1.3, MIN_LABEL_PITCH_PX).filter((tick) => tick.label);
    expect(labelled.map((tick) => tick.min)).toEqual([600, 630, 660, 690, 720, 750, 780]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/screen/ticks.test.ts`
Expected: FAIL — `MIN_LABEL_PITCH_PX` is not exported, and `tickInterval` takes one argument.

- [ ] **Step 3: Write minimal implementation**

In `src/render/screen/ticks.ts`, add the constant and thread the parameter through:

```ts
/** A label is about this wide at the ruler's type size, plus breathing room. */
export const MIN_LABEL_PX = 58;

/** A line of clock type is about this tall, plus breathing room, running down. */
export const MIN_LABEL_PITCH_PX = 24;

/** The smallest interval whose labels will not collide at this zoom. */
export function tickInterval(pxPerMin: number, minLabelPx = MIN_LABEL_PX): number {
  const fits = INTERVALS.find((interval) => interval * pxPerMin >= minLabelPx);
  return fits ?? (INTERVALS[INTERVALS.length - 1] as number);
}

export function ticks(
  fromMin: number,
  toMin: number,
  pxPerMin: number,
  minLabelPx = MIN_LABEL_PX,
): Tick[] {
  if (toMin <= fromMin || pxPerMin <= 0) return [];

  const interval = tickInterval(pxPerMin, minLabelPx);
  const minor = interval >= 60 ? interval / 4 : interval / (interval % 3 === 0 ? 3 : 5);
  const step = Math.max(1, Math.round(minor));

  const first = Math.ceil(fromMin / step) * step;
  const out: Tick[] = [];
  for (let min = first; min <= toMin; min += step) {
    const major = min % interval === 0;
    out.push({ min, label: major ? formatClock(min) : "", major });
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/render/screen/ticks.test.ts`
Expected: PASS, including the four pre-existing `ticks` tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/screen/ticks.ts src/render/screen/ticks.test.ts
git commit -m "feat: let the ruler pick its interval from a vertical label pitch"
```

---

### Task 2: What a box can hold, and where its label goes

Two pure decisions, in one module because they are one concern: how much of a block fits inside its box, and — when nothing fits — where the name hangs instead.

**Files:**
- Create: `src/render/screen/labelPlacement.ts`
- Test: `src/render/screen/labelPlacement.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type BlockDetail = "full" | "compact" | "name" | "outside"`
  - `blockDetail(heightPx: number): BlockDetail`
  - `interface LabelBox { id: string; topPx: number; heightPx: number }`
  - `placeLabels(boxes: LabelBox[], labelled: Set<string>, labelHeightPx: number, bottomPx: number): Map<string, number>` — id to the top of its hanging label, in the same pixel space as the boxes.

- [ ] **Step 1: Write the failing test**

Create `src/render/screen/labelPlacement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blockDetail, placeLabels, type LabelBox } from "./labelPlacement";

describe("blockDetail", () => {
  it("gives a tall box everything and a sliver nothing", () => {
    expect(blockDetail(60)).toBe("full");
    expect(blockDetail(46)).toBe("full");
    expect(blockDetail(45)).toBe("compact");
    expect(blockDetail(28)).toBe("compact");
    expect(blockDetail(27)).toBe("name");
    expect(blockDetail(16)).toBe("name");
    expect(blockDetail(15)).toBe("outside");
    expect(blockDetail(0)).toBe("outside");
  });
});

describe("placeLabels", () => {
  const label = 15;

  it("takes the free space after the block", () => {
    const boxes: LabelBox[] = [
      { id: "a", topPx: 0, heightPx: 10 },
      { id: "b", topPx: 100, heightPx: 40 },
    ];
    expect(placeLabels(boxes, new Set(["a"]), label, 400).get("a")).toBe(10);
  });

  it("falls back to the space before when the space after is taken", () => {
    const boxes: LabelBox[] = [
      { id: "a", topPx: 40, heightPx: 10 },
      { id: "b", topPx: 50, heightPx: 60 },
    ];
    // Nothing free below: b starts the moment a ends. Above a is clear.
    expect(placeLabels(boxes, new Set(["a"]), label, 400).get("a")).toBe(25);
  });

  it("keeps two labels in one gap from overlapping", () => {
    const boxes: LabelBox[] = [
      { id: "a", topPx: 0, heightPx: 6 },
      { id: "b", topPx: 8, heightPx: 6 },
    ];
    const placed = placeLabels(boxes, new Set(["a", "b"]), label, 400);
    const a = placed.get("a") as number;
    const b = placed.get("b") as number;
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(label);
  });

  it("never lays a label over a box", () => {
    const boxes: LabelBox[] = [
      { id: "a", topPx: 0, heightPx: 6 },
      { id: "b", topPx: 10, heightPx: 80 },
      { id: "c", topPx: 95, heightPx: 6 },
    ];
    const placed = placeLabels(boxes, new Set(["a", "c"]), label, 400);
    for (const [id, top] of placed) {
      for (const box of boxes) {
        if (box.id === id) continue;
        const clear = top + label <= box.topPx || top >= box.topPx + box.heightPx;
        expect(clear).toBe(true);
      }
    }
  });

  it("keeps a label inside the column", () => {
    const boxes: LabelBox[] = [{ id: "a", topPx: 390, heightPx: 6 }];
    const top = placeLabels(boxes, new Set(["a"]), label, 400).get("a") as number;
    expect(top + label).toBeLessThanOrEqual(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/screen/labelPlacement.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/render/screen/labelPlacement.ts`:

```ts
/**
 * How much of a block its box can hold. A box that can only show an ellipsis
 * shows nothing instead, and its name hangs beside it — see `placeLabels`.
 */
export type BlockDetail = "full" | "compact" | "name" | "outside";

export function blockDetail(heightPx: number): BlockDetail {
  if (heightPx >= 46) return "full";
  if (heightPx >= 28) return "compact";
  if (heightPx >= 16) return "name";
  return "outside";
}

export interface LabelBox {
  id: string;
  topPx: number;
  heightPx: number;
}

interface Span {
  topPx: number;
  bottomPx: number;
}

function clashes(candidate: Span, taken: Span[]): boolean {
  return taken.some((span) => candidate.topPx < span.bottomPx && span.topPx < candidate.bottomPx);
}

/**
 * Where each hanging label sits, in the column's pixel space.
 *
 * A label takes the free space directly after its block; failing that, the
 * space before it; failing both, it slides down from its block until it finds
 * room. Boxes are never covered and labels never overlap each other, so the
 * earlier block in a run of slivers keeps the place nearest its own time.
 */
export function placeLabels(
  boxes: LabelBox[],
  labelled: Set<string>,
  labelHeightPx: number,
  bottomPx: number,
): Map<string, number> {
  const ordered = [...boxes].sort((a, b) => a.topPx - b.topPx);
  const taken: Span[] = ordered.map((box) => ({
    topPx: box.topPx,
    bottomPx: box.topPx + box.heightPx,
  }));
  const placed = new Map<string, number>();

  for (const box of ordered) {
    if (!labelled.has(box.id)) continue;

    const after = box.topPx + box.heightPx;
    const before = box.topPx - labelHeightPx;
    const candidates = [after, before];

    let top: number | null = null;
    for (const candidate of candidates) {
      if (candidate < 0 || candidate + labelHeightPx > bottomPx) continue;
      if (clashes({ topPx: candidate, bottomPx: candidate + labelHeightPx }, taken)) continue;
      top = candidate;
      break;
    }

    if (top === null) {
      // Nothing free either side: slide down until something opens up.
      let slide = after;
      while (
        slide + labelHeightPx <= bottomPx &&
        clashes({ topPx: slide, bottomPx: slide + labelHeightPx }, taken)
      ) {
        slide += 1;
      }
      top = Math.min(slide, Math.max(0, bottomPx - labelHeightPx));
    }

    placed.set(box.id, top);
    taken.push({ topPx: top, bottomPx: top + labelHeightPx });
  }

  return placed;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/render/screen/labelPlacement.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/screen/labelPlacement.ts src/render/screen/labelPlacement.test.ts
git commit -m "feat: decide what a box holds and where a hanging label goes"
```

---

### Task 3: Zoom as store actions

The zoom buttons currently do arithmetic inline in `App.tsx` with a `0.2` step, which is a 2× jump at the bottom of the range. Zoom becomes two store actions so it can be tested and reused by the wheel handler and the Fit day button.

**Files:**
- Modify: `src/state/store.ts` (the `UiState` default at line ~142, the `StoreState` interface at ~74–115, and the actions object)
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `zoomBy(factor: number): void` and `fitDay(viewportPx: number, spanMin: number): void` on the store; `ZOOM_MIN = 0.4`, `ZOOM_MAX = 6`, `ZOOM_STEP = 1.25` exported from `src/state/store.ts`. Default `ui.pxPerMin` becomes `1.3`.

- [ ] **Step 1: Write the failing test**

Add to `src/state/store.test.ts`:

```ts
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./store";

describe("zoom", () => {
  beforeEach(() => {
    useStore.getState().loadDoc(sampleDoc());
  });

  it("opens at a scale that shows a half hour as a readable box", () => {
    expect(useStore.getState().ui.pxPerMin).toBe(1.3);
  });

  it("steps by a ratio, not a fixed amount", () => {
    const before = useStore.getState().ui.pxPerMin;
    useStore.getState().zoomBy(ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBeCloseTo(before * ZOOM_STEP, 5);
  });

  it("stays inside the range however hard it is pushed", () => {
    for (let i = 0; i < 40; i += 1) useStore.getState().zoomBy(ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBe(ZOOM_MAX);
    for (let i = 0; i < 40; i += 1) useStore.getState().zoomBy(1 / ZOOM_STEP);
    expect(useStore.getState().ui.pxPerMin).toBe(ZOOM_MIN);
  });

  it("fits the day to the viewport it is given", () => {
    useStore.getState().fitDay(1000, 500);
    expect(useStore.getState().ui.pxPerMin).toBe(2);
  });

  it("will not fit a day into no room at all", () => {
    const before = useStore.getState().ui.pxPerMin;
    useStore.getState().fitDay(0, 500);
    useStore.getState().fitDay(1000, 0);
    expect(useStore.getState().ui.pxPerMin).toBe(before);
  });

  it("does not put zoom in the undo history", () => {
    useStore.getState().zoomBy(ZOOM_STEP);
    expect(useStore.getState().canUndo()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — `ZOOM_STEP` is not exported and `zoomBy` is not a function.

- [ ] **Step 3: Write minimal implementation**

In `src/state/store.ts`, add near the top:

```ts
/** The zoom range, in pixels per minute, and the ratio each press moves it by. */
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 6;
export const ZOOM_STEP = 1.25;

function clampZoom(pxPerMin: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pxPerMin));
}
```

Add to the `StoreState` interface, beside `setUi`:

```ts
  zoomBy: (factor: number) => void;
  fitDay: (viewportPx: number, spanMin: number) => void;
```

Change the UI default from `pxPerMin: 1.1` to `pxPerMin: 1.3`, and add the actions beside `setUi`:

```ts
  zoomBy: (factor) =>
    set((state) => ({ ui: { ...state.ui, pxPerMin: clampZoom(state.ui.pxPerMin * factor) } })),

  // A day that will not fit is not a reason to divide by nothing.
  fitDay: (viewportPx, spanMin) =>
    set((state) =>
      viewportPx <= 0 || spanMin <= 0
        ? state
        : { ui: { ...state.ui, pxPerMin: clampZoom(viewportPx / spanMin) } },
    ),
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS, including the 19 pre-existing store tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat: zoom by ratio, and fit the day to the viewport"
```

---

### Task 4: Drag down the page instead of across it

`useDragBlock` is already axis-agnostic in its maths — only the call site reads `clientX`. Rename the argument so the next reader is not misled, and move the pointer handlers to Y.

**Files:**
- Modify: `src/render/screen/useDragBlock.ts`
- Test: `src/render/screen/useDragBlock.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `minutesFromDelta(dPx: number, pxPerMin: number, snapMin?: number): number` (unchanged signature), and `start(blockId: string, clientY: number): void` — the second argument is now the pointer's **Y**.

- [ ] **Step 1: Write the failing test**

Replace the `converts pixels to minutes at the current zoom` test in `src/render/screen/useDragBlock.test.ts` with:

```ts
  it("converts pixels dragged down the page to minutes", () => {
    // Down the page is later, so a positive delta is a later time.
    expect(minutesFromDelta(60, 1)).toBe(60);
    expect(minutesFromDelta(60, 2)).toBe(30);
    expect(minutesFromDelta(-60, 2)).toBe(-30);
  });
```

And add:

```ts
  it("moves a block to a later time when dragged downward", () => {
    useStore.getState().loadDoc(sampleDoc());
    const downward = minutesFromDelta(26, 1.3);
    useStore.getState().previewChange({ type: "shift", blockId: "blk-ceremony", deltaMin: downward });
    useStore.getState().commitPreview();
    expect(getDoc(useStore.getState()).blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(830);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/screen/useDragBlock.test.ts`
Expected: the new test FAILS only if the maths is wrong — it should pass immediately, since `minutesFromDelta(26, 1.3) === 20` and the ceremony is anchored at 810. Confirm it passes before touching the hook; this test is the guard for Step 3, not a red test.

- [ ] **Step 3: Write minimal implementation**

In `src/render/screen/useDragBlock.ts`, change the pointer axis and the parameter names:

```ts
/** Pixels dragged down the page to minutes moved, snapped. */
export function minutesFromDelta(dPx: number, pxPerMin: number, snapMin = SNAP_MIN): number {
  if (pxPerMin <= 0) return 0;
  return Math.round(dPx / pxPerMin / snapMin) * snapMin;
}
```

```ts
    const onMove = (event: PointerEvent) => {
      const deltaMin = minutesFromDelta(event.clientY - origin.current, pxPerMin);
      setDrag((current) => (current ? { ...current, deltaMin } : current));
      previewChange({ type: "shift", blockId: drag.blockId, deltaMin });
    };
```

```ts
  const start = (blockId: string, clientY: number) => {
    origin.current = clientY;
    setDrag({ blockId, deltaMin: 0 });
  };
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/render/screen/useDragBlock.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/screen/useDragBlock.ts src/render/screen/useDragBlock.test.ts
git commit -m "refactor: drag blocks down the page rather than across it"
```

---

### Task 5: The vertical ruler

The ruler moves into a sticky left gutter: clock labels down the edge, hour rules crossing the lanes, sunset and curfew as horizontal lines.

**Files:**
- Modify: `src/render/screen/Ruler.tsx`, `src/render/screen/Ruler.module.css`

**Interfaces:**
- Consumes: `ticks`, `MIN_LABEL_PITCH_PX` from Task 1.
- Produces: `<Ruler fromMin toMin pxPerMin curfewMin sunsetMin anchoredMins />` where `anchoredMins: number[]` are the minutes something is pinned to, which the ruler sets bold. Exports `GUTTER_PX = 68`. The hour rules stretch with CSS (`left: 0; right: 0`) inside the scrolling body rather than being told a width — measuring the scroller during render would read 0 on the first paint.

- [ ] **Step 1: Rewrite the component**

Replace `src/render/screen/Ruler.tsx` with:

```tsx
import { MIN_LABEL_PITCH_PX, ticks } from "./ticks";
import { formatClock } from "../../core/time/minutes";
import styles from "./Ruler.module.css";

/** The clock gutter's width. The lane strip starts here. */
export const GUTTER_PX = 68;

interface Props {
  fromMin: number;
  toMin: number;
  pxPerMin: number;
  /** Drawn as a hard line, because everything must be finished by it. */
  curfewMin: number;
  sunsetMin?: number | null;
  /** Minutes something is anchored at: those labels are set bold. */
  anchoredMins: number[];
}

export function Ruler({ fromMin, toMin, pxPerMin, curfewMin, sunsetMin, anchoredMins }: Props) {
  const marks = ticks(fromMin, toMin, pxPerMin, MIN_LABEL_PITCH_PX);
  const at = (min: number) => (min - fromMin) * pxPerMin;
  const anchored = new Set(anchoredMins);

  return (
    <div className={styles.ruler}>
      {marks.map((tick) => (
        <div
          key={tick.min}
          className={tick.major ? styles.major : styles.minor}
          style={{ top: at(tick.min) }}
        >
          {tick.label && (
            <span className={anchored.has(tick.min) ? styles.labelAnchored : styles.label}>
              {tick.label}
            </span>
          )}
        </div>
      ))}

      {sunsetMin != null && sunsetMin > fromMin && sunsetMin < toMin && (
        <div className={styles.sunset} style={{ top: at(sunsetMin) }} title="Sunset">
          <span className={styles.marker}>sunset {formatClock(sunsetMin)}</span>
        </div>
      )}

      {curfewMin > fromMin && curfewMin < toMin && (
        <div className={styles.curfew} style={{ top: at(curfewMin) }} title="Curfew">
          <span className={styles.marker}>curfew {formatClock(curfewMin)}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the stylesheet**

Replace `src/render/screen/Ruler.module.css` with:

```css
/* Sits behind the lanes and spans the whole scrolling body. */
.ruler {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.major,
.minor,
.sunset,
.curfew {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
}

.major {
  background: var(--border);
}

.minor {
  left: 56px;
  background: var(--grey-3);
}

.label,
.labelAnchored {
  position: absolute;
  left: 0;
  top: -6px;
  width: 52px;
  text-align: right;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  background: var(--surface);
}

/* Something is pinned to this minute: the clock says so. */
.labelAnchored {
  color: var(--text);
  font-weight: 600;
}

.sunset {
  background: var(--warn);
}

.curfew {
  background: var(--danger);
}

.marker {
  position: absolute;
  left: 0;
  top: -14px;
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  background: var(--surface);
}

.sunset .marker {
  color: var(--warn);
}

.curfew .marker {
  color: var(--danger);
}
```

- [ ] **Step 3: Check it compiles**

Run: `npx tsc -b --noEmit`
Expected: errors **only** in `Timeline.tsx`, which still passes the old props. Task 6 fixes them. Do not commit yet if the type check has errors elsewhere.

- [ ] **Step 4: Commit with Task 6**

The ruler cannot stand alone — commit it together with the timeline in Task 6.

---

### Task 6: The lane columns

`Timeline.tsx` becomes a sticky gutter plus a strip of lane columns, scrolling down for time and sideways only when the columns hit their floor.

**Files:**
- Modify: `src/render/screen/Timeline.tsx`, `src/render/screen/Timeline.module.css`

**Interfaces:**
- Consumes: `GUTTER_PX`, `<Ruler>` (Task 5); `zoomBy`, `fitDay` (Task 3); `useDragBlock` (Task 4).
- Produces: `LANE_MIN_PX = 160`, and the props `<BlockView>` is called with in Task 7: `{ block, entry, fromMin, pxPerMin, selected, conflicts, detail, labelTopPx, gapBeforeMin, ghost?, onSelect?, onDragStart? }`.

- [ ] **Step 1: Rewrite the component**

Replace the body of `src/render/screen/Timeline.tsx` with:

```tsx
import { useEffect, useMemo, useRef } from "react";
import { blocksById } from "../../core/schedule/resolve";
import { isMoment } from "../../core/model/types";
import { getDoc, selectSchedule, useStore, ZOOM_STEP } from "../../state/store";
import { BlockView } from "./BlockView";
import { blockDetail, placeLabels, type LabelBox } from "./labelPlacement";
import { GUTTER_PX, Ruler } from "./Ruler";
import { spanOf } from "./ticks";
import { useDragBlock } from "./useDragBlock";
import styles from "./Timeline.module.css";

/** A column narrower than this cannot hold a name, so the strip scrolls instead. */
export const LANE_MIN_PX = 160;

/** The height of a hanging label, matching `.hangingLabel` in BlockView.module.css. */
const LABEL_PX = 17;

interface Props {
  /** Presentation mode drops selection, dragging and the lane gutter's controls. */
  readOnly?: boolean;
}

export function Timeline({ readOnly = false }: Props) {
  const doc = useStore(getDoc);
  const schedule = useStore(selectSchedule);
  const preview = useStore((state) => state.preview);
  const selectedId = useStore((state) => state.selectedId);
  const select = useStore((state) => state.select);
  const pxPerMin = useStore((state) => state.ui.pxPerMin);
  const zoomBy = useStore((state) => state.zoomBy);
  const { drag, start } = useDragBlock(pxPerMin);
  const scroller = useRef<HTMLDivElement>(null);

  const blocks = useMemo(() => blocksById(doc), [doc]);
  const { fromMin, toMin } = useMemo(
    () => spanOf(schedule.resolved, doc.day.curfewMin),
    [schedule.resolved, doc.day.curfewMin],
  );

  const ghosts = useMemo(() => {
    if (!preview) return null;
    const moved = new Set(preview.movedIds);
    return preview.after.filter((entry) => moved.has(entry.id));
  }, [preview]);

  const lanes = readOnly
    ? doc.lanes.filter((lane) => doc.blocks.some((block) => block.lane === lane))
    : doc.lanes;
  const height = (toMin - fromMin) * pxPerMin;

  // Every anchored minute, so the ruler can set those labels bold.
  const anchoredMins = useMemo(
    () => schedule.resolved.filter((entry) => entry.anchored).map((entry) => entry.startMin),
    [schedule.resolved],
  );

  // Where each lane's short blocks hang their names, and the gap above each block.
  const laneLayout = useMemo(() => {
    const out = new Map<
      string,
      { labels: Map<string, number>; gaps: Map<string, number> }
    >();
    for (const lane of lanes) {
      const entries = schedule.resolved
        .filter((entry) => entry.lane === lane)
        .sort((a, b) => a.startMin - b.startMin);

      const boxes: LabelBox[] = entries
        .filter((entry) => !isMoment(blocks.get(entry.id) ?? { durationMin: 1 }))
        .map((entry) => ({
          id: entry.id,
          topPx: (entry.startMin - fromMin) * pxPerMin,
          heightPx: (entry.contentEndMin - entry.startMin) * pxPerMin,
        }));

      const labelled = new Set(
        boxes.filter((box) => blockDetail(box.heightPx) === "outside").map((box) => box.id),
      );

      const gaps = new Map<string, number>();
      let previousEnd: number | null = null;
      for (const entry of entries) {
        if (previousEnd !== null) gaps.set(entry.id, entry.startMin - previousEnd);
        previousEnd = Math.max(previousEnd ?? entry.endMin, entry.endMin);
      }

      out.set(lane, { labels: placeLabels(boxes, labelled, LABEL_PX, height), gaps });
    }
    return out;
  }, [lanes, schedule.resolved, blocks, fromMin, pxPerMin, height]);

  // Keep the selected block in view when the selection moves by keyboard.
  useEffect(() => {
    if (!selectedId || !scroller.current) return;
    const entry = schedule.positions.get(selectedId);
    if (!entry) return;
    const y = (entry.startMin - fromMin) * pxPerMin;
    const view = scroller.current;
    if (y < view.scrollTop || y > view.scrollTop + view.clientHeight - 80) {
      view.scrollTo({ top: Math.max(0, y - 120), behavior: "smooth" });
    }
  }, [selectedId, schedule.positions, fromMin, pxPerMin]);

  return (
    <div
      className={styles.timeline}
      ref={scroller}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
      }}
    >
      <div className={styles.head} style={{ paddingLeft: GUTTER_PX }}>
        {lanes.map((lane) => (
          <div key={lane} className={styles.laneName}>
            {lane}
          </div>
        ))}
      </div>

      <div className={styles.body} style={{ height }}>
        <Ruler
          fromMin={fromMin}
          toMin={toMin}
          pxPerMin={pxPerMin}
          curfewMin={doc.day.curfewMin}
          sunsetMin={schedule.sun?.sunsetMin ?? null}
          anchoredMins={anchoredMins}
        />

        <div className={styles.lanes} style={{ marginLeft: GUTTER_PX }}>
          {lanes.map((lane) => {
            const layout = laneLayout.get(lane);
            return (
              <div key={lane} className={styles.lane}>
                {schedule.resolved
                  .filter((entry) => entry.lane === lane)
                  .map((entry) => {
                    const block = blocks.get(entry.id);
                    if (!block) return null;
                    const heightPx = (entry.contentEndMin - entry.startMin) * pxPerMin;
                    return (
                      <BlockView
                        key={entry.id}
                        block={block}
                        entry={entry}
                        fromMin={fromMin}
                        pxPerMin={pxPerMin}
                        detail={blockDetail(heightPx)}
                        labelTopPx={layout?.labels.get(entry.id) ?? null}
                        gapBeforeMin={layout?.gaps.get(entry.id) ?? 0}
                        selected={!readOnly && selectedId === entry.id}
                        conflicts={schedule.byBlock.get(entry.id) ?? []}
                        {...(readOnly ? {} : { onSelect: select, onDragStart: start })}
                      />
                    );
                  })}

                {ghosts
                  ?.filter((entry) => entry.lane === lane)
                  .map((entry) => {
                    const block = blocks.get(entry.id);
                    if (!block) return null;
                    const heightPx = (entry.contentEndMin - entry.startMin) * pxPerMin;
                    return (
                      <BlockView
                        key={`ghost-${entry.id}`}
                        block={block}
                        entry={entry}
                        fromMin={fromMin}
                        pxPerMin={pxPerMin}
                        detail={blockDetail(heightPx)}
                        labelTopPx={null}
                        gapBeforeMin={0}
                        selected={false}
                        conflicts={
                          preview?.newConflicts.filter((conflict) =>
                            conflict.blockIds.includes(entry.id),
                          ) ?? []
                        }
                        ghost
                      />
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {drag && (
        <p className={styles.hint} role="status">
          Release to keep this. Escape puts it back.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the stylesheet**

Replace `src/render/screen/Timeline.module.css` with:

```css
.timeline {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--canvas-bg);
}

/* The lane names ride above the day and stay put as it scrolls. */
.head {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  min-width: min-content;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.laneName {
  flex: 1 1 0;
  min-width: 160px;
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-muted);
}

.body {
  position: relative;
  min-width: min-content;
  background: var(--surface);
}

.lanes {
  display: flex;
  height: 100%;
  min-width: min-content;
}

.lane {
  position: relative;
  flex: 1 1 0;
  min-width: 160px;
  border-left: 1px solid var(--border);
}

.hint {
  position: sticky;
  bottom: 0;
  left: 0;
  margin: 0;
  padding: var(--sp-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: var(--surface);
}
```

- [ ] **Step 3: Check it compiles**

Run: `npx tsc -b --noEmit`
Expected: errors only in `BlockView.tsx`, which does not yet accept `detail`, `labelTopPx` or `gapBeforeMin`. Task 7 fixes them.

- [ ] **Step 4: Commit with Task 7**

The three view files land together.

---

### Task 7: The block, drawn downward

**Files:**
- Modify: `src/render/screen/BlockView.tsx`, `src/render/screen/BlockView.module.css`

**Interfaces:**
- Consumes: `BlockDetail` (Task 2), the props listed in Task 6.
- Produces: nothing further.

- [ ] **Step 1: Rewrite the component**

Replace `src/render/screen/BlockView.tsx` with:

```tsx
import type { PointerEvent } from "react";
import type { Conflict } from "../../core/schedule/conflicts";
import type { ResolvedBlock } from "../../core/schedule/resolve";
import { isMoment, type Block } from "../../core/model/types";
import { formatClock, formatDuration } from "../../core/time/minutes";
import type { BlockDetail } from "./labelPlacement";
import styles from "./BlockView.module.css";

/** A gap shorter than this is not worth drawing a leader for. */
const GAP_FLOOR_MIN = 10;

interface Props {
  block: Block;
  entry: ResolvedBlock;
  fromMin: number;
  pxPerMin: number;
  selected: boolean;
  conflicts: Conflict[];
  /** How much of itself the box can hold — see labelPlacement. */
  detail: BlockDetail;
  /** Where its name hangs when the box holds nothing. Null: it holds its own. */
  labelTopPx: number | null;
  /** Minutes of air above this block in its lane. */
  gapBeforeMin: number;
  /** Ghosts show where a drag would land. They take no input. */
  ghost?: boolean;
  onSelect?: (id: string) => void;
  onDragStart?: (id: string, clientY: number) => void;
}

export function BlockView({
  block,
  entry,
  fromMin,
  pxPerMin,
  selected,
  conflicts,
  detail,
  labelTopPx,
  gapBeforeMin,
  ghost = false,
  onSelect,
  onDragStart,
}: Props) {
  const top = (entry.startMin - fromMin) * pxPerMin;
  const contentHeight = Math.max(2, (entry.contentEndMin - entry.startMin) * pxPerMin);
  const bufferHeight = Math.max(0, (entry.endMin - entry.contentEndMin) * pxPerMin);

  const severity = conflicts.some((conflict) => conflict.severity === "conflict")
    ? "conflict"
    : conflicts.length > 0
      ? "advisory"
      : null;

  const moment = isMoment(block);

  const className = [
    styles.block,
    moment ? styles.moment : "",
    entry.anchored ? styles.anchored : styles.floating,
    selected ? styles.selected : "",
    ghost ? styles.ghost : "",
    severity === "conflict" ? styles.conflict : "",
    severity === "advisory" ? styles.advisory : "",
  ]
    .filter(Boolean)
    .join(" ");

  const press = (event: PointerEvent) => {
    if (ghost || event.button !== 0) return;
    onSelect?.(block.id);
    onDragStart?.(block.id, event.clientY);
  };

  // A moment has no height to put anything in, so it becomes a rule across the
  // lane with its name on it — the same object, drawn as a line.
  if (moment) {
    return (
      <div className={className} style={{ top }}>
        <button
          type="button"
          className={styles.momentChip}
          aria-pressed={selected}
          tabIndex={ghost ? -1 : 0}
          onClick={() => onSelect?.(block.id)}
          onPointerDown={press}
        >
          <span className={styles.diamond} />
          {block.label}
          <span className={styles.times}>{formatClock(entry.startMin)}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {gapBeforeMin >= GAP_FLOOR_MIN && (
        <div
          className={styles.gap}
          style={{ top: top - gapBeforeMin * pxPerMin, height: gapBeforeMin * pxPerMin }}
          aria-hidden="true"
        >
          <span className={styles.gapLabel}>+{formatDuration(gapBeforeMin)}</span>
        </div>
      )}

      <div className={className} style={{ top, height: contentHeight + bufferHeight }}>
        <button
          type="button"
          className={styles.body}
          style={{ height: contentHeight }}
          aria-pressed={selected}
          aria-label={`${block.label}, ${formatClock(entry.startMin)}`}
          tabIndex={ghost ? -1 : 0}
          onClick={() => onSelect?.(block.id)}
          onPointerDown={press}
        >
          {detail !== "outside" && (
            <span className={styles.label}>
              {block.label}
              {detail === "compact" && (
                <span className={styles.times}>{formatClock(entry.startMin)}</span>
              )}
            </span>
          )}
          {detail === "full" && (
            <span className={styles.times}>
              {formatClock(entry.startMin)} ·{" "}
              {formatDuration(entry.contentEndMin - entry.startMin)}
              {entry.squeezedMin > 0 && (
                <span className={styles.squeezed} title={`Squeezed by ${entry.squeezedMin} min`}>
                  {" "}
                  ↤{formatDuration(entry.squeezedMin)}
                </span>
              )}
            </span>
          )}
          {severity && (
            <span className={styles.assistive}>
              {severity === "conflict" ? "Has a clash" : "Has an advisory"}
            </span>
          )}
        </button>
        {bufferHeight > 0 && (
          <div className={styles.buffer} style={{ height: bufferHeight }} title="Contingency" />
        )}
      </div>

      {detail === "outside" && labelTopPx !== null && (
        <button
          type="button"
          className={styles.hangingLabel}
          style={{ top: labelTopPx }}
          aria-pressed={selected}
          tabIndex={ghost ? -1 : 0}
          onClick={() => onSelect?.(block.id)}
          onPointerDown={press}
        >
          {block.label}
          <span className={styles.times}>{formatClock(entry.startMin)}</span>
        </button>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite the stylesheet**

Replace `src/render/screen/BlockView.module.css` with:

```css
.block {
  position: absolute;
  left: 4px;
  right: 4px;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
}

.body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  width: 100%;
  padding: 2px var(--sp-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius) var(--radius) 0 0;
  background: var(--surface);
  text-align: left;
  cursor: grab;
  overflow: hidden;
}

.block:only-child .body,
.block .body:last-child {
  border-radius: var(--radius);
}

.body:active {
  cursor: grabbing;
}

/* Pinned to the clock: a hard top edge. Floating: a soft one. */
.anchored .body {
  border-top: 2px solid var(--text);
}

.floating .body {
  border-top: 1px dashed var(--border-strong);
}

.label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-1);
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.times {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.squeezed {
  color: var(--warn);
  font-weight: 600;
}

.buffer {
  width: 100%;
  border: 1px dashed var(--border-strong);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    var(--grey-3) 3px,
    var(--grey-3) 6px
  );
}

/* Air between two blocks, with its length on it. */
.gap {
  position: absolute;
  left: 50%;
  width: 0;
  border-left: 1px dashed var(--grey-4);
  display: flex;
  align-items: center;
}

.gapLabel {
  padding-left: var(--sp-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

/* The name of a block too short to hold it, on its own line beside the day. */
.hangingLabel {
  position: absolute;
  left: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-1);
  height: 17px;
  padding: 0 var(--sp-1);
  border: 0;
  border-left: 2px solid var(--border-strong);
  background: none;
  font-size: var(--text-sm);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  cursor: grab;
}

.selected .body {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
  background: var(--accent-soft);
}

.conflict .body {
  border-left: 3px solid var(--danger);
  background: var(--danger-soft);
}

.advisory .body {
  border-left: 3px solid var(--warn);
  background: var(--warn-soft);
}

.ghost {
  opacity: 0.45;
  pointer-events: none;
}

.ghost .body {
  border-style: dashed;
  background: var(--grey-1);
}

/* Announced, never seen: colour alone cannot carry a clash. */
.assistive {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* A moment: no length, so it is a rule across the lane with a chip on it. */
.moment {
  left: 0;
  right: 0;
  height: 0;
  overflow: visible;
  border-top: 1px solid var(--accent);
  z-index: 2;
}

.momentChip {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  max-width: 100%;
  margin-top: -9px;
  margin-left: var(--sp-2);
  padding: 0 var(--sp-1);
  border: 0;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 0 0 1px var(--border);
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  cursor: grab;
}

.diamond {
  width: 8px;
  height: 8px;
  flex: none;
  background: var(--accent);
  transform: rotate(45deg);
}

.selected .momentChip {
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent);
}

.conflict .diamond {
  background: var(--danger);
}

.advisory .diamond {
  background: var(--warn);
}
```

- [ ] **Step 3: Build and check the whole suite**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Look at it**

Run: `npx vite --port 5199 --strictPort`, open `http://localhost:5199`, press **Sample day**. Confirm, in this order:

1. Time runs down; Main day, Suppliers and Transport are columns with names at the top.
2. "Cake cutting", "First dance" and "Call to dinner" — 10-minute blocks — show their names on hanging labels, not inside their boxes.
3. "Rings to the best man" is a rule across the Main day column with a chip on it, at 13:15, over nothing.
4. The ceremony's box has a hard top edge; the confetti's is dashed.
5. The gap before "Evening food" carries a dashed leader with its length.
6. Ctrl+wheel zooms; plain wheel scrolls.

Stop the server when done.

- [ ] **Step 5: Commit Tasks 5, 6 and 7 together**

```bash
git add src/render/screen/Ruler.tsx src/render/screen/Ruler.module.css \
        src/render/screen/Timeline.tsx src/render/screen/Timeline.module.css \
        src/render/screen/BlockView.tsx src/render/screen/BlockView.module.css
git commit -m "feat: run the timeline down the page, one column per lane"
```

---

### Task 8: The zoom control

**Files:**
- Modify: `src/App.tsx:81-88`

**Interfaces:**
- Consumes: `zoomBy`, `fitDay`, `ZOOM_STEP` (Task 3); `spanOf` (`src/render/screen/ticks.ts`).
- Produces: nothing.

- [ ] **Step 1: Replace the zoom buttons**

In `src/App.tsx`, replace the `styles.zoom` span with:

```tsx
        <span className={styles.zoom}>
          <Button variant="quiet" onClick={() => zoomBy(1 / ZOOM_STEP)} title="Zoom out">
            −
          </Button>
          <Button variant="quiet" onClick={() => zoomBy(ZOOM_STEP)} title="Zoom in">
            +
          </Button>
          <Button
            variant="quiet"
            title="Fit the whole day in view"
            onClick={() => {
              const span = spanOf(schedule.resolved, doc.day.curfewMin);
              const viewport = document.querySelector("[data-timeline]")?.clientHeight ?? 0;
              fitDay(viewport - 40, span.toMin - span.fromMin);
            }}
          >
            Fit day
          </Button>
        </span>
```

Add the imports and selectors this needs at the top of the component:

```tsx
import { spanOf } from "./render/screen/ticks";
import { ZOOM_STEP } from "./state/store";
```

```tsx
  const zoomBy = useStore((state) => state.zoomBy);
  const fitDay = useStore((state) => state.fitDay);
```

`doc` and `schedule` are already in scope at `src/App.tsx:23-24`. **Delete the
now-unused `const pxPerMin = useStore((state) => state.ui.pxPerMin);` at line
26** — `noUnusedLocals` fails the build on it.

- [ ] **Step 2: Mark the scroller**

In `src/render/screen/Timeline.tsx`, add `data-timeline=""` to the root `div.timeline` so **Fit day** can measure it:

```tsx
    <div
      className={styles.timeline}
      data-timeline=""
      ref={scroller}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx vitest run`
Then run the dev server, press **Sample day**, and confirm: **+** and **−** step smoothly at both ends of the range, and **Fit day** puts 07:00 to 01:00 in the window at once.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/render/screen/Timeline.tsx
git commit -m "feat: zoom in ratios and fit the day to the window"
```

---

### Task 9: Nudge, resize and lane jumping

**Files:**
- Modify: `src/state/useKeyboard.ts`
- Test: `src/state/useKeyboard.test.ts`

**Interfaces:**
- Consumes: `previewChange`, `commitPreview`, `updateBlock` from the store.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `src/state/useKeyboard.test.ts` (follow the file's existing pattern for building a `KeyboardEvent` and calling `handleKey`):

```ts
  it("nudges the selected block five minutes later", () => {
    useStore.getState().loadDoc(sampleDoc());
    useStore.getState().select("blk-ceremony");
    handleKey(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }));
    expect(getDoc(useStore.getState()).blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(815);
    useStore.getState().undo();
    expect(getDoc(useStore.getState()).blocks.find((b) => b.id === "blk-ceremony")?.anchorMin).toBe(810);
  });

  it("resizes the selected block by five minutes", () => {
    useStore.getState().loadDoc(sampleDoc());
    useStore.getState().select("blk-ceremony");
    const before = getDoc(useStore.getState()).blocks.find((b) => b.id === "blk-ceremony")?.durationMin as number;
    handleKey(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true }));
    expect(getDoc(useStore.getState()).blocks.find((b) => b.id === "blk-ceremony")?.durationMin).toBe(before + 5);
  });

  it("will not shrink a block into a moment", () => {
    useStore.getState().loadDoc(sampleDoc());
    const id = useStore.getState().addBlock("Main day", { label: "Tiny", durationMin: 5 });
    useStore.getState().select(id);
    handleKey(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true }));
    expect(getDoc(useStore.getState()).blocks.find((b) => b.id === id)?.durationMin).toBe(5);
  });

  it("walks the lane with the bare arrows", () => {
    useStore.getState().loadDoc(sampleDoc());
    useStore.getState().select("blk-ceremony");
    handleKey(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(useStore.getState().selectedId).toBe("blk-confetti");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/useKeyboard.test.ts`
Expected: FAIL — the arrows still only select, and on the horizontal axis.

- [ ] **Step 3: Write minimal implementation**

In `src/state/useKeyboard.ts`, replace the arrow-key branch with:

```ts
  /** Down the page is later, so ↓ is the next block and ↑ the one before. */
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const doc = state.history.present;
    const current = doc.blocks.find((block) => block.id === state.selectedId);
    if (!current) return;
    const step = event.key === "ArrowDown" ? 1 : -1;

    if (event.shiftKey) {
      // One preview, committed at once: a nudge is one entry in the history.
      event.preventDefault();
      state.previewChange({ type: "shift", blockId: current.id, deltaMin: step * 5 });
      state.commitPreview();
      return;
    }

    if (event.altKey) {
      // Floored at five minutes: the keyboard must not turn a block into a
      // moment by accident, the way an emptied duration field used to.
      event.preventDefault();
      state.updateBlock(current.id, {
        durationMin: Math.max(5, current.durationMin + step * 5),
      });
      return;
    }

    const lane = doc.blocks.filter((block) => block.lane === current.lane);
    const at = lane.findIndex((block) => block.id === current.id);
    const next = lane[at + step];
    if (next) {
      event.preventDefault();
      state.select(next.id);
    }
    return;
  }

  /** Across is between lanes: the nearest block in time, in the next one along. */
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const doc = state.history.present;
    const current = doc.blocks.find((block) => block.id === state.selectedId);
    if (!current) return;
    const laneAt = doc.lanes.indexOf(current.lane);
    const target = doc.lanes[laneAt + (event.key === "ArrowRight" ? 1 : -1)];
    if (!target) return;
    const schedule = scheduleFor(doc);
    const here = schedule.positions.get(current.id)?.startMin ?? 0;
    const nearest = doc.blocks
      .filter((block) => block.lane === target)
      .map((block) => ({
        id: block.id,
        distance: Math.abs((schedule.positions.get(block.id)?.startMin ?? 0) - here),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) {
      event.preventDefault();
      state.select(nearest.id);
    }
    return;
  }
```

Add `scheduleFor` to the existing import from `./store`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/state/useKeyboard.test.ts`
Expected: PASS, including the 7 pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/useKeyboard.ts src/state/useKeyboard.test.ts
git commit -m "feat: nudge, resize and cross lanes from the keyboard"
```

---

### Task 10: Move block controls into the timeline, trim the panel

The Blocks panel's per-block list duplicates what the timeline now shows. It keeps the lane controls; picking, reordering and deleting move onto the selected block.

**Files:**
- Modify: `src/ui/panels/BlocksPanel.tsx`, `src/render/screen/BlockView.tsx`, `src/render/screen/BlockView.module.css`

**Interfaces:**
- Consumes: `reorderBlock(id, delta)` and `deleteBlock(id)` from the store.
- Produces: nothing.

- [ ] **Step 1: Add the controls to the selected block**

In `src/render/screen/BlockView.tsx`, import the store and render a small toolbar when the block is selected and not a ghost. Place it immediately after the `</button>` that closes `styles.body`:

```tsx
        {selected && !ghost && (
          <span className={styles.tools}>
            <button type="button" title="Move earlier in this lane" onClick={() => reorderBlock(block.id, -1)}>
              ↑
            </button>
            <button type="button" title="Move later in this lane" onClick={() => reorderBlock(block.id, 1)}>
              ↓
            </button>
            <button type="button" title="Delete" onClick={() => deleteBlock(block.id)}>
              ×
            </button>
          </span>
        )}
```

With, at the top of the component:

```tsx
  const reorderBlock = useStore((state) => state.reorderBlock);
  const deleteBlock = useStore((state) => state.deleteBlock);
```

and the import `import { useStore } from "../../state/store";`.

Add to `BlockView.module.css`:

```css
.tools {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 1px;
  z-index: 1;
}

.tools button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface);
  font-size: var(--text-xs);
  line-height: 1;
  color: var(--text-muted);
  cursor: pointer;
}

.tools button:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
```

- [ ] **Step 2: Trim the panel**

In `src/ui/panels/BlocksPanel.tsx`, delete the `<ul className={styles.list}>…</ul>` block and the `blocks` local, along with the now-unused `schedule`, `selectedId`, `select`, `deleteBlock`, `reorderBlock` selectors and the `formatClock` / `isMoment` imports. Keep: `LaneName`, `+ Add`, `+ Moment`, the lane `×`, the empty-lane line (reworded), `+ Lane`, and the order-of-day bulk toggle. The empty-lane line becomes:

```tsx
            {doc.blocks.every((block) => block.lane !== lane) && (
              <p className={styles.empty}>Nothing in this lane yet.</p>
            )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx vitest run`
Then the dev server: select a block, confirm ↑ ↓ × appear on it and work, and that the panel still adds lanes, renames them, adds blocks and moments.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panels/BlocksPanel.tsx src/render/screen/BlockView.tsx src/render/screen/BlockView.module.css
git commit -m "refactor: move block controls onto the block, leave the panel its lanes"
```

---

### Task 11: The printed timeline, made honest

Seven changes to `src/render/pdf/timeline.ts`. The geometry decisions come out as exported pure functions so they can be tested — `textOf` can only read text, not rectangles.

**Files:**
- Modify: `src/render/pdf/timeline.ts`
- Test: `src/render/pdf/timeline.test.ts`

**Interfaces:**
- Consumes: `resolve()` (unchanged).
- Produces, exported from `src/render/pdf/timeline.ts`:
  - `interface Box { entry: Placed; topMm: number; heightMm: number; displaced: boolean }`, with `Body` and `Lane` exported alongside it
  - `boxesFor(lane: Lane, body: Body, minBoxMm: number): Box[]`
  - `laneTint(documentLaneIndex: number): number`
  - `gapsFor(boxes: Box[], minGapMin: number, mmPerMin: number): { topMm: number; heightMm: number; minutes: number }[]`
  - `Placed` gains `squeezedMin: number` and `bufferMin: number`; `Lane` gains `documentIndex: number`.

- [ ] **Step 1: Write the failing test**

Add to `src/render/pdf/timeline.test.ts`:

```ts
import { boxesFor, gapsFor, laneTint } from "./timeline";

describe("timeline geometry", () => {
  const body = { bodyTop: 0, bodyHeight: 200, fromMin: 600, mmPerMin: 0.1 };
  const block = (id: string, durationMin: number, bufferMin = 0) => ({
    id, label: id, durationMin, anchorMin: null, gapMin: 0, bufferMin,
    lane: "Main day", tags: [], location: "", notes: "", outputs: ["run-sheet" as const],
  });

  it("marks a box as displaced when it is pushed off its own time", () => {
    const lane = {
      name: "Main day",
      documentIndex: 0,
      columns: 1,
      moments: [],
      placed: [
        { block: block("a", 5), startMin: 600, endMin: 605, column: 0, squeezedMin: 0, bufferMin: 0 },
        { block: block("b", 60), startMin: 605, endMin: 665, column: 0, squeezedMin: 0, bufferMin: 0 },
      ],
    };
    const boxes = boxesFor(lane, body, 4);
    // "a" is half a millimetre tall at this scale, so it is drawn at the floor
    // and "b" is pushed down to make room.
    expect(boxes[0]?.displaced).toBe(false);
    expect(boxes[1]?.displaced).toBe(true);
    expect(boxes[1]?.topMm).toBeGreaterThan(0.5);
  });

  it("tints a lane by where it sits in the document, not on the page", () => {
    expect(laneTint(0)).toBeCloseTo(0.09, 5);
    expect(laneTint(4)).toBeCloseTo(0.37, 5);
    expect(laneTint(4)).not.toBeCloseTo(laneTint(0), 5);
  });

  it("finds the gaps worth labelling", () => {
    const boxes = [
      { entry: {} as never, topMm: 0, heightMm: 10, displaced: false },
      { entry: {} as never, topMm: 13, heightMm: 10, displaced: false },
      { entry: {} as never, topMm: 24, heightMm: 10, displaced: false },
    ];
    // 3mm at 0.1mm/min is 30 minutes; 1mm is 10 minutes and is left alone.
    const gaps = gapsFor(boxes, 15, 0.1);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.minutes).toBe(30);
  });
});

describe("what the sheet says", () => {
  it("draws contingency rather than describing it", async () => {
    const { text } = await textOf(await renderTimeline(sampleDoc(), options));
    expect(text).not.toContain("spare");
  });

  it("says when a block was squeezed", async () => {
    const doc = sampleDoc();
    const drinks = doc.blocks.find((block) => block.label.includes("Drinks"));
    if (drinks) drinks.squeezeToMin = 30;
    const ceremony = doc.blocks.find((block) => block.label === "Ceremony");
    if (ceremony) ceremony.durationMin = 180;
    const { text } = await textOf(await renderTimeline(doc, options));
    expect(text).toContain("squeezed");
  });

  it("carries a key for what the marks mean", async () => {
    const { text } = await textOf(await renderTimeline(sampleDoc(), options));
    expect(text).toContain("contingency");
    expect(text).toContain("anchored");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/pdf/timeline.test.ts`
Expected: FAIL — `boxesFor`, `laneTint` and `gapsFor` are not exported, and the sheet still prints `spare`.

- [ ] **Step 3: Write the implementation**

In `src/render/pdf/timeline.ts`:

1. Widen the interfaces:

```ts
interface Placed {
  block: Block;
  startMin: number;
  /** The block's own end, buffer excluded. */
  endMin: number;
  /** Minutes the resolver took off this block to make a downstream anchor. */
  squeezedMin: number;
  /** Contingency after the block's own length. Drawn, not described. */
  bufferMin: number;
  column: number;
}

interface Lane {
  name: string;
  /** Where the lane sits in the document, so its tint does not depend on the page. */
  documentIndex: number;
  placed: Placed[];
  moments: Placed[];
  columns: number;
}

export interface Box {
  entry: Placed;
  topMm: number;
  heightMm: number;
  /** True when the box had to be pushed off its own start to stay readable. */
  displaced: boolean;
}
```

2. Rewrite `laneLayout` so each entry carries its squeeze and buffer, and each lane knows where it sits in the document:

```ts
function laneLayout(doc: TimelineDoc): Lane[] {
  const positions = new Map(resolve(doc).map((entry) => [entry.id, entry]));
  const chosen = doc.blocks.filter((block) => block.outputs.includes("run-sheet"));

  return doc.lanes
    .map((name, documentIndex) => {
      const all = chosen
        .filter((block) => block.lane === name)
        .map((block) => {
          const at = positions.get(block.id);
          const startMin = at?.startMin ?? 0;
          return {
            block,
            startMin,
            // The squeezed length, as everywhere else: the box must agree with
            // the clock printed inside it.
            endMin: at?.contentEndMin ?? startMin + block.durationMin,
            squeezedMin: at?.squeezedMin ?? 0,
            bufferMin: block.bufferMin,
          };
        })
        .sort((a, b) => a.startMin - b.startMin);

      const moments = all
        .filter(({ block }) => isMoment(block))
        .map((entry) => ({ ...entry, column: 0 }));
      const entries = all.filter(({ block }) => !isMoment(block));

      const freeAt: number[] = [];
      const placed: Placed[] = entries.map((entry) => {
        let column = freeAt.findIndex((end) => end <= entry.startMin);
        if (column === -1) column = freeAt.length;
        freeAt[column] = entry.endMin;
        return { ...entry, column };
      });

      return { name, documentIndex, placed, moments, columns: Math.max(1, freeAt.length) };
    })
    .filter((lane) => lane.placed.length + lane.moments.length > 0);
}
```

Export `Body` and `Lane` alongside `Box`, since `boxesFor` and `gapsFor` are now
part of the module's surface and their callers need to name the types.

3. Export the geometry, adding `displaced`:

```ts
/** The lane's tint, deepening down the document so columns stay apart. */
export function laneTint(documentLaneIndex: number): number {
  return 0.09 + documentLaneIndex * 0.07;
}

export function boxesFor(lane: Lane, body: Body, minBoxMm: number): Box[] {
  const bottom = body.bodyTop + body.bodyHeight;
  const cursor = new Map<number, number>();

  return lane.placed.map((entry) => {
    const trueTop = body.bodyTop + (entry.startMin - body.fromMin) * body.mmPerMin;
    const topMm = Math.max(trueTop, cursor.get(entry.column) ?? trueTop);
    const natural = (entry.endMin - entry.startMin) * body.mmPerMin;
    const heightMm = Math.max(0.8, Math.min(Math.max(natural, minBoxMm), bottom - topMm));
    cursor.set(entry.column, topMm + heightMm + 0.7);
    return { entry, topMm, heightMm, displaced: topMm - trueTop > 0.2 };
  });
}

/** Gaps inside a lane worth putting a figure on. */
export function gapsFor(
  boxes: Box[],
  minGapMin: number,
  mmPerMin: number,
): { topMm: number; heightMm: number; minutes: number }[] {
  const out: { topMm: number; heightMm: number; minutes: number }[] = [];
  const ordered = [...boxes].sort((a, b) => a.topMm - b.topMm);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (!previous || !current) continue;
    const topMm = previous.topMm + previous.heightMm;
    const heightMm = current.topMm - topMm;
    const minutes = Math.round(heightMm / mmPerMin);
    if (minutes >= minGapMin) out.push({ topMm, heightMm, minutes });
  }
  return out;
}
```

4. In the drawing loop, use the tint, draw the buffer band, the true-time tick, the anchor pin and the gap figures:

```ts
      const fill = laneTint(lane.documentIndex);

      const geometry = { bodyTop, bodyHeight, fromMin: span.fromMin, mmPerMin };
      const boxes = boxesFor(lane, geometry, minBoxMm);

      boxes.forEach(({ entry, topMm, heightMm, displaced }) => {
        const x = laneX + columnWidth * entry.column;
        const width = columnWidth - 1.2;

        sheet.rect(x, topMm, width, heightMm, { colour: accent, opacity: fill });
        sheet.rect(x, topMm, 0.9, heightMm, { colour: accent });

        // Contingency is time set aside: draw it, in the space it occupies.
        const bufferMm = entry.bufferMin * mmPerMin;
        if (bufferMm > 0.3) {
          sheet.rect(x, topMm + heightMm, width, bufferMm, {
            colour: accent,
            opacity: fill * 0.4,
          });
        }

        // The box was pushed off its own minute to stay readable. Say where it
        // should be, or the sheet quietly disagrees with its own ruler.
        if (displaced) {
          const trueTop = bodyTop + (entry.startMin - span.fromMin) * mmPerMin;
          sheet.line(x - 1.6, trueTop, x, trueTop, { widthPt: 0.4, colour: muted });
        }

        // Anchored: pinned to the clock, and nothing upstream can move it.
        if (entry.block.anchorMin !== null) {
          sheet.rect(laneLeft - 2.6, topMm, 1.2, 1.2, { colour: accent });
        }

        drawBoxText(sheet, entry, {
          doc,
          x: x + 0.9 + PAD_MM,
          top: topMm,
          height: heightMm,
          width: width - 0.9 - PAD_MM * 2,
          regular,
          bold,
          metaPt,
          labelPt,
          muted,
        });
      });

      gapsFor(boxes, 15, mmPerMin).forEach((gap) => {
        if (gap.heightMm < ptToMm(metaPt * LEADING)) return;
        sheet.text(formatDuration(gap.minutes), {
          xMm: laneX + 2,
          yMm: gap.topMm + gap.heightMm / 2,
          font: regular,
          sizePt: metaPt,
          colour: muted,
        });
      });
```

5. In `drawBoxText`, drop the buffer text and add the squeeze note. The word rather than the screen's `↤`: an embedded subset may not carry the arrow, and a missing glyph on paper is worse than a longer line.

```ts
  const notes = block.notes;
  const rest = [
    `until ${formatClock(entry.endMin)} · ${formatDuration(entry.endMin - entry.startMin)}${
      entry.squeezedMin > 0 ? ` · squeezed ${formatDuration(entry.squeezedMin)}` : ""
    }`,
    block.location,
    who,
    notes,
  ].filter(Boolean);
```

6. Add the key to the footer, beside the generated-on line:

```ts
    sheet.text("Paler band: contingency  ·  Square: anchored  ·  Rule: a moment", {
      xMm: box.xMm + box.widthMm / 2,
      yMm: footerY,
      font: regular,
      sizePt: metaPt,
      colour: muted,
    });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/render/pdf/timeline.test.ts`
Expected: PASS, 7 pre-existing plus 6 new.

- [ ] **Step 5: Look at the sheet**

Run: `npm run sample`
Open the timeline PDF it writes and confirm: contingency shows as a paler band under its block, anchored blocks carry a pin in the gutter, short blocks have a tick at their true time, gaps of a quarter hour or more carry a figure, and the key reads along the footer.

- [ ] **Step 6: Commit**

```bash
git add src/render/pdf/timeline.ts src/render/pdf/timeline.test.ts
git commit -m "feat: draw contingency, anchors, gaps and displacement on the printed timeline"
```

---

### Task 12: The guide

**Files:**
- Modify: `USER_GUIDE.md`

- [ ] **Step 1: Rewrite the two sections**

Replace the "Reading the timeline" section's first paragraph with:

```markdown
Time runs down the page and each lane is a column, the same shape as the
printed timeline. Blocks sit to scale against the clock down the left edge. A
block too short to hold its own name keeps its true size and hangs its name
beside it — that label is the thing to click. The hatched tail below a block is
its contingency. An anchored block has a hard top edge and its time set bold on
the clock; a floating one has a dashed edge. A gap of ten minutes or more
carries a dashed leader with its length, so air you left on purpose does not
read as air you forgot.

A moment is a rule across its column with its name on it.
```

Replace the "Moving things" section with:

```markdown
Drag a block up or down. While you drag, every downstream block ghosts at its
new time and any clash the move would cause lights up. Release to keep it.
**Escape** puts it back, and leaves no entry in the undo history. Dragging never
changes the order of a lane — use the ↑ and ↓ on the selected block for that.

↑ and ↓ walk the lane; ← and → cross to the nearest block in the next lane.
**Shift+↑/↓** nudges the selected block five minutes; **Alt+↑/↓** lengthens or
shortens it by five, never below five, so the keyboard cannot turn a block into
a moment by accident.

**+** and **−** zoom, **Fit day** puts the whole day in the window, and
Ctrl+wheel zooms about the pointer.

Ctrl+Z and Ctrl+Shift+Z undo and redo. Delete removes the selected block.
```

In the "Printing" section, add to the **Timeline** paragraph:

```markdown
Contingency prints as a paler band below its block, anchored blocks carry a
pin beside the clock, and a block drawn taller than its true length to stay
readable carries a tick at the time it really starts. A key along the footer
says so.
```

- [ ] **Step 2: Verify**

Run: `npm run build && npx vitest run`
Expected: build clean, offline gate passes, every test green.

- [ ] **Step 3: Commit**

```bash
git add USER_GUIDE.md
git commit -m "docs: describe the vertical timeline and the new shortcuts"
```

---

## Done when

- The screen timeline runs down the page in lane columns; every block in the sample day can be read by name.
- Moments are rules across their column; nothing covers them.
- Anchored, floating, gap and contingency are each visible without being told.
- Shift+arrows nudge, Alt+arrows resize with a five-minute floor, Ctrl+wheel and **Fit day** work.
- The printed timeline draws contingency, marks anchors and squeezes, labels long gaps, ticks displaced boxes, tints lanes by document order, and carries a footer key.
- `npm run build` passes, including the offline gate, and the full suite is green.
