import { supabase } from '../lib/supabase';
import type {
  Survey,
  SurveySubmission,
  SurveyDefinition,
  SurveySettings,
  SurveyFilters,
  SurveyStats,
} from '../types';

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

export async function getSurveys(
  organizationId: string,
  filters?: SurveyFilters
): Promise<Survey[]> {
  let query = supabase
    .from('surveys')
    .select(`
      *,
      created_by_user:users!surveys_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSurveyById(id: string): Promise<Survey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(`
      *,
      created_by_user:users!surveys_created_by_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getSurveyBySlug(slug: string): Promise<Survey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createSurvey(
  organizationId: string,
  userId: string,
  name: string,
  description: string = ''
): Promise<Survey> {
  const defaultDefinition: SurveyDefinition = {
    steps: [],
  };

  const defaultSettings: SurveySettings = {
    contactMatching: 'email_first',
    scoringEnabled: false,
    scoreBands: [],
  };

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      organization_id: organizationId,
      name,
      description,
      status: 'draft',
      definition: defaultDefinition,
      settings: defaultSettings,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSurvey(
  id: string,
  updates: {
    name?: string;
    description?: string;
    definition?: SurveyDefinition;
    settings?: SurveySettings;
  }
): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function publishSurvey(id: string): Promise<Survey> {
  const survey = await getSurveyById(id);
  if (!survey) throw new Error('Survey not found');

  const slug = survey.public_slug || generateSlug();

  const { data, error } = await supabase
    .from('surveys')
    .update({
      status: 'published',
      public_slug: slug,
      published_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function unpublishSurvey(id: string): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update({
      status: 'draft',
      published_at: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function archiveSurvey(id: string): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function duplicateSurvey(
  id: string,
  userId: string
): Promise<Survey> {
  const original = await getSurveyById(id);
  if (!original) throw new Error('Survey not found');

  const { data, error } = await supabase
    .from('surveys')
    .insert({
      organization_id: original.organization_id,
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      definition: original.definition,
      settings: original.settings,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getSurveySubmissions(
  surveyId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    scoreBand?: string;
  }
): Promise<{ submissions: SurveySubmission[]; total: number }> {
  let query = supabase
    .from('survey_submissions')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone)
    `, { count: 'exact' })
    .eq('survey_id', surveyId)
    .order('submitted_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('submitted_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('submitted_at', options.endDate);
  }

  if (options?.scoreBand) {
    query = query.eq('score_band', options.scoreBand);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { submissions: data || [], total: count || 0 };
}

export async function getSurveyStats(organizationId: string): Promise<SurveyStats> {
  const { data: surveys, error: surveysError } = await supabase
    .from('surveys')
    .select('id, status')
    .eq('organization_id', organizationId);

  if (surveysError) throw surveysError;

  const totalSurveys = surveys?.length || 0;
  const publishedSurveys = surveys?.filter((s) => s.status === 'published').length || 0;

  const { count: totalSubmissions, error: submissionsError } = await supabase
    .from('survey_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (submissionsError) throw submissionsError;

  const { data: scoreData, error: scoreError } = await supabase
    .from('survey_submissions')
    .select('score_total')
    .eq('organization_id', organizationId)
    .not('score_total', 'is', null);

  if (scoreError) throw scoreError;

  let averageScore: number | null = null;
  if (scoreData && scoreData.length > 0) {
    const sum = scoreData.reduce((acc, s) => acc + (s.score_total || 0), 0);
    averageScore = Math.round((sum / scoreData.length) * 10) / 10;
  }

  return {
    totalSurveys,
    publishedSurveys,
    totalSubmissions: totalSubmissions || 0,
    averageScore,
  };
}

export function generateSurveyEmbedCode(
  surveySlug: string,
  options: {
    type: 'iframe' | 'popup' | 'sdk';
    baseUrl: string;
  }
): string {
  const surveyUrl = `${options.baseUrl}/s/${surveySlug}`;

  if (options.type === 'iframe') {
    return `<iframe
  src="${surveyUrl}?embed=true"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 700px;"
></iframe>`;
  }

  if (options.type === 'popup') {
    return `<script src="${options.baseUrl}/sdk/autom8ion-forms.js"></script>
<script>
  Autom8ion.init({ baseUrl: '${options.baseUrl}' });
</script>
<button onclick="Autom8ion.openSurveyPopup('${surveySlug}')">
  Take Survey
</button>`;
  }

  return `<script src="${options.baseUrl}/sdk/autom8ion-forms.js"></script>
<script>
  Autom8ion.init({ baseUrl: '${options.baseUrl}' });
  Autom8ion.renderSurvey('${surveySlug}', 'survey-container', {
    onComplete: function(data) {
      console.log('Survey completed:', data);
    },
    onError: function(error) {
      console.error('Survey error:', error);
    }
  });
</script>
<div id="survey-container"></div>`;
}

export function getSurveyPublicUrl(
  slug: string,
  baseUrl: string
): string {
  return `${baseUrl}/s/${slug}`;
}
