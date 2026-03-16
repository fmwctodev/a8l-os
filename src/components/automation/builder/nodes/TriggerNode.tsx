import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Zap, AlertCircle } from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';
import type { TriggerNodeData } from '../../../../types';
import { TRIGGER_OPTIONS } from '../../../../types/workflowBuilder';

type TriggerNode = Node<BuilderNodeData, 'trigger'>;

function TriggerNodeComponent({ data, selected }: NodeProps<TriggerNode>) {
  const triggerData = data.nodeData as TriggerNodeData;
  const triggerOption = TRIGGER_OPTIONS.find(t => t.type === triggerData.triggerType);
  const isValid = data.isValid;

  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-emerald-500 shadow-emerald-500/20 shadow-md' : isValid ? 'border-emerald-300' : 'border-red-300'}
      `}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Trigger</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {triggerOption?.label || data.label}
          </div>
        </div>
        {!isValid && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
