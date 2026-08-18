import { BUNDLED_FONTS } from "../../assets/fonts";
import type { FontBytes } from "./embedFonts";

/**
 * Where the font bytes come from. The browser reads them from the app's own
 * build output; Node reads the same files off disk for the headless render and
 * the tests. One interface so the renderers never care which.
 */
export type FontSource = (family: string) => Promise<FontBytes>;

/** Vite rewrites these to hashed same-origin URLs. Nothing leaves the machine. */
const FONT_URLS = import.meta.glob("../../assets/fonts/*.ttf", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function urlFor(file: string): string {
  const key = Object.keys(FONT_URLS).find((path) => path.endsWith(`/${file.split("/").pop()}`));
  if (!key) throw new Error(`Bundled font missing from the build: ${file}`);
  return FONT_URLS[key] as string;
}

/** Reads bundled faces in the browser. Uploaded faces come from the blob store. */
export function browserFontSource(uploaded: Map<string, Uint8Array> = new Map()): FontSource {
  return async (family) => {
    const custom = uploaded.get(family);
    if (custom) return { family, data: custom };

    const bundled = BUNDLED_FONTS.find((font) => font.family === family) ?? BUNDLED_FONTS[0];
    if (!bundled) throw new Error("No fonts are bundled with this build.");

    const load = async (file: string) =>
      new Uint8Array(await (await fetch(urlFor(file))).arrayBuffer());

    return {
      family: bundled.family,
      data: await load(bundled.file),
      ...(bundled.boldFile ? { bold: await load(bundled.boldFile) } : {}),
    };
  };
}
