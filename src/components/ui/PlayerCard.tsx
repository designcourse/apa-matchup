import type { Player, PlayerStats } from '../../data/types';

interface PlayerCardProps {
  player: Player;
  stats?: PlayerStats;
  selected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'recommendation';
  winProbability?: number;
  showStats?: boolean;
}

export function PlayerCard({
  player,
  stats,
  selected = false,
  onClick,
  variant = 'default',
  winProbability,
  showStats = true,
}: PlayerCardProps) {
  // Use player's built-in stats as fallback if no separate stats provided
  const displayStats = stats || {
    winPct: player.winPct,
    ppm: player.ppm,
    matchesPlayed: player.matchesPlayed,
    matchesWon: player.matchesWon,
    gamesPlayed: 0, // Not available from Player
  };
  const baseClasses = `
    rounded-xl border transition-all duration-200 cursor-pointer
    ${selected 
      ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/50' 
      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
    }
  `;

  const getSkillLevelColor = (sl: number) => {
    if (sl <= 3) return 'bg-green-500';
    if (sl <= 5) return 'bg-yellow-500';
    if (sl <= 7) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} p-3 flex items-center gap-3 w-full`}
      >
        <div className={`w-8 h-8 rounded-full ${getSkillLevelColor(player.skillLevel)} flex items-center justify-center text-white font-bold text-sm`}>
          {player.skillLevel}
        </div>
        <span className="text-slate-200 font-medium truncate">{player.name}</span>
      </button>
    );
  }

  if (variant === 'recommendation') {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} p-4 w-full text-left`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${getSkillLevelColor(player.skillLevel)} flex items-center justify-center text-white font-bold`}>
              {player.skillLevel}
            </div>
            <div>
              <div className="text-slate-200 font-semibold">{player.name}</div>
              <div className="text-slate-400 text-sm">Skill Level {player.skillLevel}</div>
            </div>
          </div>
          {winProbability !== undefined && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${
                winProbability >= 0.55 ? 'text-green-400' :
                winProbability >= 0.45 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {Math.round(winProbability * 100)}%
              </div>
              <div className="text-slate-500 text-xs">win probability</div>
            </div>
          )}
        </div>
        
        {showStats && displayStats && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700">
            <div className="text-center">
              <div className="text-slate-400 text-xs">Win %</div>
              <div className="text-slate-200 font-medium">{displayStats.winPct.toFixed(0)}%</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">PPM</div>
              <div className="text-slate-200 font-medium">{displayStats.ppm.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">Matches</div>
              <div className="text-slate-200 font-medium">{displayStats.matchesPlayed}</div>
            </div>
          </div>
        )}
      </button>
    );
  }

  // Default variant
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} p-4 w-full text-left`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-full ${getSkillLevelColor(player.skillLevel)} flex items-center justify-center text-white font-bold text-lg`}>
          {player.skillLevel}
        </div>
        <div>
          <div className="text-slate-200 font-semibold text-lg">{player.name}</div>
          <div className="text-slate-400 text-sm">Skill Level {player.skillLevel}</div>
        </div>
      </div>
      
      {showStats && displayStats && (
        <div className="grid grid-cols-4 gap-2">
          <div>
            <div className="text-slate-500 text-xs">Record</div>
            <div className="text-slate-300 text-sm font-medium">
              {displayStats.matchesWon}-{displayStats.matchesPlayed - displayStats.matchesWon}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Win %</div>
            <div className="text-slate-300 text-sm font-medium">{displayStats.winPct.toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">PPM</div>
            <div className="text-slate-300 text-sm font-medium">{displayStats.ppm.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Matches</div>
            <div className="text-slate-300 text-sm font-medium">{displayStats.matchesPlayed}</div>
          </div>
        </div>
      )}
    </button>
  );
}
