const PLATFORM_RATIOS: Record<string, string> = {
  tiktok: "9:16",
  instagram_reel: "9:16",
  instagram_story: "9:16",
  instagram: "1:1",
  youtube_short: "9:16",
  youtube: "16:9",
  linkedin: "1:1",
  facebook: "1:1",
  gbp: "1:1",
  google_business: "1:1",
  twitter: "16:9",
};

const VALID_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "10:16", "16:10", "Auto"]);

export function getRequiredAspectRatio(
  platform: string,
  contentFormat?: string
): string {
  if (contentFormat) {
    const key = `${platform}_${contentFormat}`;
    if (PLATFORM_RATIOS[key]) return PLATFORM_RATIOS[key];
  }
  return PLATFORM_RATIOS[platform] || "16:9";
}

export function validateAspectRatio(
  ratio: string,
  platform: string,
  contentFormat?: string
): { valid: boolean; corrected: string; reason?: string } {
  if (!VALID_RATIOS.has(ratio)) {
    const required = getRequiredAspectRatio(platform, contentFormat);
    return {
      valid: false,
      corrected: required,
      reason: `Invalid aspect ratio "${ratio}". Using ${required} for ${platform}.`,
    };
  }

  const required = getRequiredAspectRatio(platform, contentFormat);
  if (ratio !== required && ratio !== "Auto") {
    return {
      valid: true,
      corrected: required,
      reason: `${platform} recommends ${required}. Corrected from ${ratio}.`,
    };
  }

  return { valid: true, corrected: ratio };
}

export { PLATFORM_RATIOS, VALID_RATIOS };
