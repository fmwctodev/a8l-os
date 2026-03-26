import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Pause,
  XCircle,
  RotateCcw,
  Trash2,
  Target,
  FileText,
  Users,
  DollarSign,
  Lock,
  Link2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { usePaymentsAccess } from '../../hooks/usePaymentsAccess';
import type { Project, User } from '../../types';
import { getProjectById, updateProject, closeProject, deleteProject } from '../../services/projects';
import { getUsers } from '../../services/users';
import { ProjectOverviewTab } from '../../components/projects/ProjectOverviewTab';
import { ProjectTasksTab } from '../../components/projects/ProjectTasksTab';
import { ProjectNotesTab } from '../../components/projects/ProjectNotesTab';
import { ProjectTimelineTab } from '../../components/projects/ProjectTimelineTab';
import { ProjectFinancialsTab } from '../../components/projects/ProjectFinancialsTab';
import { ProjectChangeRequestsTab } from '../../components/projects/ProjectChangeRequestsTab';
import { ProjectSupportTicketsTab } from '../../components/projects/ProjectSupportTicketsTab';
import { generateProjectClientLink } from '../../services/projectChangeRequests';

type TabId = 'overview' | 'tasks' | 'notes' | 'timeline' | 'financials' | 'change_requests' | 'support_tickets';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-cyan-500/20 text-cyan-400',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = usePermission('projects.edit');
  const canClose = usePermission('projects.close');
  const canDelete = usePermission('projects.delete');
  const canManageTasks = usePermission('projects.tasks.manage');
  const canViewChangeRequests = usePermission('projects.change_requests.view');
  const canManageChangeRequests = usePermission('projects.change_requests.manage');
  const canApproveChangeRequests = usePermission('projects.change_requests.approve');
  const canAccessPayments = usePaymentsAccess();

  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id, user]);

  async function loadProject() {
    if (!id || !user) return;
    try {
      const [projectData, usersData] = await Promise.all([
        getProjectById(id),
        getUsers(),
      ]);
      if (!projectData) {
        navigate('/projects');
        return;
      }
      setProject(projectData);
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(status: 'completed' | 'cancelled') {
    if (!project || !user) return;
    const label = status === 'completed' ? 'complete' : 'cancel';
    if (!confirm(`Mark this project as ${label}?`)) return;
    try {
      const updated = await closeProject(project.id, status, user.id);
      setProject(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReopen() {
    if (!project || !user) return;
    try {
      const updated = await updateProject(project.id, { status: 'active' } as Partial<Project>, user.id);
      setProject(updated);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePutOnHold() {
    if (!project || !user) return;
    try {
      const updated = await updateProject(project.id, { status: 'on_hold' } as Partial<Project>, user.id);
      setProject(updated);
    } catch (err) {
      console.error(err);
    }
  }

  function handleCopyClientLink() {
    if (!project) return;
    const url = generateProjectClientLink(project.id, project.org_id);
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  async function handleDelete() {
    if (!project) return;
    if (!confirm('Permanently delete this project? This cannot be undone.')) return;
    try {
      await deleteProject(project.id);
      navigate('/projects');
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (!project) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'notes', label: 'Notes' },
    { id: 'timeline', label: 'Timeline' },
    ...(canAccessPayments ? [{ id: 'financials' as const, label: 'Financials' }] : []),
    ...(canViewChangeRequests ? [{ id: 'change_requests' as const, label: 'Change Requests' }] : []),
    ...(canViewChangeRequests ? [{ id: 'support_tickets' as const, label: 'Support Tickets' }] : []),
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none border-b border-slate-700 bg-slate-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/projects')}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-white truncate">{project.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[project.status]}`}>
                  {project.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {project.pipeline?.name} / {project.stage?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {project.status === 'active' && canClose && (
                <>
                  <button onClick={() => handleClose('completed')} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Complete
                  </button>
                  <button onClick={handlePutOnHold} className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">
                    <Pause className="w-4 h-4" /> Hold
                  </button>
                  <button onClick={() => handleClose('cancelled')} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    <XCircle className="w-4 h-4" /> Cancel
                  </button>
                </>
              )}
              {project.status === 'on_hold' && canClose && (
                <button onClick={handleReopen} className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm">
                  <RotateCcw className="w-4 h-4" /> Resume
                </button>
              )}
              {(project.status === 'completed' || project.status === 'cancelled') && canClose && (
                <button onClick={handleReopen} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 text-sm">
                  <RotateCcw className="w-4 h-4" /> Reopen
                </button>
              )}
              {canManageChangeRequests && (
                <button
                  onClick={handleCopyClientLink}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  {linkCopied ? 'Copied!' : 'Client Link'}
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white border-t border-l border-r border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <ProjectOverviewTab
              project={project}
              users={users}
              canEdit={canEdit}
              currentUserId={user!.id}
              onUpdate={setProject}
            />
          )}
          {activeTab === 'tasks' && (
            <ProjectTasksTab
              projectId={project.id}
              orgId={project.org_id}
              users={users}
              canManageTasks={canManageTasks}
              currentUserId={user!.id}
            />
          )}
          {activeTab === 'notes' && (
            <ProjectNotesTab
              projectId={project.id}
              orgId={project.org_id}
              canEdit={canEdit}
              currentUserId={user!.id}
            />
          )}
          {activeTab === 'timeline' && (
            <ProjectTimelineTab projectId={project.id} />
          )}
          {activeTab === 'financials' && (
            <ProjectFinancialsTab
              projectId={project.id}
              orgId={project.org_id}
              budgetAmount={Number(project.budget_amount)}
              actualCost={Number(project.actual_cost)}
              currency={project.currency}
              canEdit={canEdit}
              currentUserId={user!.id}
              onCostChange={loadProject}
            />
          )}
          {activeTab === 'change_requests' && (
            <ProjectChangeRequestsTab
              projectId={project.id}
              orgId={project.org_id}
              contactId={project.contact_id}
              users={users}
              canManage={canManageChangeRequests}
              canApprove={canApproveChangeRequests}
              currentUserId={user!.id}
              currentUserName={user!.name || user!.email || ''}
            />
          )}
          {activeTab === 'support_tickets' && (
            <ProjectSupportTicketsTab
              projectId={project.id}
              orgId={project.org_id}
              users={users}
              canManage={canManageChangeRequests}
              currentUserId={user!.id}
              currentUserName={user!.name || user!.email || ''}
            />
          )}
        </div>

        <div className="flex-none w-72 border-l border-slate-700 overflow-y-auto bg-slate-900/30 p-4 space-y-4">
          {project.contact && (
            <LinkedCard
              icon={Users}
              title="Contact"
              linkTo={`/contacts/${project.contact_id}`}
            >
              <p className="text-sm text-white font-medium">{project.contact.name}</p>
              {project.contact.email && <p className="text-xs text-slate-400 truncate">{project.contact.email}</p>}
              {project.contact.phone && <p className="text-xs text-slate-400">{project.contact.phone}</p>}
            </LinkedCard>
          )}

          {project.opportunity && (
            <LinkedCard
              icon={Target}
              title="Opportunity"
              linkTo={`/opportunities/${project.opportunity_id}`}
            >
              <p className="text-sm text-white font-medium truncate">
                {project.opportunity.contact?.name || 'Opportunity'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">
                  ${Number(project.opportunity.value_amount).toLocaleString()}
                </span>
                {project.opportunity.financial_locked && (
                  <Lock className="w-3 h-3 text-amber-400 ml-1" />
                )}
              </div>
            </LinkedCard>
          )}

          {project.proposal && (
            <LinkedCard
              icon={FileText}
              title="Proposal"
              linkTo={`/proposals/${project.proposal_id}`}
            >
              <p className="text-sm text-white font-medium truncate">{project.proposal.title || 'Proposal'}</p>
              <span className="text-xs text-slate-400 capitalize">{project.proposal.status}</span>
            </LinkedCard>
          )}

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2">Quick Info</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-300">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Progress</span>
                <span className="text-slate-300">{project.progress_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Priority</span>
                <span className="text-slate-300 capitalize">{project.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Risk</span>
                <span className="text-slate-300 capitalize">{project.risk_level}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedCard({
  icon: Icon,
  title,
  linkTo,
  children,
}: {
  icon: React.ElementType;
  title: string;
  linkTo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={linkTo}
      className="block bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </Link>
  );
}
