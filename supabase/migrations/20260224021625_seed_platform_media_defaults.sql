/*
  # Seed Platform Media Defaults

  Configures recommended media settings for each social platform.
  Each platform gets optimized defaults for feed posts, stories/reels, and covers.

  1. Instagram - Square images (1:1), vertical reels (9:16), stories (9:16)
  2. TikTok - Vertical video (9:16), short durations
  3. YouTube - Landscape video (16:9), thumbnails (16:9 image)
  4. Facebook - Landscape/square images, horizontal video
  5. LinkedIn - Landscape images (16:9), professional style
  6. Google Business Profile - Square/landscape images
*/

-- INSTAGRAM
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'instagram', 'feed_post',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '1:1', '1024x1024', NULL, NULL, 30,
  'Clean, Instagram-worthy aesthetic. Vibrant colors, high contrast, visually engaging.',
  'Square format preferred for feed posts'
),
(
  'instagram', 'reel',
  'dc712f1a-1965-44e6-acf9-671f93e85133', -- Seedance API
  '9:16', '1080p', 10, 90, 100,
  'Vertical format optimized for mobile viewing. Eye-catching motion, quick cuts.',
  'Vertical video, 15-30s recommended for engagement'
),
(
  'instagram', 'story',
  '1c3c9f93-890f-402e-bb1d-b7fe6945c146', -- Sora 2
  '9:16', '1080p', 5, 15, 30,
  'Full-screen vertical, bold text-friendly, ephemeral feel.',
  '9:16 vertical, max 15s per story slide'
),
(
  'instagram', 'carousel',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '1:1', '1024x1024', NULL, NULL, 30,
  'Consistent visual style across carousel slides. Clean backgrounds.',
  'Square images for carousel, consistent style across set'
)
ON CONFLICT (platform, content_format) DO NOTHING;

-- TIKTOK
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'tiktok', 'feed_post',
  'dc712f1a-1965-44e6-acf9-671f93e85133', -- Seedance API
  '9:16', '1080p', 10, 180, 100,
  'Vertical, eye-catching from first frame. Fast-paced, trendy aesthetic.',
  'Vertical video dominant platform, 15-60s sweet spot'
),
(
  'tiktok', 'story',
  '1c3c9f93-890f-402e-bb1d-b7fe6945c146', -- Sora 2
  '9:16', '1080p', 5, 15, 30,
  'Quick, punchy vertical content. Grabbing attention immediately.',
  'TikTok stories, short and vertical'
)
ON CONFLICT (platform, content_format) DO NOTHING;

-- YOUTUBE
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'youtube', 'feed_post',
  '1c3c9f93-890f-402e-bb1d-b7fe6945c146', -- Sora 2
  '16:9', '1080p', 15, 600, 256,
  'Cinematic widescreen quality. Professional, polished look.',
  'Landscape 16:9, longer form content'
),
(
  'youtube', 'thumbnail',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '16:9', '1536x1024', NULL, NULL, 2,
  'Bold, click-worthy thumbnail. High contrast, clear focal point, readable at small size.',
  '1280x720 minimum, high contrast for click-through'
),
(
  'youtube', 'short',
  'dc712f1a-1965-44e6-acf9-671f93e85133', -- Seedance API
  '9:16', '1080p', 10, 60, 100,
  'Vertical short-form, punchy and engaging from first second.',
  'YouTube Shorts, vertical 9:16, max 60s'
)
ON CONFLICT (platform, content_format) DO NOTHING;

-- FACEBOOK
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'facebook', 'feed_post',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '16:9', '1536x1024', NULL, NULL, 30,
  'Shareable, warm and inviting visual. Works well in news feed scroll.',
  'Landscape or square, optimized for feed visibility'
),
(
  'facebook', 'reel',
  '1c3c9f93-890f-402e-bb1d-b7fe6945c146', -- Sora 2
  '9:16', '1080p', 10, 90, 100,
  'Vertical, engaging motion content for Facebook Reels.',
  'Facebook Reels, vertical format'
),
(
  'facebook', 'story',
  'dc712f1a-1965-44e6-acf9-671f93e85133', -- Seedance API
  '9:16', '1080p', 5, 20, 30,
  'Full-screen vertical story content.',
  'Facebook Stories, 9:16 vertical'
),
(
  'facebook', 'cover',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '16:9', '1536x1024', NULL, NULL, 10,
  'Professional cover photo. Clean, branded, high resolution.',
  'Cover photo 820x312 display, upload at higher res'
)
ON CONFLICT (platform, content_format) DO NOTHING;

-- LINKEDIN
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'linkedin', 'feed_post',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '16:9', '1536x1024', NULL, NULL, 10,
  'Professional, corporate-appropriate imagery. Clean, polished, business context.',
  'Landscape preferred, professional aesthetic'
),
(
  'linkedin', 'article_cover',
  '67b07408-ceb1-49e6-9530-8a3775ffd3cc', -- Seedream 4.5
  '16:9', '1536x1024', NULL, NULL, 10,
  'Editorial, thought-leadership style imagery. Professional and authoritative.',
  'LinkedIn article cover image'
),
(
  'linkedin', 'video',
  '1c3c9f93-890f-402e-bb1d-b7fe6945c146', -- Sora 2
  '16:9', '1080p', 15, 600, 200,
  'Professional video content. Clear, polished, business-appropriate.',
  'LinkedIn native video, landscape preferred'
)
ON CONFLICT (platform, content_format) DO NOTHING;

-- GOOGLE BUSINESS PROFILE (GBP)
INSERT INTO platform_media_defaults (platform, content_format, recommended_model_id, default_aspect_ratio, default_resolution, default_duration, max_duration, max_file_size_mb, prompt_suffix, notes)
VALUES
(
  'gbp', 'feed_post',
  'f2b7f1a6-9081-477e-8508-012b09bc22ea', -- Flux.2
  '4:3', '1024x1024', NULL, NULL, 5,
  'Local business imagery. Inviting, authentic feel. Showcasing products or services.',
  'Google Business Profile post image'
),
(
  'gbp', 'cover',
  '67b07408-ceb1-49e6-9530-8a3775ffd3cc', -- Seedream 4.5
  '16:9', '1536x1024', NULL, NULL, 5,
  'Professional business cover. Clean, branded, welcoming.',
  'GBP cover photo, landscape format'
)
ON CONFLICT (platform, content_format) DO NOTHING;
