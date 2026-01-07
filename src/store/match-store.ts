import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LiveMatch, LiveGame, Match, MatchupRecommendation, CoinTossDecision, MatchStatus } from '../data/types';
import { db } from '../data/db';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface MatchState {
  // Current live match
  liveMatch: LiveMatch | null;
  
  // Scheduled matches
  upcomingMatches: Match[];
  
  // Current recommendations
  currentRecommendations: MatchupRecommendation[];
  coinTossDecision: CoinTossDecision | null;
  
  // AI Chat history (match-specific)
  chatHistory: ChatMessage[];
  
  // Actions
  loadUpcomingMatches: (teamId: number) => Promise<void>;
  startMatch: (opponentTeamId: number, opponentTeamName: string) => void;
  setAttendance: (ourPlayerIds: number[], theirPlayerIds: number[]) => void;
  setCoinTossResult: (weWon: boolean) => void;
  setWeThrowFirst: (throwFirst: boolean) => void;
  setCurrentRecommendations: (recommendations: MatchupRecommendation[]) => void;
  setCoinTossDecision: (decision: CoinTossDecision) => void;
  recordTheirPlayer: (gameNumber: number, playerId: number) => void;
  recordOurPlayer: (gameNumber: number, playerId: number) => void;
  recordGameResult: (gameNumber: number, won: boolean, ourPoints?: number, theirPoints?: number) => void;
  nextGame: () => void;
  endMatch: () => void;
  resetMatch: () => void;
  getCurrentGame: () => LiveGame | null;
  getMatchProgress: () => { gamesPlayed: number; ourWins: number; theirWins: number };
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
}

const createInitialLiveMatch = (opponentTeamId: number, opponentTeamName: string): LiveMatch => ({
  id: `match-${Date.now()}`,
  opponentTeamId,
  opponentTeamName,
  scheduledDate: new Date(),
  ourPlayersPresent: [],
  theirPlayersPresent: [],
  coinTossWinner: null,
  weThrowFirst: null,
  games: [
    { gameNumber: 1, ourPlayerId: null, theirPlayerId: null, result: 'pending' },
    { gameNumber: 2, ourPlayerId: null, theirPlayerId: null, result: 'pending' },
    { gameNumber: 3, ourPlayerId: null, theirPlayerId: null, result: 'pending' },
    { gameNumber: 4, ourPlayerId: null, theirPlayerId: null, result: 'pending' },
    { gameNumber: 5, ourPlayerId: null, theirPlayerId: null, result: 'pending' },
  ],
  currentGame: 1,
  ourScore: 0,
  theirScore: 0,
  status: 'setup',
});

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({
      liveMatch: null,
      upcomingMatches: [],
      currentRecommendations: [],
      coinTossDecision: null,
      chatHistory: [],

      loadUpcomingMatches: async (teamId: number) => {
        try {
          const now = new Date();
          const matches = await db.matches
            .filter(m => 
              (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
              new Date(m.scheduledDate) >= now &&
              m.status === 'UNPLAYED'
            )
            .sortBy('scheduledDate');
          set({ upcomingMatches: matches });
        } catch (error) {
          console.error('Failed to load upcoming matches:', error);
        }
      },

      startMatch: (opponentTeamId: number, opponentTeamName: string) => {
        const liveMatch = createInitialLiveMatch(opponentTeamId, opponentTeamName);
        set({ liveMatch, currentRecommendations: [], coinTossDecision: null, chatHistory: [] });
      },

      setAttendance: (ourPlayerIds: number[], theirPlayerIds: number[]) => {
        set(state => ({
          liveMatch: state.liveMatch ? {
            ...state.liveMatch,
            ourPlayersPresent: ourPlayerIds,
            theirPlayersPresent: theirPlayerIds,
            status: 'coin_toss' as MatchStatus,
          } : null,
        }));
      },

      setCoinTossResult: (weWon: boolean) => {
        set(state => ({
          liveMatch: state.liveMatch ? {
            ...state.liveMatch,
            coinTossWinner: weWon ? 'us' : 'them',
          } : null,
        }));
      },

      setWeThrowFirst: (throwFirst: boolean) => {
        set(state => ({
          liveMatch: state.liveMatch ? {
            ...state.liveMatch,
            weThrowFirst: throwFirst,
            status: 'in_progress' as MatchStatus,
          } : null,
        }));
      },

      setCurrentRecommendations: (recommendations: MatchupRecommendation[]) => {
        set({ currentRecommendations: recommendations });
      },

      setCoinTossDecision: (decision: CoinTossDecision) => {
        set({ coinTossDecision: decision });
      },

      recordTheirPlayer: (gameNumber: number, playerId: number) => {
        set(state => {
          if (!state.liveMatch) return state;
          
          const games = [...state.liveMatch.games];
          const gameIndex = games.findIndex(g => g.gameNumber === gameNumber);
          if (gameIndex !== -1) {
            games[gameIndex] = { ...games[gameIndex], theirPlayerId: playerId };
          }
          
          return {
            liveMatch: { ...state.liveMatch, games },
          };
        });
      },

      recordOurPlayer: (gameNumber: number, playerId: number) => {
        set(state => {
          if (!state.liveMatch) return state;
          
          const games = [...state.liveMatch.games];
          const gameIndex = games.findIndex(g => g.gameNumber === gameNumber);
          if (gameIndex !== -1) {
            games[gameIndex] = { ...games[gameIndex], ourPlayerId: playerId };
          }
          
          return {
            liveMatch: { ...state.liveMatch, games },
          };
        });
      },

      recordGameResult: (gameNumber: number, won: boolean, ourPoints?: number, theirPoints?: number) => {
        set(state => {
          if (!state.liveMatch) return state;
          
          const games = [...state.liveMatch.games];
          const gameIndex = games.findIndex(g => g.gameNumber === gameNumber);
          if (gameIndex !== -1) {
            games[gameIndex] = { 
              ...games[gameIndex], 
              result: won ? 'win' : 'loss',
              ourPoints,
              theirPoints,
            };
          }
          
          const ourScore = games.filter(g => g.result === 'win').length;
          const theirScore = games.filter(g => g.result === 'loss').length;
          
          // Check if match is over (first to 3)
          const isComplete = ourScore >= 3 || theirScore >= 3;
          
          return {
            liveMatch: {
              ...state.liveMatch,
              games,
              ourScore,
              theirScore,
              status: isComplete ? 'completed' as MatchStatus : state.liveMatch.status,
            },
          };
        });
      },

      nextGame: () => {
        set(state => {
          if (!state.liveMatch || state.liveMatch.currentGame >= 5) return state;
          
          return {
            liveMatch: {
              ...state.liveMatch,
              currentGame: state.liveMatch.currentGame + 1,
            },
            currentRecommendations: [],
          };
        });
      },

      endMatch: () => {
        set(state => ({
          liveMatch: state.liveMatch ? {
            ...state.liveMatch,
            status: 'completed' as MatchStatus,
          } : null,
        }));
      },

      resetMatch: () => {
        set({
          liveMatch: null,
          currentRecommendations: [],
          coinTossDecision: null,
          chatHistory: [],
        });
      },

      addChatMessage: (message: ChatMessage) => {
        set(state => ({
          chatHistory: [...state.chatHistory, message],
        }));
      },

      clearChatHistory: () => {
        set({ chatHistory: [] });
      },

      getCurrentGame: () => {
        const { liveMatch } = get();
        if (!liveMatch) return null;
        return liveMatch.games.find(g => g.gameNumber === liveMatch.currentGame) || null;
      },

      getMatchProgress: () => {
        const { liveMatch } = get();
        if (!liveMatch) return { gamesPlayed: 0, ourWins: 0, theirWins: 0 };
        
        const gamesPlayed = liveMatch.games.filter(g => g.result !== 'pending').length;
        const ourWins = liveMatch.games.filter(g => g.result === 'win').length;
        const theirWins = liveMatch.games.filter(g => g.result === 'loss').length;
        
        return { gamesPlayed, ourWins, theirWins };
      },
    }),
    {
      name: 'match-store',
      partialize: (state) => ({
        liveMatch: state.liveMatch,
      }),
    }
  )
);
