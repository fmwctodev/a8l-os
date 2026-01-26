import { useMemo, useState } from 'react';

interface TimingMetrics {
  dayOfWeek: number;
  hour: number;
  avgEngagement: number;
  postCount: number;
}

interface TimingHeatmapProps {
  data: TimingMetrics[];
  onCellClick?: (day: number, hour: number) => void;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour > 12) return `${hour - 12}p`;
  return `${hour}a`;
}

function getIntensityColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'bg-gray-100 dark:bg-gray-800';

  const intensity = value / max;

  if (intensity >= 0.8) return 'bg-emerald-500 dark:bg-emerald-600';
  if (intensity >= 0.6) return 'bg-emerald-400 dark:bg-emerald-500';
  if (intensity >= 0.4) return 'bg-emerald-300 dark:bg-emerald-600/60';
  if (intensity >= 0.2) return 'bg-emerald-200 dark:bg-emerald-700/50';
  return 'bg-emerald-100 dark:bg-emerald-800/40';
}

export function TimingHeatmap({ data, onCellClick }: TimingHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);

  const { grid, maxEngagement } = useMemo(() => {
    const gridData: Record<string, TimingMetrics> = {};
    let max = 0;

    data.forEach((item) => {
      const key = `${item.dayOfWeek}-${item.hour}`;
      gridData[key] = item;
      if (item.avgEngagement > max) max = item.avgEngagement;
    });

    return { grid: gridData, maxEngagement: max };
  }, [data]);

  const getCellData = (day: number, hour: number): TimingMetrics | null => {
    return grid[`${day}-${hour}`] || null;
  };

  const hoveredData = hoveredCell ? getCellData(hoveredCell.day, hoveredCell.hour) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Best Posting Times</h3>
        {hoveredData && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{dayNames[hoveredCell!.day]}</span> at{' '}
            <span className="font-medium">{formatHour(hoveredCell!.hour)}</span>:{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {hoveredData.avgEngagement}% engagement
            </span>{' '}
            <span className="text-gray-500">({hoveredData.postCount} posts)</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-12" />
            <div className="flex-1 flex">
              {hours.filter((_, i) => i % 3 === 0).map((hour) => (
                <div
                  key={hour}
                  className="flex-1 text-center text-xs text-gray-500 dark:text-gray-400 pb-1"
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>
          </div>

          {dayNames.map((day, dayIndex) => (
            <div key={day} className="flex items-center">
              <div className="w-12 text-xs text-gray-500 dark:text-gray-400 pr-2 text-right">
                {day}
              </div>
              <div className="flex-1 flex gap-0.5">
                {hours.map((hour) => {
                  const cellData = getCellData(dayIndex, hour);
                  const engagement = cellData?.avgEngagement || 0;

                  return (
                    <div
                      key={`${dayIndex}-${hour}`}
                      className={`flex-1 h-6 rounded-sm cursor-pointer transition-all ${getIntensityColor(
                        engagement,
                        maxEngagement
                      )} ${
                        hoveredCell?.day === dayIndex && hoveredCell?.hour === hour
                          ? 'ring-2 ring-blue-500 ring-offset-1'
                          : ''
                      }`}
                      onMouseEnter={() => setHoveredCell({ day: dayIndex, hour })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => onCellClick?.(dayIndex, hour)}
                      title={
                        cellData
                          ? `${day} ${formatHour(hour)}: ${engagement}% (${cellData.postCount} posts)`
                          : `${day} ${formatHour(hour)}: No data`
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-4 h-4 rounded-sm bg-gray-100 dark:bg-gray-800" />
              <div className="w-4 h-4 rounded-sm bg-emerald-100 dark:bg-emerald-800/40" />
              <div className="w-4 h-4 rounded-sm bg-emerald-200 dark:bg-emerald-700/50" />
              <div className="w-4 h-4 rounded-sm bg-emerald-300 dark:bg-emerald-600/60" />
              <div className="w-4 h-4 rounded-sm bg-emerald-400 dark:bg-emerald-500" />
              <div className="w-4 h-4 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
            </div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
