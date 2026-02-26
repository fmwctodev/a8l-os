/*
  # Create Media Style Presets Table

  1. New Tables
    - `media_style_presets`
      - `id` (uuid, primary key)
      - `name` (text, unique) - preset key identifier (e.g., 'ugc', 'cinematic')
      - `display_name` (text) - human-friendly label
      - `description` (text) - when to use this style
      - `camera_style` (text) - camera movement description
      - `lighting` (text) - lighting style
      - `pacing` (text) - editing rhythm (slow/medium/fast)
      - `hook_required` (boolean) - whether hook opening is mandatory
      - `subtitle_style` (text) - subtitle/text overlay approach
      - `recommended_duration_min` (integer) - lower bound seconds
      - `recommended_duration_max` (integer) - upper bound seconds
      - `recommended_aspect_ratio` (text) - forced ratio for this style
      - `prompt_template` (text) - structured template for KIE generation prompt
      - `llm_context_snippet` (text) - text injected into LLM system prompt
      - `enabled` (boolean, default true)
      - `display_priority` (integer, default 100)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `media_style_presets`
    - Authenticated users can SELECT enabled presets
    - SuperAdmin can manage all presets

  3. Seed Data
    - 8 built-in style presets: ugc, cinematic, product_demo, testimonial, explainer, hype_trailer, educational, corporate_clean
*/

CREATE TABLE IF NOT EXISTS media_style_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  camera_style text NOT NULL DEFAULT '',
  lighting text NOT NULL DEFAULT '',
  pacing text NOT NULL DEFAULT 'medium' CHECK (pacing IN ('slow', 'medium', 'fast')),
  hook_required boolean NOT NULL DEFAULT false,
  subtitle_style text NOT NULL DEFAULT '',
  recommended_duration_min integer NOT NULL DEFAULT 5,
  recommended_duration_max integer NOT NULL DEFAULT 30,
  recommended_aspect_ratio text,
  prompt_template text NOT NULL DEFAULT '',
  llm_context_snippet text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  display_priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE media_style_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enabled presets"
  ON media_style_presets
  FOR SELECT
  TO authenticated
  USING (enabled = true);

CREATE POLICY "SuperAdmin can view all presets"
  ON media_style_presets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

CREATE POLICY "SuperAdmin can insert presets"
  ON media_style_presets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

CREATE POLICY "SuperAdmin can update presets"
  ON media_style_presets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

CREATE POLICY "SuperAdmin can delete presets"
  ON media_style_presets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'SuperAdmin'
    )
  );

INSERT INTO media_style_presets (name, display_name, description, camera_style, lighting, pacing, hook_required, subtitle_style, recommended_duration_min, recommended_duration_max, recommended_aspect_ratio, prompt_template, llm_context_snippet, enabled, display_priority) VALUES
(
  'ugc',
  'UGC Style',
  'User-generated content look. Authentic, relatable, handheld feel. Best for TikTok, Reels, Shorts.',
  'Handheld, slight natural shake, close-up to medium shots, point-of-view angles',
  'Natural ambient lighting, window light, slightly overexposed highlights for authentic feel',
  'fast',
  true,
  'Bold kinetic text overlays, large sans-serif, animated word-by-word reveal',
  15,
  30,
  '9:16',
  '[STYLE: UGC]\nCamera: Handheld with natural shake, close-up to medium shots, POV angles\nLighting: Natural ambient, window light, slightly overexposed\nPacing: Fast cuts, 1-3 second clips\nSubtitles: Bold kinetic text, animated word-by-word\n\n[SCENE]\n{prompt}\n\n[HOOK]\nAttention-grabbing opening in first 1.5 seconds',
  'UGC Style: Handheld camera, natural lighting, fast pacing, bold kinetic subtitles. Best for TikTok/Reels/Shorts. Duration: 15-30s, 9:16 vertical. Must open with a hook in the first 1.5 seconds. Authentic, slightly imperfect aesthetic.',
  true,
  10
),
(
  'cinematic',
  'Cinematic',
  'Premium cinematic look with smooth camera work and dramatic lighting. Brand films, hero content.',
  'Smooth tracking shots, dolly moves, slow orbits, crane-style reveals',
  'Dramatic directional lighting, strong contrast, golden hour warmth or cool blue tones',
  'slow',
  false,
  'Minimal elegant lower thirds, light sans-serif, subtle fade transitions',
  10,
  60,
  '16:9',
  '[STYLE: Cinematic]\nCamera: Smooth tracking, dolly moves, slow orbits, crane reveals\nLighting: Dramatic directional, strong contrast, cinematic color grading\nPacing: Slow deliberate cuts, long takes, breathing room\nSubtitles: Minimal elegant lower thirds\n\n[SCENE]\n{prompt}',
  'Cinematic Style: Smooth tracking shots, dramatic lighting, slow pacing, minimal elegant text. Best for YouTube, brand films, hero content. Duration: 10-60s, 16:9 widescreen. Premium, polished aesthetic with cinematic color grading.',
  true,
  20
),
(
  'product_demo',
  'Product Demo',
  'Clean product showcase with focus on details and features. E-commerce, product launches.',
  'Static with subtle push-ins, macro detail shots, 360-degree rotations, clean transitions',
  'Clean studio lighting, soft shadows, white or gradient backgrounds, product-focused spots',
  'medium',
  false,
  'Professional lower thirds with feature callouts, clean data labels',
  15,
  45,
  NULL,
  '[STYLE: Product Demo]\nCamera: Static with subtle push-ins, macro details, 360 rotations\nLighting: Clean studio, soft shadows, product-focused spotlights\nPacing: Medium, methodical feature reveals\nSubtitles: Professional callouts, clean labels\n\n[SCENE]\n{prompt}',
  'Product Demo Style: Static camera with push-ins, macro detail shots, clean studio lighting, medium pacing. Professional callout text. Best for e-commerce, product launches. Duration: 15-45s. Clean, focused on product details.',
  true,
  30
),
(
  'testimonial',
  'Testimonial',
  'Interview-style talking head with supporting B-roll. Trust building, social proof.',
  'Medium shot talking head, slight zoom drift, B-roll cutaways, split-screen capability',
  'Soft key light with fill, natural background blur (bokeh), warm skin tones',
  'medium',
  true,
  'Speaker name and title lower thirds, pull-quote highlights in bold',
  20,
  60,
  NULL,
  '[STYLE: Testimonial]\nCamera: Medium talking head, slight zoom drift, B-roll cutaways\nLighting: Soft key with fill, natural bokeh background, warm skin tones\nPacing: Medium, conversational rhythm\nSubtitles: Name/title lower thirds, pull-quote highlights\n\n[SCENE]\n{prompt}\n\n[HOOK]\nCompelling quote or result statement upfront',
  'Testimonial Style: Medium shot talking head, soft key lighting with bokeh, medium conversational pacing. Name/title lower thirds. Must open with a compelling quote. Best for trust building, case studies. Duration: 20-60s.',
  true,
  40
),
(
  'explainer',
  'Explainer',
  'Educational content with clear visual storytelling. Tutorials, how-tos, thought leadership.',
  'Screen recordings mixed with talking head, animated overlays, step-by-step progression',
  'Even bright lighting, clean and professional, minimal shadows',
  'medium',
  true,
  'Step numbers, process labels, highlighted keywords, progress indicators',
  30,
  90,
  '16:9',
  '[STYLE: Explainer]\nCamera: Mixed screen recordings with talking head, animated overlays\nLighting: Even bright, clean professional\nPacing: Medium, structured step-by-step progression\nSubtitles: Step numbers, process labels, keyword highlights, progress indicators\n\n[SCENE]\n{prompt}\n\n[HOOK]\nProblem statement or intriguing question',
  'Explainer Style: Mixed screen recordings and talking head, even bright lighting, medium structured pacing. Step numbers and keyword highlights. Must open with problem statement. Best for tutorials, how-tos. Duration: 30-90s, 16:9.',
  true,
  50
),
(
  'hype_trailer',
  'Hype Trailer',
  'High-energy promotional trailer. Event promos, launches, announcements.',
  'Quick cuts between dramatic angles, whip pans, speed ramps, dynamic zooms',
  'High contrast, neon accents, strobe effects, dramatic shadows',
  'fast',
  true,
  'Large impact text, glitch effects, countdown timers, bold animated titles',
  10,
  30,
  '9:16',
  '[STYLE: Hype Trailer]\nCamera: Quick cuts, dramatic angles, whip pans, speed ramps, dynamic zooms\nLighting: High contrast, neon accents, strobe effects, dramatic shadows\nPacing: Fast, building intensity, crescendo structure\nSubtitles: Large impact text, glitch effects, countdown timers\n\n[SCENE]\n{prompt}\n\n[HOOK]\nExplosive visual or bold statement in first second',
  'Hype Trailer Style: Quick cuts with dramatic angles, high contrast neon lighting, fast escalating pacing. Large impact text with effects. Must open with explosive visual. Best for event promos, launches. Duration: 10-30s, 9:16.',
  true,
  60
),
(
  'educational',
  'Educational',
  'Calm, focused educational content. Courses, webinars, knowledge sharing.',
  'Static wide or medium shots, gentle pan across diagrams, screen share focus',
  'Soft even lighting, warm tone, comfortable and inviting atmosphere',
  'slow',
  false,
  'Clear readable text, bullet points, diagram labels, chapter markers',
  45,
  120,
  '16:9',
  '[STYLE: Educational]\nCamera: Static wide/medium shots, gentle pans across diagrams\nLighting: Soft even, warm inviting atmosphere\nPacing: Slow, deliberate, allowing absorption of information\nSubtitles: Clear readable text, bullet points, diagram labels\n\n[SCENE]\n{prompt}',
  'Educational Style: Static wide shots, soft even warm lighting, slow deliberate pacing. Clear readable text and bullet points. Best for courses, webinars, knowledge sharing. Duration: 45-120s, 16:9. Calm, focused atmosphere.',
  true,
  70
),
(
  'corporate_clean',
  'Corporate Clean',
  'Professional corporate content. Company updates, internal comms, B2B marketing.',
  'Steady tripod shots, gentle slider moves, professional framing, rule of thirds',
  'Professional 3-point lighting, branded color temperature, clean backgrounds',
  'medium',
  false,
  'Professional lower thirds with brand colors, data visualizations, clean sans-serif',
  15,
  60,
  '16:9',
  '[STYLE: Corporate Clean]\nCamera: Steady tripod, gentle slider moves, professional rule-of-thirds framing\nLighting: Professional 3-point, branded color temperature, clean backgrounds\nPacing: Medium, measured and professional\nSubtitles: Professional lower thirds with brand colors, data visualizations\n\n[SCENE]\n{prompt}',
  'Corporate Clean Style: Steady tripod shots, professional 3-point lighting, medium measured pacing. Professional lower thirds with data visualizations. Best for company updates, B2B marketing. Duration: 15-60s, 16:9.',
  true,
  80
)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_media_style_presets_enabled ON media_style_presets (enabled, display_priority);
