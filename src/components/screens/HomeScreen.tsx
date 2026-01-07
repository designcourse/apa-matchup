import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '../../store/team-store';
import { useMatchStore } from '../../store/match-store';
import { useSyncStore } from '../../store/sync-store';
import { ScoreBadge } from '../ui/StatBadge';

export function HomeScreen() {
  const navigate = useNavigate();
  const { ourTeamId, loadTeams, getOurTeam } = useTeamStore();
  const { liveMatch, upcomingMatches, loadUpcomingMatches, resetMatch } = useMatchStore();
  const { syncStatus } = useSyncStore();
  
  const ourTeam = getOurTeam();

  useEffect(() => {
    loadTeams();
    if (ourTeamId) {
      loadUpcomingMatches(ourTeamId);
    }
  }, [ourTeamId]);

  const nextMatch = upcomingMatches[0];
  const isMatchNight = nextMatch && isToday(new Date(nextMatch.scheduledDate));

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">Match-Up</h1>
          <button 
            onClick={() => navigate('/sync')}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <SyncIcon />
          </button>
        </div>
        <p className="text-slate-400">
          {ourTeam ? ourTeam.name : 'Loading...'}
        </p>
      </header>

      {/* Sync Status Banner */}
      {!syncStatus.lastSyncTime && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="text-amber-500">⚠️</div>
            <div>
              <p className="text-amber-400 font-medium">Data not synced</p>
              <p className="text-amber-400/70 text-sm">Sync to get player stats and recommendations</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sync')}
            className="mt-3 w-full py-2 px-4 rounded-lg bg-amber-500 text-slate-900 font-medium hover:bg-amber-400 transition-colors"
          >
            Sync Now
          </button>
        </div>
      )}

      {/* Live Match Card */}
      {liveMatch && liveMatch.status !== 'completed' && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-400 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Match In Progress
            </span>
            <ScoreBadge ourScore={liveMatch.ourScore} theirScore={liveMatch.theirScore} size="sm" />
          </div>
          <p className="text-white font-semibold mb-1">vs {liveMatch.opponentTeamName}</p>
          <p className="text-slate-400 text-sm mb-3">Game {liveMatch.currentGame} of 5</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/match/game')}
              className="flex-1 py-3 px-4 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors"
            >
              Continue Match
            </button>
            <button
              onClick={() => {
                if (confirm('Cancel this match and start over?')) {
                  resetMatch();
                }
              }}
              className="py-3 px-4 rounded-lg bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Next Match Card */}
      {nextMatch && !liveMatch && (
        <div className={`mb-6 p-4 rounded-xl border ${
          isMatchNight 
            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30' 
            : 'bg-slate-800/50 border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${isMatchNight ? 'text-green-400' : 'text-slate-400'}`}>
              {isMatchNight ? "🎱 Tonight's Match" : 'Next Match'}
            </span>
            <span className="text-slate-400 text-sm">Week {nextMatch.week}</span>
          </div>
          
          <p className="text-white font-semibold text-lg mb-1">
            vs {nextMatch.homeTeamId === ourTeamId ? nextMatch.awayTeamName : nextMatch.homeTeamName}
          </p>
          
          <p className="text-slate-400 text-sm mb-1">
            {formatDate(new Date(nextMatch.scheduledDate))}
          </p>
          
          <p className="text-slate-500 text-sm mb-4">
            📍 {nextMatch.hostLocationName}
          </p>
          
          {isMatchNight && (
            <button
              onClick={() => navigate('/match/opponent')}
              className="w-full py-3 px-4 rounded-lg bg-green-500 text-white font-medium hover:bg-green-400 transition-colors"
            >
              Start Match Setup
            </button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => navigate('/match/opponent')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors text-left"
        >
          <div className="text-2xl mb-2">🎱</div>
          <div className="text-white font-medium">New Match</div>
          <div className="text-slate-400 text-sm">Start match setup</div>
        </button>
        
        <button
          onClick={() => navigate('/teams')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors text-left"
        >
          <div className="text-2xl mb-2">👥</div>
          <div className="text-white font-medium">Teams</div>
          <div className="text-slate-400 text-sm">View all teams</div>
        </button>
      </div>

      {/* Last Sync Info */}
      {syncStatus.lastSyncTime && (
        <div className="text-center text-slate-500 text-sm">
          Last synced: {formatRelativeTime(new Date(syncStatus.lastSyncTime))}
        </div>
      )}
    </div>
  );
}

function SyncIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}
