import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Target, AlertCircle } from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';
import type { GoalNodeData } from '../../../../types';

type GoalNodeType = Node<BuilderNodeData, 'goal'>;

function GoalNodeComponent({ data, selected }: NodeProps<GoalNodeType>) {
  const goalData = data.nodeData as GoalNodeData;
  const ruleCount = goalData?.goalCondition?.rules?.length ?? 0;
  const isValid = data.isValid;

  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-rose-500 shadow-rose-500/20 shadow-md' : isValid ? 'border-rose-300' : 'border-red-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-rose-500 flex items-center justify-center">
          <Target className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Goal</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {data.label || 'Goal Event'}
          </div>
          {ruleCount > 0 && (
            <div className="text-xs text-gray-500 mt-0.5">
              {ruleCount} condition{ruleCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        {!isValid && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white"
      />
    </div>
  );
}

export const GoalNode = memo(GoalNodeComponent);
