import { useState, useEffect } from 'react';
import { BarChart3, Users, CheckCircle2, XCircle, TrendingUp, Clock } from 'lucide-react';
import type { WorkflowLevelStats, BuilderNode } from '../../../../types/workflowBuilder';
import { supabase } from '../../../../lib/supabase';

interface StatsOverlayProps {
  workflowId: string;
  nodes: BuilderNode[];
}

export function StatsOverlay({ workflowId, nodes }: StatsOverlayProps) {
  const [stats, setStats] = useState<WorkflowLevelStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [workflowId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: enrollments } = await supabase
        .from('workflow_enrollments')
        .select('status, started_at, completed_at')
        .eq('workflow_id', workflowId);

      if (!enrollments) {
        setStats(null);
        return;
      }

      const total = enrollments.length;
      const active = enrollments.filter(e => e.status === 'active').length;
      const completed = enrollments.filter(e => e.status === 'completed').length;
      const failed = enrollments.filter(e => e.status === 'errored' || e.status === 'stopped').length;

      const completedWithTimes = enrollments.filter(e => e.completed_at && e.started_at);
      const avgMs = completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, e) => {
            return sum + (new Date(e.completed_at!).getTime() - new Date(e.started_at).getTime());
          }, 0) / completedWithTimes.length
        : 0;

      setStats({
        totalEnrolled: total,
        active,
        completed,
        failed,
        avgCompletionTimeMs: avgMs,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-3">
      {loading ? (
        <div className="flex items-center justify-center py-2">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      ) : stats ? (
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Workflow Stats</span>
          </div>
          <StatPill icon={Users} label="Enrolled" value={stats.totalEnrolled} color="text-blue-600" />
          <StatPill icon={TrendingUp} label="Active" value={stats.active} color="text-emerald-600" />
          <StatPill icon={CheckCircle2} label="Completed" value={stats.completed} color="text-green-600" />
          <StatPill icon={XCircle} label="Failed" value={stats.failed} color="text-red-600" />
          <StatPill
            icon={Clock}
            label="Avg Time"
            value={formatDuration(stats.avgCompletionTimeMs)}
            color="text-gray-600"
            isText
          />
          <div className="ml-auto text-xs text-gray-400">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400 py-1">No enrollment data yet</div>
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color, isText }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {isText ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return '--';
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
