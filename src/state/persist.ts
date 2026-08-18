import { parse, serialise } from "../core/project/file";
import type { TimelineDoc } from "../core/model/types";

export const STORAGE_KEY = "cadence.document.v1";
const DEBOUNCE_MS = 400;

export interface Restored {
  doc: TimelineDoc | null;
  /** Set when something was there but could not be read. */
  notice: string | null;
}

/**
 * Reads the last session back. A corrupt payload never stops the app booting —
 * the user gets an empty day and a notice, not a white screen.
 */
export function restore(storage: Storage = localStorage): Restored {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { doc: null, notice: "This browser is blocking local storage, so nothing will be kept between visits." };
  }
  if (raw === null) return { doc: null, notice: null };

  const result = parse(raw);
  if (result.error !== undefined) {
    return {
      doc: null,
      notice: `The saved day could not be read (${result.error}) so Cadence has started empty.`,
    };
  }
  return { doc: result.doc, notice: null };
}

export function persist(doc: TimelineDoc, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, serialise(doc));
  } catch {
    // Quota or a private window. Losing the autosave is not worth an interruption.
  }
}

export function clearPersisted(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

/**
 * Debounced writer. Returns a flush for the cases that cannot wait, such as
 * the page going away.
 */
export function createPersister(storage: Storage = localStorage) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: TimelineDoc | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      persist(pending, storage);
      pending = null;
    }
  };

  const schedule = (doc: TimelineDoc) => {
    pending = doc;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  };

  return { schedule, flush };
}
