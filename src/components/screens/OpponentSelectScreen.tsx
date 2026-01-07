import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../../store/team-store';
import { useMatchStore } from '../../store/match-store';

export function OpponentSelectScreen() {
  const navigate = useNavigate();
  const { ourTeamId, loadTeams, getOpponentTeams } = useTeamStore();
  const { upcomingMatches, startMatch, loadUpcomingMatches } = useMatchStore();

  useEffect(() => {
    loadTeams();
    if (ourTeamId) {
      loadUpcomingMatches(ourTeamId);
    }
  }, [ourTeamId]);

  // Deduplicate teams by team number (in case of database issues)
  const opponentTeams = getOpponentTeams().filter(
    (team, index, self) => index === self.findIndex(t => t.number === team.number)
  );
  const nextMatch = upcomingMatches[0];

  // Get tonight's scheduled opponent if any
  const scheduledOpponentId = nextMatch 
    ? (nextMatch.homeTeamId === ourTeamId ? nextMatch.awayTeamId : nextMatch.homeTeamId)
    : null;

  const handleSelectOpponent = (teamId: number, teamName: string) => {
    startMatch(teamId, teamName);
    navigate('/match/attendance');
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <button 
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-white mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Select Opponent</h1>
        <p className="text-slate-400">Who are you playing against?</p>
      </header>

      {/* Scheduled Match Highlight */}
      {scheduledOpponentId && nextMatch && (
        <div className="mb-6">
          <p className="text-slate-400 text-sm mb-2">Tonight's Scheduled Match</p>
          {opponentTeams
            .filter(t => t.id === scheduledOpponentId)
            .map(team => (
              <button
                key={team.id}
                onClick={() => handleSelectOpponent(team.id, team.name)}
                className="w-full p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 text-left hover:border-green-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold text-lg">{team.name}</div>
                    <div className="text-green-400 text-sm">Week {nextMatch.week} • {nextMatch.hostLocationName}</div>
                  </div>
                  <div className="text-green-400 text-2xl">→</div>
                </div>
              </button>
            ))}
        </div>
      )}

      {/* All Teams */}
      <div>
        <p className="text-slate-400 text-sm mb-3">
          {scheduledOpponentId ? 'Or select a different team' : 'All Teams'}
        </p>
        <div className="space-y-2">
          {opponentTeams
            .filter(t => t.id !== scheduledOpponentId)
            .map(team => (
              <button
                key={team.id}
                onClick={() => handleSelectOpponent(team.id, team.name)}
                className="w-full p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-left hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{team.name}</div>
                    <div className="text-slate-400 text-sm">Team #{team.number}</div>
                  </div>
                  <div className="text-slate-400">→</div>
                </div>
              </button>
            ))}
        </div>
      </div>

      {opponentTeams.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No teams loaded yet</p>
          <button
            onClick={() => navigate('/sync')}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
          >
            Sync Data
          </button>
        </div>
      )}
    </div>
  );
}
