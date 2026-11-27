// The pictures that can sit behind every page (Settings -> Appearance).
// "sky" is the photo in public/; the others are soft nude gradients, light
// enough for the glass cards to read on; "upload" is the person's own photo.
// The ids match the check on profiles.background.

export type BackgroundChoice = "sky" | "sand" | "blush" | "mist" | "dusk" | "upload";

export const GRADIENTS: { id: Exclude<BackgroundChoice, "sky" | "upload">; label: string; css: string }[] = [
  {
    id: "sand",
    label: "Sand",
    css: "linear-gradient(160deg, #f8ece1 0%, #edd6c3 45%, #dcb89f 100%)",
  },
  {
    id: "blush",
    label: "Blush",
    css: "radial-gradient(60% 50% at 15% 10%, #f8dcd2 0%, transparent 70%), radial-gradient(55% 45% at 90% 35%, #f3e4d6 0%, transparent 70%), radial-gradient(70% 55% at 45% 100%, #eac3b6 0%, transparent 70%), #f7ede6",
  },
  {
    id: "mist",
    label: "Mist",
    css: "linear-gradient(180deg, #dfeaf4 0%, #eef0ef 55%, #f3ebe3 100%)",
  },
  {
    id: "dusk",
    label: "Dusk",
    css: "linear-gradient(180deg, #a9cbe6 0%, #d9dde0 45%, #f0d3c0 75%, #e4b79d 100%)",
  },
];

export const isBackgroundChoice = (value: unknown): value is BackgroundChoice =>
  value === "sky" || value === "upload" || GRADIENTS.some((g) => g.id === value);
