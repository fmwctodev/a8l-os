import { supabase } from '../lib/supabase';
import type { OrgOpportunityCustomFieldValue, CustomField } from '../types';

export async function getOrgOpportunityCustomFieldValues(
  opportunityId: string
): Promise<OrgOpportunityCustomFieldValue[]> {
  const { data, error } = await supabase
    .from('org_opportunity_custom_field_values')
    .select(`
      *,
      custom_field:custom_fields(*)
    `)
    .eq('opportunity_id', opportunityId);

  if (error) throw error;
  return data || [];
}

export async function setOrgOpportunityCustomFieldValue(
  organizationId: string,
  opportunityId: string,
  customFieldId: string,
  value: unknown
): Promise<OrgOpportunityCustomFieldValue> {
  const { data, error } = await supabase
    .from('org_opportunity_custom_field_values')
    .upsert(
      {
        organization_id: organizationId,
        opportunity_id: opportunityId,
        custom_field_id: customFieldId,
        value: value,
      },
      {
        onConflict: 'opportunity_id,custom_field_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrgOpportunityCustomFieldValue(
  opportunityId: string,
  customFieldId: string
): Promise<void> {
  const { error } = await supabase
    .from('org_opportunity_custom_field_values')
    .delete()
    .eq('opportunity_id', opportunityId)
    .eq('custom_field_id', customFieldId);

  if (error) throw error;
}

export async function setOrgOpportunityCustomFieldValues(
  organizationId: string,
  opportunityId: string,
  values: Record<string, unknown>
): Promise<void> {
  for (const [fieldId, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') {
      await deleteOrgOpportunityCustomFieldValue(opportunityId, fieldId);
    } else {
      await setOrgOpportunityCustomFieldValue(organizationId, opportunityId, fieldId, value);
    }
  }
}

export async function getOrgOpportunityCustomFields(
  organizationId: string
): Promise<CustomField[]> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select(`
      *,
      group:custom_field_groups(id, name, scope, sort_order, active)
    `)
    .eq('organization_id', organizationId)
    .eq('scope', 'opportunity')
    .eq('active', true)
    .is('deleted_at', null)
    .order('display_order')
    .order('name');

  if (error) throw error;
  return data || [];
}

export function buildOrgCustomFieldValuesMap(
  values: OrgOpportunityCustomFieldValue[]
): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const v of values) {
    map[v.custom_field_id] = v.value;
  }
  return map;
}
