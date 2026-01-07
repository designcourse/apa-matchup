import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../../store/team-store';
import { useMatchStore } from '../../store/match-store';
import { getAICoinTossRecommendation } from '../../services/gemini';

export function CoinTossScreen() {
  const navigate = useNavigate();
  const { ourTeamId, getPlayersByTeam, headToHead } = useTeamStore();
  const { liveMatch, setWeThrowFirst } = useMatchStore();

  const [showRecommendation, setShowRecommendation] = useState(false);
  const [recommendation, setRecommendation] = useState<{ recommendation: 'throw_first' | 'defer'; reasoning: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!liveMatch) {
    navigate('/match/opponent');
    return null;
  }

  const ourPlayers = getPlayersByTeam(ourTeamId)
    .filter(p => liveMatch.ourPlayersPresent.includes(p.id));
  const theirPlayers = getPlayersByTeam(liveMatch.opponentTeamId)
    .filter(p => liveMatch.theirPlayersPresent.includes(p.id));

  const getRecommendation = async () => {
    setIsLoading(true);
    try {
      const result = await getAICoinTossRecommendation(ourPlayers, theirPlayers, headToHead);
      setRecommendation(result);
      setShowRecommendation(true);
    } catch (err) {
      console.error('Error getting AI recommendation:', err);
      // Still show the choice buttons even if AI fails
      setShowRecommendation(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeThrowFirst = () => {
    setWeThrowFirst(true);
    navigate('/match/game');
  };

  const handleTheyThrowFirst = () => {
    setWeThrowFirst(false);
    navigate('/match/game');
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-24">
      {/* Header */}
      <header className="mb-8">
        <button 
          onClick={() => navigate('/match/attendance')}
          className="text-slate-400 hover:text-white mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Who Throws First?</h1>
        <p className="text-slate-400">vs {liveMatch.opponentTeamName}</p>
      </header>

      {/* Main Content */}
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="text-6xl mb-4">🎱</div>
          <p className="text-slate-300">Who will throw the first player?</p>
        </div>

        {/* AI Recommendation Button */}
        {!showRecommendation && !isLoading && (
          <button
            onClick={getRecommendation}
            className="w-full py-3 px-4 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <span>🤖</span>
            <span>Get AI Recommendation</span>
          </button>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 animate-pulse" />
            <p className="text-slate-400 text-sm mt-3">AI is analyzing...</p>
          </div>
        )}

        {/* AI Recommendation */}
        {showRecommendation && recommendation && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <span className="text-purple-400 font-medium">AI Recommends:</span>
              <span className="text-white font-semibold">
                {recommendation.recommendation === 'throw_first' ? 'We throw first' : 'They throw first'}
              </span>
            </div>
            <ul className="space-y-1">
              {recommendation.reasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-400 text-sm">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Choice Buttons */}
        <div className="grid grid-cols-1 gap-4 pt-4">
          <button
            onClick={handleWeThrowFirst}
            className={`p-6 rounded-xl border-2 transition-all ${
              recommendation?.recommendation === 'throw_first'
                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 hover:border-blue-400'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🎯</div>
                <div className="text-left">
                  <div className="text-white font-semibold text-lg">We Throw First</div>
                  <div className="text-slate-400 text-sm">We pick first, they counter-pick</div>
                </div>
              </div>
              {recommendation?.recommendation === 'throw_first' && (
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">Recommended</span>
              )}
            </div>
          </button>

          <button
            onClick={handleTheyThrowFirst}
            className={`p-6 rounded-xl border-2 transition-all ${
              recommendation?.recommendation === 'defer'
                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50 hover:border-blue-400'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🛡️</div>
                <div className="text-left">
                  <div className="text-white font-semibold text-lg">They Throw First</div>
                  <div className="text-slate-400 text-sm">They pick first, we counter-pick</div>
                </div>
              </div>
              {recommendation?.recommendation === 'defer' && (
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">Recommended</span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
