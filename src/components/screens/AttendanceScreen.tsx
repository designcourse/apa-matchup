import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../../store/team-store';
import { useMatchStore } from '../../store/match-store';
import { PlayerCard } from '../ui/PlayerCard';

export function AttendanceScreen() {
  const navigate = useNavigate();
  const { ourTeamId, getPlayersByTeam, loadAllPlayers, loadPlayerStats, getPlayerStatsById } = useTeamStore();
  const { liveMatch, setAttendance } = useMatchStore();

  const [ourPresent, setOurPresent] = useState<Set<number>>(new Set());
  const [theirPresent, setTheirPresent] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadAllPlayers();
    loadPlayerStats();
  }, []);

  if (!liveMatch) {
    navigate('/match/opponent');
    return null;
  }

  const ourPlayers = getPlayersByTeam(ourTeamId);
  const theirPlayers = getPlayersByTeam(liveMatch.opponentTeamId);

  const toggleOurPlayer = (playerId: number) => {
    const newSet = new Set(ourPresent);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setOurPresent(newSet);
  };

  const toggleTheirPlayer = (playerId: number) => {
    const newSet = new Set(theirPresent);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setTheirPresent(newSet);
  };

  const selectAllOurs = () => {
    setOurPresent(new Set(ourPlayers.map(p => p.id)));
  };

  const selectAllTheirs = () => {
    setTheirPresent(new Set(theirPlayers.map(p => p.id)));
  };

  const handleContinue = () => {
    setAttendance(Array.from(ourPresent), Array.from(theirPresent));
    navigate('/match/coin-toss');
  };

  const canContinue = ourPresent.size >= 5 && theirPresent.size >= 5;

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-32">
      {/* Header */}
      <header className="mb-6">
        <button 
          onClick={() => navigate('/match/opponent')}
          className="text-slate-400 hover:text-white mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Who's Playing?</h1>
        <p className="text-slate-400">Select players present tonight</p>
      </header>

      {/* Our Team */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-semibold">Our Team</h2>
            <p className="text-slate-400 text-sm">{ourPresent.size} selected</p>
          </div>
          <button
            onClick={selectAllOurs}
            className="text-blue-400 text-sm hover:text-blue-300"
          >
            Select All
          </button>
        </div>
        <div className="space-y-2">
          {ourPlayers.map((player, i) => (
            <div 
              key={player.id} 
              className={`animate-fade-in stagger-${Math.min(i + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <PlayerCard
                player={player}
                stats={getPlayerStatsById(player.id)}
                selected={ourPresent.has(player.id)}
                onClick={() => toggleOurPlayer(player.id)}
                variant="compact"
              />
            </div>
          ))}
        </div>
        {ourPlayers.length === 0 && (
          <p className="text-slate-500 text-center py-4">No players loaded</p>
        )}
      </div>

      {/* Their Team */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-semibold">{liveMatch.opponentTeamName}</h2>
            <p className="text-slate-400 text-sm">{theirPresent.size} selected</p>
          </div>
          <button
            onClick={selectAllTheirs}
            className="text-blue-400 text-sm hover:text-blue-300"
          >
            Select All
          </button>
        </div>
        <div className="space-y-2">
          {theirPlayers.map((player, i) => (
            <div 
              key={player.id} 
              className={`animate-fade-in stagger-${Math.min(i + 1, 5)}`}
              style={{ opacity: 0 }}
            >
              <PlayerCard
                player={player}
                stats={getPlayerStatsById(player.id)}
                selected={theirPresent.has(player.id)}
                onClick={() => toggleTheirPlayer(player.id)}
                variant="compact"
              />
            </div>
          ))}
        </div>
        {theirPlayers.length === 0 && (
          <p className="text-slate-500 text-center py-4">No players loaded</p>
        )}
      </div>

      {/* Continue Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
            canContinue
              ? 'bg-blue-500 text-white hover:bg-blue-400'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canContinue 
            ? 'Continue to Coin Toss' 
            : `Select at least 5 players per team`}
        </button>
      </div>
    </div>
  );
}
