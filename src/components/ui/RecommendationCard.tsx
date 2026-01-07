import type { MatchupRecommendation } from '../../data/types';

interface RecommendationCardProps {
  recommendation: MatchupRecommendation;
  rank: number;
  selected?: boolean;
  onClick?: () => void;
}

export function RecommendationCard({
  recommendation,
  rank,
  selected = false,
  onClick,
}: RecommendationCardProps) {
  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.55) return 'text-green-400';
    if (prob >= 0.45) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProbabilityBg = (prob: number) => {
    if (prob >= 0.55) return 'from-green-500/20 to-green-500/5';
    if (prob >= 0.45) return 'from-yellow-500/20 to-yellow-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-amber-500', text: '🥇' };
    if (rank === 2) return { bg: 'bg-slate-400', text: '🥈' };
    if (rank === 3) return { bg: 'bg-amber-700', text: '🥉' };
    return { bg: 'bg-slate-600', text: `#${rank}` };
  };

  const rankBadge = getRankBadge(rank);

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border transition-all duration-200
        bg-gradient-to-br ${getProbabilityBg(recommendation.winProbability)}
        ${selected 
          ? 'border-blue-500 ring-2 ring-blue-500/50' 
          : 'border-slate-700 hover:border-slate-600'
        }
      `}
    >
      <div className="p-4">
        {/* Header with rank and probability */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${rankBadge.bg} flex items-center justify-center text-sm`}>
              {rankBadge.text}
            </div>
            <div>
              <div className="text-slate-200 font-semibold text-lg">
                {recommendation.playerName}
              </div>
              <div className="text-slate-400 text-sm">
                Confidence: {Math.round(recommendation.confidence * 100)}%
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${getProbabilityColor(recommendation.winProbability)}`}>
              {Math.round(recommendation.winProbability * 100)}%
            </div>
            <div className="text-slate-500 text-xs">win chance</div>
          </div>
        </div>

        {/* Factor bars */}
        <div className="space-y-2 mb-3">
          <FactorBar 
            label="Skill Level" 
            value={recommendation.factors.skillLevelAdvantage} 
          />
          <FactorBar 
            label="Win Rate" 
            value={recommendation.factors.winPercentageDelta} 
          />
          <FactorBar 
            label="Head-to-Head" 
            value={recommendation.factors.headToHeadRecord} 
          />
          <FactorBar 
            label="Recent Form" 
            value={recommendation.factors.recentFormTrend} 
          />
        </div>

        {/* Reasoning */}
        {recommendation.reasoning.length > 0 && (
          <div className="pt-3 border-t border-slate-700/50">
            <ul className="space-y-1">
              {recommendation.reasoning.slice(0, 3).map((reason, i) => (
                <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </button>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  const isPositive = value >= 0.5;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            isPositive ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-xs w-8 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {percentage}%
      </span>
    </div>
  );
}
