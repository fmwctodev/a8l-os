import { useState, useEffect, useCallback } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfitabilityKPIs } from '../../components/profitability/ProfitabilityKPIs';
import { ProfitabilityCharts } from '../../components/profitability/ProfitabilityCharts';
import { ProfitabilityTables } from '../../components/profitability/ProfitabilityTables';
import { ProfitabilityFilterBar } from '../../components/profitability/ProfitabilityFilters';
import {
  getProjectProfitability,
  getProfitabilityByOwner,
  getProfitabilityByStage,
  computeSummary,
} from '../../services/projectProfitability';
import type {
  ProjectProfitabilityRow,
  OwnerProfitabilityRow,
  StageProfitabilityRow,
  ProfitabilityFilters,
  ProfitabilitySummary,
} from '../../types';

const EMPTY_SUMMARY: ProfitabilitySummary = {
  totalRevenue: 0,
  totalCollected: 0,
  totalCosts: 0,
  grossProfit: 0,
  overallMargin: 0,
  outstanding: 0,
  projectCount: 0,
};

export function ProjectProfitabilityPage() {
  const { user, hasPermission } = useAuth();
  const orgId = user?.organization_id ?? '';

  const [filters, setFilters] = useState<ProfitabilityFilters>({});
  const [projectRows, setProjectRows] = useState<ProjectProfitabilityRow[]>([]);
  const [ownerRows, setOwnerRows] = useState<OwnerProfitabilityRow[]>([]);
  const [stageRows, setStageRows] = useState<StageProfitabilityRow[]>([]);
  const [summary, setSummary] = useState<ProfitabilitySummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission('projects.view_financials') || hasPermission('projects.view');

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [projects, owners, stages] = await Promise.all([
        getProjectProfitability(orgId, filters),
        getProfitabilityByOwner(orgId, filters),
        getProfitabilityByStage(orgId, filters),
      ]);

      setProjectRows(projects);
      setOwnerRows(owners);
      setStageRows(stages);
      setSummary(computeSummary(projects));
    } catch (err) {
      console.error('Failed to load profitability data:', err);
      setError('Failed to load profitability data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, filters]);

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [loadData, canView]);

  if (!canView) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-800 border border-slate-700 mb-4">
            <Lock className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">Access Restricted</h3>
          <p className="text-slate-400 text-sm">
            You do not have permission to view project financials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <ProfitabilityFilterBar
          orgId={orgId}
          filters={filters}
          onChange={setFilters}
          onRefresh={loadData}
          isLoading={isLoading}
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={loadData}
              className="text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}

        <ProfitabilityKPIs summary={summary} isLoading={isLoading} />
        <ProfitabilityCharts rows={projectRows} isLoading={isLoading} />
        <ProfitabilityTables
          projectRows={projectRows}
          ownerRows={ownerRows}
          stageRows={stageRows}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
