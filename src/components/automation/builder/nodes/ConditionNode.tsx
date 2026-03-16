import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { GitBranch, AlertCircle } from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';
import type { ConditionNodeData } from '../../../../types';

type ConditionNodeType = Node<BuilderNodeData, 'condition'>;

function ConditionNodeComponent({ data, selected }: NodeProps<ConditionNodeType>) {
  const condData = data.nodeData as ConditionNodeData;
  const ruleCount = condData?.conditions?.rules?.length ?? 0;
  const isValid = data.isValid;

  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-amber-500 shadow-amber-500/20 shadow-md' : isValid ? 'border-amber-300' : 'border-red-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-amber-500 flex items-center justify-center">
          <GitBranch className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">If / Else</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {data.label || 'If / Else'}
          </div>
          {ruleCount > 0 && (
            <div className="text-xs text-gray-500 mt-0.5">
              {ruleCount} condition{ruleCount !== 1 ? 's' : ''} ({condData.conditions.logic.toUpperCase()})
            </div>
          )}
        </div>
        {!isValid && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
      </div>
      <div className="flex border-t border-gray-100">
        <div className="flex-1 text-center py-1.5 text-xs font-medium text-emerald-600 border-r border-gray-100 relative">
          Yes
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white !left-1/2"
            style={{ bottom: -6 }}
          />
        </div>
        <div className="flex-1 text-center py-1.5 text-xs font-medium text-red-500 relative">
          No
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white !left-1/2"
            style={{ bottom: -6 }}
          />
        </div>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
