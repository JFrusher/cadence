/** Regenerates the sample fixture from `sampleDoc()`. Run after changing the model. */
import { mkdirSync, writeFileSync } from "node:fs";
import { sampleDoc } from "../src/core/model/defaults";

mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/sample-day.cadence.json", JSON.stringify(sampleDoc(), null, 2) + "\n");
console.log("Wrote fixtures/sample-day.cadence.json");
