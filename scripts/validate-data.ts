/** Build gate: the fixture must still parse against the current schema. */
import { readFileSync } from "node:fs";
import { parse } from "../src/core/project/file";
import { conflicts } from "../src/core/schedule/conflicts";
import { resolve } from "../src/core/schedule/resolve";

const path = "fixtures/sample-day.cadence.json";
const result = parse(readFileSync(path, "utf8"));

if (result.error !== undefined) {
  console.error(`${path} no longer parses: ${result.error}`);
  process.exit(1);
}

const found = conflicts(resolve(result.doc), result.doc);
if (found.length > 0) {
  console.error(`${path} is meant to be a clean day, but it has ${found.length} problem(s):`);
  for (const problem of found) console.error(`  ${problem.kind}: ${problem.message}`);
  process.exit(1);
}

console.log(`${path} parses, and the day is clean.`);
