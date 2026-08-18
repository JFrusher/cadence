import type { Block, TimelineDoc } from "../model/types";

export interface ResolvedBlock {
  id: string;
  lane: string;
  /** Position within its lane, in document order. */
  laneIndex: number;
  startMin: number;
  /** End of the block's own duration, before any buffer. */
  contentEndMin: number;
  /** End including the contingency buffer. This is what the next block follows. */
  endMin: number;
  anchored: boolean;
}

/**
 * The one load-bearing function. Per lane, in document order: an anchored block
 * starts at its anchor, a floating block starts at its predecessor's end plus
 * its gap. Pure — the screen and every PDF read this and nothing else.
 */
export function resolve(doc: TimelineDoc): ResolvedBlock[] {
  const cursors = new Map<string, number>();
  const laneCounts = new Map<string, number>();

  return doc.blocks.map((block) => {
    const cursor = cursors.get(block.lane);
    const laneIndex = laneCounts.get(block.lane) ?? 0;
    const startMin =
      block.anchorMin ?? (cursor === undefined ? block.gapMin : cursor + block.gapMin);
    const contentEndMin = startMin + block.durationMin;
    const endMin = contentEndMin + block.bufferMin;

    cursors.set(block.lane, endMin);
    laneCounts.set(block.lane, laneIndex + 1);

    return {
      id: block.id,
      lane: block.lane,
      laneIndex,
      startMin,
      contentEndMin,
      endMin,
      anchored: block.anchorMin !== null,
    };
  });
}

/** Resolved blocks keyed by block id. */
export function byId(resolved: ResolvedBlock[]): Map<string, ResolvedBlock> {
  return new Map(resolved.map((entry) => [entry.id, entry]));
}

/** Resolved blocks grouped by lane, each group in document order. */
export function byLane(resolved: ResolvedBlock[]): Map<string, ResolvedBlock[]> {
  const lanes = new Map<string, ResolvedBlock[]>();
  for (const entry of resolved) {
    const group = lanes.get(entry.lane);
    if (group) group.push(entry);
    else lanes.set(entry.lane, [entry]);
  }
  return lanes;
}

/** The document's blocks keyed by id, for looking up what a resolved entry came from. */
export function blocksById(doc: TimelineDoc): Map<string, Block> {
  return new Map(doc.blocks.map((block) => [block.id, block]));
}
