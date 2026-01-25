import { supabase } from '../lib/supabase';
import type {
  BrandKit,
  BrandKitVersion,
  BrandKitWithVersion,
  BrandKitStatus,
  BrandVoice,
  BrandVoiceVersion,
  BrandVoiceWithVersion,
  BrandUsage,
  BrandUsageStats,
  CreateBrandKitInput,
  UpdateBrandKitInput,
  CreateBrandVoiceInput,
  UpdateBrandVoiceInput,
  BrandKitFilters,
  BrandVoiceFilters,
  BrandUsageFilters,
  ToneSettings,
  RollbackSection,
  BrandKitColors,
  BrandKitFonts,
  BrandLogo,
  VoiceTrainingExamples,
  BrandCTA,
  AIFallbackBehavior,
  DEFAULT_AI_PROMPT_TEMPLATE,
} from '../types';

export async function getBrandKits(
  orgId: string,
  filters?: BrandKitFilters
): Promise<BrandKitWithVersion[]> {
  let query = supabase
    .from('brand_kits')
    .select(`
      *,
      created_by_user:users!brand_kits_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('status', { ascending: true })
    .order('name');

  if (!filters?.includeArchived) {
    query = query.neq('status', 'archived');
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data: kits, error } = await query;
  if (error) throw error;

  const kitsWithVersions: BrandKitWithVersion[] = [];
  for (const kit of kits || []) {
    const { data: versions } = await supabase
      .from('brand_kit_versions')
      .select(`
        *,
        created_by_user:users!brand_kit_versions_created_by_fkey(id, name, email),
        published_by_user:users!brand_kit_versions_published_by_fkey(id, name, email)
      `)
      .eq('brand_kit_id', kit.id)
      .order('version_number', { ascending: false })
      .limit(1);

    kitsWithVersions.push({
      ...kit,
      latest_version: versions?.[0] || null,
    });
  }

  return kitsWithVersions;
}

export async function getBrandKitById(id: string): Promise<BrandKitWithVersion | null> {
  const { data: kit, error } = await supabase
    .from('brand_kits')
    .select(`
      *,
      created_by_user:users!brand_kits_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!kit) return null;

  const { data: versions } = await supabase
    .from('brand_kit_versions')
    .select(`
      *,
      created_by_user:users!brand_kit_versions_created_by_fkey(id, name, email),
      published_by_user:users!brand_kit_versions_published_by_fkey(id, name, email)
    `)
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1);

  return {
    ...kit,
    latest_version: versions?.[0] || null,
  };
}

export async function getBrandKitDetail(id: string): Promise<BrandKitWithVersion | null> {
  return getBrandKitById(id);
}

export interface UpdateVisualIdentityInput {
  logos?: BrandLogo[];
  colors?: BrandKitColors;
  fonts?: BrandKitFonts;
  imagery_refs?: string[];
}

export async function updateBrandKitVisualIdentity(
  id: string,
  input: UpdateVisualIdentityInput,
  userId: string
): Promise<BrandKitVersion> {
  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert({
      brand_kit_id: id,
      logos: input.logos ?? currentVersion?.logos ?? [],
      colors: input.colors ?? currentVersion?.colors ?? {},
      fonts: input.fonts ?? currentVersion?.fonts ?? {},
      imagery_refs: input.imagery_refs ?? currentVersion?.imagery_refs ?? [],
      tone_settings: currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
      voice_descriptors: currentVersion?.voice_descriptors ?? [],
      voice_examples: currentVersion?.voice_examples ?? { good: [], bad: [] },
      dos: currentVersion?.dos ?? [],
      donts: currentVersion?.donts ?? [],
      elevator_pitch: currentVersion?.elevator_pitch ?? null,
      value_proposition: currentVersion?.value_proposition ?? null,
      short_tagline: currentVersion?.short_tagline ?? null,
      long_description: currentVersion?.long_description ?? null,
      ctas: currentVersion?.ctas ?? [],
      ai_enforce_voice: currentVersion?.ai_enforce_voice ?? true,
      ai_enforce_terminology: currentVersion?.ai_enforce_terminology ?? false,
      ai_avoid_restricted: currentVersion?.ai_avoid_restricted ?? true,
      ai_forbidden_topics: currentVersion?.ai_forbidden_topics ?? [],
      ai_forbidden_claims: currentVersion?.ai_forbidden_claims ?? [],
      ai_forbidden_phrases: currentVersion?.ai_forbidden_phrases ?? [],
      ai_fallback_behavior: currentVersion?.ai_fallback_behavior ?? 'ask_human',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

export interface UpdateBrandVoiceInput {
  tone_settings?: ToneSettings;
  voice_descriptors?: string[];
  voice_examples?: VoiceTrainingExamples;
  dos?: string[];
  donts?: string[];
}

export async function updateBrandKitVoice(
  id: string,
  input: UpdateBrandVoiceInput,
  userId: string
): Promise<BrandKitVersion> {
  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert({
      brand_kit_id: id,
      logos: currentVersion?.logos ?? [],
      colors: currentVersion?.colors ?? {},
      fonts: currentVersion?.fonts ?? {},
      imagery_refs: currentVersion?.imagery_refs ?? [],
      tone_settings: input.tone_settings ?? currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
      voice_descriptors: input.voice_descriptors ?? currentVersion?.voice_descriptors ?? [],
      voice_examples: input.voice_examples ?? currentVersion?.voice_examples ?? { good: [], bad: [] },
      dos: input.dos ?? currentVersion?.dos ?? [],
      donts: input.donts ?? currentVersion?.donts ?? [],
      elevator_pitch: currentVersion?.elevator_pitch ?? null,
      value_proposition: currentVersion?.value_proposition ?? null,
      short_tagline: currentVersion?.short_tagline ?? null,
      long_description: currentVersion?.long_description ?? null,
      ctas: currentVersion?.ctas ?? [],
      ai_enforce_voice: currentVersion?.ai_enforce_voice ?? true,
      ai_enforce_terminology: currentVersion?.ai_enforce_terminology ?? false,
      ai_avoid_restricted: currentVersion?.ai_avoid_restricted ?? true,
      ai_forbidden_topics: currentVersion?.ai_forbidden_topics ?? [],
      ai_forbidden_claims: currentVersion?.ai_forbidden_claims ?? [],
      ai_forbidden_phrases: currentVersion?.ai_forbidden_phrases ?? [],
      ai_fallback_behavior: currentVersion?.ai_fallback_behavior ?? 'ask_human',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

export interface UpdateMessagingInput {
  elevator_pitch?: string | null;
  value_proposition?: string | null;
  short_tagline?: string | null;
  long_description?: string | null;
  ctas?: BrandCTA[];
}

export async function updateBrandKitMessaging(
  id: string,
  input: UpdateMessagingInput,
  userId: string
): Promise<BrandKitVersion> {
  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert({
      brand_kit_id: id,
      logos: currentVersion?.logos ?? [],
      colors: currentVersion?.colors ?? {},
      fonts: currentVersion?.fonts ?? {},
      imagery_refs: currentVersion?.imagery_refs ?? [],
      tone_settings: currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
      voice_descriptors: currentVersion?.voice_descriptors ?? [],
      voice_examples: currentVersion?.voice_examples ?? { good: [], bad: [] },
      dos: currentVersion?.dos ?? [],
      donts: currentVersion?.donts ?? [],
      elevator_pitch: input.elevator_pitch !== undefined ? input.elevator_pitch : currentVersion?.elevator_pitch ?? null,
      value_proposition: input.value_proposition !== undefined ? input.value_proposition : currentVersion?.value_proposition ?? null,
      short_tagline: input.short_tagline !== undefined ? input.short_tagline : currentVersion?.short_tagline ?? null,
      long_description: input.long_description !== undefined ? input.long_description : currentVersion?.long_description ?? null,
      ctas: input.ctas ?? currentVersion?.ctas ?? [],
      ai_enforce_voice: currentVersion?.ai_enforce_voice ?? true,
      ai_enforce_terminology: currentVersion?.ai_enforce_terminology ?? false,
      ai_avoid_restricted: currentVersion?.ai_avoid_restricted ?? true,
      ai_forbidden_topics: currentVersion?.ai_forbidden_topics ?? [],
      ai_forbidden_claims: currentVersion?.ai_forbidden_claims ?? [],
      ai_forbidden_phrases: currentVersion?.ai_forbidden_phrases ?? [],
      ai_fallback_behavior: currentVersion?.ai_fallback_behavior ?? 'ask_human',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

export interface UpdateAIRulesInput {
  ai_enforce_voice?: boolean;
  ai_enforce_terminology?: boolean;
  ai_avoid_restricted?: boolean;
  ai_forbidden_topics?: string[];
  ai_forbidden_claims?: string[];
  ai_forbidden_phrases?: string[];
  ai_fallback_behavior?: AIFallbackBehavior;
}

export async function updateBrandKitAIRules(
  id: string,
  input: UpdateAIRulesInput,
  userId: string
): Promise<BrandKitVersion> {
  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert({
      brand_kit_id: id,
      logos: currentVersion?.logos ?? [],
      colors: currentVersion?.colors ?? {},
      fonts: currentVersion?.fonts ?? {},
      imagery_refs: currentVersion?.imagery_refs ?? [],
      tone_settings: currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
      voice_descriptors: currentVersion?.voice_descriptors ?? [],
      voice_examples: currentVersion?.voice_examples ?? { good: [], bad: [] },
      dos: currentVersion?.dos ?? [],
      donts: currentVersion?.donts ?? [],
      elevator_pitch: currentVersion?.elevator_pitch ?? null,
      value_proposition: currentVersion?.value_proposition ?? null,
      short_tagline: currentVersion?.short_tagline ?? null,
      long_description: currentVersion?.long_description ?? null,
      ctas: currentVersion?.ctas ?? [],
      ai_enforce_voice: input.ai_enforce_voice ?? currentVersion?.ai_enforce_voice ?? true,
      ai_enforce_terminology: input.ai_enforce_terminology ?? currentVersion?.ai_enforce_terminology ?? false,
      ai_avoid_restricted: input.ai_avoid_restricted ?? currentVersion?.ai_avoid_restricted ?? true,
      ai_forbidden_topics: input.ai_forbidden_topics ?? currentVersion?.ai_forbidden_topics ?? [],
      ai_forbidden_claims: input.ai_forbidden_claims ?? currentVersion?.ai_forbidden_claims ?? [],
      ai_forbidden_phrases: input.ai_forbidden_phrases ?? currentVersion?.ai_forbidden_phrases ?? [],
      ai_fallback_behavior: input.ai_fallback_behavior ?? currentVersion?.ai_fallback_behavior ?? 'ask_human',
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

export async function publishBrandKit(id: string, userId: string): Promise<BrandKitVersion> {
  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!currentVersion) {
    throw new Error('No version found to publish');
  }

  const { data: publishedVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert({
      brand_kit_id: id,
      logos: currentVersion.logos,
      colors: currentVersion.colors,
      fonts: currentVersion.fonts,
      imagery_refs: currentVersion.imagery_refs,
      tone_settings: currentVersion.tone_settings,
      voice_descriptors: currentVersion.voice_descriptors,
      voice_examples: currentVersion.voice_examples,
      dos: currentVersion.dos,
      donts: currentVersion.donts,
      elevator_pitch: currentVersion.elevator_pitch,
      value_proposition: currentVersion.value_proposition,
      short_tagline: currentVersion.short_tagline,
      long_description: currentVersion.long_description,
      ctas: currentVersion.ctas,
      ai_enforce_voice: currentVersion.ai_enforce_voice,
      ai_enforce_terminology: currentVersion.ai_enforce_terminology,
      ai_avoid_restricted: currentVersion.ai_avoid_restricted,
      ai_forbidden_topics: currentVersion.ai_forbidden_topics,
      ai_forbidden_claims: currentVersion.ai_forbidden_claims,
      ai_forbidden_phrases: currentVersion.ai_forbidden_phrases,
      ai_fallback_behavior: currentVersion.ai_fallback_behavior,
      created_by: userId,
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return publishedVersion;
}

export async function setActiveBrandKit(id: string): Promise<void> {
  const { data: kit, error: fetchError } = await supabase
    .from('brand_kits')
    .select('org_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error: deactivateError } = await supabase
    .from('brand_kits')
    .update({ status: 'draft', active: false })
    .eq('org_id', kit.org_id)
    .eq('status', 'active');

  if (deactivateError) throw deactivateError;

  const { error: activateError } = await supabase
    .from('brand_kits')
    .update({ status: 'active', active: true })
    .eq('id', id);

  if (activateError) throw activateError;
}

export async function rollbackBrandKitSection(
  kitId: string,
  versionNumber: number,
  sections: RollbackSection[],
  userId: string
): Promise<BrandKitVersion> {
  const { data: targetVersion, error: fetchError } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', kitId)
    .eq('version_number', versionNumber)
    .single();

  if (fetchError) throw fetchError;

  const { data: currentVersion } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', kitId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const newVersionData: Record<string, unknown> = {
    brand_kit_id: kitId,
    logos: currentVersion?.logos ?? [],
    colors: currentVersion?.colors ?? {},
    fonts: currentVersion?.fonts ?? {},
    imagery_refs: currentVersion?.imagery_refs ?? [],
    tone_settings: currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
    voice_descriptors: currentVersion?.voice_descriptors ?? [],
    voice_examples: currentVersion?.voice_examples ?? { good: [], bad: [] },
    dos: currentVersion?.dos ?? [],
    donts: currentVersion?.donts ?? [],
    elevator_pitch: currentVersion?.elevator_pitch ?? null,
    value_proposition: currentVersion?.value_proposition ?? null,
    short_tagline: currentVersion?.short_tagline ?? null,
    long_description: currentVersion?.long_description ?? null,
    ctas: currentVersion?.ctas ?? [],
    ai_enforce_voice: currentVersion?.ai_enforce_voice ?? true,
    ai_enforce_terminology: currentVersion?.ai_enforce_terminology ?? false,
    ai_avoid_restricted: currentVersion?.ai_avoid_restricted ?? true,
    ai_forbidden_topics: currentVersion?.ai_forbidden_topics ?? [],
    ai_forbidden_claims: currentVersion?.ai_forbidden_claims ?? [],
    ai_forbidden_phrases: currentVersion?.ai_forbidden_phrases ?? [],
    ai_fallback_behavior: currentVersion?.ai_fallback_behavior ?? 'ask_human',
    created_by: userId,
  };

  for (const section of sections) {
    switch (section) {
      case 'visual_identity':
        newVersionData.logos = targetVersion.logos;
        newVersionData.colors = targetVersion.colors;
        newVersionData.fonts = targetVersion.fonts;
        newVersionData.imagery_refs = targetVersion.imagery_refs;
        break;
      case 'brand_voice':
        newVersionData.tone_settings = targetVersion.tone_settings;
        newVersionData.voice_descriptors = targetVersion.voice_descriptors;
        newVersionData.voice_examples = targetVersion.voice_examples;
        newVersionData.dos = targetVersion.dos;
        newVersionData.donts = targetVersion.donts;
        break;
      case 'messaging':
        newVersionData.elevator_pitch = targetVersion.elevator_pitch;
        newVersionData.value_proposition = targetVersion.value_proposition;
        newVersionData.short_tagline = targetVersion.short_tagline;
        newVersionData.long_description = targetVersion.long_description;
        newVersionData.ctas = targetVersion.ctas;
        break;
      case 'ai_rules':
        newVersionData.ai_enforce_voice = targetVersion.ai_enforce_voice;
        newVersionData.ai_enforce_terminology = targetVersion.ai_enforce_terminology;
        newVersionData.ai_avoid_restricted = targetVersion.ai_avoid_restricted;
        newVersionData.ai_forbidden_topics = targetVersion.ai_forbidden_topics;
        newVersionData.ai_forbidden_claims = targetVersion.ai_forbidden_claims;
        newVersionData.ai_forbidden_phrases = targetVersion.ai_forbidden_phrases;
        newVersionData.ai_fallback_behavior = targetVersion.ai_fallback_behavior;
        break;
    }
  }

  const { data: newVersion, error } = await supabase
    .from('brand_kit_versions')
    .insert(newVersionData)
    .select()
    .single();

  if (error) throw error;
  return newVersion;
}

export async function getActiveBrandKit(orgId: string): Promise<BrandKitWithVersion | null> {
  const { data: kit, error } = await supabase
    .from('brand_kits')
    .select(`
      *,
      created_by_user:users!brand_kits_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .eq('active', true)
    .is('archived_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!kit) return null;

  const { data: versions } = await supabase
    .from('brand_kit_versions')
    .select(`
      *,
      created_by_user:users!brand_kit_versions_created_by_fkey(id, name, email)
    `)
    .eq('brand_kit_id', kit.id)
    .order('version_number', { ascending: false })
    .limit(1);

  return {
    ...kit,
    latest_version: versions?.[0] || null,
  };
}

export async function createBrandKit(
  orgId: string,
  input: CreateBrandKitInput,
  userId: string
): Promise<BrandKit> {
  const { data: kit, error: kitError } = await supabase
    .from('brand_kits')
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description || null,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (kitError) throw kitError;

  const { error: versionError } = await supabase.from('brand_kit_versions').insert({
    brand_kit_id: kit.id,
    logos: input.logos || [],
    colors: input.colors || {},
    fonts: input.fonts || {},
    imagery_refs: input.imagery_refs || [],
    tone_settings: input.tone_settings || { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
    voice_descriptors: input.voice_descriptors || [],
    voice_examples: input.voice_examples || { good: [], bad: [] },
    dos: input.dos || [],
    donts: input.donts || [],
    elevator_pitch: input.elevator_pitch || null,
    value_proposition: input.value_proposition || null,
    short_tagline: input.short_tagline || null,
    long_description: input.long_description || null,
    ctas: input.ctas || [],
    ai_enforce_voice: input.ai_enforce_voice ?? true,
    ai_enforce_terminology: input.ai_enforce_terminology ?? false,
    ai_avoid_restricted: input.ai_avoid_restricted ?? true,
    ai_forbidden_topics: input.ai_forbidden_topics || [],
    ai_forbidden_claims: input.ai_forbidden_claims || [],
    ai_forbidden_phrases: input.ai_forbidden_phrases || [],
    ai_fallback_behavior: input.ai_fallback_behavior || 'ask_human',
    created_by: userId,
  });

  if (versionError) throw versionError;

  return kit;
}

export async function updateBrandKit(
  id: string,
  input: UpdateBrandKitInput,
  userId: string
): Promise<BrandKit> {
  if (input.name !== undefined || input.description !== undefined) {
    const { error: updateError } = await supabase
      .from('brand_kits')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      })
      .eq('id', id);

    if (updateError) throw updateError;
  }

  const hasVersionChanges =
    input.logos !== undefined ||
    input.colors !== undefined ||
    input.fonts !== undefined ||
    input.imagery_refs !== undefined ||
    input.tone_settings !== undefined ||
    input.voice_descriptors !== undefined ||
    input.voice_examples !== undefined ||
    input.dos !== undefined ||
    input.donts !== undefined ||
    input.elevator_pitch !== undefined ||
    input.value_proposition !== undefined ||
    input.short_tagline !== undefined ||
    input.long_description !== undefined ||
    input.ctas !== undefined ||
    input.ai_enforce_voice !== undefined ||
    input.ai_enforce_terminology !== undefined ||
    input.ai_avoid_restricted !== undefined ||
    input.ai_forbidden_topics !== undefined ||
    input.ai_forbidden_claims !== undefined ||
    input.ai_forbidden_phrases !== undefined ||
    input.ai_fallback_behavior !== undefined;

  if (hasVersionChanges) {
    const { data: currentVersion } = await supabase
      .from('brand_kit_versions')
      .select('*')
      .eq('brand_kit_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: versionError } = await supabase.from('brand_kit_versions').insert({
      brand_kit_id: id,
      logos: input.logos ?? currentVersion?.logos ?? [],
      colors: input.colors ?? currentVersion?.colors ?? {},
      fonts: input.fonts ?? currentVersion?.fonts ?? {},
      imagery_refs: input.imagery_refs ?? currentVersion?.imagery_refs ?? [],
      tone_settings: input.tone_settings ?? currentVersion?.tone_settings ?? { formality: 50, friendliness: 50, energy: 50, confidence: 50 },
      voice_descriptors: input.voice_descriptors ?? currentVersion?.voice_descriptors ?? [],
      voice_examples: input.voice_examples ?? currentVersion?.voice_examples ?? { good: [], bad: [] },
      dos: input.dos ?? currentVersion?.dos ?? [],
      donts: input.donts ?? currentVersion?.donts ?? [],
      elevator_pitch: input.elevator_pitch !== undefined ? input.elevator_pitch : currentVersion?.elevator_pitch ?? null,
      value_proposition: input.value_proposition !== undefined ? input.value_proposition : currentVersion?.value_proposition ?? null,
      short_tagline: input.short_tagline !== undefined ? input.short_tagline : currentVersion?.short_tagline ?? null,
      long_description: input.long_description !== undefined ? input.long_description : currentVersion?.long_description ?? null,
      ctas: input.ctas ?? currentVersion?.ctas ?? [],
      ai_enforce_voice: input.ai_enforce_voice ?? currentVersion?.ai_enforce_voice ?? true,
      ai_enforce_terminology: input.ai_enforce_terminology ?? currentVersion?.ai_enforce_terminology ?? false,
      ai_avoid_restricted: input.ai_avoid_restricted ?? currentVersion?.ai_avoid_restricted ?? true,
      ai_forbidden_topics: input.ai_forbidden_topics ?? currentVersion?.ai_forbidden_topics ?? [],
      ai_forbidden_claims: input.ai_forbidden_claims ?? currentVersion?.ai_forbidden_claims ?? [],
      ai_forbidden_phrases: input.ai_forbidden_phrases ?? currentVersion?.ai_forbidden_phrases ?? [],
      ai_fallback_behavior: input.ai_fallback_behavior ?? currentVersion?.ai_fallback_behavior ?? 'ask_human',
      created_by: userId,
    });

    if (versionError) throw versionError;
  }

  const { data: kit, error } = await supabase
    .from('brand_kits')
    .select()
    .eq('id', id)
    .single();

  if (error) throw error;
  return kit;
}

export async function duplicateBrandKit(id: string, newName: string, userId: string): Promise<BrandKit> {
  const existing = await getBrandKitById(id);
  if (!existing) throw new Error('Brand kit not found');
  const v = existing.latest_version;

  return createBrandKit(
    existing.org_id,
    {
      name: newName,
      description: existing.description || undefined,
      logos: v?.logos,
      colors: v?.colors,
      fonts: v?.fonts,
      imagery_refs: v?.imagery_refs,
      tone_settings: v?.tone_settings,
      voice_descriptors: v?.voice_descriptors,
      voice_examples: v?.voice_examples,
      dos: v?.dos,
      donts: v?.donts,
      elevator_pitch: v?.elevator_pitch || undefined,
      value_proposition: v?.value_proposition || undefined,
      short_tagline: v?.short_tagline || undefined,
      long_description: v?.long_description || undefined,
      ctas: v?.ctas,
      ai_enforce_voice: v?.ai_enforce_voice,
      ai_enforce_terminology: v?.ai_enforce_terminology,
      ai_avoid_restricted: v?.ai_avoid_restricted,
      ai_forbidden_topics: v?.ai_forbidden_topics,
      ai_forbidden_claims: v?.ai_forbidden_claims,
      ai_forbidden_phrases: v?.ai_forbidden_phrases,
      ai_fallback_behavior: v?.ai_fallback_behavior,
    },
    userId
  );
}

export async function activateBrandKit(id: string): Promise<void> {
  const { data: kit, error: fetchError } = await supabase
    .from('brand_kits')
    .select('org_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error: deactivateError } = await supabase
    .from('brand_kits')
    .update({ active: false, status: 'draft' })
    .eq('org_id', kit.org_id)
    .eq('status', 'active');

  if (deactivateError) throw deactivateError;

  const { error: activateError } = await supabase
    .from('brand_kits')
    .update({ active: true, status: 'active' })
    .eq('id', id);

  if (activateError) throw activateError;
}

export async function archiveBrandKit(id: string): Promise<void> {
  const { error } = await supabase
    .from('brand_kits')
    .update({ archived_at: new Date().toISOString(), active: false, status: 'archived' })
    .eq('id', id);

  if (error) throw error;
}

export async function getBrandKitVersions(kitId: string): Promise<BrandKitVersion[]> {
  const { data, error } = await supabase
    .from('brand_kit_versions')
    .select(`
      *,
      created_by_user:users!brand_kit_versions_created_by_fkey(id, name, email),
      published_by_user:users!brand_kit_versions_published_by_fkey(id, name, email)
    `)
    .eq('brand_kit_id', kitId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function rollbackBrandKitVersion(
  kitId: string,
  versionNumber: number,
  userId: string
): Promise<void> {
  const { data: version, error: fetchError } = await supabase
    .from('brand_kit_versions')
    .select('*')
    .eq('brand_kit_id', kitId)
    .eq('version_number', versionNumber)
    .single();

  if (fetchError) throw fetchError;

  const { error: insertError } = await supabase.from('brand_kit_versions').insert({
    brand_kit_id: kitId,
    logos: version.logos,
    colors: version.colors,
    fonts: version.fonts,
    imagery_refs: version.imagery_refs,
    created_by: userId,
  });

  if (insertError) throw insertError;
}

export async function getBrandVoices(
  orgId: string,
  filters?: BrandVoiceFilters
): Promise<BrandVoiceWithVersion[]> {
  let query = supabase
    .from('brand_voices')
    .select(`
      *,
      created_by_user:users!brand_voices_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .order('active', { ascending: false })
    .order('name');

  if (!filters?.includeArchived) {
    query = query.is('archived_at', null);
  }

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data: voices, error } = await query;
  if (error) throw error;

  const voicesWithVersions: BrandVoiceWithVersion[] = [];
  for (const voice of voices || []) {
    const { data: versions } = await supabase
      .from('brand_voice_versions')
      .select(`
        *,
        created_by_user:users!brand_voice_versions_created_by_fkey(id, name, email)
      `)
      .eq('brand_voice_id', voice.id)
      .order('version_number', { ascending: false })
      .limit(1);

    voicesWithVersions.push({
      ...voice,
      latest_version: versions?.[0] || null,
    });
  }

  return voicesWithVersions;
}

export async function getBrandVoiceById(id: string): Promise<BrandVoiceWithVersion | null> {
  const { data: voice, error } = await supabase
    .from('brand_voices')
    .select(`
      *,
      created_by_user:users!brand_voices_created_by_fkey(id, name, email)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!voice) return null;

  const { data: versions } = await supabase
    .from('brand_voice_versions')
    .select(`
      *,
      created_by_user:users!brand_voice_versions_created_by_fkey(id, name, email)
    `)
    .eq('brand_voice_id', id)
    .order('version_number', { ascending: false })
    .limit(1);

  return {
    ...voice,
    latest_version: versions?.[0] || null,
  };
}

export async function getActiveBrandVoice(orgId: string): Promise<BrandVoiceWithVersion | null> {
  const { data: voice, error } = await supabase
    .from('brand_voices')
    .select(`
      *,
      created_by_user:users!brand_voices_created_by_fkey(id, name, email)
    `)
    .eq('org_id', orgId)
    .eq('active', true)
    .is('archived_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!voice) return null;

  const { data: versions } = await supabase
    .from('brand_voice_versions')
    .select(`
      *,
      created_by_user:users!brand_voice_versions_created_by_fkey(id, name, email)
    `)
    .eq('brand_voice_id', voice.id)
    .order('version_number', { ascending: false })
    .limit(1);

  return {
    ...voice,
    latest_version: versions?.[0] || null,
  };
}

function getToneDescription(value: number, key: keyof ToneSettings): string {
  const descriptions: Record<keyof ToneSettings, { low: string; mid: string; high: string }> = {
    formality: {
      low: 'Casual and relaxed - use conversational language freely',
      mid: 'Professional but approachable - lean slightly formal while remaining accessible',
      high: 'Formal and polished - maintain professional language throughout',
    },
    friendliness: {
      low: 'Direct and efficient - focus on clarity over warmth',
      mid: 'Warm and helpful - prioritize being genuinely useful while maintaining professionalism',
      high: 'Warm and personable - prioritize building rapport and connection',
    },
    energy: {
      low: 'Calm and measured - avoid exclamation points and hyperbole',
      mid: 'Balanced and measured - confident without being pushy',
      high: 'Energetic and enthusiastic - convey excitement and momentum',
    },
    confidence: {
      low: 'Humble and tentative - acknowledge uncertainty when present',
      mid: 'Self-assured - speak with authority while remaining open to questions',
      high: 'Assertive and bold - speak with conviction and authority',
    },
  };

  if (value < 35) return descriptions[key].low;
  if (value < 70) return descriptions[key].mid;
  return descriptions[key].high;
}

export function generateAISystemPrompt(
  voiceSettings: {
    tone_settings: ToneSettings;
    dos: string[];
    donts: string[];
    vocabulary_preferred: string[];
    vocabulary_prohibited: string[];
    formatting_rules?: string;
  },
  template?: string,
  companyName?: string
): string {
  const tmpl = template || (DEFAULT_AI_PROMPT_TEMPLATE as string);

  const formalityDesc = getToneDescription(voiceSettings.tone_settings.formality, 'formality');
  const toneDesc = getToneDescription(voiceSettings.tone_settings.friendliness, 'friendliness');
  const energyDesc = getToneDescription(voiceSettings.tone_settings.energy, 'energy');
  const confidenceDesc = getToneDescription(voiceSettings.tone_settings.confidence, 'confidence');

  const dosList = voiceSettings.dos.map(d => `- ${d}`).join('\n');
  const dontsList = voiceSettings.donts.map(d => `- ${d}`).join('\n');
  const preferredPhrases = voiceSettings.vocabulary_preferred.join(', ') || 'none specified';
  const prohibitedPhrases = voiceSettings.vocabulary_prohibited.join(', ') || 'none specified';

  const formalityAdjective = voiceSettings.tone_settings.formality >= 50 ? 'professional' : 'casual';
  const toneAdjectives = [
    voiceSettings.tone_settings.friendliness >= 50 ? 'warm and helpful' : 'direct and efficient',
    voiceSettings.tone_settings.confidence >= 50 ? 'confident' : 'measured',
  ].join(', ');

  return tmpl
    .replace(/\{\{company_name\}\}/g, companyName || 'the organization')
    .replace(/\{\{formality_description\}\}/g, formalityDesc)
    .replace(/\{\{tone_description\}\}/g, toneDesc)
    .replace(/\{\{energy_description\}\}/g, energyDesc)
    .replace(/\{\{confidence_description\}\}/g, confidenceDesc)
    .replace(/\{\{dos_list\}\}/g, dosList || '- No specific guidelines')
    .replace(/\{\{donts_list\}\}/g, dontsList || '- No specific restrictions')
    .replace(/\{\{preferred_phrases\}\}/g, preferredPhrases)
    .replace(/\{\{prohibited_phrases\}\}/g, prohibitedPhrases)
    .replace(/\{\{formatting_rules\}\}/g, voiceSettings.formatting_rules || 'No specific formatting rules')
    .replace(/\{\{formality_adjective\}\}/g, formalityAdjective)
    .replace(/\{\{tone_adjectives\}\}/g, toneAdjectives);
}

export async function createBrandVoice(
  orgId: string,
  input: CreateBrandVoiceInput,
  userId: string
): Promise<BrandVoice> {
  const { data: voice, error: voiceError } = await supabase
    .from('brand_voices')
    .insert({
      org_id: orgId,
      name: input.name,
      summary: input.summary || null,
      created_by: userId,
    })
    .select()
    .single();

  if (voiceError) throw voiceError;

  const toneSettings = input.tone_settings || {
    formality: 50,
    friendliness: 50,
    energy: 50,
    confidence: 50,
  };

  const aiSystemPrompt = generateAISystemPrompt({
    tone_settings: toneSettings,
    dos: input.dos || [],
    donts: input.donts || [],
    vocabulary_preferred: input.vocabulary_preferred || [],
    vocabulary_prohibited: input.vocabulary_prohibited || [],
    formatting_rules: input.formatting_rules,
  }, input.ai_prompt_template);

  const { error: versionError } = await supabase.from('brand_voice_versions').insert({
    brand_voice_id: voice.id,
    tone_settings: toneSettings,
    dos: input.dos || [],
    donts: input.donts || [],
    vocabulary_preferred: input.vocabulary_preferred || [],
    vocabulary_prohibited: input.vocabulary_prohibited || [],
    formatting_rules: input.formatting_rules || null,
    examples: input.examples || {},
    ai_prompt_template: input.ai_prompt_template || null,
    ai_system_prompt: aiSystemPrompt,
    created_by: userId,
  });

  if (versionError) throw versionError;

  return voice;
}

export async function updateBrandVoice(
  id: string,
  input: UpdateBrandVoiceInput,
  userId: string
): Promise<BrandVoice> {
  if (input.name !== undefined || input.summary !== undefined) {
    const { error: updateError } = await supabase
      .from('brand_voices')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.summary !== undefined && { summary: input.summary }),
      })
      .eq('id', id);

    if (updateError) throw updateError;
  }

  const hasVersionChanges = input.tone_settings !== undefined ||
    input.dos !== undefined ||
    input.donts !== undefined ||
    input.vocabulary_preferred !== undefined ||
    input.vocabulary_prohibited !== undefined ||
    input.formatting_rules !== undefined ||
    input.examples !== undefined ||
    input.ai_prompt_template !== undefined;

  if (hasVersionChanges) {
    const { data: currentVersion } = await supabase
      .from('brand_voice_versions')
      .select('*')
      .eq('brand_voice_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newToneSettings = input.tone_settings ?? currentVersion?.tone_settings ?? {
      formality: 50,
      friendliness: 50,
      energy: 50,
      confidence: 50,
    };
    const newDos = input.dos ?? currentVersion?.dos ?? [];
    const newDonts = input.donts ?? currentVersion?.donts ?? [];
    const newPreferred = input.vocabulary_preferred ?? currentVersion?.vocabulary_preferred ?? [];
    const newProhibited = input.vocabulary_prohibited ?? currentVersion?.vocabulary_prohibited ?? [];
    const newFormattingRules = input.formatting_rules ?? currentVersion?.formatting_rules ?? null;
    const newTemplate = input.ai_prompt_template ?? currentVersion?.ai_prompt_template ?? null;

    const aiSystemPrompt = generateAISystemPrompt({
      tone_settings: newToneSettings,
      dos: newDos,
      donts: newDonts,
      vocabulary_preferred: newPreferred,
      vocabulary_prohibited: newProhibited,
      formatting_rules: newFormattingRules || undefined,
    }, newTemplate || undefined);

    const { error: versionError } = await supabase.from('brand_voice_versions').insert({
      brand_voice_id: id,
      tone_settings: newToneSettings,
      dos: newDos,
      donts: newDonts,
      vocabulary_preferred: newPreferred,
      vocabulary_prohibited: newProhibited,
      formatting_rules: newFormattingRules,
      examples: input.examples ?? currentVersion?.examples ?? {},
      ai_prompt_template: newTemplate,
      ai_system_prompt: aiSystemPrompt,
      created_by: userId,
    });

    if (versionError) throw versionError;
  }

  const { data: voice, error } = await supabase
    .from('brand_voices')
    .select()
    .eq('id', id)
    .single();

  if (error) throw error;
  return voice;
}

export async function duplicateBrandVoice(id: string, newName: string, userId: string): Promise<BrandVoice> {
  const existing = await getBrandVoiceById(id);
  if (!existing) throw new Error('Brand voice not found');

  return createBrandVoice(
    existing.org_id,
    {
      name: newName,
      summary: existing.summary || undefined,
      tone_settings: existing.latest_version?.tone_settings,
      dos: existing.latest_version?.dos,
      donts: existing.latest_version?.donts,
      vocabulary_preferred: existing.latest_version?.vocabulary_preferred,
      vocabulary_prohibited: existing.latest_version?.vocabulary_prohibited,
      formatting_rules: existing.latest_version?.formatting_rules || undefined,
      examples: existing.latest_version?.examples,
      ai_prompt_template: existing.latest_version?.ai_prompt_template || undefined,
    },
    userId
  );
}

export async function activateBrandVoice(id: string): Promise<void> {
  const { data: voice, error: fetchError } = await supabase
    .from('brand_voices')
    .select('org_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error: deactivateError } = await supabase
    .from('brand_voices')
    .update({ active: false })
    .eq('org_id', voice.org_id)
    .eq('active', true);

  if (deactivateError) throw deactivateError;

  const { error: activateError } = await supabase
    .from('brand_voices')
    .update({ active: true })
    .eq('id', id);

  if (activateError) throw activateError;
}

export async function archiveBrandVoice(id: string): Promise<void> {
  const { error } = await supabase
    .from('brand_voices')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getBrandVoiceVersions(voiceId: string): Promise<BrandVoiceVersion[]> {
  const { data, error } = await supabase
    .from('brand_voice_versions')
    .select(`
      *,
      created_by_user:users!brand_voice_versions_created_by_fkey(id, name, email)
    `)
    .eq('brand_voice_id', voiceId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function rollbackBrandVoiceVersion(
  voiceId: string,
  versionNumber: number,
  userId: string
): Promise<void> {
  const { data: version, error: fetchError } = await supabase
    .from('brand_voice_versions')
    .select('*')
    .eq('brand_voice_id', voiceId)
    .eq('version_number', versionNumber)
    .single();

  if (fetchError) throw fetchError;

  const { error: insertError } = await supabase.from('brand_voice_versions').insert({
    brand_voice_id: voiceId,
    tone_settings: version.tone_settings,
    dos: version.dos,
    donts: version.donts,
    vocabulary_preferred: version.vocabulary_preferred,
    vocabulary_prohibited: version.vocabulary_prohibited,
    formatting_rules: version.formatting_rules,
    examples: version.examples,
    ai_prompt_template: version.ai_prompt_template,
    ai_system_prompt: version.ai_system_prompt,
    created_by: userId,
  });

  if (insertError) throw insertError;
}

export async function getBrandUsage(
  orgId: string,
  filters?: BrandUsageFilters
): Promise<BrandUsage[]> {
  let query = supabase
    .from('brand_usage')
    .select('*')
    .eq('org_id', orgId)
    .order('last_used_at', { ascending: false });

  if (filters?.brandType) {
    query = query.eq('brand_type', filters.brandType);
  }

  if (filters?.brandId) {
    query = query.eq('brand_id', filters.brandId);
  }

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getBrandUsageStats(orgId: string): Promise<BrandUsageStats> {
  const { data, error } = await supabase
    .from('brand_usage')
    .select('brand_type, entity_type')
    .eq('org_id', orgId);

  if (error) throw error;

  const usage = data || [];
  return {
    kit_usages: usage.filter(u => u.brand_type === 'kit').length,
    voice_usages: usage.filter(u => u.brand_type === 'voice').length,
    ai_agents: usage.filter(u => u.entity_type === 'ai_agent').length,
    email_templates: usage.filter(u => u.entity_type === 'email_template').length,
    proposals: usage.filter(u => u.entity_type === 'proposal').length,
    invoices: usage.filter(u => u.entity_type === 'invoice').length,
    documents: usage.filter(u => u.entity_type === 'document').length,
    social_posts: usage.filter(u => u.entity_type === 'social_post').length,
  };
}

export async function trackBrandUsage(
  orgId: string,
  brandType: 'kit' | 'voice',
  brandId: string,
  entityType: string,
  entityId: string,
  entityName?: string
): Promise<void> {
  const { error } = await supabase
    .from('brand_usage')
    .upsert(
      {
        org_id: orgId,
        brand_type: brandType,
        brand_id: brandId,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName || null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,brand_type,brand_id,entity_type,entity_id' }
    );

  if (error) throw error;
}

export async function uploadBrandLogo(
  orgId: string,
  file: File,
  label: string
): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${orgId}/logos/${label}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('brand-assets')
    .upload(fileName, file, { upsert: true });

  if (error) throw error;
  return fileName;
}

export async function deleteBrandLogo(orgId: string, storagePath: string): Promise<void> {
  if (!storagePath.startsWith(orgId)) {
    throw new Error('Unauthorized to delete this file');
  }

  const { error } = await supabase.storage.from('brand-assets').remove([storagePath]);
  if (error) throw error;
}

export async function getBrandLogoUrl(
  logo: { source_type: string; url?: string; storage_path?: string; drive_file_id?: string }
): Promise<string | null> {
  if (logo.source_type === 'url' && logo.url) {
    return logo.url;
  }

  if (logo.source_type === 'upload' && logo.storage_path) {
    const { data } = await supabase.storage
      .from('brand-assets')
      .createSignedUrl(logo.storage_path, 3600);
    return data?.signedUrl || null;
  }

  if (logo.source_type === 'drive' && logo.drive_file_id) {
    return `https://drive.google.com/thumbnail?id=${logo.drive_file_id}&sz=w400`;
  }

  return null;
}

export function getDefaultPromptTemplate(): string {
  return DEFAULT_AI_PROMPT_TEMPLATE as string;
}
