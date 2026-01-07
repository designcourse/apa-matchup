import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomeScreen } from './components/screens/HomeScreen';
import { SyncScreen } from './components/screens/SyncScreen';
import { OpponentSelectScreen } from './components/screens/OpponentSelectScreen';
import { AttendanceScreen } from './components/screens/AttendanceScreen';
import { CoinTossScreen } from './components/screens/CoinTossScreen';
import { GameMatchupScreen } from './components/screens/GameMatchupScreen';
import { MatchSummaryScreen } from './components/screens/MatchSummaryScreen';
import { useTeamStore } from './store/team-store';
import { useSyncStore } from './store/sync-store';
import { seedInitialData } from './data/seed';

function App() {
  const { loadTeams, loadAllPlayers, loadPlayerStats, loadHeadToHead } = useTeamStore();
  const { loadSyncStatus } = useSyncStore();

  useEffect(() => {
    // Initialize app data
    const initApp = async () => {
      await seedInitialData();
      await loadSyncStatus();
      await loadTeams();
      await loadAllPlayers();
      await loadPlayerStats();
      await loadHeadToHead();
    };

    initApp();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/sync" element={<SyncScreen />} />
          <Route path="/match/opponent" element={<OpponentSelectScreen />} />
          <Route path="/match/attendance" element={<AttendanceScreen />} />
          <Route path="/match/coin-toss" element={<CoinTossScreen />} />
          <Route path="/match/game" element={<GameMatchupScreen />} />
          <Route path="/match/summary" element={<MatchSummaryScreen />} />
          <Route path="/teams" element={<TeamsScreen />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

// Simple teams screen
function TeamsScreen() {
  const { teams, getPlayersByTeam, getPlayerStatsById } = useTeamStore();
  
  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-24">
      <header className="mb-6">
        <a href="/" className="text-slate-400 hover:text-white mb-2 flex items-center gap-1">
          ← Back
        </a>
        <h1 className="text-2xl font-bold text-white">Division Teams</h1>
      </header>
      
      <div className="space-y-6">
        {teams.map(team => {
          const players = getPlayersByTeam(team.id);
          return (
            <div key={team.id} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold">{team.name}</h2>
                {team.isOurTeam && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">Our Team</span>
                )}
              </div>
              <p className="text-slate-400 text-sm mb-3">Team #{team.number} • {players.length} players</p>
              
              {players.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {players.slice(0, 8).map(player => {
                    const stats = getPlayerStatsById(player.id);
                    return (
                      <div key={player.id} className="p-2 rounded-lg bg-slate-700/50 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            player.skillLevel <= 3 ? 'bg-green-500' :
                            player.skillLevel <= 5 ? 'bg-yellow-500' :
                            player.skillLevel <= 7 ? 'bg-orange-500' : 'bg-red-500'
                          }`}>
                            {player.skillLevel}
                          </div>
                          <span className="text-slate-300 truncate">{player.name}</span>
                        </div>
                        {stats && (
                          <div className="text-slate-500 text-xs mt-1 ml-8">
                            {stats.winPct.toFixed(0)}% • {stats.ppm.toFixed(1)} PPM
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No players synced yet</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
