/**
 * NFR: zero-backend. Nothing in the built bundle may reach another origin.
 *
 * Same-origin requests are fine and necessary — the bundled fonts are loaded
 * from the app's own build output. What is banned is anything that could carry
 * a guest list, a supplier's phone number or a schedule off the machine.
 *
 * The check looks for constructs that actually cause a request. A bare URL in a
 * string is not one: React and pdf-lib both put documentation links into error
 * messages, and failing the build over a link nobody can click would only teach
 * everyone to switch the gate off.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

const BANNED: [RegExp, string][] = [
  [/fetch\(\s*["'`]https?:/, "fetch() of an absolute URL"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\bnew\s+WebSocket\b/, "WebSocket"],
  [/\bnavigator\.sendBeacon\b/, "sendBeacon"],
  [/\bnew\s+EventSource\b/, "EventSource"],
  [/\bimportScripts\(\s*["'`]https?:/, "importScripts of an absolute URL"],
  [/\bimport\(\s*["'`]https?:/, "dynamic import of an absolute URL"],
  [/\.(src|href|action)\s*=\s*["'`]https?:/, "assigning an absolute URL to src, href or action"],
  [/url\(\s*["']?https?:/, "a stylesheet asset from another origin"],
  [/<(script|link|img|iframe)[^>]+(src|href)\s*=\s*["']https?:/i, "markup loading from another origin"],
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Strips comments, so a licence URL in a banner is never the reason for a failure. */
function stripComments(source: string): string {
  // Linear-time block comment match; the lazy form backtracks badly on a bundle.
  return source.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const hits: string[] = [];

for (const file of walk(DIST)) {
  if (!/\.(js|mjs|cjs|css|html)$/.test(file)) continue;
  const source = stripComments(readFileSync(file, "utf8"));
  for (const [pattern, description] of BANNED) {
    if (pattern.test(source)) hits.push(`${file}: ${description}`);
  }
}

if (hits.length > 0) {
  console.error("Offline gate failed. The bundle can reach another origin:");
  for (const hit of [...new Set(hits)]) console.error("  " + hit);
  process.exit(1);
}

console.log("Offline gate passed. Nothing in the bundle leaves this machine.");
