/** Renders every piece from the fixture, without a browser. */
import { writeFileSync } from "node:fs";
import { renderAllCallSheets } from "../src/render/pdf/callSheet";
import { renderContactSheet } from "../src/render/pdf/contactSheet";
import { nodeFontSource } from "../src/render/pdf/nodeFontSource";
import { renderOrderOfDay } from "../src/render/pdf/orderOfDay";
import { renderRunSheet } from "../src/render/pdf/runSheet";
import { renderTimeline } from "../src/render/pdf/timeline";
import { sampleDoc } from "../src/core/model/defaults";

const doc = sampleDoc();
const fontSource = nodeFontSource;
const generatedOn = "Sample, made by npm run sample";

const pieces: [string, Uint8Array][] = [
  ["sample-run-sheet.pdf", await renderRunSheet(doc, { fontSource, generatedOn })],
  ["sample-timeline.pdf", await renderTimeline(doc, { fontSource, generatedOn })],
  ["sample-call-sheets.pdf", await renderAllCallSheets(doc, { fontSource, generatedOn })],
  ["sample-order-of-day.pdf", await renderOrderOfDay(doc, { fontSource })],
  ["sample-contact-sheet.pdf", await renderContactSheet(doc, { fontSource, generatedOn })],
];

for (const [name, bytes] of pieces) {
  writeFileSync(name, bytes);
  console.log(`Wrote ${name} (${Math.round(bytes.length / 1024)}kB)`);
}
