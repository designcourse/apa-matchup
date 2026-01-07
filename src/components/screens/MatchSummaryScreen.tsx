import { useNavigate } from 'react-router-dom';
import { useMatchStore } from '../../store/match-store';
import { useTeamStore } from '../../store/team-store';
import { ScoreBadge, SkillLevelBadge } from '../ui/StatBadge';

export function MatchSummaryScreen() {
  const navigate = useNavigate();
  const { liveMatch, resetMatch, getMatchProgress } = useMatchStore();
  const { players } = useTeamStore();

  if (!liveMatch) {
    navigate('/');
    return null;
  }

  const { ourWins, theirWins } = getMatchProgress();
  const weWon = ourWins >= 3;

  const handleDone = () => {
    resetMatch();
    navigate('/');
  };

  // Get player names from IDs
  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return 'Unknown';
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  };

  const getPlayerSkillLevel = (playerId: string | null) => {
    if (!playerId) return 0;
    const player = players.find(p => p.id === playerId);
    return player?.skillLevel || 0;
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-24">
      {/* Result Header */}
      <header className="text-center py-8 mb-6">
        <div className="text-6xl mb-4">{weWon ? '🏆' : '💪'}</div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {weWon ? 'Victory!' : 'Tough Loss'}
        </h1>
        <p className="text-slate-400 mb-4">vs {liveMatch.opponentTeamName}</p>
        
        <div className="flex justify-center">
          <ScoreBadge ourScore={liveMatch.ourScore} theirScore={liveMatch.theirScore} size="lg" />
        </div>
      </header>

      {/* Game-by-Game Breakdown */}
      <div className="mb-8">
        <h2 className="text-white font-semibold mb-4">Game Breakdown</h2>
        <div className="space-y-3">
          {liveMatch.games.map((game) => {
            if (game.result === 'pending') return null;
            
            const won = game.result === 'win';
            
            return (
              <div 
                key={game.gameNumber}
                className={`p-4 rounded-xl border ${
                  won 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                      Game {game.gameNumber}
                    </span>
                    <span className={won ? 'text-green-400' : 'text-red-400'}>
                      {won ? '✓ WIN' : '✗ LOSS'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <SkillLevelBadge level={getPlayerSkillLevel(game.ourPlayerId)} size="sm" />
                    <span className="text-slate-300">{getPlayerName(game.ourPlayerId)}</span>
                  </div>
                  <span className="text-slate-500">vs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{getPlayerName(game.theirPlayerId)}</span>
                    <SkillLevelBadge level={getPlayerSkillLevel(game.theirPlayerId)} size="sm" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-8 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <h2 className="text-white font-semibold mb-3">Match Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-slate-400 text-sm">Games Won</p>
            <p className="text-2xl font-bold text-green-400">{ourWins}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Games Lost</p>
            <p className="text-2xl font-bold text-red-400">{theirWins}</p>
          </div>
        </div>
      </div>

      {/* Recommendation Accuracy (placeholder for future) */}
      <div className="mb-8 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
        <h2 className="text-white font-semibold mb-3">Recommendations</h2>
        <p className="text-slate-400 text-sm">
          Recommendation tracking will be available in future updates
        </p>
      </div>

      {/* Done Button */}
      <button
        onClick={handleDone}
        className="w-full py-4 px-6 rounded-xl bg-blue-500 text-white font-semibold text-lg hover:bg-blue-400 transition-colors"
      >
        Done
      </button>
    </div>
  );
}
