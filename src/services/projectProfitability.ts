import { supabase } from '../lib/supabase';
import type {
  ProjectProfitabilityRow,
  OwnerProfitabilityRow,
  StageProfitabilityRow,
  ProfitabilityFilters,
  ProfitabilitySummary,
} from '../types';

export async function getProjectProfitability(
  orgId: string,
  filters: ProfitabilityFilters = {}
): Promise<ProjectProfitabilityRow[]> {
  const { data, error } = await supabase.rpc('get_project_profitability', {
    p_org_id: orgId,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_statuses: filters.statuses?.length ? filters.statuses : null,
    p_pipeline_id: filters.pipelineId ?? null,
    p_owner_id: filters.ownerId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as ProjectProfitabilityRow[];
}

export async function getProfitabilityByOwner(
  orgId: string,
  filters: ProfitabilityFilters = {}
): Promise<OwnerProfitabilityRow[]> {
  const { data, error } = await supabase.rpc('get_profitability_by_owner', {
    p_org_id: orgId,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_statuses: filters.statuses?.length ? filters.statuses : null,
    p_pipeline_id: filters.pipelineId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as OwnerProfitabilityRow[];
}

export async function getProfitabilityByStage(
  orgId: string,
  filters: ProfitabilityFilters = {}
): Promise<StageProfitabilityRow[]> {
  const { data, error } = await supabase.rpc('get_profitability_by_stage', {
    p_org_id: orgId,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_statuses: filters.statuses?.length ? filters.statuses : null,
    p_pipeline_id: filters.pipelineId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as StageProfitabilityRow[];
}

export function computeSummary(rows: ProjectProfitabilityRow[]): ProfitabilitySummary {
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_invoiced), 0);
  const totalCollected = rows.reduce((s, r) => s + Number(r.total_collected), 0);
  const totalCosts = rows.reduce((s, r) => s + Number(r.total_costs), 0);
  const grossProfit = totalRevenue - totalCosts;
  const overallMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0;
  const outstanding = totalRevenue - totalCollected;

  return {
    totalRevenue,
    totalCollected,
    totalCosts,
    grossProfit,
    overallMargin,
    outstanding,
    projectCount: rows.length,
  };
}

export function exportToCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  filename: string
) {
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
