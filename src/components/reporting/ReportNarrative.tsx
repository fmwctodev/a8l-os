import { Lightbulb, Target, FileText } from 'lucide-react';

interface ReportNarrativeProps {
  executiveSummary?: string;
  insights?: string[];
  recommendations?: string[];
}

export function ReportNarrative({ executiveSummary, insights, recommendations }: ReportNarrativeProps) {
  return (
    <div className="space-y-6">
      {executiveSummary && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Executive Summary</h3>
          </div>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {executiveSummary}
          </div>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Key Insights</h3>
          </div>
          <ul className="space-y-3">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-semibold text-amber-400 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-300 leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations && recommendations.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Recommendations</h3>
          </div>
          <ul className="space-y-3">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2" />
                <span className="text-sm text-slate-300 leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
