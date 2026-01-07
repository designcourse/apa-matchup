// Core data types for APA Match-Up App

export interface Team {
  id: number; // Internal APA ID (e.g., 12851377)
  number: string; // Team number (e.g., "84301")
  name: string;
  divisionId: number;
  leagueId?: number;
  leagueSlug?: string;
  format: 'NINE' | 'EIGHT';
  isOurTeam: boolean;
  sessionPoints?: number;
  lastSynced?: Date;
}

export interface Player {
  id: number; // Player alias ID (e.g., 90911771)
  memberId: number; // Member ID (e.g., 3359842)
  memberNumber: string; // Display number (e.g., "44526698")
  name: string;
  skillLevel: number;
  teamId: number;
  // Current session stats
  matchesPlayed: number;
  matchesWon: number;
  ppm: number; // Points per match
  pa: number; // Points awarded (decimal 0-1, multiply by 100 for %)
  winPct: number; // Calculated from matchesWon/matchesPlayed
  // Aggregated historical stats (last 4 sessions)
  historyMatchesPlayed?: number;
  historyMatchesWon?: number;
  historyWinPct?: number;
  historyPpm?: number;
  sessionsPlayed?: number; // Number of sessions with data
}

// Individual match result from player history
export interface PlayerMatchRecord {
  id: number;
  playerId: number;
  datePlayed: Date;
  won: boolean;
  skillLevel: number;
  pointsAwarded: number;
  pointsNeeded: number;
  opponentId: number;
  opponentName: string;
  opponentSkillLevel: number;
  matchWeek?: number;
}

// Session history for a player (stats per session)
export interface PlayerSessionStats {
  id?: number;
  playerId: number;
  memberId: number;
  sessionId: number;
  sessionName: string;
  sessionYear: number;
  teamId: number;
  teamName: string;
  skillLevel: number;
  matchesPlayed: number;
  matchesWon: number;
  ppm: number;
  pa: number;
  winPct: number;
}

export interface PlayerStats {
  id?: number;
  playerId: number;
  sessionId: string;
  sessionName?: string;
  skillLevel: number;
  matchesPlayed: number;
  matchesWon: number;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  pointsAwarded: number;
  ppm: number;
  winPct: number;
  defensiveShotAvg?: number;
  breakAndRunPct?: number;
  miniSlams?: number;
  nineOnSnap?: number;
  shutouts?: number;
}

export interface Match {
  id: number; // Match ID (e.g., 47949484)
  divisionId: number;
  week: number | null;
  homeTeamId: number;
  homeTeamName: string;
  homeTeamNumber: string;
  awayTeamId: number;
  awayTeamName: string;
  awayTeamNumber: string;
  scheduledDate: Date;
  hostLocationName: string;
  hostLocationId: number | null;
  isScored: boolean;
  status: 'COMPLETED' | 'UNPLAYED';
  homePoints?: number;
  awayPoints?: number;
  description?: string;
}

export interface GameResult {
  id?: number;
  matchId: number;
  gameNumber: number;
  playerId: number;
  playerName: string;
  playerTeamId: number;
  playerSkillLevel: number;
  opponentId: number;
  opponentName: string;
  opponentTeamId: number;
  opponentSkillLevel: number;
  pointsScored: number;
  pointsNeeded: number;
  won: boolean;
  playedAt: Date;
}

export interface HeadToHead {
  id?: number;
  playerId: number;
  opponentId: number;
  totalGames: number;
  wins: number;
  losses: number;
  avgPointsScored: number;
  avgPointsNeeded: number;
  lastPlayed: Date;
}

export interface SyncStatus {
  id: string;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
  lastError: string | null;
  teamsCount: number;
  playersCount: number;
  matchesCount: number;
}

// Match night types
export type MatchStatus = 'setup' | 'attendance' | 'coin_toss' | 'in_progress' | 'completed';

export interface LiveMatch {
  id: string;
  opponentTeamId: number;
  opponentTeamName: string;
  scheduledDate: Date;
  ourPlayersPresent: number[]; // Player IDs
  theirPlayersPresent: number[]; // Player IDs
  coinTossWinner: 'us' | 'them' | null;
  weThrowFirst: boolean | null;
  games: LiveGame[];
  currentGame: number;
  ourScore: number;
  theirScore: number;
  status: MatchStatus;
}

export interface LiveGame {
  gameNumber: number;
  ourPlayerId: number | null;
  theirPlayerId: number | null;
  result: 'win' | 'loss' | 'pending';
  ourPoints?: number;
  theirPoints?: number;
  recommendation?: MatchupRecommendation;
  wasRecommendationFollowed?: boolean;
}

export interface MatchupRecommendation {
  playerId: number;
  playerName: string;
  winProbability: number;
  confidence: number;
  reasoning: string[];
  factors: {
    skillLevelAdvantage: number;
    winPercentageDelta: number;
    headToHeadRecord: number;
    recentFormTrend: number;
    ppmEfficiency: number;
  };
}

export interface CoinTossDecision {
  recommendation: 'throw_first' | 'defer';
  confidence: number;
  reasoning: string[];
  suggestedFirstPlayer?: number;
}

// 9-ball specific
export interface SkillLevelRequirements {
  skillLevel: number;
  pointsNeeded: number;
}

// Division info
export interface Division {
  id: number;
  name?: string;
  sessionId?: string;
  sessionName?: string;
  leagueId?: number;
  format: 'NINE' | 'EIGHT';
}

// App Config stored in DB
export interface AppConfig {
  id: string;
  ourTeamId: number;
  ourTeamNumber: string;
  ourTeamName: string;
  divisionId: number;
  leagueId?: number;
  format: 'NINE' | 'EIGHT';
}
