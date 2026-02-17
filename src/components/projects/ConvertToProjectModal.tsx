import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FolderKanban, X, Loader2, DollarSign, Lock } from 'lucide-react';
import type { Opportunity, ProjectPipeline, ProjectStage } from '../../types';
import { getProjectPipelines } from '../../services/projectPipelines';
import { convertOpportunityToProject } from '../../services/projects';

interface ConvertToProjectModalProps {
  opportunity: Opportunity;
  onClose: () => void;
  onConverted: () => void;
}

export function ConvertToProjectModal({ opportunity, onClose, onConverted }: ConvertToProjectModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pipelines, setPipelines] = useState<ProjectPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetEndDate, setTargetEndDate] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPipelines, setLoadingPipelines] = useState(true);

  const contactName = opportunity.contact
    ? `${opportunity.contact.first_name} ${opportunity.contact.last_name}`.trim()
    : 'Unknown';

  useEffect(() => {
    if (user) {
      loadPipelines();
    }
  }, [user]);

  useEffect(() => {
    setProjectName(`${contactName} - Project`);
    setBudgetAmount(String(Number(opportunity.value_amount) || ''));
  }, [opportunity]);

  useEffect(() => {
    const pipeline = pipelines.find((p) => p.id === selectedPipelineId);
    const sorted = (pipeline?.stages || []).sort((a, b) => a.sort_order - b.sort_order);
    setStages(sorted);
    if (sorted.length > 0) {
      setSelectedStageId(sorted[0].id);
    } else {
      setSelectedStageId('');
    }
  }, [selectedPipelineId, pipelines]);

  async function loadPipelines() {
    if (!user) return;
    try {
      const data = await getProjectPipelines(user.organization_id);
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipelineId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load project pipelines');
    } finally {
      setLoadingPipelines(false);
    }
  }

  async function handleConvert() {
    if (!user || !projectName.trim() || !selectedPipelineId || !selectedStageId) return;

    try {
      setIsConverting(true);
      setError(null);

      const project = await convertOpportunityToProject(
        opportunity.id,
        {
          org_id: user.organization_id,
          contact_id: opportunity.contact_id,
          proposal_id: null,
          invoice_id: null,
          pipeline_id: selectedPipelineId,
          stage_id: selectedStageId,
          assigned_user_id: opportunity.assigned_user_id,
          department_id: opportunity.department_id,
          name: projectName.trim(),
          description: description.trim() || null,
          priority,
          start_date: startDate || null,
          target_end_date: targetEndDate || null,
          budget_amount: budgetAmount ? Number(budgetAmount) : 0,
          currency: opportunity.currency || 'USD',
          risk_level: 'low',
          created_by: user.id,
        },
        user.id
      );

      onConverted();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to convert opportunity to project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setIsConverting(false);
    }
  }

  const value = Number(opportunity.value_amount) || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
              Convert to Project
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Create a project from this won opportunity
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Opportunity Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact</span>
                  <span className="text-white">{contactName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pipeline</span>
                  <span className="text-white">{opportunity.pipeline?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Value</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {value.toLocaleString()} {opportunity.currency}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300">
                Converting will lock the opportunity's financial value to preserve data integrity.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {loadingPipelines ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading pipelines...
              </div>
            ) : pipelines.length === 0 ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">
                  No project pipelines found. Please create one first in Project Settings.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Pipeline</label>
                  <select
                    value={selectedPipelineId}
                    onChange={(e) => setSelectedPipelineId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Starting Stage</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Budget</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Target End Date</label>
                <input
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  min={startDate}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                placeholder="Optional project description..."
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isConverting}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting || !projectName.trim() || !selectedPipelineId || !selectedStageId || pipelines.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <FolderKanban className="w-4 h-4" />
                Create Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
