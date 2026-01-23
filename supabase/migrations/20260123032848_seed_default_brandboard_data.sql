/*
  # Seed Default Brandboard Data

  1. Default Brand Kit
    - Named "Primary Brand"
    - Includes sample colors: primary (blue), secondary (slate), accent (emerald), background (white), text (slate-900)
    - Includes sample font settings
    - Set as active

  2. Default Brand Voice
    - Named "Professional Voice"
    - Includes balanced tone settings
    - Includes sample dos/donts and vocabulary
    - Includes editable AI prompt template
    - Generates AI system prompt from settings
    - Set as active
*/

-- Create default brand kit
INSERT INTO brand_kits (id, org_id, name, description, active, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Primary Brand',
  'Default brand kit for your organization',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Create initial version for default brand kit
INSERT INTO brand_kit_versions (brand_kit_id, version_number, logos, colors, fonts, imagery_refs, created_at)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  1,
  '[]'::jsonb,
  '{
    "primary": {"hex": "#2563eb", "name": "Brand Blue"},
    "secondary": {"hex": "#475569", "name": "Slate"},
    "accent": {"hex": "#10b981", "name": "Emerald"},
    "background": {"hex": "#ffffff", "name": "White"},
    "text": {"hex": "#0f172a", "name": "Slate 900"}
  }'::jsonb,
  '{
    "primary": {"name": "Inter", "source": "google"},
    "secondary": {"name": "Inter", "source": "google"}
  }'::jsonb,
  '[]'::jsonb,
  now()
)
ON CONFLICT (brand_kit_id, version_number) DO NOTHING;

-- Create default brand voice
INSERT INTO brand_voices (id, org_id, name, summary, active, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Professional Voice',
  'Balanced, professional tone suitable for business communications',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Create initial version for default brand voice with AI prompt template
INSERT INTO brand_voice_versions (
  brand_voice_id, 
  version_number, 
  tone_settings, 
  dos, 
  donts, 
  vocabulary_preferred, 
  vocabulary_prohibited,
  formatting_rules,
  examples,
  ai_prompt_template,
  ai_system_prompt,
  created_at
)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  1,
  '{
    "formality": 65,
    "friendliness": 70,
    "energy": 55,
    "confidence": 75
  }'::jsonb,
  ARRAY[
    'Use clear, concise language',
    'Address the reader directly using "you"',
    'Lead with benefits and value',
    'Include specific examples when possible',
    'End with a clear call to action'
  ],
  ARRAY[
    'Use jargon or technical terms without explanation',
    'Make promises we cannot keep',
    'Use passive voice excessively',
    'Include unnecessary filler words',
    'Sound robotic or impersonal'
  ],
  ARRAY[
    'partner',
    'solution',
    'streamline',
    'empower',
    'optimize'
  ],
  ARRAY[
    'synergy',
    'leverage',
    'circle back',
    'low-hanging fruit',
    'move the needle'
  ],
  'Use sentence case for headings. Limit paragraphs to 3-4 sentences. Use bullet points for lists of 3+ items. Include line breaks between sections for readability.',
  '{
    "email": "Hi [Name],\n\nThank you for reaching out about [topic]. We appreciate your interest in working together.\n\nI wanted to follow up on our conversation and share some thoughts on how we can help you achieve [goal].\n\nLooking forward to connecting soon.\n\nBest regards,\n[Signature]",
    "sms": "Hi [Name]! Thanks for your interest. Let me know a good time to chat about how we can help. - [Name]",
    "social": "Great things happen when teams work smarter, not harder. Discover how [Company] helps businesses like yours achieve more."
  }'::jsonb,
  'You are an AI assistant representing {{company_name}}.

COMMUNICATION STYLE:
- Formality Level: {{formality_description}}
- Tone: {{tone_description}}
- Energy: {{energy_description}}
- Confidence: {{confidence_description}}

WRITING GUIDELINES:
DO:
{{dos_list}}

DO NOT:
{{donts_list}}

VOCABULARY:
Preferred phrases: {{preferred_phrases}}
Avoid these phrases: {{prohibited_phrases}}

FORMATTING:
{{formatting_rules}}

When communicating, ensure all messages reflect our brand voice. Be {{tone_adjectives}} while maintaining {{formality_adjective}} language.',
  'You are an AI assistant representing the organization.

COMMUNICATION STYLE:
- Formality Level: Professional but approachable - lean slightly formal while remaining accessible
- Tone: Warm and helpful - prioritize being genuinely useful while maintaining professionalism
- Energy: Balanced and measured - confident without being pushy
- Confidence: Self-assured - speak with authority while remaining open to questions

WRITING GUIDELINES:
DO:
- Use clear, concise language
- Address the reader directly using "you"
- Lead with benefits and value
- Include specific examples when possible
- End with a clear call to action

DO NOT:
- Use jargon or technical terms without explanation
- Make promises we cannot keep
- Use passive voice excessively
- Include unnecessary filler words
- Sound robotic or impersonal

VOCABULARY:
Preferred phrases: partner, solution, streamline, empower, optimize
Avoid these phrases: synergy, leverage, circle back, low-hanging fruit, move the needle

FORMATTING:
Use sentence case for headings. Limit paragraphs to 3-4 sentences. Use bullet points for lists of 3+ items. Include line breaks between sections for readability.

When communicating, ensure all messages reflect our brand voice. Be warm and helpful while maintaining professional language.',
  now()
)
ON CONFLICT (brand_voice_id, version_number) DO NOTHING;
