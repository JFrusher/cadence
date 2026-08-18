import { PDFDocument } from "pdf-lib";
import { usedTags } from "../../core/model/tags";
import type { TimelineDoc } from "../../core/model/types";
import { formatClock } from "../../core/time/minutes";
import { embedFamily } from "./embedFonts";
import type { FontSource } from "./fontSource";
import { addSheet, hexColour } from "./page";
import { columnOffsets, fitColumns, type Column } from "./table";
import { truncate, wrap } from "./text";
import { contentBox, PAGE_SIZES, ptToMm } from "./units";

export interface ContactSheetOptions {
  fontSource: FontSource;
  generatedOn?: string;
}

const MARGIN_MM = 15;
const GAP_MM = 4;

const COLUMNS: Column[] = [
  { key: "who", heading: "Who", widthMm: 50 },
  { key: "phone", heading: "Phone", widthMm: 34 },
  { key: "arrives", heading: "Arrives", widthMm: 20 },
  { key: "notes", heading: "Notes", widthMm: 76 },
];

/**
 * One page, every supplier, one line each. A tag with no details still gets its
 * row — the gap is the point, because that is the number nobody has yet.
 */
export async function renderContactSheet(
  doc: TimelineDoc,
  options: ContactSheetOptions,
): Promise<Uint8Array> {
  const style = doc.styles["contact-sheet"];
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedFamily(pdf, await options.fontSource(style.fontFamily));

  const size = PAGE_SIZES.A4;
  const box = contentBox(size, MARGIN_MM);
  const columns = fitColumns(COLUMNS, box.widthMm, GAP_MM);
  const offsets = columnOffsets(columns, box.xMm, GAP_MM);
  const accent = hexColour(style.accentHex);
  const muted = { r: 0.44, g: 0.43, b: 0.41 };

  const bodyPt = 10 * style.typeScale;
  const headPt = 8 * style.typeScale;
  const lineMm = ptToMm(bodyPt * 1.35);

  const sheet = addSheet(pdf, size);
  let y = box.yMm + 6;

  sheet.text(`${doc.day.coupleNames || "The day"} — who to ring`, {
    xMm: box.xMm,
    yMm: y,
    font: bold,
    sizePt: 15 * style.typeScale,
  });
  y += 6;
  sheet.text([doc.day.venueName, doc.day.date].filter(Boolean).join("  ·  "), {
    xMm: box.xMm,
    yMm: y,
    font: regular,
    sizePt: headPt,
    colour: muted,
  });
  y += 6;

  sheet.line(box.xMm, y, box.xMm + box.widthMm, y, {
    widthPt: Math.max(0.4, style.ruleWeightPt * 2),
    colour: accent,
  });
  y += 6;

  columns.forEach((column, index) => {
    sheet.text(column.heading.toUpperCase(), {
      xMm: offsets[index] as number,
      yMm: y,
      font: bold,
      sizePt: headPt,
      colour: muted,
    });
  });
  y += 5;

  for (const summary of usedTags(doc)) {
    const detail = summary.detail;
    const notes = wrap(
      detail?.notes ?? "",
      regular,
      bodyPt,
      columns[3]?.widthMm ?? 60,
    );
    const values = [
      truncate(detail?.displayName || summary.tag, bold, bodyPt, columns[0]?.widthMm ?? 40),
      detail?.phone || "—",
      detail?.arrivalMin == null ? "—" : formatClock(detail.arrivalMin),
    ];

    values.forEach((value, index) => {
      sheet.text(value, {
        xMm: offsets[index] as number,
        yMm: y,
        font: index === 0 ? bold : regular,
        sizePt: bodyPt,
        colour: value === "—" ? muted : { r: 0, g: 0, b: 0 },
      });
    });

    notes.forEach((line, index) => {
      if (line === "") return;
      sheet.text(line, {
        xMm: offsets[3] as number,
        yMm: y + lineMm * index,
        font: regular,
        sizePt: bodyPt,
        colour: muted,
      });
    });

    const rows = Math.max(1, notes.filter(Boolean).length);
    y += lineMm * rows + 2.5;
    sheet.line(box.xMm, y - 2, box.xMm + box.widthMm, y - 2, {
      widthPt: style.ruleWeightPt,
      colour: { r: 0.84, g: 0.83, b: 0.82 },
    });
  }

  if (options.generatedOn) {
    sheet.text(options.generatedOn, {
      xMm: box.xMm,
      yMm: size.heightMm - MARGIN_MM + 4,
      font: regular,
      sizePt: headPt,
      colour: muted,
    });
  }

  return pdf.save();
}
