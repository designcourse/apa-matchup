import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team, Player, PlayerStats, HeadToHead } from '../data/types';
import { db, getTeamPlayers } from '../data/db';
import { MY_TEAM_ID } from '../data/seed';

interface TeamState {
  // Data
  teams: Team[];
  players: Player[];
  playerStats: Map<number, PlayerStats>;
  headToHead: Map<string, HeadToHead>;
  
  // Our team
  ourTeamId: number;
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  loadTeams: () => Promise<void>;
  loadPlayers: (teamId: number) => Promise<Player[]>;
  loadAllPlayers: () => Promise<void>;
  loadPlayerStats: () => Promise<void>;
  loadHeadToHead: () => Promise<void>;
  setOurTeam: (teamId: number) => void;
  getOurTeam: () => Team | undefined;
  getOpponentTeams: () => Team[];
  getTeamById: (teamId: number) => Team | undefined;
  getPlayersByTeam: (teamId: number) => Player[];
  getPlayerStatsById: (playerId: number) => PlayerStats | undefined;
  getHeadToHead: (playerId: number, opponentId: number) => HeadToHead | undefined;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      players: [],
      playerStats: new Map(),
      headToHead: new Map(),
      ourTeamId: MY_TEAM_ID, // Pocket Pounders
      isLoading: false,

      loadTeams: async () => {
        set({ isLoading: true });
        try {
          const teams = await db.teams.toArray();
          // Find our team and ensure ourTeamId matches
          const ourTeam = teams.find(t => t.isOurTeam);
          if (ourTeam) {
            set({ teams, ourTeamId: ourTeam.id, isLoading: false });
          } else {
            set({ teams, isLoading: false });
          }
        } catch (error) {
          console.error('Failed to load teams:', error);
          set({ isLoading: false });
        }
      },

      loadPlayers: async (teamId: number) => {
        const players = await getTeamPlayers(teamId);
        return players;
      },

      loadAllPlayers: async () => {
        set({ isLoading: true });
        try {
          const players = await db.players.toArray();
          set({ players, isLoading: false });
        } catch (error) {
          console.error('Failed to load players:', error);
          set({ isLoading: false });
        }
      },

      loadPlayerStats: async () => {
        try {
          const allStats = await db.playerStats.toArray();
          const statsMap = new Map<number, PlayerStats>();
          
          // Get latest stats for each player
          for (const stats of allStats) {
            const existing = statsMap.get(stats.playerId);
            if (!existing || (stats.sessionId || '') > (existing.sessionId || '')) {
              statsMap.set(stats.playerId, stats);
            }
          }
          
          set({ playerStats: statsMap });
        } catch (error) {
          console.error('Failed to load player stats:', error);
        }
      },

      loadHeadToHead: async () => {
        try {
          const allH2H = await db.headToHead.toArray();
          const h2hMap = new Map<string, HeadToHead>();
          
          for (const h2h of allH2H) {
            const key = `${h2h.playerId}-${h2h.opponentId}`;
            h2hMap.set(key, h2h);
          }
          
          set({ headToHead: h2hMap });
        } catch (error) {
          console.error('Failed to load head-to-head:', error);
        }
      },

      setOurTeam: (teamId: number) => {
        set({ ourTeamId: teamId });
      },

      getOurTeam: () => {
        const { teams, ourTeamId } = get();
        return teams.find(t => t.id === ourTeamId);
      },

      getOpponentTeams: () => {
        const { teams, ourTeamId } = get();
        // Filter out our team and deduplicate by team number
        const seen = new Set<string>();
        return teams.filter(t => {
          if (t.id === ourTeamId || t.isOurTeam) return false;
          if (seen.has(t.number)) return false;
          seen.add(t.number);
          return true;
        });
      },

      getTeamById: (teamId: number) => {
        return get().teams.find(t => t.id === teamId);
      },

      getPlayersByTeam: (teamId: number) => {
        // Ensure both IDs are numbers for comparison (localStorage can stringify)
        const numTeamId = Number(teamId);
        return get().players.filter(p => Number(p.teamId) === numTeamId);
      },

      getPlayerStatsById: (playerId: number) => {
        return get().playerStats.get(playerId);
      },

      getHeadToHead: (playerId: number, opponentId: number) => {
        const key = `${playerId}-${opponentId}`;
        return get().headToHead.get(key);
      },
    }),
    {
      name: 'team-store',
      partialize: (state) => ({
        ourTeamId: state.ourTeamId,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure ourTeamId is a number after rehydration from localStorage
        if (state && state.ourTeamId) {
          state.ourTeamId = Number(state.ourTeamId);
        }
      },
    }
  )
);
