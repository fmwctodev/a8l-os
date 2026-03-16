import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Square } from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';

type EndNodeType = Node<BuilderNodeData, 'end'>;

function EndNodeComponent({ data, selected }: NodeProps<EndNodeType>) {
  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-slate-500 shadow-slate-500/20 shadow-md' : 'border-slate-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-slate-500 flex items-center justify-center">
          <Square className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">End</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {data.label || 'End Workflow'}
          </div>
        </div>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
