import crimsonRegular from "./CrimsonText-Regular.ttf?url";
import crimsonSemiBold from "./CrimsonText-SemiBold.ttf?url";
import greatVibes from "./GreatVibes-Regular.ttf?url";
import lato from "./Lato-Regular.ttf?url";
import marcellus from "./Marcellus-Regular.ttf?url";

export interface BundledFont {
  family: string;
  /** Vite resolves this to a bundled asset path; nothing is fetched off-origin. */
  url: string;
  /** The bold companion, where the family has one. */
  boldUrl?: string;
  /** Node reads the file directly for headless renders and tests. */
  file: string;
  boldFile?: string;
}

export const BUNDLED_FONTS: BundledFont[] = [
  {
    family: "Lato",
    url: lato,
    file: "src/assets/fonts/Lato-Regular.ttf",
  },
  {
    family: "Crimson Text",
    url: crimsonRegular,
    boldUrl: crimsonSemiBold,
    file: "src/assets/fonts/CrimsonText-Regular.ttf",
    boldFile: "src/assets/fonts/CrimsonText-SemiBold.ttf",
  },
  {
    family: "Marcellus",
    url: marcellus,
    file: "src/assets/fonts/Marcellus-Regular.ttf",
  },
  {
    family: "Great Vibes",
    url: greatVibes,
    file: "src/assets/fonts/GreatVibes-Regular.ttf",
  },
];

export const DEFAULT_FONT_FAMILY = "Lato";

export function bundledFont(family: string): BundledFont | null {
  return BUNDLED_FONTS.find((font) => font.family === family) ?? null;
}
