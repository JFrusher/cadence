import { parse, serialise, suggestedFilename } from "../core/project/file";
import type { TimelineDoc } from "../core/model/types";
import { missingKeys, type BlobBackend } from "./blobStore";

/** Downloads the document as a `.cadence.json` file. */
export function saveProject(doc: TimelineDoc): void {
  const blob = new Blob([serialise(doc)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedFilename(doc);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type OpenResult =
  | { doc: TimelineDoc; missing: string[]; fromFuture: boolean; error?: undefined }
  | { error: string; doc?: undefined; missing?: undefined; fromFuture?: undefined };

/**
 * Reads a dropped or chosen file. Uploads referenced by the document but absent
 * from this machine's blob store are reported, not treated as failure — a
 * project file that has travelled arrives without its logo.
 */
export async function openProject(
  file: File | Blob,
  backend?: BlobBackend,
): Promise<OpenResult> {
  const text = await file.text();
  const result = parse(text);
  if (result.error !== undefined) return { error: result.error };

  const referenced = referencedKeys(result.doc);
  let missing: string[] = [];
  if (referenced.length > 0) {
    try {
      missing = backend ? await missingKeys(referenced, backend) : await missingKeys(referenced);
    } catch {
      // No IndexedDB in this browser. Opening the day matters more than
      // knowing whether its logo is here.
      missing = [];
    }
  }
  return { doc: result.doc, missing, fromFuture: result.fromFuture };
}

/** Every blob-store key a document depends on. */
export function referencedKeys(doc: TimelineDoc): string[] {
  const keys = doc.fonts.map((font) => font.blobKey);
  if (doc.day.logoKey) keys.push(doc.day.logoKey);
  return [...new Set(keys)];
}
