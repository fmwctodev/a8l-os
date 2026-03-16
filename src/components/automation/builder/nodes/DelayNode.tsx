import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Clock, AlertCircle } from 'lucide-react';
import type { BuilderNodeData } from '../../../../types/workflowBuilder';
import type { DelayNodeData } from '../../../../types';

type DelayNodeType = Node<BuilderNodeData, 'delay'>;

function getDelayLabel(dd: DelayNodeData): string {
  if (dd.delayType === 'wait_duration' && dd.duration) {
    return `Wait ${dd.duration.value} ${dd.duration.unit}`;
  }
  if (dd.delayType === 'wait_until_datetime' && dd.datetime) {
    return `Wait until ${new Date(dd.datetime).toLocaleDateString()}`;
  }
  if (dd.delayType === 'wait_until_weekday_time') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dd.weekday !== undefined ? days[dd.weekday] : '?';
    return `Wait until ${dayName} ${dd.time || ''}`;
  }
  return 'Wait / Delay';
}

function DelayNodeComponent({ data, selected }: NodeProps<DelayNodeType>) {
  const delayData = data.nodeData as DelayNodeData;
  const isValid = data.isValid;
  const displayLabel = getDelayLabel(delayData);

  return (
    <div
      className={`
        relative w-[260px] rounded-lg border-2 bg-white shadow-sm transition-all
        ${selected ? 'border-blue-500 shadow-blue-500/20 shadow-md' : isValid ? 'border-blue-300' : 'border-red-300'}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Wait</div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {displayLabel}
          </div>
        </div>
        {!isValid && (
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
}

export const DelayNode = memo(DelayNodeComponent);
