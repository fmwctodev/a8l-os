import { memo, useState } from 'react';
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Plus } from 'lucide-react';

interface InsertableEdgeData {
  insertable?: boolean;
  onInsert?: (edgeId: string) => void;
}

function InsertableEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  style,
  data,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const edgeData = (data ?? {}) as InsertableEdgeData;

  const isYesBranch = sourceHandleId === 'yes';
  const isNoBranch = sourceHandleId === 'no';

  let edgeColor = '#94a3b8';
  if (isYesBranch) edgeColor = '#10b981';
  if (isNoBranch) edgeColor = '#ef4444';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.25,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: isYesBranch || isNoBranch ? '6 4' : undefined,
        }}
      />
      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      >
        <circle
          cx={labelX}
          cy={labelY}
          r={16}
          fill="transparent"
        />
        <circle
          cx={labelX}
          cy={labelY}
          r={12}
          fill="white"
          stroke={hovered ? '#3b82f6' : '#d1d5db'}
          strokeWidth={hovered ? 2 : 1.5}
          style={{ transition: 'all 150ms' }}
          onClick={(e) => {
            e.stopPropagation();
            edgeData.onInsert?.(id);
          }}
        />
        <foreignObject
          x={labelX - 8}
          y={labelY - 8}
          width={16}
          height={16}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex items-center justify-center w-full h-full">
            <Plus
              className={`w-3.5 h-3.5 transition-colors ${hovered ? 'text-blue-500' : 'text-gray-400'}`}
            />
          </div>
        </foreignObject>
      </g>
      {(isYesBranch || isNoBranch) && (
        <foreignObject
          x={sourceX + (isYesBranch ? -30 : 10)}
          y={sourceY + 8}
          width={24}
          height={16}
          style={{ pointerEvents: 'none' }}
        >
          <div className={`text-[10px] font-semibold ${isYesBranch ? 'text-emerald-500' : 'text-red-500'}`}>
            {isYesBranch ? 'Yes' : 'No'}
          </div>
        </foreignObject>
      )}
    </>
  );
}

export const InsertableEdge = memo(InsertableEdgeComponent);
