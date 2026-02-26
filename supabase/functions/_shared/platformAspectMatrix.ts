const PLATFORM_ASPECT_MAP: Record<string, string> = {
  instagram: "1:1",
  instagram_story: "9:16",
  instagram_reel: "9:16",
  tiktok: "9:16",
  youtube: "16:9",
  youtube_shorts: "9:16",
  facebook: "1:1",
  twitter: "16:9",
  x: "16:9",
  linkedin: "1:1",
  pinterest: "2:3",
  threads: "1:1",
};

const VALID_RATIOS = new Set([
  "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "5:4", "4:5", "21:9",
]);

export function getRequiredAspectRatio(platform?: string): string {
  if (!platform) return "1:1";
  const key = platform.toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_ASPECT_MAP[key] || "1:1";
}

export function validateAspectRatio(ratio: string): boolean {
  return VALID_RATIOS.has(ratio);
}
